const Discord = require('discord.js');

const EmbedGenerator = require('../../Functions/embedGenerator');
const { GuildsManager } = require('../../Classes/GuildsManager');
const { sendModLog } = require('../../Functions/modLog');
const Infractions = require('../../Schemas/Infractions');

const ZALGO_REGEX = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]{2,}/;

const INVITE_REGEX =
    /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li|com|invite)|discordapp\.com\/invite)\/([\w-]{2,255})/i;

const messageTracker = new Map();
const duplicateTracker = new Map();

function containsZalgo(content) {
    return ZALGO_REGEX.test(content);
}

function containsInvite(content) {
    if (!content) return false;
    return INVITE_REGEX.test(content);
}

function messageContainsInvite(message) {
    if (message.content && containsInvite(message.content)) {
        return true;
    }

    if (message.embeds && message.embeds.length > 0) {
        for (const embed of message.embeds) {
            if (embed.description && containsInvite(embed.description)) {
                return true;
            }
            if (embed.fields && embed.fields.length > 0) {
                for (const field of embed.fields) {
                    if (field.value && containsInvite(field.value)) {
                        return true;
                    }
                    if (field.name && containsInvite(field.name)) {
                        return true;
                    }
                }
            }
            if (embed.footer && embed.footer.text && containsInvite(embed.footer.text)) {
                return true;
            }
            if (embed.author && embed.author.name && containsInvite(embed.author.name)) {
                return true;
            }
        }
    }

    return false;
}

function containsBadword(content, words) {
    if (!words || words.length === 0 || !content) return false;
    const lower = content.toLowerCase();
    return words.some((w) => {
        const trimmed = w.trim().toLowerCase();
        if (!trimmed) return false;
        const wordBoundaryPattern = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, 'i');
        if (wordBoundaryPattern.test(lower)) return true;
        return lower.includes(trimmed);
    });
}

function containsExcessiveCaps(content, threshold = 70, minLength = 10) {
    if (!content || content.length < minLength) return false;

    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length < minLength) return false;

    const caps = letters.replace(/[^A-Z]/g, '').length;
    const capsPercentage = (caps / letters.length) * 100;

    return capsPercentage >= threshold;
}

function containsMentionSpam(message, maxMentions = 5, checkEveryone = true) {
    if (!message) return false;

    let mentionCount = 0;

    if (message.mentions && message.mentions.users) {
        mentionCount += message.mentions.users.size;
    }

    if (message.mentions && message.mentions.roles) {
        mentionCount += message.mentions.roles.size;
    }

    if (checkEveryone) {
        if (
            message.content &&
            (message.content.includes('@everyone') || message.content.includes('@here'))
        ) {
            mentionCount += 1; 
        }
    }

    return mentionCount > maxMentions;
}

function isSpamming(userId, guildId, maxMessages = 5, timeframe = 5000) {
    const key = `${userId}-${guildId}`;
    const now = Date.now();

    if (!messageTracker.has(key)) {
        messageTracker.set(key, []);
    }

    const messages = messageTracker.get(key);

    const validMessages = messages.filter((timestamp) => now - timestamp < timeframe);
    messageTracker.set(key, validMessages);

    validMessages.push(now);

    return validMessages.length > maxMessages;
}

function isDuplicateSpam(userId, guildId, content, maxDuplicates = 3) {
    const key = `${userId}-${guildId}`;
    const now = Date.now();

    if (!duplicateTracker.has(key)) {
        duplicateTracker.set(key, new Map());
    }

    const userDuplicates = duplicateTracker.get(key);

    for (const [text, timestamps] of userDuplicates.entries()) {
        const validTimestamps = timestamps.filter((timestamp) => now - timestamp < 30000);
        if (validTimestamps.length === 0) {
            userDuplicates.delete(text);
        } else {
            userDuplicates.set(text, validTimestamps);
        }
    }

    if (!userDuplicates.has(content)) {
        userDuplicates.set(content, []);
    }
    userDuplicates.get(content).push(now);

    return userDuplicates.get(content).length > maxDuplicates;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function executeAutomodAction(message, client, dbGuild, action, reason, system) {
    const member = message.member;
    if (!member) return;

    if (action === 'delete') {
        await message.delete().catch(() => null);
        const dmEmbed = EmbedGenerator.basicEmbed(
            `**Automod Action: Message Deleted**\n\n` +
                `Your message in **${message.guild.name}** was automatically deleted.\n\n` +
                `**Reason:** ${reason}\n` +
                `**System:** ${system}\n\n` +
                `Please review the server rules to avoid further actions.`
        )
            .setColor('Orange')
            .setTitle('Automod: Message Deleted')
            .setFooter({ text: `${message.guild.name}`, iconURL: message.guild.iconURL() })
            .setTimestamp();
        await member.send({ embeds: [dmEmbed] }).catch(() => null);
        const logEmbed = EmbedGenerator.basicEmbed(
            `**${system}**\nMessage by ${message.author} was deleted.\n**Reason:** ${reason}\n**Content:** ${message.content?.slice(0, 200) || '(empty)'}`
        )
            .setColor('Orange')
            .setTitle('Automod Action');
        await sendModLog(message.guild, dbGuild, logEmbed);
        return;
    }

    if (action === 'warn') {
        await message.delete().catch(() => null);
        const dmEmbed = EmbedGenerator.basicEmbed(
            `**Automod Action: Warning**\n\n` +
                `You have been warned in **${message.guild.name}** by the automoderation system.\n\n` +
                `**Reason:** ${reason}\n` +
                `**System:** ${system}\n\n` +
                `Please review the server rules to avoid further actions.`
        )
            .setColor('Orange')
            .setTitle('Automod: Warning')
            .setFooter({ text: `${message.guild.name}`, iconURL: message.guild.iconURL() })
            .setTimestamp();
        await member.send({ embeds: [dmEmbed] }).catch(() => null);
        if (member.moderatable) {
            await Infractions.create({
                guild: message.guild.id,
                user: member.id,
                issuer: client.user.id,
                type: 'warning',
                reason: reason,
                active: false,
            });
        }
        const logEmbed = EmbedGenerator.basicEmbed(
            `**${system}**\n${member} was warned.\n**Reason:** ${reason}\n**Content:** ${message.content?.slice(0, 200) || '(empty)'}`
        )
            .setColor('Orange')
            .setTitle('Automod Action');
        await sendModLog(message.guild, dbGuild, logEmbed);
        return;
    }

    if (action === 'timeout') {
        await message.delete().catch(() => null);
        const durationMs = 60 * 60 * 1000;
        const dmEmbed = EmbedGenerator.basicEmbed(
            `**Automod Action: Timeout**\n\n` +
                `You have been timed out in **${message.guild.name}** by the automoderation system.\n\n` +
                `**Duration:** 1 hour\n` +
                `**Reason:** ${reason}\n` +
                `**System:** ${system}\n\n` +
                `Please review the server rules to avoid further actions.`
        )
            .setColor('Orange')
            .setTitle('Automod: Timeout')
            .setFooter({ text: `${message.guild.name}`, iconURL: message.guild.iconURL() })
            .setTimestamp();
        await member.send({ embeds: [dmEmbed] }).catch(() => null);
        if (member.moderatable) {
            await member.timeout(durationMs, reason).catch(() => null);
            const inf = await Infractions.create({
                guild: message.guild.id,
                user: member.id,
                issuer: client.user.id,
                type: 'timeout',
                reason: reason,
                duration: durationMs,
            });
            await client.expiringDocumentsManager.infractions.addNewDocument(inf);
        }
        const logEmbed = EmbedGenerator.basicEmbed(
            `**${system}**\n${member} was timed out for 1h.\n**Reason:** ${reason}\n**Content:** ${message.content?.slice(0, 200) || '(empty)'}`
        )
            .setColor('Orange')
            .setTitle('Automod Action');
        await sendModLog(message.guild, dbGuild, logEmbed);
    }
}

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;
        if (!message.guild) return;

        const dbGuild = await GuildsManager.fetch(message.guild.id);
        if (!dbGuild) return;

        const doc = dbGuild.document || {};
        const automod = doc.automod || {};

        const antiZalgo = automod.antiZalgo || {};
        if (antiZalgo.enabled && message.content && containsZalgo(message.content)) {
            await executeAutomodAction(
                message,
                client,
                dbGuild,
                antiZalgo.action || 'delete',
                'Zalgo/corrupted text is not allowed.',
                'Anti Zalgo'
            );
            return;
        }

        const antiBadwords = automod.antiBadwords || {};
        if (
            antiBadwords.enabled &&
            message.content &&
            containsBadword(message.content, antiBadwords.words || [])
        ) {
            await executeAutomodAction(
                message,
                client,
                dbGuild,
                antiBadwords.action || 'delete',
                'Your message contained a word that is not allowed.',
                'Anti Badwords'
            );
            return;
        }

        const antiAd = automod.antiAdvertisement || {};
        if (antiAd.enabled && messageContainsInvite(message)) {
            const whitelist = antiAd.whitelistChannels || [];
            if (whitelist.includes(message.channel.id)) return;
            await executeAutomodAction(
                message,
                client,
                dbGuild,
                antiAd.action || 'delete',
                'Discord invite links are not allowed.',
                'Anti Advertisement'
            );
            return;
        }

        const antiCaps = automod.antiCaps || {};
        if (
            antiCaps.enabled &&
            message.content &&
            containsExcessiveCaps(message.content, antiCaps.threshold, antiCaps.minLength)
        ) {
            await executeAutomodAction(
                message,
                client,
                dbGuild,
                antiCaps.action || 'delete',
                'Excessive capitalization is not allowed.',
                'Anti Caps'
            );
            return;
        }

        const antiMentionSpam = automod.antiMentionSpam || {};
        if (
            antiMentionSpam.enabled &&
            containsMentionSpam(message, antiMentionSpam.maxMentions, antiMentionSpam.checkEveryone)
        ) {
            await executeAutomodAction(
                message,
                client,
                dbGuild,
                antiMentionSpam.action || 'delete',
                'Excessive mentions are not allowed.',
                'Anti Mention Spam'
            );
            return;
        }

        const antiSpam = automod.antiSpam || {};
        if (antiSpam.enabled) {
            const isSpam = isSpamming(
                message.author.id,
                message.guild.id,
                antiSpam.maxMessages,
                antiSpam.timeframe
            );
            const isDuplicate = isDuplicateSpam(
                message.author.id,
                message.guild.id,
                message.content,
                antiSpam.maxDuplicates
            );

            if (isSpam || isDuplicate) {
                await executeAutomodAction(
                    message,
                    client,
                    dbGuild,
                    antiSpam.action || 'delete',
                    isSpam ? 'Message spam detected.' : 'Duplicate message spam detected.',
                    'Anti Spam'
                );
                return;
            }
        }
    },
};
