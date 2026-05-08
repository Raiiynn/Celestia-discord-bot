const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency'),

  async execute(interaction) {
    const ping = interaction.client.ws.ping;
    await interaction.reply({ content: `🏓 Pong! \`${ping}ms\`` });
  },
};