const Discord = require('discord.js');

const EmbedGenerator = require('./embedGenerator');
const Tickets = require('../Schemas/Tickets');

const baseUrl = () =>
    process.env.LIVE === 'true' ? 'https://guardianbot.space' : 'http://localhost:3001';

/**
 * @param {import('mongoose').Document} ticket 
 * @param {Discord.Client} client
 * @returns {Promise<string>}
 */
async function buildTranscriptText(ticket, client) {
    const lines = [
        `Ticket ${ticket._id} | Guild ${ticket.guild}`,
        '---',
        '',
    ];
    for (const m of ticket.messages || []) {
        const user = await client.users.fetch(m.user).catch(() => null);
        const tag = user ? user.tag : `User ${m.user}`;
        const time = m.time ? new Date(m.time).toISOString() : '';
        lines.push(`[${time}] ${tag}: ${(m.message || '').replace(/\n/g, ' ')}`);
        if (m.images && m.images.length) {
            lines.push(`  Attachments: ${m.images.join(', ')}`);
        }
    }
    return lines.join('\n');
}

/**
 * @param {Discord.Client} client
 * @param {Discord.Guild} guild
 * @param {Discord.TextChannel} channel 
 * @param {import('mongoose').Document} ticket 
 * @param {string} closedByUserId
 * @param {string} [logChannelId] 
 */
async function closeTicketChannel(client, guild, channel, ticket, closedByUserId, logChannelId) {
    const participantIds = new Set([
        closedByUserId,
        ticket.user,
        ...(ticket.messages || []).map((m) => m.user),
    ]);

    await Tickets.updateOne(
        { guild: guild.id, channel: channel.id },
        {
            $set: { active: false },
            $push: {
                messages: {
                    user: closedByUserId,
                    message: 'This ticket has been closed.',
                    time: Date.now(),
                },
            },
        }
    );

    let transcriptText = null;
    try {
        transcriptText = await buildTranscriptText(ticket, client);
    } catch (_) {}

    const transcriptAttachment =
        transcriptText &&
        new Discord.AttachmentBuilder(Buffer.from(transcriptText, 'utf8'), {
            name: `ticket-${ticket._id}.txt`,
        });

    const embed = EmbedGenerator.basicEmbed(
        `A ticket you were involved in has been closed.\nYou can view an export of the ticket [here](${baseUrl()}/guilds/${ticket.guild}/tickets/${ticket._id.toString()}).`
    ).setTitle(`${channel.name} | Closed`);

    const dmPayload = { embeds: [embed] };
    if (transcriptAttachment) dmPayload.files = [transcriptAttachment];

    for (const id of participantIds) {
        const user = await client.users.fetch(id).catch(() => null);
        if (user && !user.bot) await user.send(dmPayload).catch(() => null);
    }

    if (logChannelId && transcriptText) {
        const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
            const logAttachment = new Discord.AttachmentBuilder(Buffer.from(transcriptText, 'utf8'), {
                name: `ticket-${ticket._id}.txt`,
            });
            const logEmbed = EmbedGenerator.basicEmbed(
                `Ticket **${channel.name}** closed by <@${closedByUserId}>.\nTranscript attached.`
            )
                .setTitle('Ticket closed')
                .setTimestamp();
            await logChannel
                .send({ embeds: [logEmbed], files: [logAttachment] })
                .catch(() => null);
        }
    }

    await channel.delete(`Ticket closed by ${closedByUserId}`).catch(() => null);
}

module.exports = { closeTicketChannel, buildTranscriptText };
