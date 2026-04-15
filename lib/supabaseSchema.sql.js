const SQL_SCHEMA = `
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- GUILDS TABLE - Guild settings and configurations
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS guilds (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL UNIQUE,
  setup BOOLEAN DEFAULT FALSE,
  
  -- Verification settings
  verification_enabled BOOLEAN DEFAULT FALSE,
  verification_channel TEXT,
  verification_role TEXT,
  verification_unverified_role TEXT,
  
  -- Logging settings
  logs_enabled BOOLEAN DEFAULT FALSE,
  logs_moderator TEXT,
  logs_basic TEXT,
  logs_global TEXT,
  logs_suggestions_channel TEXT,
  logs_announcement_channel TEXT,
  logs_giveaway_channel TEXT,
  
  -- AutoRole settings
  autorole_enabled BOOLEAN DEFAULT FALSE,
  autorole_member TEXT,
  autorole_bot TEXT,
  
  -- AutoMod settings
  automod_anti_spam_enabled BOOLEAN DEFAULT FALSE,
  automod_anti_spam_max_messages INTEGER DEFAULT 5,
  automod_anti_spam_timeframe INTEGER DEFAULT 5000,
  automod_anti_spam_max_duplicates INTEGER DEFAULT 3,
  
  automod_anti_badwords_enabled BOOLEAN DEFAULT FALSE,
  automod_anti_badwords_words TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  automod_anti_zalgo_enabled BOOLEAN DEFAULT FALSE,
  
  automod_anti_caps_enabled BOOLEAN DEFAULT FALSE,
  automod_anti_caps_threshold INTEGER DEFAULT 70,
  automod_anti_caps_min_length INTEGER DEFAULT 10,
  
  automod_anti_mention_spam_enabled BOOLEAN DEFAULT FALSE,
  automod_anti_mention_spam_max_mentions INTEGER DEFAULT 5,
  
  -- Tickets settings
  tickets_enabled BOOLEAN DEFAULT FALSE,
  tickets_channel TEXT,
  tickets_category TEXT,
  tickets_role TEXT,
  tickets_log_channel TEXT,
  
  -- Backup and other
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guilds_id ON guilds(guild_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- USERS TABLE - User data per guild
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  captcha TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_users_guild_user ON users(guild_id, user_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INFRACTIONS TABLE - Ban, kick, warn, timeout records
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS infractions (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  issuer_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ban', 'kick', 'warning', 'timeout', 'block')),
  active BOOLEAN DEFAULT TRUE,
  reason TEXT DEFAULT 'Unspecified reason.',
  time BIGINT DEFAULT 0,
  duration BIGINT,
  expires BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infractions_guild_user ON infractions(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_infractions_type ON infractions(type);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- NOTES TABLE - Moderator notes on members
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS notes (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  issuer_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_guild_user ON notes(guild_id, user_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TICKETS TABLE - Support/mod tickets
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  ticket_number INTEGER NOT NULL,
  open BOOLEAN DEFAULT TRUE,
  created_by_id TEXT NOT NULL,
  members TEXT[] DEFAULT ARRAY[]::TEXT[],
  blocked_users TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- REMINDERS TABLE - User reminders
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS reminders (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  content TEXT NOT NULL,
  reminder_time BIGINT NOT NULL,
  expires BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- AFK TABLE - User AFK status
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS afk (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  guild_id TEXT NOT NULL,
  reason TEXT DEFAULT 'AFK',
  time BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_afk_user ON afk(user_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- GIVEAWAYS TABLE - Server giveaways
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS giveaways (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  prize TEXT NOT NULL,
  participants TEXT[] DEFAULT ARRAY[]::TEXT[],
  winners_count INTEGER NOT NULL,
  winners TEXT[] DEFAULT ARRAY[]::TEXT[],
  active BOOLEAN DEFAULT TRUE,
  ended_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- REACTION ROLES TABLE - Message reactions to roles
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS reaction_roles (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  role_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reaction_roles_guild ON reaction_roles(guild_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- GUILD MEMBERS TABLE - Member tracking
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS guild_members (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  join_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, user_id)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ECONOMY TABLE - User currency/economy system
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS economy (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  balance BIGINT DEFAULT 0,
  bank BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, guild_id)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BACKUPS TABLE - Server backups
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS backups (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  backup_data JSONB NOT NULL,
  created_by_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STREAKS TABLE (Existing - included for completeness)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS streaks (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  username TEXT,
  streak INTEGER DEFAULT 0,
  longest INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  last_checkin DATE,
  checked_today BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_streaks_checked ON streaks(checked_today);
`;

module.exports = SQL_SCHEMA;
