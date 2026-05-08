const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../lib/db');

async function createTicketDB(guildId, userId, channelId, reason) {
  const { data, error } = await db.from('tickets').insert({
    guild_id: guildId,
    user_id: userId,
    channel_id: channelId,
    reason: reason,
    status: 'open',
    created_at: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return data;
}

async function getTicketDB(guildId, channelId) {
  const { data } = await db.from('tickets').select('*').eq('guild_id', guildId).eq('channel_id', channelId).single();
  return data;
}

async function closeTicketDB(guildId, channelId, transcript) {
  const { error } = await db.from('tickets').update({
    status: 'closed',
    closed_at: new Date().toISOString(),
    transcript: transcript,
  }).eq('guild_id', guildId).eq('channel_id', channelId);
  if (error) throw error;
}

async function getGuildTicketsDB(guildId) {
  const { data } = await db.from('tickets').select('*').eq('guild_id', guildId).eq('status', 'open');
  return data || [];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system')
    .addSubcommand(sub => sub.setName('create').setDescription('Create a ticket')
      .addStringOption(o => o.setName('reason').setDescription('Reason')))
    .addSubcommand(sub => sub.setName('close').setDescription('Close ticket')
      .addChannelOption(o => o.setName('channel').setDescription('Ticket channel')))
    .addSubcommand(sub => sub.setName('list').setDescription('List open tickets'))
    .addSubcommand(sub => sub.setName('setup').setDescription('Setup ticket system')
      .addChannelOption(o => o.setName('category').setDescription('Category').setRequired(true))
      .addChannelOption(o => o.setName('logs').setDescription('Log channel'))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'setup') {
      const category = interaction.options.getChannel('category');
      const logs = interaction.options.getChannel('logs');
      
      await db.from('guilds').upsert({
        guild_id: guild.id,
        ticket_category: category.id,
        ticket_logs: logs?.id,
        updated_at: new Date().toISOString(),
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎫 Ticket System Setup')
        .addFields(
          { name: 'Category', value: category.toString(), inline: true },
          { name: 'Logs', value: logs?.toString() || 'Not set', inline: true },
        );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'create') {
      const reason = interaction.options.getString('reason') || 'No reason';
      const user = interaction.user;
      
      const existingTickets = await getGuildTicketsDB(guild.id);
      const userHasTicket = existingTickets.find(t => t.user_id === user.id && t.status === 'open');
      if (userHasTicket) {
        const existingChannel = guild.channels.cache.get(userHasTicket.channel_id);
        return interaction.reply({ content: `⚠️ You already have a ticket: ${existingChannel}`, ephemeral: true });
      }

      const guildData = await db.from('guilds').select('ticket_category').eq('guild_id', guild.id).single();
      const categoryId = guildData?.data?.ticket_category;

      const channelName = `ticket-${user.username.toLowerCase()}-${user.id.slice(-4)}`;
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: 0,
        parent: categoryId,
        permissionOverwrites: [
          { id: guild.id, deny: ['ViewChannel'] },
          { id: user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        ],
      });

      await createTicketDB(guild.id, user.id, ticketChannel.id, reason);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎫 New Ticket')
        .setDescription(`**User:** ${user}\n**Reason:** ${reason}`)
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId('ticket-close').setLabel('Close').setStyle(ButtonStyle.Danger),
        );

      await ticketChannel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
    }

    if (subcommand === 'close') {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const ticket = await getTicketDB(guild.id, channel.id);
      
      if (!ticket || ticket.status === 'closed') {
        return interaction.reply({ content: '❌ Ticket not found or already closed', ephemeral: true });
      }

      const messages = await channel.messages.fetch({ limit: 100 });
      const transcript = messages.reverse().map(m => 
        `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.username}: ${m.content}`
      ).join('\n');

      await closeTicketDB(guild.id, channel.id, transcript);

      const user = await guild.users.fetch(ticket.user_id);
      const guildData = await db.from('guilds').select('ticket_logs').eq('guild_id', guild.id).single();
      const logChannel = guildData?.data?.ticket_logs;

      const transcriptEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('🎫 Ticket Closed')
        .addFields(
          { name: 'Channel', value: channel.name, inline: true },
          { name: 'User', value: user?.toString() || ticket.user_id, inline: true },
          { name: 'Created', value: `<t:${Math.floor(new Date(ticket.created_at).getTime()/1000)}>`, inline: true },
        )
        .setDescription(transcript.slice(0, 3800))
        .setTimestamp();

      if (logChannel) {
        const logCh = guild.channels.cache.get(logChannel);
        if (logCh) await logCh.send({ embeds: [transcriptEmbed] });
      }

      if (user) {
        try {
          await user.send({ embeds: [transcriptEmbed] });
        } catch (e) {
          console.log('[Ticket] Could not DM user');
        }
      }

      await channel.delete();
      await interaction.reply({ content: '✅ Ticket closed and transcript saved', ephemeral: true });
    }

    if (subcommand === 'list') {
      const tickets = await getGuildTicketsDB(guild.id);
      
      if (tickets.length === 0) {
        return interaction.reply({ content: 'No open tickets', ephemeral: true });
      }

      const list = await Promise.all(tickets.map(async t => {
        const channel = guild.channels.cache.get(t.channel_id);
        const user = await guild.users.fetch(t.user_id);
        return `#${channel?.name || t.channel_id} - ${user?.username || t.user_id} (${t.reason})`;
      }));

      await interaction.reply({ content: `**Open Tickets:**\n${list.join('\n')}`, ephemeral: true });
    }
  },
};