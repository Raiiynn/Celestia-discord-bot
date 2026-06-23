"use strict";

const { SlashCommandBuilder } = require("discord.js");
const storage = require("../../utils/storage");
const aiService = require("../../services/aiService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Tanya AI assistant")
    .addStringOption((opt) =>
      opt
        .setName("pertanyaan")
        .setDescription(
          'Pertanyaan kamu — atau ketik "clear" untuk hapus history',
        )
        .setRequired(true),
    ),

  async execute(interaction) {
    const input = interaction.options.getString("pertanyaan").trim();

    // ── deferReply HARUS dipanggil pertama sebelum operasi async apapun ───────
    // Discord memberi waktu 3 detik saja; jika lewat → Unknown Interaction (10062)
    const isEphemeral = input.toLowerCase() === "clear";
    await interaction.deferReply({ flags: isEphemeral ? 64 : undefined });

    // ── Clear history ─────────────────────────────────────────────────────────
    if (isEphemeral) {
      await storage.clearAiHistory(interaction.user.id);
      return interaction.editReply("🗑️ History percakapan kamu sudah dihapus.");
    }

    try {
      const [history, aiConfig] = await Promise.all([
        storage.getAiHistory(interaction.user.id),
        storage.getAiConfig(interaction.guildId),
      ]);

      const systemPrompt = aiService.buildSystemPrompt(
        aiConfig?.persona ?? null,
      );
      const aiReply = await aiService.callOpenRouter(
        systemPrompt,
        history,
        input,
      );

      // Simpan history
      const newHistory = aiService.appendHistory(history, input, aiReply);
      await storage.saveAiHistory(interaction.user.id, newHistory);

      // Kirim — split kalau terlalu panjang
      const parts = aiService.splitMessage(aiReply);
      await interaction.editReply(parts[0]);
      for (const part of parts.slice(1)) {
        await interaction.followUp(part);
      }
    } catch (err) {
      console.error("[/ask]", err.message);
      const errMsg = `❌ **Gagal mendapat respons AI**\n\`\`\`\n${err.message}\n\`\`\``;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg);
      } else {
        await interaction.reply({ content: errMsg, flags: 64 });
      }
    }
  },
};
