const { EmbedBuilder } = require('discord.js');

function buildBanEmbed({ guildName, description, banCount, footerText, language = 'en', bilingual = false }) {
  const descriptions = {
    en: 'DO NOT SEND MESSAGES in this channel as it is used to catch spam bots.\nAny messages sent here will be blocked immediately.',
    id: 'Jangan kirim pesan di channel ini karena digunakan untuk menangkap bot spam\nSetiap pesan yang dikirim di sini akan diblokir secara langsung.',
  };

  let desc;
  if (description) {
    desc = description;
  } else if (bilingual) {
    desc = `${descriptions.en}\n\n${descriptions.id}`;
  } else {
    desc = descriptions[language] || descriptions['en'];
  }

  const embed = new EmbedBuilder()
    .setTitle('🛑 Security Monitor Intercept')
    .setDescription(desc)
    .addFields({ name: 'Bans', value: String(banCount || 0), inline: true })
    .setColor(0xcc0227)
    .setTimestamp(new Date());

  if (footerText) embed.setFooter({ text: footerText });
  else embed.setFooter({ text: `Auto Moderation - Spam Bot Catch • ${new Date().toLocaleString()}` });

  return embed;
}

module.exports = { buildBanEmbed };
