// utils/inviteDetector.js — Detect Discord invite links with bypass attempts

/**
 * Regex patterns for Discord invite detection
 * Covers: discord.gg, discord.com/invite, discordapp.com/invite, and obfuscated forms
 */
const INVITE_PATTERNS = [
  // Standard discord.gg format
  /discord\.gg\/[\w-]{1,}|discordapp\.com\/invite\/[\w-]{1,}|discord\.com\/invite\/[\w-]{1,}/gi,
  // Obfuscated with spaces: discord . gg
  /discord\s*\.\s*gg\/[\w-]{1,}/gi,
  // Obfuscated with (dot): discord(dot)gg
  /discord\s*\(\s*dot\s*\)\s*gg\/[\w-]{1,}/gi,
  // Obfuscated with [dot]: discord[dot]gg
  /discord\s*\[\s*dot\s*\]\s*gg\/[\w-]{1,}/gi,
  // Spaced out: d i s c o r d . g g
  /d\s*i\s*s\s*c\s*o\s*r\s*d\s*\.\s*gg\/[\w-]{1,}/gi,
  // With underscores or hyphens: d_i_s_c_o_r_d . g g
  /d[\s_-]*i[\s_-]*s[\s_-]*c[\s_-]*o[\s_-]*r[\s_-]*d[\s_-]*\.[\s_-]*g[\s_-]*g/gi,
];

/**
 * Detect Discord invite links in content (with bypass attempts)
 * @param {string} content - Message content to check
 * @returns {string[]|null} - Array of detected invite links or null if none found
 */
function detectInvites(content) {
  if (!content || typeof content !== 'string') return null;

  const detected = [];
  const cleanContent = content.toLowerCase();

  for (const pattern of INVITE_PATTERNS) {
    const matches = cleanContent.match(pattern);
    if (matches) {
      detected.push(...matches);
    }
  }

  return detected.length > 0 ? [...new Set(detected)] : null;
}

/**
 * Check if message contains invite spam
 * @param {Message} message - Discord message object
 * @param {Object} honeypotConfig - Honeypot configuration
 * @returns {boolean} - True if invite spam detected
 */
function isInviteSpam(message, honeypotConfig) {
  if (!message || !message.content) return false;

  const invites = detectInvites(message.content);
  return invites !== null && invites.length > 0;
}

/**
 * Get detected invite links from content
 * @param {string} content - Message content
 * @returns {string[]} - Array of found invite links
 */
function getInvites(content) {
  const invites = detectInvites(content);
  return invites || [];
}

module.exports = {
  detectInvites,
  isInviteSpam,
  getInvites,
  INVITE_PATTERNS,
};
