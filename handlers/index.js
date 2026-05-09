const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

async function loadCommands(client) {
  const commandsDir = path.join(__dirname, '../commands');
  const commands = [];
  
  try {
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
      try {
        const command = require(path.join(commandsDir, file));
        if (command.data) {
          client.commands.set(command.data.name, command);
          commands.push(command.data.toJSON());
          console.log(`[Commands] ✅ Loaded: ${command.data.name}`);
        }
      } catch (err) {
        console.error(`[Commands] ❌ Error loading ${file}:`, err);
      }
    }
  } catch (err) {
    console.error('[Commands] Error loading commands:', err);
  }
  return commands;
}

async function loadEvents(client) {
  const eventsDir = path.join(__dirname, '../events');
  
  try {
    const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
      try {
        const event = require(path.join(eventsDir, file));
        const execute = (...args) => event.execute(...args, client);

        if (event.once) {
          client.once(event.name, execute);
        } else {
          client.on(event.name, execute);
        }

        console.log(`[Events] ✅ Loaded: ${event.name}`);
      } catch (err) {
        console.error(`[Events] ❌ Error loading ${file}:`, err);
      }
    }
  } catch (err) {
    console.error('[Events] Error loading events:', err);
  }
}

function setupErrorHandling() {
  process.on('unhandledRejection', err => {
    console.error('[Error] Unhandled Promise Rejection:', err);
  });

  process.on('uncaughtException', err => {
    console.error('[Error] Uncaught Exception:', err);
    process.exit(1);
  });
}

async function deployCommands(client) {
  const commandsDir = path.join(__dirname, '../commands');
  const commands = [];

  for (const file of fs.readdirSync(commandsDir)) {
    const fullPath = path.join(commandsDir, file);
    if (fs.statSync(fullPath).isDirectory()) continue;
    if (!file.endsWith('.js')) continue;

    try {
      const mod = require(fullPath);
      if (mod.data) {
        commands.push(mod.data.toJSON());
        console.log(`[Deploy] Loaded: ${mod.data.name}`);
      }
    } catch (err) {
      console.error(`[Deploy] Error loading ${file}:`, err.message);
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.token);
  const guildId = process.env.GUILD_ID;

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, guildId), { body: commands });
    console.log(`[Deploy] ✅ Registered ${commands.length} commands to guild ${guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log(`[Deploy] ✅ Registered ${commands.length} commands globally`);
  }
}

module.exports = {
  loadCommands,
  loadEvents,
  setupErrorHandling,
  deployCommands,
};
