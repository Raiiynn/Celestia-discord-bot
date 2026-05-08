const storage = require('./storage');

const INVITE_REGEX = /discord(?:\.gg|app\.com\/invite|\.com\/invite)\/[a-zA-Z0-9\-]+/gi;

async function isUrlWhitelisted(guildId, url) {
  const whitelist = await storage.getWhitelistUrls(guildId);
  return whitelist.some(entry => url.includes(entry.url));
}

async function checkInvites(message, guildId, settings) {
  if (!settings?.invite_block) return null;

  const matches = message.content.match(INVITE_REGEX);
  if (!matches) return null;

  for (const invite of matches) {
    if (await isUrlWhitelisted(guildId, invite)) {
      return null;
    }
  }

  return { type: 'invite', severity: 1, content: matches[0] };
}

async function checkBadwords(message, guildId, settings) {
  if (!settings?.badword_block) return null;

  const badwords = await storage.getBadwords(guildId);
  if (badwords.length === 0) return null;

  const content = message.content.toLowerCase();

  for (const word of badwords) {
    let match = false;

    if (word.is_regex) {
      try {
        const regex = new RegExp(word.pattern, 'gi');
        match = regex.test(content);
      } catch (e) {
        console.error('[Moderation] Invalid regex pattern:', word.pattern);
      }
    } else {
      match = content.includes(word.pattern.toLowerCase());
    }

    if (match) {
      await storage.addViolation(guildId, message.author.id, 'badword', message.content, message.id, message.channelId);
      await storage.incrementStat(guildId, 'badwords_blocked');
      return { type: 'badword', severity: word.severity, pattern: word.pattern };
    }
  }

  return null;
}

async function checkSpam(message, guildId, settings) {
  if (!settings?.spam_block) return null;

  const patterns = await storage.getSpamPatterns(guildId);
  if (patterns.length === 0) return null;

  const content = message.content.toLowerCase();

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern.pattern, 'gi');
      if (regex.test(content)) {
        await storage.addViolation(guildId, message.author.id, 'spam', message.content, message.id, message.channelId);
        await storage.incrementStat(guildId, 'spam_blocked');
        return { type: 'spam', severity: pattern.severity, pattern: pattern.pattern };
      }
    } catch (e) {
      console.error('[Moderation] Invalid spam regex:', pattern.pattern);
    }
  }

  return null;
}

async function handleViolation(message, violation, guildId, settings) {
  const shouldDelete = settings?.auto_delete !== false;

  try {
    if (shouldDelete) {
      await message.delete();
    }
  } catch {}

  await storage.addViolation(
    guildId,
    message.author.id,
    violation.type,
    message.content,
    message.id,
    message.channelId
  );

  let warningCount = await storage.addWarning(guildId, message.author.id);

  const thresholdMute = settings?.warning_threshold_mute || 2;
  const thresholdKick = settings?.warning_threshold_kick || 3;
  const muteDuration = (settings?.mute_duration || 300) * 1000; // Convert to ms

  let action = null;
  let muteUntil = null;

  if (violation.severity >= 3 || warningCount >= thresholdKick) {
    action = 'kick';
    await storage.setWarningAction(guildId, message.author.id, action);
    await storage.incrementStat(guildId, 'kicks_given');
    try {
      await message.member?.kick(`Moderation: ${violation.type} (${warningCount} violations)`);
    } catch (e) {
      console.error('[Moderation] Could not kick user:', e.message);
    }
  } else if (violation.severity >= 2 || warningCount >= thresholdMute) {
    action = 'mute';
    muteUntil = new Date(Date.now() + muteDuration);
    await storage.setWarningAction(guildId, message.author.id, action, muteUntil.toISOString());
    await storage.incrementStat(guildId, 'mutes_given');
    
    try {
      const muteRole = message.guild?.roles.cache.find(r => r.name.toLowerCase().includes('mute'));
      if (muteRole) {
        await message.member?.roles.add(muteRole);
      }
    } catch (e) {
      console.error('[Moderation] Could not mute user:', e.message);
    }

    setTimeout(async () => {
      try {
        const muteRole = message.guild?.roles.cache.find(r => r.name.toLowerCase().includes('mute'));
        if (muteRole && message.member) {
          await message.member.roles.remove(muteRole);
        }
      } catch (e) {
        console.error('[Moderation] Could not auto-unmute user:', e.message);
      }
    }, muteDuration);
  } else {
    action = 'warn';
    await storage.setWarningAction(guildId, message.author.id, action);
    await storage.incrementStat(guildId, 'warnings_given');
  }

  return { action, warningCount, muteUntil };
}

function createViolationEmbed(violation, message, warningInfo) {
  const { EmbedBuilder } = require('discord.js');
  const { action, warningCount } = warningInfo;

  const typeEmojis = {
    invite: '🔗',
    badword: '🚫',
    spam: '📧',
  };

  const actionEmojis = {
    warn: '⚠️',
    mute: '🔇',
    kick: '🦵',
  };

  const embed = new EmbedBuilder()
    .setColor(action === 'kick' ? 0xFF0000 : action === 'mute' ? 0xFFA500 : 0xFFFF00)
    .setTitle(`${typeEmojis[violation.type]} ${violation.type.toUpperCase()} DETECTED`)
    .addFields(
      { name: 'User', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
      { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
      { name: 'Action', value: `${actionEmojis[action]} ${action.toUpperCase()}`, inline: true },
      { name: 'Violation Count', value: `${warningCount}`, inline: true },
      { name: 'Content', value: `\`\`\`${message.content.slice(0, 1000)}\`\`\`` }
    )
    .setTimestamp();

  return embed;
}

async function logToChannel(message, violation, warningInfo, settings) {
  if (!settings?.log_channel_id) return;

  try {
    const logChannel = message.guild?.channels.cache.get(settings.log_channel_id);
    if (!logChannel) return;

    const embed = createViolationEmbed(violation, message, warningInfo);
    await logChannel.send({ embeds: [embed] });
  } catch (e) {
    console.error('[Moderation] Error logging violation:', e.message);
  }
}

module.exports = {
  checkInvites,
  checkBadwords,
  checkSpam,
  handleViolation,
  logToChannel,
};
