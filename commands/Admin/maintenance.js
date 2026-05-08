/**
 * Maintenance Mode Command
 * Manage bot maintenance status
 */

const Discord = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new Discord.SlashCommandBuilder()
    .setName('maintenance')
    .setDMPermission(true)
    .setDescription('Toggle maintenance mode')
    .setDefaultMemberPermissions(Discord.PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    const botOwner = config.botOwner || process.env.BOT_OWNER;
    
    if (!botOwner || interaction.user.id !== botOwner) {
      return interaction.reply({
        content: '❌ Only bot owner can use this command',
        ephemeral: true,
      });
    }

    try {
      client.maintenance = !client.maintenance;
      const status = client.maintenance ? '🔧 ON' : '✅ OFF';

      const embed = new Discord.EmbedBuilder()
        .setColor(client.maintenance ? 0xFFA500 : 0x00FF00)
        .setTitle('Maintenance Mode')
        .setDescription(`Maintenance mode is now **${status}**`);

      await interaction.reply({ embeds: [embed] });

      if (client.maintenance) {
        await client.user.setStatus('dnd');
        await client.user.setActivity('Maintenance...', { type: Discord.ActivityType.Playing });
      } else {
        await client.user.setStatus('online');
        await client.user.setActivity('/help', { type: Discord.ActivityType.Listening });
      }
    } catch (err) {
      console.error('[Maintenance] Error:', err);
      await interaction.reply({
        content: '❌ Failed to toggle maintenance',
        ephemeral: true,
      });
    }
  },
};
