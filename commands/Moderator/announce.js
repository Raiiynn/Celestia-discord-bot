const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Announce a message to the server')
    .addStringOption(o => o.setName('message').setDescription('Message to announce').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to announce in')),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');
    const targetChannel = channel || interaction.channel;

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('📢 Server Announcement')
      .setDescription(message)
      .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await targetChannel.send({ embeds: [embed] });
    await interaction.reply({ content: `✅ Announced to ${targetChannel}`, ephemeral: true });
  },
};