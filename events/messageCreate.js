// events/messageCreate.js — Advanced AutoMod + AFK watcher + Prefix commands
const config       = require('../config');
const storage      = require('../utils/storage');
const moderation   = require('../utils/moderation');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message.guild) return;
    if (message.author.bot) return;

    // ── MODERATION: Get settings once ──────────────────────────────────────────
    const settings = await storage.getAutoMod(message.guildId);
    const canBypass = message.member?.permissions?.has('ManageMessages');

    // Skip moderation checks for admins/mods
    if (!canBypass && settings) {
      // Check for invite links
      if (settings.invite_block) {
        const inviteViolation = await moderation.checkInvites(message, message.guildId, settings);
        if (inviteViolation) {
          const warningInfo = await moderation.handleViolation(message, inviteViolation, message.guildId, settings);
          await moderation.logToChannel(message, inviteViolation, warningInfo, settings);

          // Send warning to user
          const warn = await message.channel.send(
            `⛔ <@${message.author.id}> Posting invite link tidak diizinkan di server ini! (${warningInfo.warningCount}/${settings.warning_threshold_kick || 3})`
          );
          setTimeout(() => warn.delete().catch(() => {}), 5000);
          return;
        }
      }

      // Check for bad words
      if (settings.badword_block) {
        const badwordViolation = await moderation.checkBadwords(message, message.guildId, settings);
        if (badwordViolation) {
          const warningInfo = await moderation.handleViolation(message, badwordViolation, message.guildId, settings);
          await moderation.logToChannel(message, badwordViolation, warningInfo, settings);

          const warn = await message.channel.send(
            `🚫 <@${message.author.id}> Konten tidak diizinkan! (${warningInfo.warningCount}/${settings.warning_threshold_kick || 3})`
          );
          setTimeout(() => warn.delete().catch(() => {}), 5000);
          return;
        }
      }

      // Check for spam patterns
      if (settings.spam_block) {
        const spamViolation = await moderation.checkSpam(message, message.guildId, settings);
        if (spamViolation) {
          const warningInfo = await moderation.handleViolation(message, spamViolation, message.guildId, settings);
          await moderation.logToChannel(message, spamViolation, warningInfo, settings);

          const warn = await message.channel.send(
            `📧 <@${message.author.id}> Spam terdeteksi! (${warningInfo.warningCount}/${settings.warning_threshold_kick || 3})`
          );
          setTimeout(() => warn.delete().catch(() => {}), 5000);
          return;
        }
      }
    }

    // ── AFK: remove status when user sends a message ──────────────────────────
    const afkEntry = await storage.getAfk(message.author.id, message.guildId);
    if (afkEntry) {
      await storage.removeAfk(message.author.id, message.guildId);
      const reply = await message.reply(`👋 Welcome back **${message.author.username}**! Your AFK status has been removed.`);
      setTimeout(() => reply.delete().catch(() => {}), 5000);
    }

    // ── AFK: notify when mentioning someone AFK ───────────────────────────────
    if (message.mentions.users.size) {
      for (const [, user] of message.mentions.users) {
        if (user.id === message.author.id) continue;
        const entry = await storage.getAfk(user.id, message.guildId);
        if (entry) {
          const since = Math.floor(new Date(entry.since).getTime() / 1000);
          await message.reply(`💤 **${user.username}** is AFK: *${entry.reason || 'AFK'}* — <t:${since}:R>`);
        }
      }
    }

    // ── Prefix command parsing ────────────────────────────────────────────────
    if (!message.content.startsWith(config.prefix)) return;

    const args    = message.content.slice(config.prefix.length).trim().split(/\s+/);
    const cmdName = args.shift().toLowerCase();
    const cmd     = client.prefixCmds.get(cmdName);
    if (!cmd) return;

    try {
      await cmd.executePrefix(message, args, client);
    } catch (e) {
      console.error(`[Prefix Error] ${cmdName}:`, e);
      message.reply('❌ An error occurred.').catch(() => {});
    }
  },
};
