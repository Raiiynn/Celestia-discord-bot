const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const storage = require('../../utils/storage');
const config = require('../../config');

function getTier(streak) {
  return storage.getStreakTier(streak);
}

function timeStr() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('streak')
    .setDescription('Mutual streak system')
    .addSubcommand(sub => sub.setName('check').setDescription('Streak with a friend')
      .addUserOption(o => o.setName('friend').setDescription('Friend to streak with').setRequired(true)))
    .addSubcommand(sub => sub.setName('leaderboard').setDescription('Top streak pairs')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'leaderboard') {
      await interaction.deferReply();
      
      const list = await storage.getMutualLeaderboard(interaction.guildId, 10);
      const today = storage.todayStr();

      if (list.length === 0) {
        return interaction.editReply('No streak data yet!');
      }

      const medals = ['🥇', '🥈', '🥉'];
      const lines = list.map((u, i) => {
        const tier = getTier(u.streak);
        return `${medals[i] || `${i + 1}.`} <@${u.user1_id}> + <@${u.user2_id}> - ${tier.emoji} **${u.streak} days** (${tier.label})`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xFF6B00)
        .setTitle('Mutual Streak Leaderboard')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Top 10 streak pairs' });

      return interaction.editReply({ embeds: [embed] });
    }

    const friend = interaction.options.getUser('friend');
    const user = interaction.user;
    const guildId = interaction.guildId;

    if (user.id === friend.id) {
      return interaction.reply({ content: 'Cannot streak with yourself', ephemeral: true });
    }

    const result = await storage.updateMutualCheckin(user.id, friend.id, guildId, user.username, friend.username);

    if (result.waiting) {
      const embed = new EmbedBuilder()
        .setColor(0xFF6B00)
        .setTitle('Waiting for Friend')
        .setDescription(`Waiting for ${friend} to check in...`)
        .setFooter({ text: 'Both must check in to count' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (result.mutual) {
      const data = result.mutual;
      const tier = getTier(data.streak);

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Streak Counted!')
        .setDescription(
          `You and ${friend} matched!\n\n` +
          `[${tier.emoji}] **${data.streak} days** - ${tier.label}\n\n` +
          `Longest: **${data.longest} days**`
        )
        .setFooter({ text: 'Come back tomorrow!' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (result.cooldown) {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Already Done Today')
        .setDescription(`You already streaked with ${friend} today!`)
        .setFooter({ text: '24hr cooldown' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (result.error) {
      await interaction.reply({ content: `Error: ${result.error}`, ephemeral: true });
    }
  },
};