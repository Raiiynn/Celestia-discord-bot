const HoneypotManager = require('../lib/HoneypotManager');
const { scheduleUpdate } = require('../services/banEmbedUpdater');

module.exports = {
  name: 'guildBanAdd',
  once: false,

  async execute(ban, client) {
    try {
      const guild = ban.guild || (ban.guildId ? await client.guilds.fetch(ban.guildId) : null);
      if (!guild) return;

      // If honeypot config saves embed location, schedule an update
      const cfg = await HoneypotManager.getConfig(guild.id);
      if (cfg && cfg.embed_channel_id && cfg.embed_message_id) {
        scheduleUpdate(guild, cfg.embed_channel_id, cfg.embed_message_id);
      }
    } catch (err) {
      console.error('[guildBanAdd] Error:', err);
    }
  },
};
