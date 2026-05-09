const supabase = require('./db');
const { EmbedBuilder } = require('discord.js');

class GreetManager {
  static async getGreetSettings(guildId) {
    try {
      const { data: guild, error } = await supabase
        .from('guilds')
        .select('greet_enabled, greet_mode, greet_channels, greet_message, greet_embed, greet_delete_after')
        .eq('guild_id', guildId)
        .maybeSingle();

      if (error) throw error;
      return guild || null;
    } catch (err) {
      console.error('[GreetManager] Error getting settings:', err);
      return null;
    }
  }

  static async setupGreet(guildId, config) {
    try {
      const { data: guild, error } = await supabase
        .from('guilds')
        .update({
          greet_enabled: true,
          greet_mode: config.mode || 'simple',
          greet_channels: config.channels || [],
          greet_message: config.message || '',
          greet_embed: config.embed || null,
          greet_delete_after: config.deleteAfter || null,
        })
        .eq('guild_id', guildId)
        .select()
        .single();

      if (error) throw error;
      return guild;
    } catch (err) {
      console.error('[GreetManager] Error setting up greet:', err);
      throw err;
    }
  }

  static async disableGreet(guildId) {
    try {
      const { data: guild, error } = await supabase
        .from('guilds')
        .update({ greet_enabled: false })
        .eq('guild_id', guildId)
        .select()
        .single();

      if (error) throw error;
      return guild;
    } catch (err) {
      console.error('[GreetManager] Error disabling greet:', err);
      throw err;
    }
  }

  static replaceVariables(text, member, guild) {
    if (!text) return '';

    return text
      .replace(/{user}/g, member.user.username)
      .replace(/{mention}/g, `<@${member.user.id}>`)
      .replace(/{server}/g, guild.name)
      .replace(/{memberCount}/g, guild.memberCount)
      .replace(/{tag}/g, member.user.tag);
  }

  static async sendGreetMessage(member, guild) {
    try {
      const settings = await this.getGreetSettings(guild.id);

      if (!settings || !settings.greet_enabled) return;

      const channels = settings.greet_channels || [];
      if (channels.length === 0) return;

      for (const channelId of channels) {
        try {
          const channel = await guild.channels.fetch(channelId).catch(() => null);
          if (!channel || !channel.isTextBased()) continue;

          let messageContent;

          if (settings.greet_mode === 'embed' && settings.greet_embed) {
            const embedData = settings.greet_embed;
            const embed = new EmbedBuilder()
              .setTitle(this.replaceVariables(embedData.title, member, guild))
              .setDescription(this.replaceVariables(embedData.description, member, guild));

            if (embedData.thumbnail) {
              embed.setThumbnail(embedData.thumbnail);
            }
            if (embedData.image) {
              embed.setImage(embedData.image);
            }
            if (embedData.color) {
              embed.setColor(embedData.color);
            }

            messageContent = { embeds: [embed] };
          } else {
            messageContent = {
              content: this.replaceVariables(settings.greet_message, member, guild),
            };
          }

          const message = await channel.send(messageContent);

          if (settings.greet_delete_after && settings.greet_delete_after > 0) {
            setTimeout(() => {
              message.delete().catch(err =>
                console.error('[GreetManager] Error deleting message:', err)
              );
            }, settings.greet_delete_after * 1000);
          }

          console.log(`[GreetManager] Sent greet message to ${channel.name} for ${member.user.tag}`);
        } catch (err) {
          console.error(`[GreetManager] Error sending to channel:`, err);
        }
      }
    } catch (err) {
      console.error('[GreetManager] Error in sendGreetMessage:', err);
    }
  }
}

module.exports = GreetManager;
