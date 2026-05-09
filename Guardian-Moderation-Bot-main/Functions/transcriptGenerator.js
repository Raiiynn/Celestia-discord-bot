const Discord = require('discord.js');

function escapeHtml(unsafe) {
    if (unsafe === undefined || unsafe === null) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br/>');
}

/**
 * @param {Discord.Collection<string, Discord.Message>|Array<Discord.Message>} messages
 * @param {Discord.TextChannel|import('discord.js').BaseChannel} channel
 * @returns {Discord.AttachmentBuilder}
 */
async function generateTranscript(messages, channel) {
    try {
        const msgs = Array.isArray(messages) ? messages.slice() : Array.from(messages.values());
        msgs.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        const guildName = channel && channel.guild ? channel.guild.name : 'Direct Message';
        const channelName =
            channel && channel.name
                ? channel.name
                : String(channel && channel.id ? channel.id : 'unknown');

        let html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Transcript - ${escapeHtml(guildName)} / #${escapeHtml(channelName)}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f6f6f8;color:#111;margin:0;padding:0}
    .container{max-width:900px;margin:24px auto;padding:16px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
    .header{border-bottom:1px solid #eee;padding-bottom:12px;margin-bottom:12px}
    .message{display:flex;gap:12px;padding:8px 0;border-bottom:1px dashed #eee}
    .avatar{width:48px;height:48px;border-radius:6px;object-fit:cover}
    .meta{font-size:12px;color:#6b6b6b}
    .author{font-weight:600;color:#222}
    .content{margin-top:6px;white-space:pre-wrap}
    .attachment{margin-top:6px}
    .attached-image{max-width:400px;border-radius:6px;margin-top:6px}
    </style></head><body><div class="container"><div class="header"><h2>Transcript</h2><div>${escapeHtml(guildName)} / #${escapeHtml(channelName)}</div></div>`;

        for (const m of msgs) {
            const time =
                m && m.createdTimestamp ? new Date(m.createdTimestamp).toLocaleString() : '';
            const authorTag = m && m.author ? m.author.tag || m.author.username : 'Unknown';
            const avatar =
                m && m.author && typeof m.author.displayAvatarURL === 'function'
                    ? m.author.displayAvatarURL({ format: 'png', size: 128 })
                    : '';

            html += `<div class="message"><div class="left"><img class="avatar" src="${escapeHtml(avatar)}" alt="avatar"></div><div class="right"><div class="meta"><span class="author">${escapeHtml(authorTag)}</span> · <span class="time">${escapeHtml(time)}</span></div><div class="content">${escapeHtml(m.content)}</div>`;

            if (m.attachments && m.attachments.size > 0) {
                for (const att of m.attachments.values()) {
                    html += `<div class="attachment"><a href="${escapeHtml(att.url)}">${escapeHtml(att.name || att.url)}</a>`;
                    if (/(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(att.url)) {
                        html += `<div><img class="attached-image" src="${escapeHtml(att.url)}"/></div>`;
                    }
                    html += `</div>`;
                }
            }

            html += `</div></div>`;
        }

        html += `</div></body></html>`;

        const buffer = Buffer.from(html, 'utf8');
        const attachment = new Discord.AttachmentBuilder(buffer, {
            name: `transcript-${channel && channel.id ? channel.id : 'unknown'}.html`,
        });
        return attachment;
    } catch (localErr) {
        throw localErr;
    }
}

module.exports = { generateTranscript };
