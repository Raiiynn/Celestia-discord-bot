const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('🛡️ Advanced AutoMod Configuration System')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    // ── General Settings ──
    .addSubcommandGroup(group =>
      group
        .setName('settings')
        .setDescription('Configure AutoMod features')
        .addSubcommand(sub =>
          sub
            .setName('inviteblock')
            .setDescription('Enable/disable invite link blocking')
            .addBooleanOption(o => o.setName('enabled').setDescription('Enable/disable').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('badwordblock')
            .setDescription('Enable/disable bad word filtering')
            .addBooleanOption(o => o.setName('enabled').setDescription('Enable/disable').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('spamblock')
            .setDescription('Enable/disable spam detection')
            .addBooleanOption(o => o.setName('enabled').setDescription('Enable/disable').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('autodelete')
            .setDescription('Auto-delete violating messages')
            .addBooleanOption(o => o.setName('enabled').setDescription('Enable/disable').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('thresholds')
            .setDescription('Set warning thresholds for auto-actions')
            .addIntegerOption(o => o.setName('mute').setDescription('Mute after N warnings (default: 2)').setMinValue(1).setMaxValue(10))
            .addIntegerOption(o => o.setName('kick').setDescription('Kick after N warnings (default: 3)').setMinValue(1).setMaxValue(10))
            .addIntegerOption(o => o.setName('mute_duration').setDescription('Mute duration in seconds (default: 300)').setMinValue(30).setMaxValue(3600))
        )
    )
    // ── Bad Words Management ──
    .addSubcommandGroup(group =>
      group
        .setName('badwords')
        .setDescription('Manage bad word list')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Add a bad word/pattern')
            .addStringOption(o => o.setName('word').setDescription('Word or regex pattern').setRequired(true))
            .addIntegerOption(o => o.setName('severity').setDescription('Severity: 1=warn, 2=mute, 3=kick').setMinValue(1).setMaxValue(3))
            .addBooleanOption(o => o.setName('is_regex').setDescription('Is this a regex pattern?'))
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Remove a bad word')
            .addStringOption(o => o.setName('word').setDescription('Word to remove').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('list')
            .setDescription('View all bad words')
        )
    )
    // ── Spam Patterns Management ──
    .addSubcommandGroup(group =>
      group
        .setName('spam')
        .setDescription('Manage spam patterns')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Add a spam pattern (regex)')
            .addStringOption(o => o.setName('pattern').setDescription('Regex pattern').setRequired(true))
            .addIntegerOption(o => o.setName('severity').setDescription('Severity: 1=warn, 2=mute, 3=kick').setMinValue(1).setMaxValue(3))
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Remove a spam pattern')
            .addStringOption(o => o.setName('pattern').setDescription('Pattern to remove').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('list')
            .setDescription('View all spam patterns')
        )
    )
    // ── Whitelist Management ──
    .addSubcommandGroup(group =>
      group
        .setName('whitelist')
        .setDescription('Manage whitelisted URLs')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Add a whitelisted URL')
            .addStringOption(o => o.setName('url').setDescription('URL or domain to whitelist').setRequired(true))
            .addStringOption(o => o.setName('reason').setDescription('Reason for whitelisting'))
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Remove a whitelisted URL')
            .addStringOption(o => o.setName('url').setDescription('URL to remove').setRequired(true))
        )
        .addSubcommand(sub =>
          sub
            .setName('list')
            .setDescription('View all whitelisted URLs')
        )
    )
    // ── Status & Info ──
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('View all AutoMod settings')
    )
    .addSubcommand(sub =>
      sub
        .setName('stats')
        .setDescription('View moderation statistics')
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // Settings group
    if (group === 'settings') {
      switch (subcommand) {
        case 'inviteblock':
          return await handleToggleSetting(interaction, guildId, 'invite_block');
        case 'badwordblock':
          return await handleToggleSetting(interaction, guildId, 'badword_block');
        case 'spamblock':
          return await handleToggleSetting(interaction, guildId, 'spam_block');
        case 'autodelete':
          return await handleToggleSetting(interaction, guildId, 'auto_delete');
        case 'thresholds':
          return await handleThresholds(interaction, guildId);
      }
    }

    // Bad words group
    if (group === 'badwords') {
      switch (subcommand) {
        case 'add':
          return await handleAddBadword(interaction, guildId);
        case 'remove':
          return await handleRemoveBadword(interaction, guildId);
        case 'list':
          return await handleListBadwords(interaction, guildId);
      }
    }

    // Spam group
    if (group === 'spam') {
      switch (subcommand) {
        case 'add':
          return await handleAddSpam(interaction, guildId);
        case 'remove':
          return await handleRemoveSpam(interaction, guildId);
        case 'list':
          return await handleListSpam(interaction, guildId);
      }
    }

    // Whitelist group
    if (group === 'whitelist') {
      switch (subcommand) {
        case 'add':
          return await handleAddWhitelist(interaction, guildId);
        case 'remove':
          return await handleRemoveWhitelist(interaction, guildId);
        case 'list':
          return await handleListWhitelist(interaction, guildId);
      }
    }

    // Direct subcommands
    if (subcommand === 'status') {
      return await handleStatus(interaction, guildId);
    }
    if (subcommand === 'stats') {
      return await handleStats(interaction, guildId);
    }
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// HANDLERS
// ──────────────────────────────────────────────────────────────────────────────

async function handleToggleSetting(interaction, guildId, setting) {
  const enabled = interaction.options.getBoolean('enabled');
  try {
    await storage.setAutoMod(guildId, { [setting]: enabled });
    const embed = new EmbedBuilder()
      .setColor(enabled ? 0x00FF00 : 0xFF0000)
      .setTitle('⚙️ Setting Updated')
      .addFields({ name: setting.toUpperCase(), value: enabled ? '✅ Enabled' : '❌ Disabled' })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error(e);
    await interaction.reply({ content: '❌ Error updating setting', ephemeral: true });
  }
}

async function handleThresholds(interaction, guildId) {
  const mute = interaction.options.getInteger('mute');
  const kick = interaction.options.getInteger('kick');
  const duration = interaction.options.getInteger('mute_duration');

  try {
    const updates = {};
    if (mute) updates.warning_threshold_mute = mute;
    if (kick) updates.warning_threshold_kick = kick;
    if (duration) updates.mute_duration = duration;

    await storage.setAutoMod(guildId, updates);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('⚙️ Thresholds Updated')
      .addFields(
        { name: 'Mute After', value: `${mute || '(unchanged)'}`, inline: true },
        { name: 'Kick After', value: `${kick || '(unchanged)'}`, inline: true },
        { name: 'Mute Duration', value: `${duration ? duration + 's' : '(unchanged)'}`, inline: true }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error(e);
    await interaction.reply({ content: '❌ Error updating thresholds', ephemeral: true });
  }
}

async function handleAddBadword(interaction, guildId) {
  const word = interaction.options.getString('word');
  const severity = interaction.options.getInteger('severity') || 1;
  const isRegex = interaction.options.getBoolean('is_regex') || false;

  try {
    const success = await storage.addBadword(guildId, word, severity, isRegex, interaction.user.id);
    if (!success) {
      return await interaction.reply({ content: '⚠️ Word already exists', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Bad Word Added')
      .addFields(
        { name: 'Pattern', value: `\`${word}\``, inline: true },
        { name: 'Severity', value: `${severity === 1 ? 'Warn' : severity === 2 ? 'Mute' : 'Kick'}`, inline: true },
        { name: 'Regex', value: isRegex ? 'Yes' : 'No', inline: true }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error(e);
    await interaction.reply({ content: '❌ Error adding bad word', ephemeral: true });
  }
}

async function handleRemoveBadword(interaction, guildId) {
  const word = interaction.options.getString('word');

  try {
    await storage.removeBadword(guildId, word);
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Bad Word Removed')
      .addFields({ name: 'Pattern', value: `\`${word}\`` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error(e);
    await interaction.reply({ content: '❌ Error removing bad word', ephemeral: true });
  }
}

async function handleListBadwords(interaction, guildId) {
  try {
    const badwords = await storage.getBadwords(guildId);
    if (badwords.length === 0) {
      return await interaction.reply({ content: '📋 No bad words configured', ephemeral: true });
    }

    const fields = badwords.map(w => ({
      name: `${w.pattern}${w.is_regex ? ' (Regex)' : ''}`,
      value: `Severity: ${w.severity === 1 ? 'Warn' : w.severity === 2 ? 'Mute' : 'Kick'}`,
      inline: true,
    }));

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📋 Bad Words List (${badwords.length})`)
      .addFields(fields)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error(e);
    await interaction.reply({ content: '❌ Error loading bad words', ephemeral: true });
  }
}

async function handleAddSpam(interaction, guildId) {
  const pattern = interaction.options.getString('pattern');
  const severity = interaction.options.getInteger('severity') || 1;

  try {
    const success = await storage.addSpamPattern(guildId, pattern, severity, interaction.user.id);
    if (!success) {
      return await interaction.reply({ content: '⚠️ Pattern already exists', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Spam Pattern Added')
      .addFields(
        { name: 'Pattern', value: `\`${pattern}\`` },
        { name: 'Severity', value: severity === 1 ? 'Warn' : severity === 2 ? 'Mute' : 'Kick' }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error(e);
    await interaction.reply({ content: '❌ Error adding spam pattern', ephemeral: true });
  }
}

async function handleRemoveSpam(interaction, guildId) {
  const pattern = interaction.options.getString('pattern');

  try {
    await storage.removeSpamPattern(guildId, pattern);
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Spam Pattern Removed')
      .addFields({ name: 'Pattern', value: `\`${pattern}\`` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error(e);
    await interaction.reply({ content: '❌ Error removing spam pattern', ephemeral: true });
  }
}

async function handleListSpam(interaction, guildId) {
  try {
    const patterns = await storage.getSpamPatterns(guildId);
    if (patterns.length === 0) {
      return await interaction.reply({ content: '📋 No spam patterns configured', ephemeral: true });
    }

    const fields = patterns.map(p => ({
      name: p.pattern,
      value: `Severity: ${p.severity === 1 ? 'Warn' : p.severity === 2 ? 'Mute' : 'Kick'}`,
      inline: true,
    }));

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📋 Spam Patterns (${patterns.length})`)
      .addFields(fields)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error(e);
    await interaction.reply({ content: '❌ Error loading spam patterns', ephemeral: true });
  }
}

async function handleAddWhitelist(interaction, guildId) {
  const url = interaction.options.getString('url');
  const reason = interaction.options.getString('reason');

  try {
    const success = await storage.addWhitelistUrl(guildId, url, reason, interaction.user.id);
    if (!success) {
      return await interaction.reply({ content: '⚠️ URL already whitelisted', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ URL Whitelisted')
      .addFields(
        { name: 'URL', value: `\`${url}\`` },
        { name: 'Reason', value: reason || 'No reason provided' }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error(e);
    await interaction.reply({ content: '❌ Error adding whitelist', ephemeral: true });
  }
}

async function handleRemoveWhitelist(interaction, guildId) {
  const url = interaction.options.getString('url');

  try {
    await storage.removeWhitelistUrl(guildId, url);
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ URL Removed from Whitelist')
      .addFields({ name: 'URL', value: `\`${url}\`` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error(e);
    await interaction.reply({ content: '❌ Error removing from whitelist', ephemeral: true });
  }
}

async function handleListWhitelist(interaction, guildId) {
  try {
    const whitelist = await storage.getWhitelistUrls(guildId);
    if (whitelist.length === 0) {
      return await interaction.reply({ content: '📋 No whitelisted URLs', ephemeral: true });
    }

    const fields = whitelist.map(w => ({
      name: w.url,
      value: w.reason || 'No reason',
      inline: true,
    }));

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📋 Whitelisted URLs (${whitelist.length})`)
      .addFields(fields)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error(e);
    await interaction.reply({ content: '❌ Error loading whitelist', ephemeral: true });
  }
}

async function handleStatus(interaction, guildId) {
  try {
    const settings = await storage.getAutoMod(guildId);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('⚙️ AutoMod Status')
      .addFields(
        {
          name: '🔗 Invite Blocking',
          value: settings?.invite_block ? '✅ Enabled' : '❌ Disabled',
          inline: true,
        },
        {
          name: '🚫 Bad Word Filter',
          value: settings?.badword_block ? '✅ Enabled' : '❌ Disabled',
          inline: true,
        },
        {
          name: '📧 Spam Detection',
          value: settings?.spam_block ? '✅ Enabled' : '❌ Disabled',
          inline: true,
        },
        {
          name: '📋 Log Channel',
          value: settings?.log_channel_id ? `<#${settings.log_channel_id}>` : '❌ Not Set',
          inline: true,
        },
        {
          name: '🗑️ Auto-Delete',
          value: settings?.auto_delete !== false ? '✅ Yes' : '❌ No',
          inline: true,
        },
        {
          name: '⚠️ Mute Threshold',
          value: `After ${settings?.warning_threshold_mute || 2} warnings`,
          inline: true,
        },
        {
          name: '🦵 Kick Threshold',
          value: `After ${settings?.warning_threshold_kick || 3} warnings`,
          inline: true,
        },
        {
          name: '⏱️ Mute Duration',
          value: `${settings?.mute_duration || 300} seconds`,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error(e);
    await interaction.reply({ content: '❌ Error loading status', ephemeral: true });
  }
}

async function handleStats(interaction, guildId) {
  try {
    const stats = await storage.getStatistics(guildId);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('📊 Moderation Statistics')
      .addFields(
        { name: '🔗 Invites Blocked', value: `${stats.invite_blocked}`, inline: true },
        { name: '🚫 Bad Words Blocked', value: `${stats.badwords_blocked}`, inline: true },
        { name: '📧 Spam Blocked', value: `${stats.spam_blocked}`, inline: true },
        { name: '⚠️ Warnings Given', value: `${stats.warnings_given}`, inline: true },
        { name: '🔇 Mutes Given', value: `${stats.mutes_given}`, inline: true },
        { name: '🦵 Kicks Given', value: `${stats.kicks_given}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (e) {
    console.error(e);
    await interaction.reply({ content: '❌ Error loading statistics', ephemeral: true });
  }
}

