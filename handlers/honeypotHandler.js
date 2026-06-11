// handlers/honeypotHandler.js — Main honey pot orchestration

const HoneypotManager = require('../lib/HoneypotManager');
const inviteDetector = require('../utils/inviteDetector');
const { cleanupUserMessages } = require('../utils/cleanupMessages');
const { applyPunishment, isWhitelisted } = require('../utils/punishment');
const { createTriggerEmbed } = require('../utils/honeypotEmbed');

// In-memory cooldown map to prevent duplicate processing
const processingCooldowns = new Map();

/**
 * Process message for honey pot spam
 * @param {Message} message - Discord message
 * @param {Client} client - Discord client
 * @returns {Promise<boolean>} - True if trigger was processed
 */
async function processHoneypotMessage(message, client) {
  if (!message.guild || !message.member || message.author.bot) {
    return false;
  }

  try {
    // Get honeypot config
    const config = await HoneypotManager.getConfig(message.guildId);
    if (!config || !config.enabled) {
      return false;
    }

    // Check if this is the honeypot channel
    if (message.channelId !== config.honeypot_channel_id) {
      return false;
    }

    // Check cooldown to prevent duplicate processing
    const cooldownKey = `${message.guildId}:${message.author.id}`;
    if (processingCooldowns.has(cooldownKey)) {
      return false;
    }

    // Add to cooldown (30 seconds)
    processingCooldowns.set(cooldownKey, true);
    setTimeout(() => processingCooldowns.delete(cooldownKey), 30000);

    // Get whitelist
    const { users: whitelistedUsers, roles: whitelistedRoles } = await HoneypotManager.getWhitelistFiltered(message.guildId);

    // Check if user is whitelisted
    if (isWhitelisted(message.member, whitelistedUsers, whitelistedRoles)) {
      return false;
    }

    // Detect invite spam
    const detectedInvites = inviteDetector.getInvites(message.content);
    if (detectedInvites.length === 0) {
      return false;
    }

    // ============= TRIGGER DETECTED =============
    console.log(`[HoneypotHandler] 🚨 Trigger detected in ${message.guild.name}: ${message.author.tag}`);

    const errors = [];
    let actionTaken = 'None';
    let cleanupSummary = {};

    // 1. Delete the triggering message
    try {
      await message.delete();
    } catch (err) {
      errors.push(`Could not delete trigger message: ${err.message}`);
    }

    // 2. Perform global cleanup if enabled
    if (config.cleanup_enabled) {
      try {
        cleanupSummary = await cleanupUserMessages(
          message.guild,
          message.author.id,
          config.cleanup_window_minutes || 60
        );

        // Track cleanup errors
        if (cleanupSummary.errors && cleanupSummary.errors.length > 0) {
          errors.push(...cleanupSummary.errors.slice(0, 3));
        }
      } catch (err) {
        errors.push(`Global cleanup failed: ${err.message}`);
      }
    }

    // 3. Apply punishment
    try {
      const punishmentResult = await applyPunishment(
        message.member,
        config.punishment_mode || 'BAN',
        config.timeout_duration_ms || 3600000,
        'Honey Pot Spam Trap - Invite Spam Detected'
      );

      if (punishmentResult.success) {
        actionTaken = punishmentResult.action;
        await HoneypotManager.updatePunishmentStats(
          message.guildId,
          config.punishment_mode,
          cleanupSummary.totalDeleted || 0
        );
      } else if (punishmentResult.error) {
        errors.push(`Punishment failed: ${punishmentResult.error}`);
      }
    } catch (err) {
      errors.push(`Error applying punishment: ${err.message}`);
    }

    // 4. Record trigger
    try {
      await HoneypotManager.recordTrigger(message.guildId, message.author.id, {
        message_id: message.id,
        channel_id: message.channelId,
        violation_type: 'INVITE_SPAM',
        message_content: message.content.substring(0, 500),
        deleted_count: cleanupSummary.totalDeleted || 0,
        punishment_applied: actionTaken,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      console.error('[HoneypotHandler] Error recording trigger:', err.message);
    }

    // 5. Send moderation embed to log channel
    if (config.log_channel_id) {
      try {
        const logChannel = await client.channels.fetch(config.log_channel_id).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
          const embed = createTriggerEmbed({
            user: message.author,
            triggerChannel: message.channel,
            violationType: 'INVITE_SPAM',
            messageContent: message.content,
            cleanupSummary,
            actionTaken,
            errors,
            detectedInvites,
          });

          await logChannel.send({ embeds: [embed] }).catch(err => {
            console.error('[HoneypotHandler] Error sending log embed:', err.message);
          });
        }
      } catch (err) {
        console.error('[HoneypotHandler] Error fetching log channel:', err.message);
      }
    }

    return true;

  } catch (err) {
    console.error('[HoneypotHandler] Unexpected error:', err);
    return false;
  }
}

module.exports = {
  processHoneypotMessage,
};
