const supabase = require('./db');

class UsersManager {
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

  static async setLanguage(userId, guildId, language) {
    try {
      await this.getOrCreate(userId, guildId);
      return await this.update(userId, guildId, { language });
    } catch (err) {
      console.error('[UsersManager] Error in setLanguage:', err);
      throw err;
    }
  }

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
