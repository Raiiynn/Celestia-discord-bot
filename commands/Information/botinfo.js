const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Bot information'),

  async execute(interaction) {
    const client = interaction.client;
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(client.user.username)
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: '🏓 Ping', value: `${client.ws.ping}ms`, inline: true },
        { name: '📊 Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: '⏱️ Uptime', value: `${hours}h ${minutes}m`, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};