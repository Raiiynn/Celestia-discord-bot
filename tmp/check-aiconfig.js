require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const db = require("../lib/db");

const GUILD_ID = process.env.GUILD_ID;

async function checkAiConfig() {
  console.log("=== Cek AI Config di Supabase ===");
  console.log("Guild ID:", GUILD_ID);
  
  const { data, error } = await db
    .from("ai_configs")
    .select("*")
    .eq("guild_id", GUILD_ID)
    .single();

  if (error) {
    console.log("❌ Error atau tidak ada AI config:", error.message);
    console.log("ℹ️  Bot akan menerima mention dari SEMUA channel (tidak ada restriction)");
  } else {
    console.log("✅ AI Config ditemukan:");
    console.log(JSON.stringify(data, null, 2));
    if (data.channel_id) {
      console.log(`\n⚠️  PERHATIAN: Bot hanya merespons di channel ID: ${data.channel_id}`);
      console.log("   Jika kamu mention bot di channel lain, bot akan DIAM!");
    } else {
      console.log("\nℹ️  channel_id tidak diset — bot merespons di semua channel.");
    }
  }

  // Cek juga AI history user yang mungkin corrupt
  console.log("\n=== Cek AI History (sample 3 user terbaru) ===");
  const { data: histories, error: hErr } = await db
    .from("ai_history")
    .select("user_id, updated_at, history")
    .order("updated_at", { ascending: false })
    .limit(3);

  if (hErr) {
    console.log("Error ambil history:", hErr.message);
  } else {
    for (const h of (histories || [])) {
      const hist = h.history || [];
      const corrupt = hist.some(item => !item.parts?.[0]?.text && item.parts?.[0]?.text !== "");
      console.log(`User ${h.user_id}: ${hist.length} entries, updated: ${h.updated_at}, corrupt: ${corrupt}`);
    }
  }

  process.exit(0);
}

checkAiConfig().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
