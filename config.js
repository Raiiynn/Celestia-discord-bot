require('dotenv').config();

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    prefix: '!',

    supabaseUrl:     process.env.SUPABASE_URL      || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    geminiKey:       process.env.GEMINI_API_KEY     || '',
    openRouterKey:   process.env.OPENROUTER_API_KEY || '',

    musicMonitorChannelId: process.env.MUSIC_MONITOR_CHANNEL_ID || null,
    streakChannelId:       process.env.STREAK_CHANNEL_ID        || null,

    musicBotKeywords: [
    'music', 'jockie', 'rythm', 'groovy', 'fredboat', 'chip',
    'hydra', 'muse', 'wave', 'atom', 'euphony', 'hade', 'vexera',
    'uzox', 'beatbot', 'aiode', 'octave', 'felix'
    ],

    musicBotPrefixes: {
    'jockie': 'm!',
    'felix':  'm!',
    'chip':   '/',
    'hade':   'h',
    'muse':   '/',
    'wave':   '/',
    'atom':   '.',
    'euphony': '/',
    'hydra':  '.',
    'rythm':  '!',
    'groovy': '-',
    'fredboat': ';;',
    'vexera': 'v!',
    'uzox': 'x!',
    'beatbot': 'b!',
    'aiode': 'a!',
    'octave': 'o!',
    },

    streakTiers: [
    { min: 365, label: 'Legend',   emoji: '👑' },
    { min: 180, label: 'Diamond',  emoji: '💎' },
    { min: 90,  label: 'Platinum', emoji: '🌟' },
    { min: 30,  label: 'Gold',     emoji: '🥇' },
    { min: 14,  label: 'Silver',   emoji: '🥈' },
    { min: 7,   label: 'Bronze',   emoji: '🥉' },
    { min: 1,   label: 'Starter',  emoji: '🔥' },
  ],
}