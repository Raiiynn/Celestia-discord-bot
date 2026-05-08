const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create and send a customizable embed message')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('description').setDescription('Main body text').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('Embed title'))
    .addStringOption(o => o.setName('color').setDescription('Hex color e.g. #5865F2'))
    .addStringOption(o => o.setName('footer').setDescription('Footer text'))
    .addStringOption(o => o.setName('thumbnail').setDescription('Thumbnail image URL'))
    .addStringOption(o => o.setName('image').setDescription('Large image URL'))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to send to (default: current)')),

  async execute(interaction) {
    const desc      = interaction.options.getString('description');
    const title     = interaction.options.getString('title');
    const colorHex  = interaction.options.getString('color') || '#5865F2';
    const footer    = interaction.options.getString('footer');
    const thumbnail = interaction.options.getString('thumbnail');
    const image     = interaction.options.getString('image');
    const channel   = interaction.options.getChannel('channel') || interaction.channel;

    const color = parseInt(colorHex.replace('#', ''), 16) || 0x5865F2;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(desc)
      .setTimestamp();

    if (title)     embed.setTitle(title);
    if (footer)    embed.setFooter({ text: footer });
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (image)     embed.setImage(image);

    try {
      await channel.send({ embeds: [embed] });
      await interaction.reply({ content: `✅ Embed sent to <#${channel.id}>!`, ephemeral: true });
    } catch {
      await interaction.reply({ content: `❌ Couldn't send to <#${channel.id}>.`, ephemeral: true });
    }
  },
};