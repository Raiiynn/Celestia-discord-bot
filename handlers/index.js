/**
 * Handlers module
 * Exports all handler functions for command loading, event loading, and error handling
 */

const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * Load all command files from commands directory
 */
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

    if (client.application) {
      await client.application.commands.set(commands);
      console.log(`[Commands] ✅ Registered ${commands.length} slash commands`);
    }
  } catch (err) {
    console.error('[Commands] Error loading commands:', err);
  }
}

/**
 * Load all event files from events directory
 */
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

/**
 * Handle global errors
 */
function setupErrorHandling() {
  process.on('unhandledRejection', err => {
    console.error('[Error] Unhandled Promise Rejection:', err);
  });

  process.on('uncaughtException', err => {
    console.error('[Error] Uncaught Exception:', err);
    process.exit(1);
  });
}

module.exports = {
  loadCommands,
  loadEvents,
  setupErrorHandling,
};
