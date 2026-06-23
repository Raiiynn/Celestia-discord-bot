-- =============================================================
-- Streak Pair System — Migration
-- Run this in Supabase SQL Editor (or psql)
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE
-- =============================================================

-- ─── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS streak_pairs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id         TEXT        NOT NULL,
  pair_key         TEXT        NOT NULL,
  user_low         TEXT        NOT NULL,
  user_high        TEXT        NOT NULL,
  current_streak   INT         NOT NULL DEFAULT 0,
  lifetime_streak  INT         NOT NULL DEFAULT 0,
  last_confirmed_at TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, pair_key)
);

CREATE TABLE IF NOT EXISTS streak_pending (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id     TEXT        NOT NULL,
  requester_id TEXT        NOT NULL,
  target_id    TEXT        NOT NULL,
  pair_key     TEXT        NOT NULL,
  status       TEXT        DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  UNIQUE(guild_id, requester_id, target_id)
);

CREATE TABLE IF NOT EXISTS streak_events (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id             TEXT        NOT NULL,
  pair_key             TEXT        NOT NULL,
  actor_id             TEXT        NOT NULL,
  counterpart_id       TEXT        NOT NULL,
  current_streak_after  INT         NOT NULL,
  lifetime_streak_after INT         NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_streak_pairs_guild_lifetime
  ON streak_pairs(guild_id, lifetime_streak DESC);

CREATE INDEX IF NOT EXISTS idx_streak_pairs_guild_current
  ON streak_pairs(guild_id, current_streak DESC);

CREATE INDEX IF NOT EXISTS idx_streak_pending_guild_status
  ON streak_pending(guild_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_streak_events_guild_created
  ON streak_events(guild_id, created_at DESC);

-- ─── RPC Function ─────────────────────────────────────────────
--
-- process_streak_request
--   Called from the bot whenever a user runs /streak user @target.
--   Returns a JSONB object with one of these shapes:
--     { "status": "self_streak" }
--     { "status": "waiting",  "expires_at": <iso> }
--     { "status": "matched",  "current_streak": N, "lifetime_streak": N,
--                              "expires_at": <iso>, "pair_key": "..." }
--
CREATE OR REPLACE FUNCTION process_streak_request(
  p_guild_id     TEXT,
  p_requester_id TEXT,
  p_target_id    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair_key        TEXT;
  v_pending_id      UUID;
  v_pair            streak_pairs%ROWTYPE;
  v_current_streak  INT;
  v_lifetime_streak INT;
  v_expires_at      TIMESTAMPTZ;
BEGIN
  -- ── Guard: no self-streak ──────────────────────────────────
  IF p_requester_id = p_target_id THEN
    RETURN jsonb_build_object('status', 'self_streak');
  END IF;

  -- ── Deterministic pair key (lower ID first) ───────────────
  v_pair_key := LEAST(p_requester_id, p_target_id)
             || '_'
             || GREATEST(p_requester_id, p_target_id);

  -- ── Sweep expired pending rows for this guild ─────────────
  DELETE FROM streak_pending
  WHERE  guild_id = p_guild_id
    AND  expires_at < NOW()
    AND  status = 'pending';

  -- ── Look for a reverse-pending: target previously pinged requester ──
  SELECT id INTO v_pending_id
  FROM   streak_pending
  WHERE  guild_id     = p_guild_id
    AND  requester_id = p_target_id
    AND  target_id    = p_requester_id
    AND  status       = 'pending'
    AND  expires_at   > NOW()
  FOR UPDATE SKIP LOCKED;   -- prevent race conditions on concurrent confirms

  -- ════════════════════════════════════════════════════════════
  --  MATCHED — both sides confirmed
  -- ════════════════════════════════════════════════════════════
  IF v_pending_id IS NOT NULL THEN

    -- Lock the pair row so concurrent requests don't double-count
    SELECT * INTO v_pair
    FROM   streak_pairs
    WHERE  guild_id  = p_guild_id
      AND  pair_key  = v_pair_key
    FOR UPDATE;

    IF NOT FOUND THEN
      -- Very first streak for this pair
      v_current_streak  := 1;
      v_lifetime_streak := 1;
    ELSE
      -- Check whether the existing streak is still alive
      IF v_pair.expires_at IS NOT NULL AND v_pair.expires_at < NOW() THEN
        -- Expired: reset current, preserve lifetime
        v_current_streak := 1;
      ELSE
        v_current_streak := COALESCE(v_pair.current_streak, 0) + 1;
      END IF;
      v_lifetime_streak := COALESCE(v_pair.lifetime_streak, 0) + 1;
    END IF;

    v_expires_at := NOW() + INTERVAL '24 hours';

    -- Upsert the pair record
    INSERT INTO streak_pairs (
      guild_id, pair_key, user_low, user_high,
      current_streak, lifetime_streak,
      last_confirmed_at, expires_at, updated_at
    ) VALUES (
      p_guild_id, v_pair_key,
      LEAST(p_requester_id,    p_target_id),
      GREATEST(p_requester_id, p_target_id),
      v_current_streak, v_lifetime_streak,
      NOW(), v_expires_at, NOW()
    )
    ON CONFLICT (guild_id, pair_key) DO UPDATE SET
      current_streak    = EXCLUDED.current_streak,
      lifetime_streak   = EXCLUDED.lifetime_streak,
      last_confirmed_at = EXCLUDED.last_confirmed_at,
      expires_at        = EXCLUDED.expires_at,
      updated_at        = EXCLUDED.updated_at;

    -- Mark the reverse-pending as accepted
    UPDATE streak_pending
    SET    status = 'accepted'
    WHERE  id = v_pending_id;

    -- Clean up any duplicate pending from requester→target
    DELETE FROM streak_pending
    WHERE  guild_id     = p_guild_id
      AND  requester_id = p_requester_id
      AND  target_id    = p_target_id
      AND  status       = 'pending';

    -- Audit log
    INSERT INTO streak_events (
      guild_id, pair_key, actor_id, counterpart_id,
      current_streak_after, lifetime_streak_after
    ) VALUES (
      p_guild_id, v_pair_key,
      p_requester_id, p_target_id,
      v_current_streak, v_lifetime_streak
    );

    RETURN jsonb_build_object(
      'status',          'matched',
      'current_streak',  v_current_streak,
      'lifetime_streak', v_lifetime_streak,
      'expires_at',      v_expires_at,
      'pair_key',        v_pair_key
    );

  -- ════════════════════════════════════════════════════════════
  --  WAITING — save pending, wait for the other side
  -- ════════════════════════════════════════════════════════════
  ELSE

    -- Upsert so that a repeated /streak request just refreshes the expiry
    INSERT INTO streak_pending (
      guild_id, requester_id, target_id, pair_key,
      status, created_at, expires_at
    ) VALUES (
      p_guild_id, p_requester_id, p_target_id, v_pair_key,
      'pending', NOW(), NOW() + INTERVAL '24 hours'
    )
    ON CONFLICT (guild_id, requester_id, target_id) DO UPDATE SET
      status     = 'pending',
      created_at = NOW(),
      expires_at = NOW() + INTERVAL '24 hours';

    RETURN jsonb_build_object(
      'status',     'waiting',
      'expires_at', NOW() + INTERVAL '24 hours'
    );

  END IF;
END;
$$;
