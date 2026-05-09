const { EmbedBuilder } = require('discord.js');
const config  = require('../config');
const storage = require('./storage');

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

function getPrefix(member) {
  const act = member.presence?.activities?.[0];
  if (act?.details) {
    const m = act.details.match(/prefix[:\s]+([^\s,]+)/i);
    if (m) return m[1];
  }

  const nameLower = member.user.username.toLowerCase();
  for (const [fragment, prefix] of Object.entries(config.musicBotPrefixes)) {
    if (nameLower.includes(fragment)) return prefix;
  }
  return '/';
}

function getActivityText(member) {
  const act = member.presence?.activities?.[0];
  if (!act) return null;
  const txt = act.state || act.details || act.name || '';
  if (!txt || txt.toLowerCase().includes('prefix')) return null;
  return txt.slice(0, 50);
}

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

    const knownPrefix = Object.entries(config.musicBotPrefixes)
      .find(([frag]) => bot.user.username.toLowerCase().includes(frag))?.[1];
    const nameLine = knownPrefix
      ? `${i}. ${dot} **${bot.user.username}** ( ${knownPrefix} )`
      : `${i}. ${dot} **${bot.user.username}**`;

    if (vchan) {
      const actSuffix = actText
        ? ` — 🎵🎵 ${actText}`
        : ` — 🎵${prefix}help`;
      inVoice.push(`${nameLine}\n✅ Aktif di **${vchan.name}**${actSuffix}`);
    } else {
      notInVoice.push(`${nameLine}\n❌ Tidak di voice`);
    }
  }

  const allLines = [...inVoice, ...notInVoice];

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

  for (let c = 1; c < chunks.length; c++) {
    embed.addFields({ name: '🎵 Music Bots (cont.)', value: chunks[c], inline: false });
  }

  return embed;
}

async function updateGuildMusicMonitor(client, guild) {
  const guildSettings = await storage.getGuildMusicMonitor(guild.id);
  if (!guildSettings.music_monitor_enabled || !guildSettings.music_monitor_channel_id) {
    return;
  }

  const channel = guild.channels.cache.get(guildSettings.music_monitor_channel_id);
  if (!channel) {
    console.warn(`[MusicMonitor] Channel not found in guild ${guild.name} (${guild.id}): ${guildSettings.music_monitor_channel_id}`);
    return;
  }

  const embed = await buildMusicEmbed(guild);
  const channelId = channel.id;

  try {
    const cached = await storage.getMusicCache(channelId);

    if (cached?.message_id) {
      try {
        const msg = await channel.messages.fetch(cached.message_id);
        await msg.edit({ embeds: [embed] });
        console.log(`[MusicMonitor] Updated existing message in ${guild.name}`);
        return;
      } catch (err) {
        console.log(`[MusicMonitor] Message not found in ${guild.name}, searching for existing monitor message...`);

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
            console.log(`[MusicMonitor] Found and updated existing monitor message in ${guild.name}`);
            return;
          }
        } catch {}

        if (!cached?.message_id) {
          console.log(`[MusicMonitor] No cached message, sending first monitor message in ${guild.name}...`);
          const msg = await channel.send({ embeds: [embed] });
          await storage.saveMusicCache(channelId, msg.id);
          console.log(`[MusicMonitor] Sent initial monitor message in ${guild.name}: ${msg.id}`);
          return;
        }

        console.warn(`[MusicMonitor] Could not update or find message in ${guild.name} - skipping update`);
      }
    } else {
      console.log(`[MusicMonitor] No cache, sending first monitor message in ${guild.name}...`);
      const msg = await channel.send({ embeds: [embed] });
      await storage.saveMusicCache(channelId, msg.id);
      console.log(`[MusicMonitor] Sent initial monitor message in ${guild.name}: ${msg.id}`);
    }
  } catch (e) {
    console.error(`[MusicMonitor] Update failed for guild ${guild.name}:`, e.message);
  }
}

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

    if (cached?.message_id) {
      try {
        const msg = await channel.messages.fetch(cached.message_id);
        await msg.edit({ embeds: [embed] });
        console.log('[MusicMonitor] Updated existing message (no re-send)');
        return;
      } catch (err) {
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
      console.log('[MusicMonitor] No cache, sending first monitor message...');
      const msg = await channel.send({ embeds: [embed] });
      await storage.saveMusicCache(channelId, msg.id);
      console.log('[MusicMonitor] Sent initial monitor message:', msg.id);
    }
  } catch (e) {
    console.error('[MusicMonitor] Update failed:', e.message);
  }
}

module.exports = { buildMusicEmbed, updateMusicMonitor, updateGuildMusicMonitor, isMusicBot };
