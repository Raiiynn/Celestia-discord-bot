const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('User information')
    .addUserOption(o => o.setName('user').setDescription('User to check')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild?.members.cache.get(user.id);
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(user.username)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: '🆔 ID', value: user.id, inline: true },
        { name: '📅 Joined Discord', value: `<t:${Math.floor(user.createdTimestamp/1000)}>`, inline: true },
      )
      .setTimestamp();

    if (member) {
      embed.addFields({ name: '📅 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp/1000)}>` });
    }

    await interaction.reply({ embeds: [embed] });
  },
};