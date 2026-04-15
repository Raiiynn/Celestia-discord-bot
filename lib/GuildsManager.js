const supabase = require('./db');

class GuildsManager {
  static async getOrCreate(guildId) {
    try {
      const { data: guild, error } = await supabase
        .from('guilds')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();

      if (!guild && !error) {
        const { data: newGuild, error: createError } = await supabase
          .from('guilds')
          .insert({ guild_id: guildId })
          .select()
          .single();

        if (createError) throw createError;
        return newGuild;
      }

      return guild;
    } catch (err) {
      console.error('[GuildsManager] Error in getOrCreate:', err);
      throw err;
    }
  }

  static async update(guildId, updates) {
    try {
      await supabase
        .from('guilds')
        .upsert({ guild_id: guildId }, { onConflict: 'guild_id' })
        .select();

      const { data: guild, error } = await supabase
        .from('guilds')
        .update(updates)
        .eq('guild_id', guildId)
        .select()
        .single();

      if (error) throw error;
      return guild;
    } catch (err) {
      console.error('[GuildsManager] Error in update:', err);
      throw err;
    }
  }

  static async getSettings(guildId) {
    try {
      const { data: guild, error } = await supabase
        .from('guilds')
        .select('*')
        .eq('guild_id', guildId)
        .maybeSingle();

      return guild || null;
    } catch (err) {
      console.error('[GuildsManager] Error in getSettings:', err);
      return null;
    }
  }

  static async enableFeature(guildId, feature, config = {}) {
    try {
      const updates = { [`${feature}_enabled`]: true, ...config };
      return await this.update(guildId, updates);
    } catch (err) {
      console.error('[GuildsManager] Error in enableFeature:', err);
      throw err;
    }
  }

  static async disableFeature(guildId, feature) {
    try {
      return await this.update(guildId, { [`${feature}_enabled`]: false });
    } catch (err) {
      console.error('[GuildsManager] Error in disableFeature:', err);
      throw err;
    }
  }
}

module.exports = GuildsManager;