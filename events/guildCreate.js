/**
 * GuildCreate Event
 * Handle when bot joins a new guild
 */

const Discord = require('discord.js');
const GuildsManager = require('../lib/GuildsManager');

module.exports = {
  name: 'guildCreate',
  once: false,
  
  async execute(guild, client) {
    try {
      console.log(`[GuildCreate] Joined guild: ${guild.name} (${guild.id})`);
      
      // Initialize guild in database
      await GuildsManager.getOrCreate(guild.id);
      
      // Send welcome embed
      const owner = await client.users.fetch(guild.ownerId).catch(() => null);
      if (owner) {
        const embed = new Discord.EmbedBuilder()
          .setColor('Green')
          .setTitle('Thanks for adding me!')
          .setDescription('Use `/help` to get started')
          .addFields(
            { name: 'Documentation', value: '[Visit our docs](https://docs.example.com)' },
            { name: 'Support Server', value: '[Join here](https://discord.gg/example)' }
          );
        
        await owner.send({ embeds: [embed] }).catch(() => null);
      }
    } catch (err) {
      console.error('[GuildCreate] Error:', err);
    }
  }
};
