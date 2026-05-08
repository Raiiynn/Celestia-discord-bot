const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

function parseDuration(str) {
  const match = str?.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const n = parseInt(match[1]);
  const u = match[2].toLowerCase();
  return n * { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[u];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member to timeout').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 1h, 1d').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),

  async execute(interaction) {
    const target   = interaction.options.getMember('user');
    const durStr   = interaction.options.getString('duration');
    const reason   = interaction.options.getString('reason') || 'No reason provided';
    const duration = parseDuration(durStr);

    if (!target)   return interaction.reply({ content: '❌ User not found.', ephemeral: true });
    if (!duration) return interaction.reply({ content: '❌ Invalid duration. Use e.g. `10m`, `1h`, `1d`.', ephemeral: true });
    if (duration > 28 * 86_400_000) return interaction.reply({ content: '❌ Max timeout is 28 days.', ephemeral: true });

    await target.timeout(duration, reason);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFFFF00)
          .setTitle('⏱️ Member Timed Out')
          .addFields(
            { name: 'User',     value: target.user.tag, inline: true },
            { name: 'Duration', value: durStr,           inline: true },
            { name: 'Reason',   value: reason }
          ),
      ],
    });
  },
};
