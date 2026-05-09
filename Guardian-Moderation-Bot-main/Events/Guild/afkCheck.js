const Discord = require('discord.js');

const AFK = require('../../Schemas/AFK');

module.exports = {
    name: 'messageCreate',
    /**
     * @param {Discord.Message} message
     */
    async execute(message) {
        if (message.author.bot) return;

        const authorAFK = await AFK.findOne({ user: message.author.id });
        if (authorAFK) {
            await AFK.deleteOne({ user: message.author.id });
            const timeDiff = Date.now() - authorAFK.timestamp;
            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

            await message.reply(
                `Welcome back ${message.author}! You were AFK for ${timeString}. You have been removed from the AFK list.`
            );
        }

        if (message.mentions.has(message.client.user)) return;

        const mentionedUsers = message.mentions.users;
        if (mentionedUsers.size === 0) return;

        for (const mentionedUser of mentionedUsers.values()) {
            if (mentionedUser.bot) continue;

            const afkUser = await AFK.findOne({ user: mentionedUser.id });
            if (afkUser) {
                const timeDiff = Date.now() - afkUser.timestamp;
                const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

                await message.reply(
                    `${mentionedUser} is currently AFK for ${timeString}.\n**Reason:** ${afkUser.reason}`
                );
            }
        }
    },
};
