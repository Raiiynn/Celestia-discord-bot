const Mongoose = require('mongoose');

module.exports = Mongoose.model(
    'Guilds',
    new Mongoose.Schema({
        guild: { type: String, required: true, index: true, immutable: true },
        setup: { type: Boolean, default: false },
        members: { type: [String], index: true, default: [] },
        verification: {
            enabled: { type: Boolean, default: false },
            version: { type: String, enum: [null, 'button', 'command', 'captcha'], default: null },
            role: { type: String, default: null },
            unverifiedRole: { type: String, default: null },
            channel: { type: String, default: null },
        },
        logs: {
            enabled: { type: Boolean, default: false },
            basic: { type: String, default: null },
            moderator: { type: String, default: null },
            global: { type: String, default: null },
            suggestionsChannel: { type: String, default: null },
            announcementChannel: { type: String, default: null },
            giveawayChannel: { type: String, default: null },
        },
        autorole: {
            enabled: { type: Boolean, default: false },
            member: { type: String, default: null },
            bot: { type: String, default: null },
        },
        antiraid: {
            enabled: { type: Boolean, default: false },
            raid: { type: Boolean, default: false },
            joinAmount: { type: Number, default: null },
            joinWithin: { type: Number, default: null },
            action: { type: String, enum: [null, 'kick', 'ban'], default: null },
            lockdown: {
                enabled: { type: Boolean, default: false },
                active: { type: Boolean, default: false },
            },
            channel: { type: String, default: null },
        },
        automod: {
            antiZalgo: {
                enabled: { type: Boolean, default: false },
                action: { type: String, enum: ['delete', 'warn', 'timeout'], default: 'delete' },
            },
            antiBadwords: {
                enabled: { type: Boolean, default: false },
                words: { type: [String], default: [] },
                action: { type: String, enum: ['delete', 'warn', 'timeout'], default: 'delete' },
            },
            antiNuke: {
                enabled: { type: Boolean, default: false },
                maxChannelsPerMinute: { type: Number, default: 3 },
                maxRolesPerMinute: { type: Number, default: 3 },
                action: { type: String, enum: ['kick', 'ban'], default: 'ban' },
            },
            antiAdvertisement: {
                enabled: { type: Boolean, default: false },
                action: { type: String, enum: ['delete', 'warn', 'timeout'], default: 'delete' },
                whitelistChannels: { type: [String], default: [] },
            },
            antiCaps: {
                enabled: { type: Boolean, default: false },
                action: { type: String, enum: ['delete', 'warn', 'timeout'], default: 'delete' },
                threshold: { type: Number, default: 70 }, // percentage of caps
                minLength: { type: Number, default: 10 }, // minimum message length
            },
            antiMentionSpam: {
                enabled: { type: Boolean, default: false },
                action: { type: String, enum: ['delete', 'warn', 'timeout'], default: 'delete' },
                maxMentions: { type: Number, default: 5 }, // max mentions per message
                checkEveryone: { type: Boolean, default: true }, // check @everyone/@here
            },
            antiSpam: {
                enabled: { type: Boolean, default: false },
                action: { type: String, enum: ['delete', 'warn', 'timeout'], default: 'delete' },
                maxMessages: { type: Number, default: 5 }, // max messages in timeframe
                timeframe: { type: Number, default: 5000 }, // timeframe in milliseconds
                maxDuplicates: { type: Number, default: 3 }, // max duplicate messages
            },
        },
        suggestion: {
            enabled: { type: Boolean, default: false },
            channel: { type: String, default: null },
            reactions: { type: Boolean, default: false },
        },
        tickets: {
            enabled: { type: Boolean, default: false },
            category: { type: String, default: null },
            channel: { type: String, default: null },
            role: { type: String, default: null },
            logChannel: { type: String, default: null },
        },
    })
);