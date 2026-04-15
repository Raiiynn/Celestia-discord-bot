require('dotenv').config();
const {
  Client, GatewayIntentBits, Collection, Partials, ActivityType,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');
const cron = require('node-cron');

const config       = require('./config');
const storage      = require('./utils/storage');
const setupDatabase = require('./lib/setupDatabase');
const musicMonitor = require('./utils/musicMonitor');
const { loadCommands, loadEvents, setupErrorHandling } = require('./handlers');

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

function loadCommandsRecursive(dir) {
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      loadCommandsRecursive(fullPath);
    } else if (file.endsWith('.js')) {
      const cmd = require(fullPath);
      if (cmd.data)       client.commands.set(cmd.data.name, cmd);
      if (cmd.prefixName) client.prefixCmds.set(cmd.prefixName, cmd);
      if (cmd.aliases)    cmd.aliases.forEach(a => client.prefixCmds.set(a, cmd));
    }
  }
}

loadCommandsRecursive(path.join(__dirname, 'commands'));

const evtDir = path.join(__dirname, 'events');
for (const file of fs.readdirSync(evtDir).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(evtDir, file));
  const fn    = (...args) => event.execute(...args, client);
  event.once ? client.once(event.name, fn) : client.on(event.name, fn);
}

client.once('ready', async () => {
  console.log(`✅  Logged in as ${client.user.tag}`);
  
  try {
    await setupDatabase.initializeDatabase();
    console.log('✅ Database initialized successfully');
  } catch (e) {
    console.error('⚠️  Database init error (may already exist):', e.message);
  }
  
  client.user.setActivity('/help | Music Monitor & Streaks', { type: ActivityType.Watching });

  if (config.musicMonitorChannelId) {
    await musicMonitor.updateMusicMonitor(client);
    setInterval(() => musicMonitor.updateMusicMonitor(client), 30_000);
  }

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
});

client.login(config.token);