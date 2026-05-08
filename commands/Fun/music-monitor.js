const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { buildMusicEmbed, updateMusicMonitor, isMusicBot } = require('../../utils/musicMonitor');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Music bot monitor commands')
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Show live music bot status embed in this channel')
    )
    .addSubcommand(sub =>
      sub.setName('bots')
        .setDescription('List all detected music bots')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    if (sub === 'status') {
      const embed = await buildMusicEmbed(interaction.guild);
      await interaction.editReply({ embeds: [embed] });

      await updateMusicMonitor(client).catch(() => {});
      return;
    }

    if (sub === 'bots') {
      await interaction.guild.members.fetch().catch(() => {});
      const bots = interaction.guild.members.cache.filter(isMusicBot);

      if (bots.size === 0) {
        return interaction.editReply('No music bots detected in this server.');
      }

      const lines = bots.map(b =>
        `• **${b.user.username}** (${b.user.id}) — ${b.presence?.status || 'offline'}`
      );

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎵 Music Bots (${bots.size})`)
        .setDescription(lines.join('\n'));

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
