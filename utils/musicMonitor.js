// utils/musicMonitor.js — Live music bot monitor (matches screenshot exactly)
const { EmbedBuilder } = require('discord.js');
const config  = require('../config');
const storage = require('./storage');

// ── Helpers ───────────────────────────────────────────────────────────────────

function isMusicBot(member) {
  if (!member.user.bot) return false;
  const name = (member.user.username + ' ' + (member.nickname || '')).toLowerCase();
  return config.musicBotKeywords.some(k => name.includes(k));
}

function getBotVoiceMap(guild) {
  const map = new Map();
  for (const [, channel] of guild.channels.cache) {
    if (!channel.isVoiceBased()) continue;
    for (const [, member] of channel.members) {
      if (member.user.bot) map.set(member.id, channel);
    }
  }
  return map;
}

/**
 * Determine the command prefix for a music bot.
 * Priority: activity details → known prefix map → fallback "/"
 */
function getPrefix(member) {
  // Check activity for a prefix hint
  const act = member.presence?.activities?.[0];
  if (act?.details) {
    const m = act.details.match(/prefix[:\s]+([^\s,]+)/i);
    if (m) return m[1];
  }

  // Known prefix map (config)
  const nameLower = member.user.username.toLowerCase();
  for (const [fragment, prefix] of Object.entries(config.musicBotPrefixes)) {
    if (nameLower.includes(fragment)) return prefix;
  }
  return '/';
}

/**
 * Get the activity text for a bot that is currently playing something.
 * Returns null if nothing notable.
 */
function getActivityText(member) {
  const act = member.presence?.activities?.[0];
  if (!act) return null;
  const txt = act.state || act.details || act.name || '';
  if (!txt || txt.toLowerCase().includes('prefix')) return null;
  return txt.slice(0, 50);
}

// ── Build Embed ───────────────────────────────────────────────────────────────

/**
 * Builds the live music monitor embed that mirrors the screenshot layout.
 *
 * Layout per bot:
 *   N. 🟢 BotName ( prefix )
 *   ✅ Aktif di ChannelName — 🎵prefix+help
 *
 *   N. 🟡 BotName ( prefix )
 *   ❌ Tidak di voice
 */
async function buildMusicEmbed(guild) {
  if (guild.memberCount > guild.members.cache.size) {
    await guild.members.fetch().catch(() => {});
  }

  const voiceMap  = getBotVoiceMap(guild);
  const musicBots = guild.members.cache.filter(isMusicBot);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  if (musicBots.size === 0) {
    return new EmbedBuilder()
      .setColor(0x2B2D31)
      .setAuthor({ name: '🎵 Music Bot Monitor' })
      .setDescription(`Live monitoring of **${guild.name}**\n\n*No music bots found in this server.*`)
      .setFooter({ text: `Updates every 30 seconds • Today at ${timeStr}` });
  }

  // Build lines list — split into two arrays: in-voice and not-in-voice
  const inVoice    = [];
  const notInVoice = [];
  let i = 0;

  for (const [, bot] of musicBots) {
    i++;
    const vchan    = voiceMap.get(bot.id);
    const prefix   = getPrefix(bot);
    const actText  = getActivityText(bot);
    const status   = bot.presence?.status;
    const isOnline = status === 'online' || status === 'idle';
    const dot      = isOnline ? '🟢' : '🟡';

    // Line 1: number + dot + bold name + prefix in parens (no backticks)
    // Only show "( prefix )" if the bot has a known prefix in our config map
    const knownPrefix = Object.entries(config.musicBotPrefixes)
      .find(([frag]) => bot.user.username.toLowerCase().includes(frag))?.[1];
    const nameLine = knownPrefix
      ? `${i}. ${dot} **${bot.user.username}** ( ${knownPrefix} )`
      : `${i}. ${dot} **${bot.user.username}**`;

    if (vchan) {
      // Line 2: active — no backticks on prefix, matches screenshot exactly
      const actSuffix = actText
        ? ` — 🎵🎵 ${actText}`
        : ` — 🎵${prefix}help`;
      inVoice.push(`${nameLine}\n✅ Aktif di **${vchan.name}**${actSuffix}`);
    } else {
      notInVoice.push(`${nameLine}\n❌ Tidak di voice`);
    }
  }

  const allLines = [...inVoice, ...notInVoice];

  // Split into chunks of 10 for embed field limit
  const CHUNK = 10;
  const chunks = [];
  for (let c = 0; c < allLines.length; c += CHUNK) {
    chunks.push(allLines.slice(c, c + CHUNK).join('\n\n'));
  }

  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setAuthor({ name: '🎵 Music Bot Monitor' })
    .setDescription(
      `Live monitoring of **${guild.name}**\n\n` +
      `🎵 **Music Bots**\n\n${chunks[0]}`
    )
    .setFooter({ text: `Updates every 30 seconds • Today at ${timeStr}` });

  // Additional chunks as fields (mirrors "Music Bots (cont.)" in screenshot)
  for (let c = 1; c < chunks.length; c++) {
    embed.addFields({ name: '🎵 Music Bots (cont.)', value: chunks[c], inline: false });
  }

  return embed;
}

// ── Update pinned monitor message ─────────────────────────────────────────────

async function updateMusicMonitor(client) {
  const channelId = config.musicMonitorChannelId;
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel) {
    console.warn('[MusicMonitor] Channel not found:', channelId);
    return;
  }

  const embed = await buildMusicEmbed(channel.guild);

  try {
    const cached = await storage.getMusicCache(channelId);

    // Jika sudah ada cache → edit message yang sama
    if (cached?.message_id) {
      try {
        const msg = await channel.messages.fetch(cached.message_id);
        await msg.edit({ embeds: [embed] });
        console.log('[MusicMonitor] Updated existing message (no re-send)');
        return;
      } catch (err) {
        // Message dihapus atau error — cari message lain dari bot di channel
        console.log('[MusicMonitor] Message not found, searching for existing monitor message...');
        
        try {
          const allMessages = await channel.messages.fetch({ limit: 50 });
          const existingMonitor = allMessages.find(m => 
            m.author.id === client.user?.id && 
            m.embeds.length > 0 && 
            m.embeds[0].author?.name?.includes('Music Bot Monitor')
          );

          if (existingMonitor) {
            await existingMonitor.edit({ embeds: [embed] });
            await storage.saveMusicCache(channelId, existingMonitor.id);
            console.log('[MusicMonitor] Found and updated existing monitor message');
            return;
          }
        } catch {}
        
        // Jika tidak ada message sama sekali → send satu kali saja
        if (!cached?.message_id) {
          console.log('[MusicMonitor] No cached message, sending first monitor message...');
          const msg = await channel.send({ embeds: [embed] });
          await storage.saveMusicCache(channelId, msg.id);
          console.log('[MusicMonitor] Sent initial monitor message:', msg.id);
          return;
        }
        
        console.warn('[MusicMonitor] Could not update or find message - skipping update');
      }
    } else {
      // First time - send initial message
      console.log('[MusicMonitor] No cache, sending first monitor message...');
      const msg = await channel.send({ embeds: [embed] });
      await storage.saveMusicCache(channelId, msg.id);
      console.log('[MusicMonitor] Sent initial monitor message:', msg.id);
    }
  } catch (e) {
    console.error('[MusicMonitor] Update failed:', e.message);
  }
}

module.exports = { buildMusicEmbed, updateMusicMonitor, isMusicBot };
