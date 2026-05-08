/**
 * GuildMemberRemove Event
 * Handle member leave - Member tracking, cleanup
 */

const GuildsManager = require('../lib/GuildsManager');

module.exports = {
  name: 'guildMemberRemove',
  once: false,
  
  async execute(member, client) {
    try {
      const guild = member.guild;
      const guildSettings = await GuildsManager.getSettings(guild.id);

      if (!guildSettings) return;

      // Log member leave
      console.log(`[MemberRemove] ${member.user.tag} left ${guild.name}`);

      // Optional: Log to logging channel
      if (guildSettings.logs_enabled && guildSettings.logs_basic) {
        const channel = await guild.channels.fetch(guildSettings.logs_basic).catch(() => null);
        if (channel) {
          const embed = {
            color: 0xFF6B6B,
            title: 'Member Left',
            description: `${member.user.tag} (${member.id})`,
            timestamp: new Date().toISOString(),
          };
          
          await channel.send({ embeds: [embed] }).catch(err =>
            console.error('[MemberRemove] Error sending log:', err)
          );
        }
      }
    } catch (err) {
      console.error('[GuildMemberRemove] Error:', err);
    }
  }
};
