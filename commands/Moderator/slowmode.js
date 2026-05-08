const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode for a channel')
    .addIntegerOption(o => o.setName('seconds').setDescription('Seconds (0 to disable)').setMinValue(0).setMaxValue(21600))
    .addChannelOption(o => o.setName('channel').setDescription('Channel')),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds') || 0;
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    
    await channel.setRateLimitPerUser(seconds);
    await interaction.reply({ content: `🐢 Slowmode set to ${seconds}s in ${channel}`, ephemeral: true });
  },
};