const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Lock/unlock a channel')
    .addStringOption(o => o.setName('mode').setDescription('Lock or unlock').setRequired(true)
      .addChoices({ name: 'lock', value: 'lock' }, { name: 'unlock', value: 'unlock' }))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to lock')),

  async execute(interaction) {
    const mode = interaction.options.getString('mode');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const lock = mode === 'lock';

    if (lock) {
      await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
    } else {
      await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null });
    }

    await interaction.reply({ content: `🔒 Channel ${lock ? 'locked' : 'unlocked'}`, ephemeral: true });
  },
};