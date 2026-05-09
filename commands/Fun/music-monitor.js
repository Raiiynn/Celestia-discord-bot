const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { buildMusicEmbed, updateGuildMusicMonitor, isMusicBot } = require('../../utils/musicMonitor');
const storage = require('../../utils/storage');

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
    )
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Enable music bot monitoring in this server')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to post the monitor')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable music bot monitoring in this server')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    if (sub === 'status') {
      const embed = await buildMusicEmbed(interaction.guild);
      await interaction.editReply({ embeds: [embed] });

      await updateGuildMusicMonitor(client, interaction.guild).catch(() => {});
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

    if (sub === 'enable') {
      const channel = interaction.options.getChannel('channel');

      await storage.setGuildMusicMonitor(interaction.guild.id, channel.id, true);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Music Monitor Enabled')
        .setDescription(`Music bot monitoring will be posted in ${channel}. This updates every 30 seconds.`)
        .setFooter({ text: 'Use /music disable to turn off monitoring' });

      await interaction.editReply({ embeds: [embed] });

      await updateGuildMusicMonitor(client, interaction.guild).catch(console.error);
      return;
    }

    if (sub === 'disable') {
      await storage.disableGuildMusicMonitor(interaction.guild.id);

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('✅ Music Monitor Disabled')
        .setDescription('Music bot monitoring has been turned off for this server.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  },
};
