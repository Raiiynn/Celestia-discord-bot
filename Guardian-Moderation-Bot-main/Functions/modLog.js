const Discord = require('discord.js');

/**
 * @param {Discord.Guild} guild 
 * @param {import('../Classes/GuildsManager').GuildsManager} dbGuild 
 * @param {Discord.EmbedBuilder} embed
 * @param {Discord.AttachmentBuilder[]} [files]
 */
async function sendModLog(guild, dbGuild, embed, files = []) {
    if (!dbGuild?.logs?.enabled || !dbGuild.logs.moderator) return;

    const channel = await guild.channels.fetch(dbGuild.logs.moderator).catch(() => null);
    if (channel && channel instanceof Discord.TextChannel) {
        const payload = { embeds: [embed] };
        if (files.length > 0) payload.files = files;
        await channel.send(payload).catch((err) => console.error('Error sending mod log:', err));
    }
}

module.exports = { sendModLog };
