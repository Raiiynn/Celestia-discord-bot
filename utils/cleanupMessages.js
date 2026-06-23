// utils/cleanupMessages.js — Global message cleanup utility

/**
 * Delete recent messages from a user across accessible channels
 * @param {Guild} guild - Discord guild
 * @param {string} userId - User ID to clean up
 * @param {number} windowMinutes - Time window in minutes to look back
 * @returns {Promise<Object>} - Cleanup summary {totalDeleted, channels, errors}
 */
async function cleanupUserMessages(guild, userId, windowMinutes = 60) {
  const summary = {
    totalDeleted: 0,
    channelsSummary: {},
    errors: [],
    startTime: new Date(),
  };

  if (!guild || !userId) {
    summary.errors.push("Missing guild or userId");
    return summary;
  }

  const cutoffTime = Date.now() - windowMinutes * 60 * 1000;

  try {
    const channels = guild.channels.cache.filter(
      (ch) => ch.isTextBased() && !ch.isDMBased(),
    );

    for (const [channelId, channel] of channels) {
      try {
        // Check if bot can view this channel
        if (!channel.permissionsFor(guild.me).has('ViewChannel')) {
          summary.errors.push(`No access to ${channel.name} (#${channelId})`);
          continue;
        }

        // Check if bot can manage messages
        if (!channel.permissionsFor(guild.me).has('ManageMessages')) {
          summary.errors.push(`Cannot delete in ${channel.name} - no permission`);
          continue;
        }

        let deletedInChannel = 0;
        let lastMessage = null;
        let hasMore = true;

        while (hasMore) {
          try {
            const options = {};
            if (lastMessage) {
              options.before = lastMessage.id;
            }

            // Fetch messages in batches
            const messages = await channel.messages
              .fetch({ limit: 100, ...options })
              .catch(() => null);

            if (!messages || messages.size === 0) {
              hasMore = false;
              break;
            }

            // Filter messages from the user within the time window
            const toDelete = messages.filter(
              (msg) =>
                msg.author?.id === userId && msg.createdTimestamp > cutoffTime,
            );

            if (toDelete.size === 0) {
              hasMore = false;
              break;
            }

            // Delete messages (Discord allows bulk delete up to 100, but older than 14 days requires individual delete)
            for (const [, msg] of toDelete) {
              try {
                await msg.delete().catch(() => null);
                deletedInChannel++;
                summary.totalDeleted++;
              } catch (err) {
                // Continue on individual deletion failures
              }
            }

            lastMessage = messages.last();

            // Small delay to avoid rate limits
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (err) {
            summary.errors.push(
              `Fetch error in ${channel.name}: ${err.message}`,
            );
            hasMore = false;
          }
        }

        if (deletedInChannel > 0) {
          summary.channelsSummary[channel.name] = deletedInChannel;
        }
      } catch (err) {
        summary.errors.push(
          `Channel error ${channel?.name || "unknown"}: ${err.message}`,
        );
      }
    }
  } catch (err) {
    summary.errors.push(`Global cleanup error: ${err.message}`);
  }

  summary.endTime = new Date();
  return summary;
}

/**
 * Format cleanup summary for logging
 * @param {Object} summary - Cleanup summary object
 * @returns {string} - Formatted summary
 */
function formatCleanupSummary(summary) {
  if (!summary) return "No cleanup performed";

  let text = `🧹 **Global Cleanup Summary**\n`;
  text += `Total Deleted: **${summary.totalDeleted}** messages\n`;

  if (Object.keys(summary.channelsSummary).length > 0) {
    text += `\n**Channels:**\n`;
    for (const [channel, count] of Object.entries(summary.channelsSummary)) {
      text += `• ${channel}: ${count}\n`;
    }
  }

  if (summary.errors.length > 0) {
    text += `\n**Errors/Skipped:**\n`;
    for (const error of summary.errors.slice(0, 5)) {
      text += `• ${error}\n`;
    }
    if (summary.errors.length > 5) {
      text += `• ... and ${summary.errors.length - 5} more\n`;
    }
  }

  return text;
}

module.exports = {
  cleanupUserMessages,
  formatCleanupSummary,
};
