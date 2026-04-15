const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

if (!config.supabaseUrl || !config.supabaseAnonKey) {
  console.warn('[DB] ⚠️  SUPABASE_URL or SUPABASE_ANON_KEY not set. Database features will fail.');
}

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

module.exports = supabase;
