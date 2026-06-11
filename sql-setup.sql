-- CREATE ALL TABLES FOR SUPABASE
-- Copy this SQL and run in Supabase Dashboard → SQL Editor

-- Guilds table
CREATE TABLE IF NOT EXISTS guilds (
  guild_id      TEXT PRIMARY KEY,
  prefix       TEXT,
  language     TEXT DEFAULT 'en',
  log_channel   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  logs_basic    TEXT,
  logs_member  TEXT,
  logs_message TEXT,
  logs_voice  TEXT,
  verify_enabled BOOLEAN DEFAULT FALSE,
  verify_channel TEXT,
  verify_role TEXT,
  verify_message TEXT,
  maintenance_mode BOOLEAN DEFAULT FALSE,
  music_channel TEXT,
  music_message TEXT,
  autorole_enabled BOOLEAN DEFAULT FALSE,
  autorole_role TEXT,
  autorole_bot BOOLEAN DEFAULT FALSE
);

-- Add columns if table exists
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_basic TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_member TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_message TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_voice TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS verify_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS verify_channel TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS verify_role TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS verify_message TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS music_channel TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS music_message TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS autorole_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS autorole_role TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_moderation TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_automod TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_server TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_joinleave TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_ban TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS autorole_bot BOOLEAN DEFAULT FALSE;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_moderator TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_warning TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_kick TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_mute TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_verify TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS logs_level TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS music_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS streak_enabled BOOLEAN DEFAULT FALSE;

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id              BIGSERIAL PRIMARY KEY,
  guild_id        TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  channel_id     TEXT NOT NULL,
  reason        TEXT,
  status        TEXT DEFAULT 'open',
  transcript    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  closed_at     TIMESTAMPTZ,
  UNIQUE (guild_id, channel_id)
);

-- Streaks table
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

-- Mutual Streaks table
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

-- Music Cache table
CREATE TABLE IF NOT EXISTS music_cache (
  channel_id TEXT PRIMARY KEY,
  message_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AutoMod Settings table
CREATE TABLE IF NOT EXISTS automod_settings (
  guild_id        TEXT PRIMARY KEY,
  invite_block    BOOLEAN     DEFAULT FALSE,
  log_channel_id  TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- AFK Status table
CREATE TABLE IF NOT EXISTS afk_status (
  user_id    TEXT        NOT NULL,
  guild_id   TEXT        NOT NULL,
  reason     TEXT,
  since      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, guild_id)
);

-- Mod Violations table
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

-- Mod Warnings table
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

-- Mod Whitelist URLs table
CREATE TABLE IF NOT EXISTS mod_whitelist_urls (
  id        BIGSERIAL PRIMARY KEY,
  guild_id  TEXT NOT NULL,
  url       TEXT NOT NULL,
  reason    TEXT,
  added_by  TEXT,
  added_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guild_id, url)
);

-- Mod Bad Words table
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

-- Mod Spam Patterns table
CREATE TABLE IF NOT EXISTS mod_spam_patterns (
  id        BIGSERIAL PRIMARY KEY,
  guild_id  TEXT NOT NULL,
  pattern   TEXT NOT NULL,
  severity  INTEGER DEFAULT 1,
  added_by  TEXT,
  added_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guild_id, pattern)
);

-- Mod Statistics table
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

-- AI History table
CREATE TABLE IF NOT EXISTS ai_history (
  user_id   TEXT PRIMARY KEY,
  history   JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to automod_settings
ALTER TABLE automod_settings ADD COLUMN IF NOT EXISTS badword_block BOOLEAN DEFAULT FALSE;
ALTER TABLE automod_settings ADD COLUMN IF NOT EXISTS spam_block BOOLEAN DEFAULT FALSE;
ALTER TABLE automod_settings ADD COLUMN IF NOT EXISTS warning_threshold_mute INTEGER DEFAULT 2;
ALTER TABLE automod_settings ADD COLUMN IF NOT EXISTS warning_threshold_kick INTEGER DEFAULT 3;
ALTER TABLE automod_settings ADD COLUMN IF NOT EXISTS mute_duration INTEGER DEFAULT 300;
ALTER TABLE automod_settings ADD COLUMN IF NOT EXISTS auto_delete BOOLEAN DEFAULT TRUE;

-- Greet Messages columns to guilds table
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS greet_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS greet_mode TEXT DEFAULT 'simple';
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS greet_channels JSONB DEFAULT '[]'::jsonb;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS greet_message TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS greet_embed JSONB;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS greet_delete_after INTEGER;

-- Honey Pot Spam Trap tables
CREATE TABLE IF NOT EXISTS honeypot_configs (
  guild_id                  TEXT PRIMARY KEY,
  enabled                   BOOLEAN DEFAULT FALSE,
  honeypot_channel_id       TEXT,
  log_channel_id            TEXT,
  punishment_mode           TEXT DEFAULT 'BAN',
  timeout_duration_ms       BIGINT DEFAULT 3600000,
  cleanup_enabled           BOOLEAN DEFAULT TRUE,
  cleanup_window_minutes    INTEGER DEFAULT 60,
  total_triggers            INTEGER DEFAULT 0,
  total_bans                INTEGER DEFAULT 0,
  total_timeouts            INTEGER DEFAULT 0,
  total_deletions           INTEGER DEFAULT 0,
  last_trigger_at           TIMESTAMPTZ,
  embed_channel_id          TEXT,
  embed_message_id          TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Add embed columns if they don't exist (for existing tables)
ALTER TABLE honeypot_configs ADD COLUMN IF NOT EXISTS embed_channel_id TEXT;
ALTER TABLE honeypot_configs ADD COLUMN IF NOT EXISTS embed_message_id TEXT;

CREATE TABLE IF NOT EXISTS honeypot_whitelist (
  id                BIGSERIAL PRIMARY KEY,
  guild_id          TEXT NOT NULL,
  target_id         TEXT NOT NULL,
  target_type       TEXT NOT NULL,
  added_by          TEXT,
  added_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guild_id, target_id, target_type)
);

CREATE TABLE IF NOT EXISTS honeypot_triggers (
  id                BIGSERIAL PRIMARY KEY,
  guild_id          TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  message_id        TEXT,
  channel_id        TEXT NOT NULL,
  violation_type    TEXT DEFAULT 'INVITE_SPAM',
  message_content   TEXT,
  deleted_count     INTEGER DEFAULT 0,
  punishment_applied TEXT,
  errors            JSONB DEFAULT '[]'::jsonb,
  triggered_at      TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_guild_user (guild_id, user_id),
  INDEX idx_triggered_at (triggered_at)
);

CREATE INDEX IF NOT EXISTS idx_honeypot_configs_guild ON honeypot_configs(guild_id);
CREATE INDEX IF NOT EXISTS idx_honeypot_whitelist_guild ON honeypot_whitelist(guild_id);
CREATE INDEX IF NOT EXISTS idx_honeypot_triggers_guild ON honeypot_triggers(guild_id);
CREATE INDEX IF NOT EXISTS idx_honeypot_triggers_user ON honeypot_triggers(user_id);

SELECT 'Tables created successfully!' as result;