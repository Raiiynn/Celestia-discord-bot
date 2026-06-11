// lib/HoneypotManager.js — Database operations for honey pot feature

const supabase = require('./db');

class HoneypotManager {
  /**
   * Get honeypot config for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object|null>} - Configuration or null
   */
  static async getConfig(guildId) {
    try {
      const { data, error } = await supabase
        .from('honeypot_configs')
        .select('*')
        .eq('guild_id', guildId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data;
    } catch (err) {
      console.error('[HoneypotManager] Error fetching config:', err.message);
      return null;
    }
  }

  /**
   * Create or update honeypot config
   * @param {string} guildId - Guild ID
   * @param {Object} config - Configuration object
   * @returns {Promise<Object|null>} - Updated config or null
   */
  static async upsertConfig(guildId, config) {
    try {
      const { data, error } = await supabase
        .from('honeypot_configs')
        .upsert({
          guild_id: guildId,
          ...config,
          updated_at: new Date(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('[HoneypotManager] Error upserting config:', err.message);
      return null;
    }
  }

  /**
   * Get whitelist entries for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} - Array of whitelist entries
   */
  static async getWhitelist(guildId) {
    try {
      const { data, error } = await supabase
        .from('honeypot_whitelist')
        .select('*')
        .eq('guild_id', guildId);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[HoneypotManager] Error fetching whitelist:', err.message);
      return [];
    }
  }

  /**
   * Get whitelisted users and roles
   * @param {string} guildId - Guild ID
   * @returns {Promise<{users: string[], roles: string[]}>} - Whitelisted users and roles
   */
  static async getWhitelistFiltered(guildId) {
    try {
      const entries = await this.getWhitelist(guildId);
      const users = entries.filter(e => e.target_type === 'USER').map(e => e.target_id);
      const roles = entries.filter(e => e.target_type === 'ROLE').map(e => e.target_id);
      return { users, roles };
    } catch (err) {
      console.error('[HoneypotManager] Error filtering whitelist:', err.message);
      return { users: [], roles: [] };
    }
  }

  /**
   * Add whitelist entry
   * @param {string} guildId - Guild ID
   * @param {string} targetId - Target ID (user or role)
   * @param {string} targetType - 'USER' or 'ROLE'
   * @param {string} addedBy - User ID who added it
   * @returns {Promise<Object|null>} - Entry or null
   */
  static async addWhitelist(guildId, targetId, targetType, addedBy = null) {
    try {
      const { data, error } = await supabase
        .from('honeypot_whitelist')
        .insert({
          guild_id: guildId,
          target_id: targetId,
          target_type: targetType,
          added_by: addedBy,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('[HoneypotManager] Error adding whitelist:', err.message);
      return null;
    }
  }

  /**
   * Remove whitelist entry
   * @param {string} guildId - Guild ID
   * @param {string} targetId - Target ID
   * @param {string} targetType - 'USER' or 'ROLE'
   * @returns {Promise<boolean>} - Success status
   */
  static async removeWhitelist(guildId, targetId, targetType) {
    try {
      const { error } = await supabase
        .from('honeypot_whitelist')
        .delete()
        .eq('guild_id', guildId)
        .eq('target_id', targetId)
        .eq('target_type', targetType);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[HoneypotManager] Error removing whitelist:', err.message);
      return false;
    }
  }

  /**
   * Record a trigger event
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {Object} triggerData - Trigger data
   * @returns {Promise<Object|null>} - Recorded trigger or null
   */
  static async recordTrigger(guildId, userId, triggerData) {
    try {
      const { data, error } = await supabase
        .from('honeypot_triggers')
        .insert({
          guild_id: guildId,
          user_id: userId,
          ...triggerData,
        })
        .select()
        .single();

      if (error) throw error;

      // Update config stats
      await this.incrementConfigStat(guildId, 'total_triggers');

      return data;
    } catch (err) {
      console.error('[HoneypotManager] Error recording trigger:', err.message);
      return null;
    }
  }

  /**
   * Increment a config stat
   * @param {string} guildId - Guild ID
   * @param {string} stat - Stat name
   * @param {number} increment - Increment amount (default 1)
   * @returns {Promise<boolean>} - Success status
   */
  static async incrementConfigStat(guildId, stat, increment = 1) {
    try {
      const config = await this.getConfig(guildId);
      if (!config) return false;

      const currentValue = config[stat] || 0;
      const { error } = await supabase
        .from('honeypot_configs')
        .update({ [stat]: currentValue + increment, last_trigger_at: new Date() })
        .eq('guild_id', guildId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[HoneypotManager] Error incrementing stat:', err.message);
      return false;
    }
  }

  /**
   * Update config punishment stats
   * @param {string} guildId - Guild ID
   * @param {string} punishmentMode - Punishment mode applied
   * @param {number} deletedCount - Number of messages deleted
   * @returns {Promise<boolean>} - Success status
   */
  static async updatePunishmentStats(guildId, punishmentMode, deletedCount) {
    try {
      const config = await this.getConfig(guildId);
      if (!config) return false;

      const updates = {
        total_deletions: (config.total_deletions || 0) + deletedCount,
      };

      if (punishmentMode === 'BAN') {
        updates.total_bans = (config.total_bans || 0) + 1;
      } else if (punishmentMode === 'TIMEOUT') {
        updates.total_timeouts = (config.total_timeouts || 0) + 1;
      }

      const { error } = await supabase
        .from('honeypot_configs')
        .update(updates)
        .eq('guild_id', guildId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[HoneypotManager] Error updating stats:', err.message);
      return false;
    }
  }

  /**
   * Get recent triggers for a user in a guild
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {number} limitMinutes - Look back N minutes (default 5)
   * @returns {Promise<Array>} - Recent triggers
   */
  static async getRecentTriggers(guildId, userId, limitMinutes = 5) {
    try {
      const cutoffTime = new Date(Date.now() - limitMinutes * 60 * 1000);

      const { data, error } = await supabase
        .from('honeypot_triggers')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .gte('triggered_at', cutoffTime.toISOString())
        .order('triggered_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[HoneypotManager] Error fetching recent triggers:', err.message);
      return [];
    }
  }

  /**
   * Check if user has been recently triggered (cooldown)
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {number} cooldownSeconds - Cooldown period (default 30)
   * @returns {Promise<boolean>} - True if on cooldown
   */
  static async isOnCooldown(guildId, userId, cooldownSeconds = 30) {
    try {
      const triggers = await this.getRecentTriggers(guildId, userId, Math.ceil(cooldownSeconds / 60));
      return triggers.length > 0;
    } catch (err) {
      console.error('[HoneypotManager] Error checking cooldown:', err.message);
      return false;
    }
  }
}

module.exports = HoneypotManager;
