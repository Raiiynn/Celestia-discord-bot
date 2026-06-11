// utils/punishment.js — Apply punishment to users

const { ChannelType } = require('discord.js');

/**
 * Apply punishment to a user based on mode
 * @param {GuildMember} member - Discord guild member
 * @param {string} mode - Punishment mode: DELETE_ONLY, TIMEOUT, BAN
 * @param {number} durationMs - Duration for timeout (ignored for DELETE_ONLY/BAN)
 * @param {string} reason - Reason for punishment
 * @returns {Promise<{success: boolean, action: string, error?: string}>}
 */
async function applyPunishment(member, mode, durationMs, reason = 'Honey Pot Spam Trap') {
  const result = {
    success: false,
    action: mode,
    error: null,
  };

  if (!member || !member.guild) {
    result.error = 'Invalid member or guild';
    return result;
  }

  try {
    switch (mode) {
      case 'DELETE_ONLY':
        // Message already deleted, no further action needed
        result.success = true;
        result.action = 'Message Deleted';
        break;

      case 'TIMEOUT':
        if (member.moderatable) {
          await member.timeout(durationMs, reason);
          result.success = true;
          result.action = `Timeout (${formatDuration(durationMs)})`;
        } else {
          result.error = 'Cannot timeout member (insufficient permissions)';
        }
        break;

      case 'BAN':
        if (member.bannable) {
          await member.ban({ reason });
          result.success = true;
          result.action = 'Ban';
        } else {
          result.error = 'Cannot ban member (insufficient permissions)';
        }
        break;

      default:
        result.error = `Unknown punishment mode: ${mode}`;
    }
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }

  return result;
}

/**
 * Check if user is whitelisted
 * @param {GuildMember} member - Discord guild member
 * @param {string[]} whitelistedUsers - Array of whitelisted user IDs
 * @param {string[]} whitelistedRoles - Array of whitelisted role IDs
 * @returns {boolean} - True if whitelisted
 */
function isWhitelisted(member, whitelistedUsers = [], whitelistedRoles = []) {
  if (!member) return false;

  // Check user ID
  if (whitelistedUsers.includes(member.id)) return true;

  // Check roles
  for (const roleId of whitelistedRoles) {
    if (member.roles.cache.has(roleId)) return true;
  }

  return false;
}

/**
 * Format duration in milliseconds to human-readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/**
 * Get punishment mode from config
 * @param {string} mode - Punishment mode string
 * @returns {string} - Normalized punishment mode
 */
function getPunishmentMode(mode) {
  const valid = ['DELETE_ONLY', 'TIMEOUT', 'BAN'];
  if (valid.includes(mode)) return mode;
  return 'BAN'; // Default to BAN
}

module.exports = {
  applyPunishment,
  isWhitelisted,
  formatDuration,
  getPunishmentMode,
};
