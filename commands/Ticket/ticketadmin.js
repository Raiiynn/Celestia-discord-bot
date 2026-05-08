const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketadmin')
    .setDescription('Manage tickets')
    .addSubcommand(sub => sub.setName('list').setDescription('List all tickets'))
    .addSubcommand(sub => sub.setName('close').setDescription('Close a ticket')
      .addChannelOption(o => o.setName('channel').setDescription('Ticket channel').setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const channels = interaction.guild.channels.cache.filter(c => c.name.startsWith('ticket-'));

    if (subcommand === 'list') {
      const list = channels.map(c => `#${c.name}`).join('\n') || 'No tickets';
      await interaction.reply({ content: `**Tickets:**\n${list}`, ephemeral: true });
    }
    
    if (subcommand === 'close') {
      const channel = interaction.options.getChannel('channel');
      await channel.delete();
      await interaction.reply({ content: '✅ Ticket closed', ephemeral: true });
    }
  },
};