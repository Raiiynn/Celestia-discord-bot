const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('totalban')
    .setDescription('View total ban count'),

  async execute(interaction) {
    const bans = await interaction.guild.bans.fetch();
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🔨 Total Bans')
      .setDescription(`**${bans.size}** users are banned`);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};