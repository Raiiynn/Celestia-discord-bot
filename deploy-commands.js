require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs     = require('fs');
const path   = require('path');
const config = require('./config');

const commands = [];
const cmdDir   = path.join(__dirname, 'commands');

function loadCommands(dir) {
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      loadCommands(fullPath);
    } else if (file.endsWith('.js')) {
      try {
        const mod = require(fullPath);
        if (mod.data) {
          commands.push(mod.data.toJSON());
          console.log(`  Loaded: ${mod.data.name}`);
        }
      } catch (err) {
        console.error(`❌ Error loading ${file}:`, err.message);
      }
    }
  }
}

loadCommands(cmdDir);

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log(`📡 Registering ${commands.length} slash command(s)…`);
    const guildId = process.env.GUILD_ID;

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(config.clientId, guildId), { body: commands });
      console.log(`✅ Registered to guild ${guildId} (instant).`);
    } else {
      await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
      console.log('✅ Registered globally (may take up to 1 hour).');
    }

    console.log('\nCommands registered:');
    commands.forEach(c => console.log(`  /${c.name}`));
  } catch (err) {
    console.error('❌ Deploy failed:', err);
  }
})();