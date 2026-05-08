/**
 * GuildDelete Event
 * Handle when bot is removed from a guild
 */

module.exports = {
  name: 'guildDelete',
  once: false,
  
  async execute(guild, client) {
    try {
      console.log(`[GuildDelete] Left guild: ${guild.name} (${guild.id})`);
      // Optional: Clean up guild data from database
    } catch (err) {
      console.error('[GuildDelete] Error:', err);
    }
  }
};
