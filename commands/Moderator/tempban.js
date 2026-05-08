const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Temporarily ban a user')
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addIntegerOption(o => o.setName('days').setDescription('Days to ban').setMinValue(1).setMaxValue(7))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const days = interaction.options.getInteger('days') || 1;
    const reason = interaction.options.getString('reason') || 'No reason';

    try {
      await interaction.guild.members.ban(user, { deleteMessageDays: days });
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('✅ Tempban Complete')
        .setDescription(`${user} banned for ${days} day(s)\nReason: ${reason}`);
      
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      await interaction.reply({ content: `❌ Error: ${e.message}`, ephemeral: true });
    }
  },
};