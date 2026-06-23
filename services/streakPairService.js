'use strict';

/**
 * streakPairService.js
 * Thin wrapper around the Supabase service-role client for streak pair logic.
 * All heavy lifting lives in the process_streak_request() PostgreSQL function.
 */

const db = require('../lib/dbAdmin');

/**
 * Invoke the process_streak_request Postgres RPC.
 *
 * Returns one of:
 *   { status: 'self_streak' }
 *   { status: 'waiting',  expires_at: <iso> }
 *   { status: 'matched',  current_streak: N, lifetime_streak: N,
 *                          expires_at: <iso>, pair_key: '...' }
 *
 * @param {string} guildId
 * @param {string} requesterId
 * @param {string} targetId
 * @returns {Promise<object>}
 */
async function processStreakRequest(guildId, requesterId, targetId) {
  const { data, error } = await db.rpc('process_streak_request', {
    p_guild_id:     guildId,
    p_requester_id: requesterId,
    p_target_id:    targetId,
  });

  if (error) {
    console.error('[StreakPairSvc] RPC error:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Fetch the top-N lifetime-streak pairs for a guild.
 *
 * @param {string} guildId
 * @param {number} [limit=10]
 * @returns {Promise<Array<{ user_low: string, user_high: string, current_streak: number, lifetime_streak: number }>>}
 */
async function getStreakLeaderboard(guildId, limit = 10) {
  const { data, error } = await db
    .from('streak_pairs')
    .select('user_low, user_high, current_streak, lifetime_streak, last_confirmed_at')
    .eq('guild_id', guildId)
    .order('lifetime_streak', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[StreakPairSvc] Leaderboard error:', error);
    throw new Error(error.message);
  }

  return data ?? [];
}

module.exports = { processStreakRequest, getStreakLeaderboard };
