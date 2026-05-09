const SUGGESTION_EMOJIS = ['✅', '❌'];

/**
 * Gets reaction counts for ✅ and ❌ excluding the bot.
 * @param {import('discord.js').Message} message
 * @returns {Promise<{ yes: number, no: number }>}
 */
async function getSuggestionReactionCounts(message) {
    const msg = message.partial ? await message.fetch() : message;
    let yes = 0;
    let no = 0;
    for (const emoji of SUGGESTION_EMOJIS) {
        const reaction = msg.reactions.cache.get(emoji);
        if (!reaction) continue;
        try {
            const users = await reaction.users.fetch();
            const count = users.filter((u) => !u.bot).size;
            if (emoji === '✅') yes = count;
            else if (emoji === '❌') no = count;
        } catch {
        }
    }
    return { yes, no };
}

/**
 * Returns a percentage string for suggestion reactions, e.g. "✅ 65% | ❌ 35%".
 * Excludes bot reactions.
 * @param {import('discord.js').Message} message
 * @returns {Promise<String>}
 */
async function getSuggestionPercentageString(message) {
    const { yes, no } = await getSuggestionReactionCounts(message);
    const total = yes + no;
    if (total === 0) return '✅ 0% | ❌ 0%';
    const yesPct = Math.round((yes / total) * 100);
    const noPct = 100 - yesPct;
    return `✅ ${yesPct}% | ❌ ${noPct}%`;
}

/**
 * @param {import('discord.js').Message} message
 * @param {import('../Classes/GuildsManager').GuildsManager} dbGuild
 * @returns {Boolean}
 */
function isSuggestionMessage(message, dbGuild) {
    if (!message.guild || !dbGuild?.suggestion?.enabled || !dbGuild.suggestion.reactions) return false;
    if (message.channel.id !== dbGuild.suggestion.channel) return false;
    if (message.author?.id !== message.client?.user?.id) return false;
    if (!message.embeds?.[0]) return false;
    return true;
}

module.exports = {
    getSuggestionReactionCounts,
    getSuggestionPercentageString,
    isSuggestionMessage,
    SUGGESTION_EMOJIS,
};
