const Discord = require('discord.js');

/**
 * @param {Discord.Guild} guild 
 * @param {Object} guildSettings 
 * @param {Discord.EmbedBuilder} embed 
 */
async function sendModLog(guild, guildSettings, embed) {
  if (!guildSettings?.logs_enabled || !guildSettings.logs_moderator) return;

  try {
    const channel = await guild.channels.fetch(guildSettings.logs_moderator).catch(() => null);
    if (channel && channel instanceof Discord.TextChannel) {
      await channel.send({ embeds: [embed] }).catch(err => 
        console.error('[ModLog] Error sending to channel:', err)
      );
    }
  } catch (err) {
    console.error('[ModLog] Error:', err);
  }
}

async function sendLog(guild, guildSettings, embed, channelType = 'logs_basic') {
  if (!guildSettings?.logs_enabled || !guildSettings[channelType]) return;

  try {
    const channel = await guild.channels.fetch(guildSettings[channelType]).catch(() => null);
    if (channel && channel instanceof Discord.TextChannel) {
      await channel.send({ embeds: [embed] }).catch(err =>
        console.error('[Log] Error sending to channel:', err)
      );
    }
  } catch (err) {
    console.error('[Log] Error:', err);
  }
}

function createInfractionEmbed(type, user, issuer, reason, duration) {
  const embed = new Discord.EmbedBuilder()
    .setColor('Red')
    .setTitle(`${type.charAt(0).toUpperCase() + type.slice(1)} - ${user.username}`)
    .addFields(
      { name: 'User', value: `<@${user.id}> (${user.id})`, inline: true },
      { name: 'Issuer', value: `<@${issuer.id}> (${issuer.id})`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided', inline: false },
      { name: 'Duration', value: duration || 'Permanent', inline: true }
    )
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();

  return embed;
}

module.exports = {
  sendModLog,
  sendLog,
  createInfractionEmbed,
};
