// utils/honeypotEmbed.js — Generate moderation embeds for honeypot triggers

const { EmbedBuilder } = require("discord.js");

/**
 * Create trigger moderation embed
 * @param {Object} data - Embed data
 * @returns {EmbedBuilder} - Discord embed
 */
function createTriggerEmbed(data) {
  const {
    user,
    triggerChannel,
    violationType = "invite_spam",
    messageContent = "",
    cleanupSummary = {},
    actionTaken = "None",
    errors = [],
    detectedInvites = [],
    detectedAttachments = [],
  } = data;

  const embed = new EmbedBuilder()
    .setColor("#FF0000")
    .setTitle("🚨 Honey Pot Triggered")
    .setDescription(`${user} was detected through the honey pot trap`)
    .addFields(
      {
        name: "👤 User",
        value: `${user.toString()}\n${user.tag} • \`${user.id}\``,
        inline: false,
      },
      {
        name: "📍 Trigger Channel",
        value: triggerChannel.toString(),
        inline: true,
      },
      {
        name: "⚠️ Violation Type",
        value: violationType,
        inline: true,
      },
      {
        name: "💬 Message Content",
        value: truncateContent(messageContent, 200),
        inline: false,
      },
    );

  // Add detected evidence — field label and content depend on violation type
  if (violationType === "images_spam") {
    const imageEvidence =
      detectedAttachments.length > 0
        ? detectedAttachments
            .slice(0, 5)
            .map((url) => `\`${url}\``)
            .join("\n")
        : "*(file attachment)*";
    embed.addFields({
      name: "🖼️ Detected Images",
      value: imageEvidence,
      inline: false,
    });
  } else if (detectedInvites.length > 0) {
    embed.addFields({
      name: "🔗 Detected Invites",
      value: detectedInvites
        .slice(0, 5)
        .map((inv) => `\`${inv}\``)
        .join("\n"),
      inline: false,
    });
  }

  // Add cleanup summary
  const totalDeleted = cleanupSummary.totalDeleted || 0;
  const channelsText = Object.entries(cleanupSummary.channelsSummary || {})
    .map(([channel, count]) => `• ${channel}: ${count}`)
    .slice(0, 5)
    .join("\n");

  let cleanupText = `**Total Deleted:** ${totalDeleted} messages`;
  if (channelsText) {
    cleanupText += `\n${channelsText}`;
  }
  if ((cleanupSummary.errors || []).length > 0) {
    cleanupText += `\n**Errors:** ${(cleanupSummary.errors || []).slice(0, 2).join(", ")}`;
  }

  embed.addFields({
    name: "🧹 Global Cleanup",
    value: cleanupText || "No cleanup needed",
    inline: false,
  });

  // Add action taken
  embed.addFields({
    name: "⚙️ Action Taken",
    value: actionTaken || "Pending",
    inline: false,
  });

  // Add errors if any
  if (errors && errors.length > 0) {
    const errorText = errors
      .slice(0, 3)
      .map((e) => `• ${e}`)
      .join("\n");
    embed.addFields({
      name: "⚠️ Errors",
      value: errorText,
      inline: false,
    });
  }

  embed.setFooter({
    text: `Honey Pot Spam Trap • User ID: ${user.id}`,
    iconURL: user.displayAvatarURL({ dynamic: true }),
  });

  embed.setTimestamp();

  return embed;
}

/**
 * Create status embed (for /honeypot status command)
 * @param {Object} config - Honeypot configuration
 * @param {Guild} guild - Discord guild
 * @returns {EmbedBuilder} - Status embed
 */
function createStatusEmbed(config, guild) {
  const embed = new EmbedBuilder()
    .setColor(config.enabled ? "#00AA00" : "#FF0000")
    .setTitle("🍯 Honey Pot Configuration")
    .setDescription(`Honey Pot status for **${guild.name}**`)
    .addFields(
      {
        name: "📊 Status",
        value: config.enabled ? "✅ Enabled" : "❌ Disabled",
        inline: true,
      },
      {
        name: "🎯 Honeypot Channel",
        value: config.honeypot_channel_id
          ? `<#${config.honeypot_channel_id}>`
          : "Not configured",
        inline: true,
      },
      {
        name: "📋 Log Channel",
        value: config.log_channel_id
          ? `<#${config.log_channel_id}>`
          : "Not configured",
        inline: true,
      },
      {
        name: "⚔️ Punishment Mode",
        value: config.punishment_mode || "BAN",
        inline: true,
      },
      {
        name: "⏱️ Timeout Duration",
        value: config.timeout_duration_ms
          ? formatMs(config.timeout_duration_ms)
          : "N/A",
        inline: true,
      },
      {
        name: "🧹 Cleanup Enabled",
        value: config.cleanup_enabled ? "✅ Yes" : "❌ No",
        inline: true,
      },
      {
        name: "⏪ Cleanup Window",
        value: `${config.cleanup_window_minutes || 60} minutes`,
        inline: true,
      },
    );

  embed.setFooter({ text: `Server ID: ${guild.id}` });
  embed.setTimestamp();

  return embed;
}

/**
 * Create stats embed (for /honeypot stats command)
 * @param {Object} config - Honeypot configuration
 * @param {Guild} guild - Discord guild
 * @returns {EmbedBuilder} - Stats embed
 */
function createStatsEmbed(config, guild) {
  const embed = new EmbedBuilder()
    .setColor("#0099FF")
    .setTitle("📊 Honey Pot Statistics")
    .setDescription(`Statistics for **${guild.name}**`)
    .addFields(
      {
        name: "🚨 Total Triggers",
        value: `${config.total_triggers || 0}`,
        inline: true,
      },
      {
        name: "🔨 Total Bans",
        value: `${config.total_bans || 0}`,
        inline: true,
      },
      {
        name: "⏱️ Total Timeouts",
        value: `${config.total_timeouts || 0}`,
        inline: true,
      },
      {
        name: "🗑️ Total Deletions",
        value: `${config.total_deletions || 0}`,
        inline: true,
      },
      {
        name: "🕐 Last Trigger",
        value: config.last_trigger_at
          ? `<t:${Math.floor(new Date(config.last_trigger_at).getTime() / 1000)}:R>`
          : "Never",
        inline: true,
      },
    );

  embed.setFooter({ text: `Server ID: ${guild.id}` });
  embed.setTimestamp();

  return embed;
}

/**
 * Create info embed (for /honeypot test command preview)
 * @param {Guild} guild - Discord guild
 * @returns {EmbedBuilder} - Test/info embed
 */
function createTestEmbed(guild) {
  const embed = new EmbedBuilder()
    .setColor("#FF9900")
    .setTitle("🍯 Honey Pot Test")
    .setDescription("This is a test of the Honey Pot Spam Trap system.")
    .addFields(
      {
        name: "⚠️ What This Means",
        value: "If you see this, it means the Honey Pot is working correctly.",
      },
      {
        name: "🚨 When Triggered",
        value:
          "When someone sends an invite link in the configured honeypot channel, this bot will:\n1. Delete the message\n2. Clean up recent messages from that user\n3. Apply the configured punishment\n4. Log the incident",
      },
      {
        name: "✅ Safe Actions",
        value: "Whitelisted users and bots are exempt.",
      },
    )
    .setFooter({ text: `Server: ${guild.name}` })
    .setTimestamp();

  return embed;
}

/**
 * Truncate content to max length
 * @param {string} content - Content to truncate
 * @param {number} maxLength - Max length
 * @returns {string} - Truncated content
 */
function truncateContent(content, maxLength = 200) {
  if (!content) return "(No content)";
  if (content.length > maxLength) {
    return `${content.substring(0, maxLength)}...\n\`\`\``;
  }
  return `\`\`\`${content}\`\`\``;
}

/**
 * Format milliseconds to readable time
 * @param {number} ms - Milliseconds
 * @returns {string} - Formatted time
 */
function formatMs(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  return `${seconds} second${seconds > 1 ? "s" : ""}`;
}

module.exports = {
  createTriggerEmbed,
  createStatusEmbed,
  createStatsEmbed,
  createTestEmbed,
  truncateContent,
  formatMs,
};
