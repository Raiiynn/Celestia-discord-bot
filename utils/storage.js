const db     = require('../lib/db');
const config = require('../config');


function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getStreakTier(streak) {
  for (const tier of config.streakTiers) {
    if (streak >= tier.min) return tier;
  }
  return config.streakTiers[config.streakTiers.length - 1];
}

async function getUserStreak(userId, guildId) {
  const { data, error } = await db
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .single();

  if (error || !data) {
    return { user_id: userId, guild_id: guildId, streak: 0, longest: 0, total: 0, last_checkin: null, checked_today: false };
  }
  return data;
}

async function checkin(userId, guildId, username) {
  const today     = todayStr();
  const yesterday = yesterdayStr();
  const user      = await getUserStreak(userId, guildId);

  if (user.last_checkin === today && user.checked_today) {
    return { success: false, reason: 'already_checkedin', data: user };
  }

  let newStreak = 1;
  if (user.last_checkin === yesterday) {
    newStreak = (user.streak || 0) + 1;  // continue
  } else if (user.last_checkin === today) {
    newStreak = user.streak || 1;        // same day, no increment
  }

  const newLongest = Math.max(user.longest || 0, newStreak);
  const newTotal   = (user.total   || 0) + (user.last_checkin === today ? 0 : 1);

  const updated = {
    user_id:       userId,
    guild_id:      guildId,
    username,
    streak:        newStreak,
    longest:       newLongest,
    total:         newTotal,
    last_checkin:  today,
    checked_today: true,
    updated_at:    new Date().toISOString(),
  };

  const { data, error } = await db.from('streaks').upsert(updated).select().single();
  if (error) throw error;
  return { success: true, data: data || updated };
}

async function getActiveStreaks(guildId) {
  const today = todayStr();
  const { data, error } = await db
    .from('streaks')
    .select('*')
    .eq('guild_id', guildId)
    .eq('last_checkin', today)
    .order('streak', { ascending: false });

  if (error) return [];
  return data || [];
}

async function getLeaderboard(guildId, limit = 10) {
  const { data, error } = await db
    .from('streaks')
    .select('*')
    .eq('guild_id', guildId)
    .order('streak', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

async function resetDailyFlags() {
  const today = todayStr();
  const { error } = await db
    .from('streaks')
    .update({ checked_today: false })
    .neq('last_checkin', today);
  if (error) console.error('[Storage] resetDailyFlags error:', error.message);
}

// ── Music Cache ────────────────────────────────────────────────────────────────

async function getMusicCache(channelId) {
  const { data } = await db.from('music_cache').select('*').eq('channel_id', channelId).single();
  return data || null;
}

async function saveMusicCache(channelId, messageId) {
  await db.from('music_cache').upsert({ channel_id: channelId, message_id: messageId, updated_at: new Date().toISOString() });
}

// ── AutoMod Settings ───────────────────────────────────────────────────────────

async function getAutoMod(guildId) {
  const { data } = await db.from('automod_settings').select('*').eq('guild_id', guildId).single();
  return data;
}

async function setAutoMod(guildId, settings) {
  const { error } = await db
    .from('automod_settings')
    .upsert({
      guild_id: guildId,
      ...settings,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
  return await getAutoMod(guildId);
}

// ── AFK Status ────────────────────────────────────────────────────────────────

async function setAfk(userId, guildId, reason = null) {
  const { error } = await db
    .from('afk_status')
    .upsert({
      user_id: userId,
      guild_id: guildId,
      reason,
      since: new Date().toISOString(),
    });
  if (error) throw error;
}

async function getAfk(userId, guildId) {
  const { data } = await db.from('afk_status').select('*').eq('user_id', userId).eq('guild_id', guildId).single();
  return data;
}

async function removeAfk(userId, guildId) {
  await db.from('afk_status').delete().eq('user_id', userId).eq('guild_id', guildId);
}

// ── Mod Violations (mendetail setiap pelaporan) ────────────────────────────────

async function addViolation(guildId, userId, type, content = null, messageId = null, channelId = null) {
  const { error } = await db.from('mod_violations').insert({
    guild_id: guildId,
    user_id: userId,
    violation_type: type,
    content,
    message_id: messageId,
    channel_id: channelId,
    timestamp: new Date().toISOString(),
  });
  if (error) console.error('[Storage] addViolation error:', error.message);
}

async function getViolations(guildId, userId) {
  const { data } = await db
    .from('mod_violations')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .order('timestamp', { ascending: false });
  return data || [];
}

// ── Mod Warnings (tracking pelanggaran & aksi) ───────────────────────────────

async function getUserWarnings(guildId, userId) {
  const { data } = await db.from('mod_warnings').select('*').eq('guild_id', guildId).eq('user_id', userId).single();
  return data;
}

async function addWarning(guildId, userId) {
  const existing = await getUserWarnings(guildId, userId);
  const newCount = (existing?.violation_count || 0) + 1;

  const { error } = await db
    .from('mod_warnings')
    .upsert({
      guild_id: guildId,
      user_id: userId,
      violation_count: newCount,
      last_violation: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
  return newCount;
}

async function setWarningAction(guildId, userId, action, muteUntil = null) {
  const { error } = await db
    .from('mod_warnings')
    .update({
      action_taken: action,
      action_timestamp: new Date().toISOString(),
      mute_until: muteUntil,
      updated_at: new Date().toISOString(),
    })
    .eq('guild_id', guildId)
    .eq('user_id', userId);
  if (error) throw error;
}

async function resetWarnings(guildId, userId) {
  const { error } = await db.from('mod_warnings').delete().eq('guild_id', guildId).eq('user_id', userId);
  if (error) console.error('[Storage] resetWarnings error:', error.message);
}

// ── Mod Whitelist URLs ───────────────────────────────────────────────────────

async function getWhitelistUrls(guildId) {
  const { data } = await db.from('mod_whitelist_urls').select('*').eq('guild_id', guildId);
  return data || [];
}

async function addWhitelistUrl(guildId, url, reason = null, addedBy = null) {
  const { error } = await db.from('mod_whitelist_urls').insert({
    guild_id: guildId,
    url,
    reason,
    added_by: addedBy,
    added_at: new Date().toISOString(),
  });
  if (error && error.code !== '23505') throw error; // 23505 = unique constraint
  return !error;
}

async function removeWhitelistUrl(guildId, url) {
  const { error } = await db.from('mod_whitelist_urls').delete().eq('guild_id', guildId).eq('url', url);
  if (error) throw error;
}

// ── Mod Bad Words ────────────────────────────────────────────────────────────

async function getBadwords(guildId) {
  const { data } = await db.from('mod_badwords').select('*').eq('guild_id', guildId);
  return data || [];
}

async function addBadword(guildId, pattern, severity = 1, isRegex = false, addedBy = null) {
  const { error } = await db.from('mod_badwords').insert({
    guild_id: guildId,
    pattern,
    severity,
    is_regex: isRegex,
    added_by: addedBy,
    added_at: new Date().toISOString(),
  });
  if (error && error.code !== '23505') throw error;
  return !error;
}

async function removeBadword(guildId, pattern) {
  const { error } = await db.from('mod_badwords').delete().eq('guild_id', guildId).eq('pattern', pattern);
  if (error) throw error;
}

// ── Mod Spam Patterns ────────────────────────────────────────────────────────

async function getSpamPatterns(guildId) {
  const { data } = await db.from('mod_spam_patterns').select('*').eq('guild_id', guildId);
  return data || [];
}

async function addSpamPattern(guildId, pattern, severity = 1, addedBy = null) {
  const { error } = await db.from('mod_spam_patterns').insert({
    guild_id: guildId,
    pattern,
    severity,
    added_by: addedBy,
    added_at: new Date().toISOString(),
  });
  if (error && error.code !== '23505') throw error;
  return !error;
}

async function removeSpamPattern(guildId, pattern) {
  const { error } = await db.from('mod_spam_patterns').delete().eq('guild_id', guildId).eq('pattern', pattern);
  if (error) throw error;
}

// ── Mod Statistics ───────────────────────────────────────────────────────────

async function getStatistics(guildId) {
  const { data } = await db.from('mod_statistics').select('*').eq('guild_id', guildId).single();
  return data || {
    guild_id: guildId,
    invite_blocked: 0,
    badwords_blocked: 0,
    spam_blocked: 0,
    warnings_given: 0,
    mutes_given: 0,
    kicks_given: 0,
  };
}

async function incrementStat(guildId, statName) {
  const current = await getStatistics(guildId);
  const { error } = await db
    .from('mod_statistics')
    .upsert({
      guild_id: guildId,
      [statName]: (current[statName] || 0) + 1,
      updated_at: new Date().toISOString(),
    });
  if (error) console.error('[Storage] incrementStat error:', error.message);
}

// ── AI Conversation History ──────────────────────────────────────────────────

async function getAiHistory(userId) {
  const { data } = await db.from('ai_history').select('history').eq('user_id', userId).single();
  return data?.history || [];
}

async function saveAiHistory(userId, history) {
  const { error } = await db
    .from('ai_history')
    .upsert({
      user_id: userId,
      history: history,
      updated_at: new Date().toISOString(),
    });
  if (error) console.error('[Storage] saveAiHistory error:', error.message);
}

async function clearAiHistory(userId) {
  const { error } = await db
    .from('ai_history')
    .update({ history: [] })
    .eq('user_id', userId);
  if (error) console.error('[Storage] clearAiHistory error:', error.message);
}

// ────── MUTUAL STREAKS (Pair-based like TikTok) ──────────
async function getMutualStreak(user1, user2, guildId) {
  // Ensure user1 < user2 for consistent ordering
  if (user1 > user2) [user1, user2] = [user2, user1];

  const { data, error } = await db
    .from('mutual_streaks')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user1_id', user1)
    .eq('user2_id', user2)
    .single();

  if (error || !data) {
    return { 
      guild_id: guildId, 
      user1_id: user1, 
      user2_id: user2, 
      streak: 0, 
      longest: 0, 
      user1_checked: false, 
      user2_checked: false,
      last_checkin: null 
    };
  }
  return data;
}

async function updateMutualCheckin(user1, user2, guildId, checkingUserId) {
  const now = new Date();
  const today = todayStr();
  
  // Ensure user1 < user2
  if (user1 > user2) [user1, user2] = [user2, user1];

  const mutual = await getMutualStreak(user1, user2, guildId);
  const isUser1 = checkingUserId === user1;
  
  // CHECK: Streak pair ini sudah pernah di-check-in hari ini?
  const lastMutualCheckDate = mutual.last_mutual_checkin ? 
    new Date(mutual.last_mutual_checkin).toISOString().slice(0, 10) : null;
  
  if (lastMutualCheckDate === today && mutual.streak > 0) {
    // Pair ini sudah check-in hari ini, tunggu hari besok
    return { success: false, reason: 'pair_already_checked_today', error: 'Streak pair ini sudah checked-in hari ini!' };
  }

  // Check if 24 hours passed since last mutual check-in (if first time checking)
  let shouldResetStreak = false;
  if (mutual.last_mutual_checkin && mutual.streak > 0) {
    const timeSinceMutual = now - new Date(mutual.last_mutual_checkin);
    const hoursPassed = timeSinceMutual / (1000 * 60 * 60);
    
    // If 24+ hours passed, streak is broken
    if (hoursPassed >= 24) {
      shouldResetStreak = true;
    }
  }

  // Check if other user already checked in today
  const otherChecked = isUser1 ? mutual.user2_checked : mutual.user1_checked;
  const otherCheckinTime = isUser1 ? mutual.user2_checkin_time : mutual.user1_checkin_time;
  
  const otherCheckedToday = otherCheckinTime && 
    todayStr() === new Date(otherCheckinTime).toISOString().slice(0, 10);

  let newStreak = mutual.streak || 0;
  let bothCheckedToday = false;

  // Mark current user as checked
  const updates = {
    guild_id: guildId,
    user1_id: user1,
    user2_id: user2,
    last_checkin: today,
    streak: mutual.streak || 0,
    longest: mutual.longest || 0,
    [isUser1 ? 'user1_checked' : 'user2_checked']: true,
    [isUser1 ? 'user1_checkin_time' : 'user2_checkin_time']: now.toISOString(),
    updated_at: new Date().toISOString(),
  };

  // If 24+ hours passed since last mutual check-in, reset streak
  if (shouldResetStreak) {
    updates.streak = 0;
    newStreak = 0;
  }

  // Check if other user already checked in today
  if (otherCheckedToday) {
    // Both checked in today → increment streak!
    newStreak = Math.max(1, (mutual.streak || 0) + 1);
    updates.streak = newStreak;
    updates.longest = Math.max(mutual.longest || 0, newStreak);
    updates.last_mutual_checkin = now.toISOString();
    
    // Reset flags + timestamps for tomorrow
    updates.user1_checked = false;
    updates.user2_checked = false;
    updates.user1_checkin_time = null;
    updates.user2_checkin_time = null;
    
    bothCheckedToday = true;
  }

  const { error } = await db
    .from('mutual_streaks')
    .upsert(updates);

  if (error) {
    console.error('[Storage] updateMutualCheckin error:', error.message);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    mutual: updates,
    bothChecked: bothCheckedToday,
  };
}

async function getMutualLeaderboard(guildId, limit = 10) {
  const { data, error } = await db
    .from('mutual_streaks')
    .select('*')
    .eq('guild_id', guildId)
    .order('streak', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Storage] getMutualLeaderboard error:', error.message);
    return [];
  }
  return data || [];
}

module.exports = {
  todayStr, yesterdayStr, getStreakTier,
  getUserStreak, checkin, getActiveStreaks, getLeaderboard, resetDailyFlags,
  getMusicCache, saveMusicCache,
  getAutoMod, setAutoMod,
  setAfk, getAfk, removeAfk,
  // Violations
  addViolation, getViolations,
  // Warnings
  getUserWarnings, addWarning, setWarningAction, resetWarnings,
  // Whitelist
  getWhitelistUrls, addWhitelistUrl, removeWhitelistUrl,
  // Bad Words
  getBadwords, addBadword, removeBadword,
  // Spam Patterns
  getSpamPatterns, addSpamPattern, removeSpamPattern,
  // Statistics
  getStatistics, incrementStat,
  // AI History
  getAiHistory, saveAiHistory, clearAiHistory,
  // Mutual Streaks
  getMutualStreak, updateMutualCheckin, getMutualLeaderboard,
};
