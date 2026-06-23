// events/messageCreate.js — AutoMod + AFK + AI mention reply + Prefix commands

const config = require("../config");
const storage = require("../utils/storage");
const moderation = require("../utils/moderation");
const aiService = require("../services/aiService");
const { processHoneypotMessage } = require("../handlers/honeypotHandler");

// In-memory rate-limit: mencegah spam mention ke bot
const mentionCooldown = new Map();
const MENTION_COOLDOWN_MS = 5_000;

module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    if (!message.guild) return;
    if (message.author.bot) return;

    // ── HONEYPOT ─────────────────────────────────────────────────────────────
    try {
      const triggered = await processHoneypotMessage(message, client);
      if (triggered) return;
    } catch (err) {
      console.error("[HoneypotEvent]", err);
    }

    // ── AUTOMOD ──────────────────────────────────────────────────────────────
    const settings = await storage.getAutoMod(message.guildId);
    const canBypass = message.member?.permissions?.has("ManageMessages");

    if (!canBypass && settings) {
      if (settings.invite_block) {
        const v = await moderation.checkInvites(
          message,
          message.guildId,
          settings,
        );
        if (v) {
          const info = await moderation.handleViolation(
            message,
            v,
            message.guildId,
            settings,
          );
          await moderation.logToChannel(message, v, info, settings);
          const w = await message.channel.send(
            `⛔ <@${message.author.id}> Posting invite link tidak diizinkan! (${info.warningCount}/${settings.warning_threshold_kick || 3})`,
          );
          setTimeout(() => w.delete().catch(() => {}), 5000);
          return;
        }
      }

      if (settings.badword_block) {
        const v = await moderation.checkBadwords(
          message,
          message.guildId,
          settings,
        );
        if (v) {
          const info = await moderation.handleViolation(
            message,
            v,
            message.guildId,
            settings,
          );
          await moderation.logToChannel(message, v, info, settings);
          const w = await message.channel.send(
            `🚫 <@${message.author.id}> Konten tidak diizinkan! (${info.warningCount}/${settings.warning_threshold_kick || 3})`,
          );
          setTimeout(() => w.delete().catch(() => {}), 5000);
          return;
        }
      }

      if (settings.spam_block) {
        const v = await moderation.checkSpam(
          message,
          message.guildId,
          settings,
        );
        if (v) {
          const info = await moderation.handleViolation(
            message,
            v,
            message.guildId,
            settings,
          );
          await moderation.logToChannel(message, v, info, settings);
          const w = await message.channel.send(
            `📧 <@${message.author.id}> Spam terdeteksi! (${info.warningCount}/${settings.warning_threshold_kick || 3})`,
          );
          setTimeout(() => w.delete().catch(() => {}), 5000);
          return;
        }
      }
    }

    // ── AFK: hapus status saat user kirim pesan ───────────────────────────────
    const afkEntry = await storage.getAfk(message.author.id, message.guildId);
    if (afkEntry) {
      await storage.removeAfk(message.author.id, message.guildId);
      const r = await message.reply(
        `👋 Welcome back **${message.author.username}**! Your AFK status has been removed.`,
      );
      setTimeout(() => r.delete().catch(() => {}), 5000);
    }

    // ── AFK: notif kalau mention user yang lagi AFK ───────────────────────────
    if (message.mentions.users.size) {
      for (const [, user] of message.mentions.users) {
        if (user.id === message.author.id) continue;
        if (user.id === client.user?.id) continue; // skip bot itself
        const entry = await storage.getAfk(user.id, message.guildId);
        if (entry) {
          const since = Math.floor(new Date(entry.since).getTime() / 1000);
          await message.reply(
            `💤 **${user.username}** is AFK: *${entry.reason || "AFK"}* — <t:${since}:R>`,
          );
        }
      }
    }

    // ── AI: auto-reply saat bot di-mention ───────────────────────────────────
    if (client.user && message.mentions.users.has(client.user.id)) {
      await handleAiMention(message, client);
      return; // jangan lanjut ke prefix commands
    }

    // ── PREFIX COMMANDS ──────────────────────────────────────────────────────
    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content
      .slice(config.prefix.length)
      .trim()
      .split(/\s+/);
    const cmdName = args.shift().toLowerCase();
    const cmd = client.prefixCmds.get(cmdName);
    if (!cmd) return;

    try {
      await cmd.executePrefix(message, args, client);
    } catch (e) {
      console.error(`[Prefix Error] ${cmdName}:`, e);
      message.reply("❌ An error occurred.").catch(() => {});
    }
  },
};

// ─── AI mention handler ───────────────────────────────────────────────────────

async function handleAiMention(message, client) {
  // Rate limit ─────────────────────────────────────────────────────────────────
  if (mentionCooldown.has(message.author.id)) return;
  mentionCooldown.set(message.author.id, true);
  setTimeout(
    () => mentionCooldown.delete(message.author.id),
    MENTION_COOLDOWN_MS,
  );

  // Ambil AI config guild ───────────────────────────────────────────────────────
  const aiConfig = await storage.getAiConfig(message.guildId).catch(() => null);

  // Cek channel restriction ─────────────────────────────────────────────────────
  // Kalau channel_id diset tapi pesan bukan dari sana → diam
  if (aiConfig?.channel_id && message.channelId !== aiConfig.channel_id) {
    return;
  }

  // Ambil pertanyaan (hapus semua @mention) ─────────────────────────────────────
  const input = message.content.replace(/<@!?\d+>/g, "").trim();

  if (!input) {
    await message.reply("Halo! Ada yang bisa saya bantu? 😊").catch(() => {});
    return;
  }

  // Guard: API key ──────────────────────────────────────────────────────────────
  if (!config.openRouterKey && !process.env.OPENROUTER_API_KEY) {
    await message
      .reply("❌ `OPENROUTER_API_KEY` belum dikonfigurasi.")
      .catch(() => {});
    return;
  }

  // Typing indicator (refresh tiap 9 detik supaya tidak hilang) ─────────────────
  await message.channel.sendTyping().catch(() => {});
  const typingInterval = setInterval(
    () => message.channel.sendTyping().catch(() => {}),
    9_000,
  );

  try {
    const history = await storage.getAiHistory(message.author.id);
    const systemPrompt = aiService.buildSystemPrompt(aiConfig?.persona ?? null);
    const aiReply = await aiService.callOpenRouter(
      systemPrompt,
      history,
      input,
    );

    clearInterval(typingInterval);

    // Simpan history
    const newHistory = aiService.appendHistory(history, input, aiReply);
    await storage.saveAiHistory(message.author.id, newHistory);

    // Kirim — split kalau terlalu panjang
    const parts = aiService.splitMessage(aiReply);
    await message.reply(parts[0]);
    for (const part of parts.slice(1)) {
      await message.channel.send(part);
    }
  } catch (err) {
    clearInterval(typingInterval);
    console.error("[MentionAI]", err.message);
    await message
      .reply(`❌ **Gagal mendapat respons AI**\n\`\`\`\n${err.message}\n\`\`\``)
      .catch(() => {});
  }
}
