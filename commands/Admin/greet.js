/**
 * Greet Messages Command
 * Configure welcome messages for new members with customizable text or embeds
 */

const Discord = require('discord.js');
const GreetManager = require('../../lib/GreetManager');

module.exports = {
  data: new Discord.SlashCommandBuilder()
    .setName('greet')
    .setDescription('Configure automatic greet messages for new members')
    .setDefaultMemberPermissions(Discord.PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Setup greet messages')
        .addStringOption(opt =>
          opt
            .setName('mode')
            .setDescription('Message mode: simple (text) or embed')
            .setRequired(true)
            .addChoices(
              { name: 'Simple (Text)', value: 'simple' },
              { name: 'Embed', value: 'embed' }
            )
        )
        .addChannelOption(opt =>
          opt
            .setName('channel1')
            .setDescription('First greet channel')
            .addChannelTypes(Discord.ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt
            .setName('channel2')
            .setDescription('Second greet channel (optional)')
            .addChannelTypes(Discord.ChannelType.GuildText)
        )
        .addChannelOption(opt =>
          opt
            .setName('channel3')
            .setDescription('Third greet channel (optional)')
            .addChannelTypes(Discord.ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('message')
        .setDescription('Set the greet message text')
        .addStringOption(opt =>
          opt
            .setName('text')
            .setDescription('Message text (supports {user}, {mention}, {server}, {memberCount}, {tag})')
            .setRequired(true)
            .setMaxLength(2000)
        )
        .addIntegerOption(opt =>
          opt
            .setName('delete_after')
            .setDescription('Auto-delete message after X seconds (0 = never delete)')
            .setMinValue(0)
            .setMaxValue(86400)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('embed')
        .setDescription('Set embed message (title, description, colors, images)')
        .addStringOption(opt =>
          opt
            .setName('title')
            .setDescription('Embed title (supports {user}, {mention}, {server}, {memberCount}, {tag})')
            .setRequired(true)
            .setMaxLength(256)
        )
        .addStringOption(opt =>
          opt
            .setName('description')
            .setDescription('Embed description (supports variables, max 2000 chars)')
            .setRequired(true)
            .setMaxLength(2000)
        )
        .addStringOption(opt =>
          opt
            .setName('color')
            .setDescription('Hex color (e.g., #FF0000)')
        )
        .addStringOption(opt =>
          opt
            .setName('thumbnail')
            .setDescription('Thumbnail image URL')
        )
        .addStringOption(opt =>
          opt
            .setName('image')
            .setDescription('Banner image URL')
        )
        .addIntegerOption(opt =>
          opt
            .setName('delete_after')
            .setDescription('Auto-delete message after X seconds (0 = never delete)')
            .setMinValue(0)
            .setMaxValue(86400)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('preview')
        .setDescription('Preview the greet message')
    )
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Disable greet messages')
    ),

  async execute(interaction, client) {
    await interaction.deferReply();

    try {
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guildId;

      if (subcommand === 'setup') {
        return await handleSetup(interaction, guildId);
      } else if (subcommand === 'message') {
        return await handleMessage(interaction, guildId);
      } else if (subcommand === 'embed') {
        return await handleEmbed(interaction, guildId);
      } else if (subcommand === 'preview') {
        return await handlePreview(interaction, guildId);
      } else if (subcommand === 'disable') {
        return await handleDisable(interaction, guildId);
      }
    } catch (err) {
      console.error('[Greet] Error:', err);
      return await interaction.editReply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true,
      });
    }
  },
};

async function handleSetup(interaction, guildId) {
  const mode = interaction.options.getString('mode');
  const channel1 = interaction.options.getChannel('channel1');
  const channel2 = interaction.options.getChannel('channel2');
  const channel3 = interaction.options.getChannel('channel3');

  const channels = [channel1.id];
  if (channel2) channels.push(channel2.id);
  if (channel3) channels.push(channel3.id);

  try {
    await GreetManager.setupGreet(guildId, {
      mode,
      channels,
    });

    const embed = new Discord.EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Greet Setup Configured')
      .setDescription(`Greet messages enabled in **${channels.length}** channel(s)`)
      .addFields(
        { name: 'Mode', value: `\`${mode}\``, inline: true },
        { name: 'Channels', value: channels.map(id => `<#${id}>`).join(', '), inline: true }
      )
      .setFooter({ text: 'Next: Use /greet message or /greet embed to set message content' });

    return await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Greet Setup] Error:', err);
    return await interaction.editReply({
      content: '❌ Failed to setup greet messages.',
    });
  }
}

async function handleMessage(interaction, guildId) {
  const text = interaction.options.getString('text');
  const deleteAfter = interaction.options.getInteger('delete_after');

  try {
    await GreetManager.setupGreet(guildId, {
      mode: 'simple',
      message: text,
      deleteAfter,
    });

    const embed = new Discord.EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Greet Message Set')
      .setDescription('Simple text message configured for new members')
      .addFields(
        { name: 'Message Preview', value: `\`\`\`${text}\`\`\`` },
        { name: 'Auto-Delete', value: deleteAfter ? `${deleteAfter}s` : 'Disabled', inline: true }
      )
      .setFooter({ text: 'Variables: {user}, {mention}, {server}, {memberCount}, {tag}' });

    return await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Greet Message] Error:', err);
    return await interaction.editReply({
      content: '❌ Failed to set greet message.',
    });
  }
}

async function handleEmbed(interaction, guildId) {
  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  const color = interaction.options.getString('color');
  const thumbnail = interaction.options.getString('thumbnail');
  const image = interaction.options.getString('image');
  const deleteAfter = interaction.options.getInteger('delete_after');

  try {
    const embedData = {
      title,
      description,
      color: color ? parseInt(color.replace('#', '0x'), 16) : 0x5865F2,
      thumbnail: thumbnail || null,
      image: image || null,
    };

    await GreetManager.setupGreet(guildId, {
      mode: 'embed',
      embed: embedData,
      deleteAfter,
    });

    const previewEmbed = new Discord.EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(embedData.color);

    if (thumbnail) previewEmbed.setThumbnail(thumbnail);
    if (image) previewEmbed.setImage(image);

    const resultEmbed = new Discord.EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Greet Embed Set')
      .setDescription('Embed message configured for new members')
      .addFields(
        { name: 'Preview', value: '(See below)' },
        { name: 'Auto-Delete', value: deleteAfter ? `${deleteAfter}s` : 'Disabled', inline: true }
      )
      .setFooter({ text: 'Variables: {user}, {mention}, {server}, {memberCount}, {tag}' });

    return await interaction.editReply({
      embeds: [resultEmbed, previewEmbed],
    });
  } catch (err) {
    console.error('[Greet Embed] Error:', err);
    return await interaction.editReply({
      content: '❌ Failed to set greet embed.',
    });
  }
}

async function handlePreview(interaction, guildId) {
  try {
    const settings = await GreetManager.getGreetSettings(guildId);

    if (!settings || !settings.greet_enabled) {
      return await interaction.editReply({
        content: '❌ Greet messages are not configured. Use `/greet setup` first.',
        ephemeral: true,
      });
    }

    const member = interaction.member;
    const guild = interaction.guild;

    if (settings.greet_mode === 'embed' && settings.greet_embed) {
      const embedData = settings.greet_embed;
      const embed = new Discord.EmbedBuilder()
        .setTitle(GreetManager.replaceVariables(embedData.title, member, guild))
        .setDescription(GreetManager.replaceVariables(embedData.description, member, guild));

      if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
      if (embedData.image) embed.setImage(embedData.image);
      if (embedData.color) embed.setColor(embedData.color);

      const info = new Discord.EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Greet Preview')
        .setDescription('This is how new members will be greeted:')
        .setFooter({ text: `Delete after: ${settings.greet_delete_after ? `${settings.greet_delete_after}s` : 'Never'}` });

      return await interaction.editReply({ embeds: [info, embed] });
    } else {
      const message = GreetManager.replaceVariables(settings.greet_message, member, guild);
      const embed = new Discord.EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Greet Preview')
        .setDescription(message)
        .setFooter({ text: `Delete after: ${settings.greet_delete_after ? `${settings.greet_delete_after}s` : 'Never'}` });

      return await interaction.editReply({ embeds: [embed] });
    }
  } catch (err) {
    console.error('[Greet Preview] Error:', err);
    return await interaction.editReply({
      content: '❌ Failed to generate preview.',
    });
  }
}

async function handleDisable(interaction, guildId) {
  try {
    await GreetManager.disableGreet(guildId);

    const embed = new Discord.EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('✅ Greet Disabled')
      .setDescription('Greet messages have been disabled for this server.');

    return await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Greet Disable] Error:', err);
    return await interaction.editReply({
      content: '❌ Failed to disable greet messages.',
    });
  }
}
