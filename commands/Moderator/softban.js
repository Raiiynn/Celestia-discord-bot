const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Soft ban a user (kick + delete messages)')
    .addUserOption(o => o.setName('user').setDescription('User to softban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ content: '❌ User not found in server', ephemeral: true });
    }

    try {
      await member.kick(reason);
      const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('✅ Softban Complete')
        .setDescription(`${user} has been softbanned`);
      
      await interaction.reply({ embeds: [embed] });
    } catch (e) {
      await interaction.reply({ content: `❌ Error: ${e.message}`, ephemeral: true });
    }
  },
};