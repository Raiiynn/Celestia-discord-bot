/**
 * Users Manager for Supabase
 * Handles all user-related database operations
 */

const supabase = require('./db');

class UsersManager {
  /**
   * Get or create a user document
   */
  static async getOrCreate(userId, guildId) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .eq('guild_id', guildId)
        .maybeSingle();

      if (!user && !error) {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({ user_id: userId, guild_id: guildId })
          .select()
          .single();

        if (createError) throw createError;
        return newUser;
      }

      return user;
    } catch (err) {
      console.error('[UsersManager] Error in getOrCreate:', err);
      throw err;
    }
  }

  /**
   * Get user by ID and guild ID
   */
  static async getUser(userId, guildId) {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .eq('guild_id', guildId)
        .maybeSingle();

      return user || null;
    } catch (err) {
      console.error('[UsersManager] Error in getUser:', err);
      return null;
    }
  }

  /**
   * Update user settings
   */
  static async update(userId, guildId, updates) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .update(updates)
        .match({ user_id: userId, guild_id: guildId })
        .select()
        .single();

      if (error) throw error;
      return user;
    } catch (err) {
      console.error('[UsersManager] Error in update:', err);
      throw err;
    }
  }

  /**
   * Set user language
   */
  static async setLanguage(userId, guildId, language) {
    try {
      await this.getOrCreate(userId, guildId);
      return await this.update(userId, guildId, { language });
    } catch (err) {
      console.error('[UsersManager] Error in setLanguage:', err);
      throw err;
    }
  }

  /**
   * Get user language
   */
  static async getLanguage(userId, guildId) {
    try {
      const user = await this.getUser(userId, guildId);
      return user?.language || 'en';
    } catch (err) {
      return 'en';
    }
  }
}

module.exports = UsersManager;
