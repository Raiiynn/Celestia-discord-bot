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
  console.clear();
  console.log(`\x1b[36m
  ╔══════════════════════════════════════════════════╗
  ║                🚀 BOT DISCORD CELESTIA           ║
  ║              By raiiynnn                         ║
  ╚══════════════════════════════════════════════════╝
  \x1b[0m`);

  console.log(`\x1b[33m
  ╔══════════════════════════════════════════════════╗
  ║                  INITIALIZING                    ║
  ╠══════════════════════════════════════════════════╣
  ║ • \x1b[32m✅ Logging in as ${client.user.tag}\x1b[33m ║
  ║ • \x1b[32mInitializing Database...\x1b[33m        ║
  ║ • \x1b[32mDeploying Commands...\x1b[33m           ║
  ║ • \x1b[32mSetting up Monitors...\x1b[33m          ║
  ╚══════════════════════════════════════════════════╝
  \x1b[0m`);

  try {
    await setupDatabase.initializeDatabase();
    console.log('\x1b[32m✅ Database initialized successfully\x1b[0m');
  } catch (e) {
    console.error('\x1b[31m⚠️  Database init error (may already exist):', e.message, '\x1b[0m');
  }

  client.user.setActivity('/help | Automod & Fun', { type: ActivityType.Watching });

  // Deploy slash commands on startup (guild-only for instant update)
  try {
    await deployCommands(client);
    console.log('\x1b[32m✅ Slash commands deployed\x1b[0m');
  } catch (e) {
    console.error('\x1b[31m❌ Command deploy error:', e.message, '\x1b[0m');
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

  console.log(`\x1b[35m
  ╔══════════════════════════════════════════════════╗
  ║                  COMMANDS LOADED                 ║
  ╠══════════════════════════════════════════════════╣
  ║ • \x1b[36mSlash Commands\x1b[35m: ${String(client.commands.size).padEnd(28, ' ')}\x1b[35m    ║
  ║ • \x1b[36mPrefix Commands\x1b[35m: ${String(client.prefixCmds.size).padEnd(26, ' ')}\x1b[35m ║
  ╚══════════════════════════════════════════════════╝
  \x1b[0m`);

  console.log(`\x1b[32m
  ╔══════════════════════════════════════════════════╗
  ║                  BOT STATUS                      ║
  ╠══════════════════════════════════════════════════╣
  ║ • \x1b[33mDevelopment by raiiynnn\x1b[32m        ║
  ║ • \x1b[33mBot is Online and Ready\x1b[32m        ║
  ║ • \x1b[33mAll Systems: Operational\x1b[32m       ║
  ║ • \x1b[33mWaiting for Commands\x1b[32m           ║
  ╚══════════════════════════════════════════════════╝
  \x1b[0m`);
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