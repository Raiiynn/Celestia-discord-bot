const Discord = require('discord.js');

const EmbedGenerator = require('../../Functions/embedGenerator');
const { GuildsManager } = require('../../Classes/GuildsManager');

const Infractions = require('../../Schemas/Infractions');
const Tickets = require('../../Schemas/Tickets');

const ticketMenuData = new Map();

const TICKET_OPTIONS = {
    '📝': {
        title: 'General Question',
        description: 'Ask a general question or get help with basic information',
        color: 0x00ff00,
    },
    '👤': {
        title: 'Report User',
        description: 'Report a user for breaking rules or inappropriate behavior',
        color: 0xff0000,
    },
    '🐛': {
        title: 'Bug Report',
        description: 'Report a bug or issue with the server/bot',
        color: 0xff9900,
    },
    '🚨': {
        title: 'Emergency',
        description: 'Urgent matter requiring immediate staff attention',
        color: 0xff0000,
    },
    '💡': {
        title: 'Suggestion',
        description: 'Share your ideas to improve the server',
        color: 0x0099ff,
    },
    '🔒': {
        title: 'Account Issue',
        description: 'Problems with your account or permissions',
        color: 0xff6600,
    },
};

function sanitizeTicketChannelName(name) {
    const sanitized = name
        .replace(/[^a-zA-Z0-9\-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return (sanitized || 'ticket').slice(0, 100);
}

module.exports = {
    name: 'interactionCreate',
    /**
     * @param {Discord.Interaction} interaction
     */
    async execute(interaction) {
        if (interaction.isButton()) {
            const customId = interaction.customId;
            if (customId === 'open-ticket') return handleOpenTicket(interaction);
            if (customId === 'close-ticket') return handleCloseTicketButton(interaction);
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket-type-select') {
            return handleTicketTypeSelect(interaction);
        }
    },
};

const messageReactionAddEvent = {
    name: 'messageReactionAdd',
    async execute(reaction, user) {
        if (user.bot) return;

        const message = reaction.message;
        const emoji = reaction.emoji.toString();

        const menuData = ticketMenuData.get(message.id);
        if (!menuData) return;

        if (!TICKET_OPTIONS[emoji]) return;

        await reaction.users.remove(user).catch(() => null);

        await createTicketWithType(
            user,
            menuData.guild,
            menuData.channel,
            emoji,
            menuData.category,
            menuData.role
        );
    },
};

module.exports.ticketMenuData = ticketMenuData;
module.exports.TICKET_OPTIONS = TICKET_OPTIONS;
module.exports.createTicketWithType = createTicketWithType;

async function createTicketWithType(
    user,
    guild,
    ticketChannel,
    emoji,
    categoryId,
    staffRoleId,
    ticketId
) {
    const ticketOption = TICKET_OPTIONS[emoji];
    if (!ticketOption) return;

    try {
        await Tickets.updateOne({ _id: ticketId }, { $set: { type: ticketOption.title } });

        const ticketEmbed = new Discord.EmbedBuilder()
            .setColor(ticketOption.color)
            .setTitle(`${emoji} ${ticketOption.title}`)
            .setDescription(
                `**Ticket ID:** ${ticketId}\n**User:** ${user.tag} (${user.id})\n**Type:** ${ticketOption.title}\n\n**Please describe your issue below and wait for staff assistance.**`
            )
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp()
            .setFooter({
                text: `${guild.name} | Guardian Bot`,
                iconURL: guild.iconURL(),
            });

        const menuMessages = await ticketChannel.messages.fetch({ limit: 10 });
        const menuMessage = menuMessages.find(
            (msg) => msg.embeds.length > 0 && msg.embeds[0].title === '🎫 Select Ticket Type'
        );

        if (menuMessage) {
            const updatedMenuEmbed = new Discord.EmbedBuilder()
                .setTitle(`${emoji} ${ticketOption.title} - Ticket Created`)
                .setDescription(
                    `**Ticket Type:** ${ticketOption.title}\n**User:** ${user.tag} (${user.id})\n\n**Please describe your issue below and wait for staff assistance.**`
                )
                .setColor(ticketOption.color)
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp()
                .setFooter({
                    text: `${guild.name} | Guardian Bot`,
                    iconURL: guild.iconURL(),
                });

            await menuMessage.edit({
                embeds: [updatedMenuEmbed],
                content: `<@${user.id}>${staffRoleId ? ` | <@&${staffRoleId}>` : ''}`,
            });

            await menuMessage.reactions.removeAll().catch(() => null);
        }

        await ticketChannel.send({
            components: [
                new Discord.ActionRowBuilder().addComponents(
                    new Discord.ButtonBuilder()
                        .setCustomId('close-ticket')
                        .setEmoji('🔒')
                        .setLabel('Close Ticket')
                        .setStyle(Discord.ButtonStyle.Danger)
                ),
            ],
        });

        ticketMenuData.forEach((data, messageId) => {
            if (data.userId === user.id) {
                ticketMenuData.delete(messageId);
            }
        });
    } catch (err) {
        console.error('Error updating ticket:', err);
        try {
            await user.send({
                embeds: [
                    EmbedGenerator.errorEmbed(
                        'Failed to update ticket. Please contact staff directly.'
                    ),
                ],
            });
        } catch (err) {
        }
    }
}

async function handleOpenTicket(interaction) {
    const guild = await GuildsManager.fetch(interaction.guild.id);
    if (!guild.tickets.enabled)
        return interaction.reply({
            embeds: [EmbedGenerator.basicEmbed("This guild doesn't have ticket system enabled.")],
            ephemeral: true,
        });

    const blocked = await Infractions.findOne({
        guild: interaction.guild.id,
        user: interaction.user.id,
        type: 'block',
        active: true,
    });
    if (blocked)
        return interaction.reply({
            embeds: [EmbedGenerator.errorEmbed('You are blocked from creating tickets.')],
            ephemeral: true,
        });

    const existingTicket = await Tickets.findOne({
        guild: interaction.guild.id,
        user: interaction.user.id,
        active: true,
    });
    if (existingTicket)
        return interaction.reply({
            embeds: [EmbedGenerator.errorEmbed('You already have an open ticket.')],
            ephemeral: true,
        });

    const channelName = `ticket-${sanitizeTicketChannelName(interaction.user.username)}`;

    try {
        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            parent: guild.tickets.category,
            type: Discord.ChannelType.GuildText,
        });

        await ticketChannel.lockPermissions().catch(() => null);
        await ticketChannel.permissionOverwrites
            .edit(interaction.user.id, { ViewChannel: true, SendMessages: true })
            .catch(() => null);
        if (guild.tickets.role) {
            await ticketChannel.permissionOverwrites
                .edit(guild.tickets.role, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                })
                .catch(() => null);
        }

        const ticket = await Tickets.create({
            guild: interaction.guild.id,
            user: interaction.user.id,
            channel: ticketChannel.id,
        });

        const menuEmbed = new Discord.EmbedBuilder()
            .setTitle('🎫 Select Ticket Type')
            .setDescription('Please choose one below for a moderator:')
            .setColor(0x0099ff)
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({
                text: `${interaction.guild.name} | Guardian Bot`,
                iconURL: interaction.guild.iconURL(),
            });

        Object.entries(TICKET_OPTIONS).forEach(([emoji, option]) => {
            menuEmbed.addFields({
                name: `${emoji} ${option.title}`,
                value: option.description,
                inline: false,
            });
        });

        const menuMessage = await ticketChannel.send({
            content: `<@${interaction.user.id}>${guild.tickets.role ? ` | <@&${guild.tickets.role}>` : ''}`,
            embeds: [menuEmbed],
        });

        ticketMenuData.set(menuMessage.id, {
            guild: interaction.guild,
            channel: ticketChannel,
            category: guild.tickets.category,
            role: guild.tickets.role,
            userId: interaction.user.id,
            ticketId: ticket._id,
        });

        for (const emoji of Object.keys(TICKET_OPTIONS)) {
            await menuMessage.react(emoji).catch(() => null);
        }

        await interaction.reply({
            embeds: [EmbedGenerator.basicEmbed(`Ticket created, <#${ticketChannel.id}>`)],
            ephemeral: true,
        });
    } catch (err) {
        await interaction
            .reply({ embeds: [EmbedGenerator.errorEmbed()], ephemeral: true })
            .catch(() => null);
    }
}

async function handleTicketTypeSelect(interaction) {
    await interaction.reply({
        embeds: [EmbedGenerator.errorEmbed('Please use the emoji reactions instead.')],
        ephemeral: true,
    });
}

async function handleCloseTicketButton(interaction) {
    const guild = await GuildsManager.fetch(interaction.guild.id);
    if (!guild.tickets.enabled) return;

    const ticket = await Tickets.findOne({
        guild: interaction.guild.id,
        channel: interaction.channel.id,
        active: true,
    });
    if (!ticket)
        return interaction.reply({
            embeds: [EmbedGenerator.errorEmbed('This is not an active ticket channel.')],
            ephemeral: true,
        });

    const isStaff = guild.tickets.role && interaction.member.roles.cache.has(guild.tickets.role);
    const isCreator = ticket.user === interaction.user.id;
    if (!isStaff && !isCreator)
        return interaction.reply({
            embeds: [
                EmbedGenerator.errorEmbed(
                    'Only ticket staff or the ticket creator can close this ticket.'
                ),
            ],
            ephemeral: true,
        });

    await interaction.reply({
        embeds: [EmbedGenerator.basicEmbed('Closing this ticket…')],
        ephemeral: true,
    });

    const { closeTicketChannel } = require('../../Functions/ticketClose');
    await closeTicketChannel(
        interaction.client,
        interaction.guild,
        interaction.channel,
        ticket,
        interaction.user.id,
        guild.tickets.logChannel
    );
}
