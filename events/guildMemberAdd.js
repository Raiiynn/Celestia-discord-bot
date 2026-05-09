/**
 * GuildMemberAdd Event
 * Handle member join - AutoRole, Verification, Greet Messages, Member tracking
 */

const Discord = require('discord.js');
const GuildsManager = require('../lib/GuildsManager');
const GreetManager = require('../lib/GreetManager');

module.exports = {
  name: 'guildMemberAdd',
  once: false,

  async execute(member, client) {
    try {
      const guild = member.guild;
      const guildSettings = await GuildsManager.getSettings(guild.id);

      if (!guildSettings) return;

      // AutoRole
      if (guildSettings.autorole_enabled && guildSettings.autorole_member) {
        try {
          const role = await guild.roles.fetch(guildSettings.autorole_member).catch(() => null);
          if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role, 'AutoRole').catch(err =>
              console.error('[AutoRole] Error adding role:', err)
            );
          }
        } catch (err) {
          console.error('[AutoRole] Error:', err);
        }
      }

      // Verification
      if (guildSettings.verification_enabled && guildSettings.verification_unverified_role) {
        try {
          const unverifiedRole = await guild.roles
            .fetch(guildSettings.verification_unverified_role)
            .catch(() => null);

          if (unverifiedRole) {
            await member.roles.add(unverifiedRole, 'Unverified').catch(err =>
              console.error('[Verification] Error adding role:', err)
            );
          }
        } catch (err) {
          console.error('[Verification] Error:', err);
        }
      }

      // Greet Messages
      if (guildSettings.greet_enabled) {
        try {
          await GreetManager.sendGreetMessage(member, guild);
        } catch (err) {
          console.error('[GreetMessages] Error:', err);
        }
      }

      // Member tracking
      console.log(`[MemberAdd] ${member.user.tag} joined ${guild.name}`);
    } catch (err) {
      console.error('[GuildMemberAdd] Error:', err);
    }
  }
};

