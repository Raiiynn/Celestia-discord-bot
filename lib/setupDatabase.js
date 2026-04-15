const supabase = require('./db');

const SQL = `
-- ── Guilds ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guilds (
  guild_id      TEXT PRIMARY KEY,
  prefix       TEXT,
  language     TEXT DEFAULT 'en',
  log_channel   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Streaks ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS streaks (
  user_id       TEXT        NOT NULL,
  guild_id      TEXT        NOT NULL,
  username      TEXT,
  streak        INTEGER     DEFAULT 0,
  longest       INTEGER     DEFAULT 0,
  total         INTEGER     DEFAULT 0,
  last_checkin  DATE,
  checked_today BOOLEAN     DEFAULT FALSE,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, guild_id)
);

-- ── Mutual Streaks (pair-based like TikTok) ────────────────────────────
CREATE TABLE IF NOT EXISTS mutual_streaks (
  guild_id           TEXT        NOT NULL,
  user1_id           TEXT        NOT NULL,
  user2_id           TEXT        NOT NULL,
  streak             INTEGER     DEFAULT 0,
  longest            INTEGER     DEFAULT 0,
  last_checkin       DATE,
  last_mutual_checkin TIMESTAMPTZ,
  user1_checked      BOOLEAN     DEFAULT FALSE,
  user1_checkin_time TIMESTAMPTZ,
  user2_checked      BOOLEAN     DEFAULT FALSE,
  user2_checkin_time TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (guild_id, user1_id, user2_id),
  CHECK (user1_id < user2_id)
);
CREATE INDEX IF NOT EXISTS idx_mutual_streaks_guild ON mutual_streaks(guild_id);

-- ── Music Monitor Cache ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS music_cache (
  channel_id TEXT PRIMARY KEY,
  message_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── AutoMod Settings ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automod_settings (
  guild_id        TEXT PRIMARY KEY,
  invite_block    BOOLEAN     DEFAULT FALSE,
  log_channel_id  TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── AFK Status ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS afk_status (
  user_id    TEXT        NOT NULL,
  guild_id   TEXT        NOT NULL,
  reason     TEXT,
  since      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, guild_id)
);

-- ── Mod Violations (mendetail setiap violation) ────────────────────────
CREATE TABLE IF NOT EXISTS mod_violations (
  id            BIGSERIAL PRIMARY KEY,
  guild_id      TEXT        NOT NULL,
  user_id       TEXT        NOT NULL,
  violation_type TEXT       NOT NULL,
  content       TEXT,
  message_id    TEXT,
  channel_id    TEXT,
  timestamp     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_violations_guild_user ON mod_violations(guild_id, user_id);

-- ── Mod Warnings ────────────────────────────────��────────────────────────
CREATE TABLE IF NOT EXISTS mod_warnings (
  id              BIGSERIAL PRIMARY KEY,
  guild_id        TEXT        NOT NULL,
  user_id         TEXT        NOT NULL,
  violation_count INTEGER     DEFAULT 1,
  last_violation  TIMESTAMPTZ DEFAULT NOW(),
  action_taken    TEXT,
  action_timestamp TIMESTAMPTZ,
  mute_until      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON mod_warnings(guild_id, user_id);

-- ── Mod Whitelist URLs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mod_whitelist_urls (
  id        BIGSERIAL PRIMARY KEY,
  guild_id  TEXT NOT NULL,
  url       TEXT NOT NULL,
  reason    TEXT,
  added_by  TEXT,
  added_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guild_id, url)
);

-- ── Mod Bad Words ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mod_badwords (
  id        BIGSERIAL PRIMARY KEY,
  guild_id  TEXT NOT NULL,
  pattern   TEXT NOT NULL,
  severity  INTEGER DEFAULT 1,
  is_regex  BOOLEAN DEFAULT FALSE,
  added_by  TEXT,
  added_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guild_id, pattern)
);

-- ── Mod Spam Patterns ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mod_spam_patterns (
  id        BIGSERIAL PRIMARY KEY,
  guild_id  TEXT NOT NULL,
  pattern   TEXT NOT NULL,
  severity  INTEGER DEFAULT 1,
  added_by  TEXT,
  added_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guild_id, pattern)
);

-- ── Mod Statistics ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mod_statistics (
  guild_id        TEXT PRIMARY KEY,
  invite_blocked  INTEGER DEFAULT 0,
  badwords_blocked INTEGER DEFAULT 0,
  spam_blocked    INTEGER DEFAULT 0,
  warnings_given  INTEGER DEFAULT 0,
  mutes_given     INTEGER DEFAULT 0,
  kicks_given     INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── AI Conversation History ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_history (
  user_id   TEXT PRIMARY KEY,
  history   JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

(async () => {
  console.log('🔧 Setting up Supabase tables...\n');
  console.log('📋 SQL to execute:\n');
  console.log(SQL);
  console.log('\n──────────────────────────────────────────────');
  console.log('NOTE: Supabase JS client cannot run raw DDL.');
  console.log('Please copy the SQL above and run it in:');
  console.log('  Supabase Dashboard → SQL Editor → New Query → Run');
  console.log('\nOr use the Supabase CLI:');
  console.log('  supabase db push');
  console.log('──────────────────────────────────────────────\n');

  const { error } = await supabase.from('guilds').select('guild_id').limit(1);
  if (error && error.code === '42P01') {
    console.log('⚠️  Tables not yet created. Run the SQL above first.');
  } else if (!error) {
    console.log('✅ Connected to Supabase and tables exist!');
  } else {
    console.error('❌ Supabase error:', error.message);
  }
})();

module.exports = {
  async initializeDatabase() {
    console.log('🔍 Checking Supabase connection...');
    try {
      const { error } = await supabase.from('guilds').select('guild_id').limit(1);
      if (error && error.code === '42P01') {
        throw new Error('Tables not yet created. Run setupDatabase SQL in Supabase Dashboard.');
      }
      if (error && error.code !== '42P01') {
        throw error;
      }
      console.log('✅ Supabase connected and tables exist!');
    } catch (e) {
      console.error('Database error:', e.message);
      throw e;
    }
  },
};