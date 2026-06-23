'use strict';

/**
 * commands/Admin/aiConfig.js
 *
 * /ai channel [#channel]  — set (or clear) the channel where bot auto-replies on mention
 * /ai persona [teks]      — set (or reset) the AI persona/personality for this server
 * /ai status              — show current AI config
 *
 * Requires ManageGuild permission.
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const storage = require('../../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Konfigurasi AI chatbot server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('channel')
        .setDescription('Set channel khusus untuk AI auto-reply (kosongkan untuk hapus batasan)')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel yang dituju — kosongkan untuk hapus batasan')
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('persona')
        .setDescription('Set kepribadian/persona AI bot untuk server ini')
        .addStringOption(opt =>
          opt
            .setName('teks')
            .setDescription('Deskripsi persona — kosongkan untuk reset ke default')
            .setMaxLength(1000)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Tampilkan konfigurasi AI saat ini')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'channel') return handleChannel(interaction);
    if (sub === 'persona')  return handlePersona(interaction);
    if (sub === 'status')   return handleStatus(interaction);
  },
};

// ─── /ai channel ─────────────────────────────────────────────────────────────

async function handleChannel(interaction) {
  const channel = interaction.options.getChannel('channel');

  try {
    await storage.setAiConfig(interaction.guildId, {
      channel_id: channel?.id ?? null,
    });

    if (channel) {
      return interaction.reply({
        content: `✅ AI auto-reply sekarang hanya aktif di ${channel}.\nUser harus mention bot di channel tersebut.`,
        flags: 64,
      });
    }

    return interaction.reply({
      content: '✅ Batasan channel dihapus — bot akan auto-reply mention di channel manapun.',
      flags: 64,
    });
  } catch (err) {
    console.error('[/ai channel]', err.message);
    return interaction.reply({
      content: `❌ Gagal menyimpan config: \`${err.message}\``,
      flags: 64,
    });
  }
}

// ─── /ai persona ─────────────────────────────────────────────────────────────

async function handlePersona(interaction) {
  const teks = interaction.options.getString('teks')?.trim() || null;

  try {
    await storage.setAiConfig(interaction.guildId, { persona: teks });

    if (teks) {
      const preview = teks.length > 300 ? teks.slice(0, 300) + '…' : teks;
      return interaction.reply({
        content: `✅ Persona AI diupdate:\n>>> ${preview}`,
        flags: 64,
      });
    }

    return interaction.reply({
      content: '✅ Persona direset ke default.',
      flags: 64,
    });
  } catch (err) {
    console.error('[/ai persona]', err.message);
    return interaction.reply({
      content: `❌ Gagal menyimpan persona: \`${err.message}\``,
      flags: 64,
    });
  }
}

// ─── /ai status ──────────────────────────────────────────────────────────────

async function handleStatus(interaction) {
  try {
    const cfg = await storage.getAiConfig(interaction.guildId);

    const channelValue = cfg?.channel_id
      ? `<#${cfg.channel_id}>`
      : '*(semua channel — tidak dibatasi)*';

    const personaValue = cfg?.persona
      ? `\`\`\`${cfg.persona.slice(0, 400)}${cfg.persona.length > 400 ? '…' : ''}\`\`\``
      : '*(default — belum dikustomisasi)*';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🤖 Konfigurasi AI Chatbot')
      .addFields(
        { name: '📍 AI Channel',  value: channelValue,  inline: false },
        { name: '🎭 Persona',     value: personaValue,  inline: false },
      )
      .setFooter({ text: 'Gunakan /ai channel dan /ai persona untuk mengubah' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  } catch (err) {
    console.error('[/ai status]', err.message);
    return interaction.reply({
      content: `❌ Gagal membaca config: \`${err.message}\``,
      flags: 64,
    });
  }
}
