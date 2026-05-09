require('dotenv').config();
const {
  Client, GatewayIntentBits, Collection, Partials, ActivityType,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');
const cron = require('node-cron');
const commands = [];
const commandsDir = path.join(__dirname, 'commands');

const config       = require('./config');
const storage      = require('./utils/storage');
const setupDatabase = require('./lib/setupDatabase');
const musicMonitor = require('./utils/musicMonitor');
const { loadCommands, loadEvents, setupErrorHandling, deployCommands } = require('./handlers');
const { REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands   = new Collection();
client.prefixCmds = new Collection();
client.maintenance = false;

// Load commands and events using handlers
(async () => {
  await loadCommands(client);
  await loadEvents(client);
  setupErrorHandling();
})();

client.once('ready', async () => {
  console.log(`✅  Logged in as ${client.user.tag}`);

  try {
    await setupDatabase.initializeDatabase();
    console.log('✅ Database initialized successfully');
  } catch (e) {
    console.error('⚠️  Database init error (may already exist):', e.message);
  }

  client.user.setActivity('/help | Music Monitor & Streaks', { type: ActivityType.Watching });

  // Deploy slash commands on startup (guild-only for instant update)
  try {
    await deployCommands(client);
    console.log('✅ Slash commands deployed');
  } catch (e) {
    console.error('❌ Command deploy error:', e.message);
  }

  if (config.musicMonitorChannelId) {
    await musicMonitor.updateMusicMonitor(client);
    setInterval(() => musicMonitor.updateMusicMonitor(client), 30_000);
  }

  // Multi-guild music monitoring
  setInterval(async () => {
    try {
      const guilds = client.guilds.cache;
      for (const [, guild] of guilds) {
        try {
          await musicMonitor.updateGuildMusicMonitor(client, guild);
        } catch (e) {
          console.error(`[MusicMonitor] Error in guild ${guild.name}:`, e.message);
        }
      }
    } catch (e) {
      console.error('[MusicMonitor] Global update error:', e.message);
    }
  }, 30_000);

  cron.schedule('0 0 * * *', async () => {
    await storage.resetDailyFlags();
    console.log('[Cron] Daily streak flags reset.');
  }, { timezone: 'UTC' });

  console.log(`📦  ${client.commands.size} slash commands | ${client.prefixCmds.size} prefix commands loaded`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const prefix = config.prefix || 'l';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  const command = client.prefixCmds.get(cmd);
  if (!command) return;

  try {
    await command.executePrefix(message, args);
  } catch (e) {
    console.error(`[Prefix CMD Error] ${prefix}${cmd}:`, e);
    message.reply({ content: '❌ Command error occurred.' });
    
  }

  app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
});

client.login(config.token);