const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const CATEGORIES = {
  moderation: {
    emoji: '🛡️',
    name: 'Moderation',
    commands: [
      { cmd: '/ban', desc: 'Ban a member from the server' },
      { cmd: '/kick', desc: 'Kick a member from the server' },
      { cmd: '/timeout', desc: 'Timeout a member' },
      { cmd: '/automod', desc: 'Configure automoderation' },
    ],
  },
  fun: {
    emoji: '🎮',
    name: 'Fun & Stats',
    commands: [
      { cmd: '/streak', desc: 'Track daily activity streaks' },
      { cmd: '/ask', desc: 'Ask AI a question' },
    ],
  },
  utilities: {
    emoji: '🎨',
    name: 'Utilities',
    commands: [
      { cmd: '/embed', desc: 'Create custom embed messages' },
      { cmd: '/music', desc: 'Music activity tracker' },
      { cmd: '/password', desc: 'Generate secure passwords' },
      { cmd: '/help', desc: 'Show this help menu' },
    ],
  },
  admin: {
    emoji: '💾',
    name: 'Admin',
    commands: [
      { cmd: '/backup', desc: 'Create/list server backups' },
      { cmd: '/logging', desc: 'Configure event logging' },
      { cmd: '/verification', desc: 'Setup verification system' },
      { cmd: '/maintenance', desc: 'Toggle maintenance mode' },
    ],
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show bot commands'),

  async execute(interaction) {
    await interaction.deferReply();
    const initialEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📋 Bot Commands')
      .setDescription('Select a category from the dropdown below')
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Select category')
      .addOptions(
        { label: '🛡️ Moderation', value: 'moderation' },
        { label: '🎮 Fun & Stats', value: 'fun' },
        { label: '🎨 Utilities', value: 'utilities' },
        { label: '💾 Admin', value: 'admin' },
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({ embeds: [initialEmbed], components: [row] });
  },

  async handleSelectMenu(interaction) {
    const category = interaction.values[0];
    const cat = CATEGORIES[category];

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${cat.emoji} ${cat.name}`)
      .setDescription('Select a category from the dropdown to see other commands')
      .setTimestamp();

    for (const cmd of cat.commands) {
      embed.addFields({ name: cmd.cmd, value: cmd.desc, inline: false });
    }

    embed.setFooter({ text: 'Total: 14 commands' });
    await interaction.update({ embeds: [embed] });
  },
};