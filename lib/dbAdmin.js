'use strict';

/**
 * Supabase client using the SERVICE ROLE key.
 * Required so the process_streak_request RPC can bypass RLS.
 * Falls back to the anon key if service key is not configured.
 */
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

const url = config.supabaseUrl;
const key = config.supabaseServiceKey || config.supabaseAnonKey;

if (!url || !key) {
  console.warn('[dbAdmin] ⚠️  SUPABASE_URL or SUPABASE_SERVICE_KEY not set — DB ops will fail.');
}

const dbAdmin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = dbAdmin;
