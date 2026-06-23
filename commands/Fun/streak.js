"use strict";

/**
 * commands/Fun/streak.js
 *
 * /streak user @target   — Send or confirm a streak request
 * /streak leaderboard    — Top 10 lifetime streak pairs in this server
 *
 * Uses the process_streak_request() Postgres RPC via streakPairService.
 * On a confirmed match, generates a 1920×1080 PNG card via streakImageService.
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const {
  processStreakRequest,
  getStreakLeaderboard,
} = require("../../services/streakPairService");
const { generateStreakCard } = require("../../services/streakImageService");

const MEDALS = ["🥇", "🥈", "🥉"];

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName("streak")
    .setDescription("Streak pair system")
    .addSubcommand((sub) =>
      sub
        .setName("user")
        .setDescription("Send or confirm a streak with another user")
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("The user you want to streak with")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("leaderboard")
        .setDescription("Top streak pairs in this server (lifetime)"),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === "user") return handleUser(interaction);
    if (sub === "leaderboard") return handleLeaderboard(interaction);
  },
};

// ─── /streak user @target ────────────────────────────────────────────────────

async function handleUser(interaction) {
  const target = interaction.options.getUser("target");
  const requester = interaction.user;

  // ── Client-side anti-abuse guards (DB function has its own too) ──────────
  if (target.id === requester.id) {
    return interaction.reply({
      content: "❌ You cannot streak with yourself.",
      flags: 64,
    });
  }
  if (target.bot) {
    return interaction.reply({
      content: "❌ You cannot streak with a bot.",
      flags: 64,
    });
  }

  await interaction.deferReply();

  try {
    const result = await processStreakRequest(
      interaction.guildId,
      requester.id,
      target.id,
    );

    // ── DB-level self-streak guard returned ──────────────────────────────
    if (result.status === "self_streak") {
      return interaction.editReply({
        content: "❌ You cannot streak with yourself.",
      });
    }

    // ── Waiting: other user hasn't replied yet ────────────────────────────
    if (result.status === "waiting") {
      const ts = Math.floor(new Date(result.expires_at).getTime() / 1000);
      return interaction.editReply(
        `⏳ Streak request sent to ${target}!\n` +
          `They must run \`/streak user @${requester.username}\` before <t:${ts}:R> to confirm.`,
      );
    }

    // ── Matched: both sides confirmed ─────────────────────────────────────
    if (result.status === "matched") {
      // Resolve display names from guild members
      const [mem1, mem2] = await Promise.all([
        interaction.guild.members.fetch(requester.id).catch(() => null),
        interaction.guild.members.fetch(target.id).catch(() => null),
      ]);

      const u1 = {
        displayName: mem1?.displayName ?? requester.username,
        avatarURL: requester.displayAvatarURL({
          extension: "png",
          size: 512,
          forceStatic: true,
        }),
      };
      const u2 = {
        displayName: mem2?.displayName ?? target.username,
        avatarURL: target.displayAvatarURL({
          extension: "png",
          size: 512,
          forceStatic: true,
        }),
      };

      // Generate 1920×1080 streak card
      const imgBuf = await generateStreakCard(u1, u2, result.current_streak);
      const attachment = new AttachmentBuilder(imgBuf, { name: "streak.png" });

      const expiryTs = Math.floor(new Date(result.expires_at).getTime() / 1000);

      const embed = new EmbedBuilder()
        .setColor(0x7b2fbe)
        .setTitle("🔥 Streak Confirmed!")
        .setDescription(`**${u1.displayName}** × **${u2.displayName}**`)
        .addFields(
          {
            name: "🔥 Current Streak",
            value: `**${result.current_streak}** days`,
            inline: true,
          },
          {
            name: "🏆 Lifetime",
            value: `**${result.lifetime_streak}** total`,
            inline: true,
          },
          { name: "⏰ Expires", value: `<t:${expiryTs}:R>`, inline: true },
        )
        .setImage("attachment://streak.png")
        .setTimestamp()
        .setFooter({ text: "Keep the streak going!" });

      return interaction.editReply({ embeds: [embed], files: [attachment] });
    }

    // Unknown status (should never happen)
    return interaction.editReply(
      "❌ Unexpected response from database. Please try again.",
    );
  } catch (err) {
    console.error("[/streak user]", err);
    return interaction.editReply(
      "❌ Something went wrong. Please try again later.",
    );
  }
}

// ─── /streak leaderboard ─────────────────────────────────────────────────────

async function handleLeaderboard(interaction) {
  await interaction.deferReply();

  try {
    const pairs = await getStreakLeaderboard(interaction.guildId, 10);

    if (!pairs.length) {
      return interaction.editReply(
        "No streak pairs have been recorded in this server yet. Start one with `/streak user @someone`!",
      );
    }

    const lines = pairs.map((p, i) => {
      const medal = MEDALS[i] ?? `**#${i + 1}**`;
      return `${medal} <@${p.user_low}> × <@${p.user_high}> — **${p.lifetime_streak}** 🔥`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle("🏆 Streak Leaderboard")
      .setDescription(lines.join("\n"))
      .setFooter({
        text: `${interaction.guild.name} • Top 10 Lifetime Streaks`,
      })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[/streak leaderboard]", err);
    return interaction.editReply(
      "❌ Failed to fetch leaderboard. Try again later.",
    );
  }
}
