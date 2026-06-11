const HoneypotManager = require('../lib/HoneypotManager');
const { buildBanEmbed } = require('../utils/banEmbed');

// Map to debounce updates per guild
const pending = new Map(); // guildId -> timeout

async function fetchBanCount(guild) {
  // Prefer stored stat in honeypot config
  try {
    const cfg = await HoneypotManager.getConfig(guild.id);
    if (cfg && Number.isInteger(cfg.total_bans)) return cfg.total_bans;
  } catch (e) {
    // ignore and fallback
  }

  // Fallback to fetching from API (expensive)
  try {
    const bans = await guild.bans.fetch();
    return bans.size;
  } catch (err) {
    return 0;
  }
}

async function doUpdate(guild, channelId, messageId) {
  const banCount = await fetchBanCount(guild);
  const embed = buildBanEmbed({
    guildName: guild.name,
    banCount,
    bilingual: true,
    footerText: `Auto Moderation - Honey Pot • ${new Date().toLocaleString()}`,
  });

  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) return;

    await msg.edit({ embeds: [embed] });
  } catch (err) {
    console.warn('[banEmbedUpdater] failed edit:', err && err.message ? err.message : err);
  }
}

function scheduleUpdate(guild, channelId, messageId, delay = 2000) {
  const key = guild.id;
  if (pending.has(key)) clearTimeout(pending.get(key));
  const t = setTimeout(() => {
    pending.delete(key);
    doUpdate(guild, channelId, messageId).catch(console.error);
  }, delay);
  pending.set(key, t);
}

module.exports = { scheduleUpdate, doUpdate };
