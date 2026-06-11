const { EmbedBuilder } = require('discord.js');

function buildBanEmbed({ guildName, description, banCount, footerText, language = 'en', bilingual = false }) {
  const descriptions = {
    en: 'DO NOT SEND MESSAGES IN THIS CHANNEL\nThis channel is used to catch spam bots. Any messages sent here will result in an immediate ban.',
    id: 'JANGAN KIRIM PESAN DI CHANNEL INI\nChannel ini digunakan untuk menangkap bot spam. Setiap pesan yang dikirim di sini akan mengakibatkan pemblokiran langsung.',
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
    .setTitle('Spam Bot Catch Channel')
    .setDescription(desc)
    .addFields({ name: 'Bans', value: String(banCount || 0), inline: true })
    .setColor(0xfbff0d)
    .setTimestamp(new Date());

  if (footerText) embed.setFooter({ text: footerText });
  else embed.setFooter({ text: `Auto Moderation - Honey Pot • ${new Date().toLocaleString()}` });

  return embed;
}

module.exports = { buildBanEmbed };
