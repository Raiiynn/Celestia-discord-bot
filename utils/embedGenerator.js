/**
 * Embed Generator - Create formatted Discord embeds
 * Ported from Guardian bot with Supabase compatibility
 */

const Discord = require('discord.js');
const ms = require('ms');

/**
 * Create a basic success embed
 */
function basicEmbed(description) {
  const embed = new Discord.EmbedBuilder().setColor('Green');
  if (description) embed.setDescription(description);
  return embed;
}

/**
 * Create an error embed
 */
function errorEmbed(description = 'There was an error.') {
  return new Discord.EmbedBuilder().setColor('Red').setDescription(description);
}

/**
 * Create an infraction embed
 */
function infractionEmbed(guild, issuer, type, duration, expires, reason = 'Unspecified reason.') {
  let durationString;
  let expiresString;

  if (!duration || isNaN(duration)) {
    durationString = 'N/A';
    expiresString = 'N/A';
  } else if (!isFinite(duration)) {
    durationString = 'Permanent';
    expiresString = 'N/A';
  } else {
    durationString = ms(duration, { long: true });
    expiresString = `<t:${Math.floor(expires / 1000)}:R>`;
  }

  return new Discord.EmbedBuilder()
    .setColor('Blue')
    .setTitle(`${type} | Infraction`)
    .setThumbnail(guild.iconURL())
    .setDescription(
      [
        `You have been issued a ${type.toLowerCase()} in **${guild.name}**`,
        '',
        `**Issuer**: <@${issuer}>`,
        `**Duration**: ${durationString}`,
        `**Expires**: ${expiresString}`,
        `**Reason**: ${reason}`,
      ].join('\n')
    )
    .setTimestamp();
}

/**
 * Create a paginated embed with buttons
 */
async function pagesEmbed(interaction, embeds, ephemeral = false) {
  if (embeds.length === 0)
    return interaction.reply({ content: 'There was an error.', ephemeral: true });
  
  if (embeds.length === 1) {
    return interaction.reply({
      embeds: [embeds[0].setFooter({ text: 'Page 1/1' })],
      ephemeral: ephemeral,
    });
  }

  let page = 0;
  const replyPayload = {
    embeds: [embeds[page].setFooter({ text: `Page ${page + 1}/${embeds.length}` })],
    components: [
      new Discord.ActionRowBuilder().addComponents([
        new Discord.ButtonBuilder()
          .setCustomId('previous')
          .setEmoji('◀️')
          .setStyle(Discord.ButtonStyle.Primary),
        new Discord.ButtonBuilder()
          .setCustomId('next')
          .setEmoji('▶️')
          .setStyle(Discord.ButtonStyle.Primary),
      ]),
    ],
  };

  const reply = await interaction.reply(replyPayload);

  const collector = reply.createMessageComponentCollector({
    componentType: Discord.ComponentType.Button,
    time: 60000,
  });

  collector.on('collect', async (collected) => {
    if (collected.user.id !== interaction.user.id) {
      collected.reply({ content: 'You cannot use this button.', ephemeral: true });
      return;
    }

    if (collected.customId === 'previous') {
      page = (page - 1 + embeds.length) % embeds.length;
    } else if (collected.customId === 'next') {
      page = (page + 1) % embeds.length;
    }

    await collected.update({
      embeds: [embeds[page].setFooter({ text: `Page ${page + 1}/${embeds.length}` })],
    });
  });

  collector.on('end', () => {
    replyPayload.components = [];
  });
}

module.exports = {
  basicEmbed,
  errorEmbed,
  infractionEmbed,
  pagesEmbed,
};
