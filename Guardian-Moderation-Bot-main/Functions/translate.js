const translate = require('@iamtraction/google-translate');

/**
 * Masks slash command names (e.g. /help, /language) so they are not translated.
 * Uses a placeholder format that translators typically leave unchanged.
 * @param {String} text
 * @returns {{ masked: String, commands: String[] }}
 */
function maskSlashCommands(text) {
    const cmdPattern = /\/[\w-]+/g;
    const commands = [...new Set((text.match(cmdPattern) || []))];
    let masked = text;
    commands.forEach((cmd, i) => {
        const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        masked = masked.replace(new RegExp(escaped, 'g'), `\u2063SLASH${i}\u2063`);
    });
    return { masked, commands };
}

/**
 * Restores slash command names after translation.
 * Tries full placeholder first, then plain SLASHn in case the API stripped invisible chars.
 * @param {String} text
 * @param {String[]} commands
 * @returns {String}
 */
function unmaskSlashCommands(text, commands) {
    let result = text;
    commands.forEach((cmd, i) => {
        const fullPlaceholder = new RegExp(`\u2063SLASH${i}\u2063`, 'g');
        const fallbackPlaceholder = new RegExp(`SLASH${i}`, 'g');
        result = result.replace(fullPlaceholder, cmd).replace(fallbackPlaceholder, cmd);
    });
    return result;
}

/**
 * Translates text to the target language. Slash command names (e.g. /help, /language) are preserved.
 * @param {String} text 
 * @param {String} targetLang 
 * @returns {Promise<String|null>} 
 */
async function translateText(text, targetLang) {
    if (!text || typeof text !== 'string' || !targetLang || targetLang.toLowerCase() === 'en') {
        return text;
    }
    try {
        const { masked, commands } = maskSlashCommands(text);
        const result = await translate(masked, { from: 'en', to: targetLang });
        return unmaskSlashCommands(result.text, commands);
    } catch {
        return text;
    }
}

/**
 * Translates response content and embeds to the user's language.
 * Preserves all other payload keys (components, files, ephemeral, etc.).
 * @param {Object} response 
 * @param {String} targetLang 
 * @returns {Promise<Object>}
 */
async function translateResponse(response, targetLang) {
    if (!response || !targetLang || targetLang.toLowerCase() === 'en') return response;

    try {
        const translated = {
            ...response,
            content: response.content || null,
            embeds: Array.isArray(response.embeds) ? [...response.embeds] : [],
        };

        if (translated.content) {
            translated.content = await translateText(translated.content, targetLang);
        }

        if (translated.embeds.length > 0) {
            const Discord = require('discord.js');
            for (const embed of translated.embeds) {
                if (!(embed instanceof Discord.EmbedBuilder)) continue;
                const data = embed.data || {};
                if (data.description) {
                    embed.setDescription(
                        await translateText(data.description, targetLang)
                    );
                }
                if (data.title) {
                    embed.setTitle(await translateText(data.title, targetLang));
                }
                if (data.author?.name) {
                    embed.setAuthor({
                        name: await translateText(data.author.name, targetLang),
                        iconURL: data.author.iconURL,
                        url: data.author.url,
                    });
                }
                if (data.fields?.length) {
                    const translatedFields = [];
                    for (const field of data.fields) {
                        translatedFields.push({
                            name: await translateText(field.name, targetLang),
                            value: await translateText(field.value, targetLang),
                            inline: field.inline,
                        });
                    }
                    embed.setFields(translatedFields);
                }
                if (data.footer?.text) {
                    embed.setFooter({
                        text: await translateText(data.footer.text, targetLang),
                        iconURL: data.footer.iconURL,
                    });
                }
            }
        }

        return translated;
    } catch {
        return response;
    }
}

module.exports = {
    translateText,
    translateResponse,
};
