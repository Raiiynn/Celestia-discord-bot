const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('isbanned')
    .setDescription('Check if a user is banned')
    .addStringOption(o => o.setName('user_id').setDescription('User ID to check').setRequired(true)),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    const bans = await interaction.guild.bans.fetch();
    const isBanned = bans.has(userId);
    
    await interaction.reply({
      content: isBanned ? `✅ User <@${userId}> is **banned**` : `❌ User <@${userId}> is **not banned**`,
      ephemeral: true,
    });
  },
};