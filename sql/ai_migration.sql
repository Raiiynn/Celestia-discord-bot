-- =============================================================
-- AI Chatbot Config — Migration
-- Run this in Supabase SQL Editor
-- Safe to re-run (IF NOT EXISTS)
-- =============================================================

CREATE TABLE IF NOT EXISTS ai_configs (
  guild_id    TEXT        PRIMARY KEY,
  channel_id  TEXT,                        -- null = reply in any channel
  persona     TEXT,                        -- null = use default system prompt
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
