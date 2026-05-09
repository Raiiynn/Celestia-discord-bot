const Discord = require('discord.js');

/**
 * @param {Discord.Guild} guild
 * @param {boolean} active
 */
async function setLockdown(guild, active) {
    if (!guild || !guild.roles || !guild.channels) return;

    const everyoneRole = guild.roles.everyone;
    if (!everyoneRole) return;

    const textLikeChannels = guild.channels.cache.filter(
        (ch) =>
            ch &&
            (ch.type === Discord.ChannelType.GuildText ||
                ch.type === Discord.ChannelType.GuildAnnouncement)
    );

    for (const channel of textLikeChannels.values()) {
        await channel.permissionOverwrites
            .edit(everyoneRole, { SendMessages: active ? false : null })
            .catch(() => null);
    }
}

module.exports = {
    setLockdown,
};

