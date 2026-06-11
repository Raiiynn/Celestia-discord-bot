const HoneypotManager = require('../lib/HoneypotManager');
const { scheduleUpdate } = require('../services/banEmbedUpdater');

module.exports = {
  name: 'guildBanRemove',
  once: false,

  async execute(guild, user, client) {
    try {
      // Some loaders pass (ban) while others pass (guild, user). Handle both.
      let theGuild = null;
      if (guild && guild.id) theGuild = guild;
      else if (guild && guild.guild) theGuild = guild.guild;

      if (!theGuild) return;

      const cfg = await HoneypotManager.getConfig(theGuild.id);
      if (cfg && cfg.embed_channel_id && cfg.embed_message_id) {
        scheduleUpdate(theGuild, cfg.embed_channel_id, cfg.embed_message_id);
      }
    } catch (err) {
      console.error('[guildBanRemove] Error:', err);
    }
  },
};
