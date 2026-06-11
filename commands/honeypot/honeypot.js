// commands/honeypot/honeypot.js — Master honey pot command with all subcommands

const { SlashCommandBuilder, ChannelType } = require('discord.js');
const HoneypotManager = require('../../lib/HoneypotManager');
const { createStatusEmbed, createStatsEmbed, createTestEmbed } = require('../../utils/honeypotEmbed');
const { buildBanEmbed } = require('../../utils/banEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('honeypot')
    .setDescription('🍯 Manage honey pot spam trap')
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Configure honey pot for this server')
        .addChannelOption(opt =>
          opt
            .setName('honeypot_channel')
            .setDescription('Channel to monitor for invite spam')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt
            .setName('log_channel')
            .setDescription('Channel to send moderation logs')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('punishment_mode')
            .setDescription('Punishment to apply')
            .setRequired(true)
            .addChoices(
              { name: 'Delete Only', value: 'DELETE_ONLY' },
              { name: 'Timeout', value: 'TIMEOUT' },
              { name: 'Ban', value: 'BAN' }
            )
        )
        .addIntegerOption(opt =>
          opt
            .setName('cleanup_window')
            .setDescription('Minutes to look back for cleanup (default 60)')
            .setRequired(false)
            .setMinValue(5)
            .setMaxValue(1440)
        )
        .addIntegerOption(opt =>
          opt
            .setName('timeout_duration')
            .setDescription('Timeout duration in minutes (for TIMEOUT mode)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(40320)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('View current honey pot configuration')
    )
    .addSubcommand(sub =>
      sub
        .setName('enable')
        .setDescription('Enable honey pot for this server')
    )
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Disable honey pot for this server')
    )
    .addSubcommand(sub =>
      sub
        .setName('stats')
        .setDescription('View honey pot statistics')
    )
    .addSubcommand(sub =>
      sub
        .setName('test')
        .setDescription('Send a preview embed (no punishment)')
    )
    .addSubcommand(sub =>
      sub
        .setName('embed-init')
        .setDescription('Create and link auto-updating ban-count embed to a channel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel where the embed will be posted')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('whitelist')
        .setDescription('Manage honey pot whitelist')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Add user or role to whitelist')
            .addUserOption(opt =>
              opt
                .setName('user')
                .setDescription('User to whitelist')
                .setRequired(false)
            )
            .addRoleOption(opt =>
              opt
                .setName('role')
                .setDescription('Role to whitelist')
                .setRequired(false)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Remove user or role from whitelist')
            .addStringOption(opt =>
              opt
                .setName('entry_id')
                .setDescription('ID of the entry to remove')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('list')
            .setDescription('List all whitelisted users and roles')
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const subcommandGroup = interaction.options.getSubcommandGroup();

    // Check admin permission for all commands
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: '❌ You need Administrator permission',
        ephemeral: true,
      });
    }

    try {
      if (subcommandGroup === 'whitelist') {
        await handleWhitelist(interaction, subcommand);
      } else {
        switch (subcommand) {
          case 'setup':
            await handleSetup(interaction);
            break;
          case 'status':
            await handleStatus(interaction);
            break;
          case 'enable':
            await handleEnable(interaction);
            break;
          case 'disable':
            await handleDisable(interaction);
            break;
          case 'stats':
            await handleStats(interaction);
            break;
          case 'test':
            await handleTest(interaction);
            break;
          case 'embed-init':
            await handleEmbedInit(interaction);
            break;
        }
      }
    } catch (err) {
      console.error('[HoneypotCommand] Error:', err);
      const reply = {
        content: `❌ Error: ${err.message}`,
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  },
};

async function handleSetup(interaction) {
  const honeypotChannel = interaction.options.getChannel('honeypot_channel');
  const logChannel = interaction.options.getChannel('log_channel');
  const punishmentMode = interaction.options.getString('punishment_mode');
  const cleanupWindow = interaction.options.getInteger('cleanup_window') || 60;
  const timeoutDuration = interaction.options.getInteger('timeout_duration') || 60;

  await interaction.deferReply();

  const config = await HoneypotManager.upsertConfig(interaction.guildId, {
    enabled: true,
    honeypot_channel_id: honeypotChannel.id,
    log_channel_id: logChannel.id,
    punishment_mode: punishmentMode,
    timeout_duration_ms: timeoutDuration * 60 * 1000,
    cleanup_enabled: true,
    cleanup_window_minutes: cleanupWindow,
  });

  if (!config) {
    return interaction.editReply({
      content: '❌ Failed to save configuration',
    });
  }

  await interaction.editReply({
    content: `✅ **Honey Pot Configured**\n\n` +
      `🎯 Honeypot Channel: ${honeypotChannel}\n` +
      `📋 Log Channel: ${logChannel}\n` +
      `⚔️ Punishment: ${punishmentMode}\n` +
      `⏪ Cleanup Window: ${cleanupWindow} minutes\n` +
      `⏱️ Timeout Duration: ${timeoutDuration} minutes\n\n` +
      `🚀 Honey pot is now **ENABLED** and ready to monitor!`,
  });
}

async function handleStatus(interaction) {
  await interaction.deferReply();

  const config = await HoneypotManager.getConfig(interaction.guildId);
  if (!config) {
    return interaction.editReply({
      content: '❌ Honey pot not configured for this server. Use `/honeypot setup` first.',
    });
  }

  const embed = createStatusEmbed(config, interaction.guild);
  await interaction.editReply({ embeds: [embed] });
}

async function handleEnable(interaction) {
  await interaction.deferReply();

  const config = await HoneypotManager.getConfig(interaction.guildId);
  if (!config) {
    return interaction.editReply({
      content: '❌ Honey pot not configured. Use `/honeypot setup` first.',
    });
  }

  const updated = await HoneypotManager.upsertConfig(interaction.guildId, { enabled: true });
  if (!updated) {
    return interaction.editReply({ content: '❌ Failed to enable' });
  }

  await interaction.editReply({
    content: '✅ **Honey Pot Enabled** - Now monitoring for invite spam!',
  });
}

async function handleDisable(interaction) {
  await interaction.deferReply();

  const config = await HoneypotManager.getConfig(interaction.guildId);
  if (!config) {
    return interaction.editReply({
      content: '❌ Honey pot not configured.',
    });
  }

  const updated = await HoneypotManager.upsertConfig(interaction.guildId, { enabled: false });
  if (!updated) {
    return interaction.editReply({ content: '❌ Failed to disable' });
  }

  await interaction.editReply({
    content: '⛔ **Honey Pot Disabled** - No longer monitoring for invite spam.',
  });
}

async function handleStats(interaction) {
  await interaction.deferReply();

  const config = await HoneypotManager.getConfig(interaction.guildId);
  if (!config) {
    return interaction.editReply({
      content: '❌ Honey pot not configured.',
    });
  }

  const embed = createStatsEmbed(config, interaction.guild);
  await interaction.editReply({ embeds: [embed] });
}

async function handleTest(interaction) {
  await interaction.deferReply();

  const config = await HoneypotManager.getConfig(interaction.guildId);
  if (!config) {
    return interaction.editReply({
      content: '❌ Honey pot not configured.',
    });
  }

  const embed = createTestEmbed(interaction.guild);
  await interaction.editReply({ embeds: [embed] });
}

async function handleEmbedInit(interaction) {
  await interaction.deferReply();

  const config = await HoneypotManager.getConfig(interaction.guildId);
  if (!config) {
    return interaction.editReply({
      content: '❌ Honey pot not configured. Use `/honeypot setup` first.',
    });
  }

  const channel = interaction.options.getChannel('channel');
  if (!channel.isTextBased()) {
    return interaction.editReply({
      content: '❌ Channel must be a text channel',
    });
  }

  try {
    // Build initial embed with current ban count
    const banCount = config.total_bans || 0;
    const embed = buildBanEmbed({
      guildName: interaction.guild.name,
      banCount,
      bilingual: true,
      footerText: `Auto Moderation - Honey Pot • ${new Date().toLocaleString()}`,
    });

    // Send embed to target channel
    const message = await channel.send({ embeds: [embed] });

    // Save message ID and channel ID to config
    const updated = await HoneypotManager.upsertConfig(interaction.guildId, {
      embed_channel_id: channel.id,
      embed_message_id: message.id,
    });

    if (!updated) {
      return interaction.editReply({
        content: '⚠️ Embed sent but failed to save message ID to database',
      });
    }

    await interaction.editReply({
      content: `✅ **Ban-count embed initialized**\n\n` +
        `📍 Posted in: ${channel}\n` +
        `🔗 Message ID: \`${message.id}\`\n\n` +
        `📊 The embed will auto-update when bans are applied or removed!`,
    });
  } catch (err) {
    console.error('[handleEmbedInit] Error:', err);
    return interaction.editReply({
      content: `❌ Failed to send embed: ${err.message}`,
    });
  }
}

async function handleWhitelist(interaction, subcommand) {
  await interaction.deferReply();

  const config = await HoneypotManager.getConfig(interaction.guildId);
  if (!config) {
    return interaction.editReply({
      content: '❌ Honey pot not configured.',
    });
  }

  switch (subcommand) {
    case 'add': {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');

      if (!user && !role) {
        return interaction.editReply({
          content: '❌ Please specify a user or role to whitelist',
        });
      }

      if (user) {
        const entry = await HoneypotManager.addWhitelist(
          interaction.guildId,
          user.id,
          'USER',
          interaction.user.id
        );
        if (entry) {
          return interaction.editReply({
            content: `✅ Added **${user.tag}** to whitelist`,
          });
        } else {
          return interaction.editReply({
            content: `⚠️ User may already be whitelisted or error occurred`,
          });
        }
      }

      if (role) {
        const entry = await HoneypotManager.addWhitelist(
          interaction.guildId,
          role.id,
          'ROLE',
          interaction.user.id
        );
        if (entry) {
          return interaction.editReply({
            content: `✅ Added role **${role.name}** to whitelist`,
          });
        } else {
          return interaction.editReply({
            content: `⚠️ Role may already be whitelisted or error occurred`,
          });
        }
      }
      break;
    }

    case 'remove': {
      const entryId = interaction.options.getString('entry_id');
      // For simplicity, we'll treat this as a target_id
      // In production, you might want a better way to identify entries
      return interaction.editReply({
        content: '⚠️ Remove feature requires providing target ID. Please use list first to see entries.',
      });
    }

    case 'list': {
      const whitelist = await HoneypotManager.getWhitelist(interaction.guildId);
      if (whitelist.length === 0) {
        return interaction.editReply({
          content: '📋 **Whitelist is empty**',
        });
      }

      let text = '📋 **Whitelisted Users & Roles:**\n\n';
      for (const entry of whitelist.slice(0, 20)) {
        const type = entry.target_type === 'USER' ? '👤' : '📍';
        text += `${type} \`${entry.target_id}\` (${entry.target_type})\n`;
      }

      if (whitelist.length > 20) {
        text += `\n... and ${whitelist.length - 20} more`;
      }

      return interaction.editReply({ content: text });
    }
  }
}
