# Quick Reference - Guardian Bot Migration

## ⚡ Quick Start (3 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Copy SQL schema to Supabase and execute
# (from lib/supabaseSchema.sql.js)

# 3. Update .env with your credentials
DISCORD_TOKEN=your_token
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key

# 4. Start bot
npm start
```

---

## 📋 Commands Quick Ref

### Moderation
| Command | Purpose | Usage |
|---------|---------|-------|
| `/ban` | Ban user | `/ban @user delete_messages:24h reason:"Spam"` |
| `/kick` | Kick user | `/kick @user reason:"Disruptive"` |

### Setup
| Command | Purpose | Usage |
|---------|---------|-------|
| `/logging` | Configure logs | `/logging setup mod_logs:#mod general_logs:#general` |
| `/verification` | Setup verification | `/verification setup channel:#verify verified_role:@Member` |
| `/automod` | Configure automod | `/automod spam enable:true max_messages:5` |
| `/backup` | Manage backups | `/backup create` or `/backup list` |

### Utilities
| Command | Purpose | Usage |
|---------|---------|-------|
| `/password` | Generate password | `/password length:20 uppercase:true symbols:true` |
| `/maintenance` | Maintenance mode | `/maintenance` (toggle) |

---

## 🗄️ Database Reference

### Guild Settings
```javascript
{
  guild_id,
  logs_enabled,
  logs_moderator,              // Channel for mod logs
  authorization_enabled,
  verification_enabled,
  autorole_enabled,
  automod_anti_spam_enabled,
  automod_anti_badwords_enabled,
  automod_anti_zalgo_enabled,
  // ... 20+ more settings
}
```

### Infractions
```javascript
{
  guild_id,
  user_id,
  issuer_id,
  type: 'ban'|'kick'|'warning'|'timeout',
  active: true,
  reason,
  time,
  expires,
  created_at
}
```

---

## 💻 Common Code Patterns

### Get Guild Settings
```javascript
const GuildsManager = require('./lib/GuildsManager');
const settings = await GuildsManager.getSettings(guildId);
```

### Create Infraction
```javascript
const { error } = await supabase
  .from('infractions')
  .insert({
    guild_id: guildId,
    user_id: userId,
    issuer_id: issuerId,
    type: 'ban',
    reason: 'Spam',
    active: true,
    time: Date.now()
  });
```

### Send Embed
```javascript
const { basicEmbed, errorEmbed } = require('./utils/embedGenerator');

await interaction.reply({
  embeds: [basicEmbed('✅ Success!')]
});
```

### Log Action
```javascript
const { sendModLog } = require('./utils/modLog');

const embed = new Discord.EmbedBuilder()
  .setColor('Red')
  .setTitle('Ban')
  .setDescription(`User: ${user.tag}`);

await sendModLog(guild, guildSettings, embed);
```

---

## 📁 File Locations

| What | Where |
|------|-------|
| Commands | `commands/*.js` |
| Events | `events/*.js` |
| Managers | `lib/*Manager.js` |
| Utilities | `utils/*.js` |
| Database Connection | `lib/db.js` |
| Database Schema | `lib/supabaseSchema.sql.js` |

---

## 🔧 Manager Methods

### GuildsManager
```javascript
await GuildsManager.getOrCreate(guildId)
await GuildsManager.getSettings(guildId)
await GuildsManager.update(guildId, updates)
await GuildsManager.enableFeature(guildId, feature, config)
await GuildsManager.disableFeature(guildId, feature)
```

### UsersManager
```javascript
await UsersManager.getOrCreate(userId, guildId)
await UsersManager.getUser(userId, guildId)
await UsersManager.update(userId, guildId, updates)
await UsersManager.getLanguage(userId, guildId)
await UsersManager.setLanguage(userId, guildId, lang)
```

---

## ⚙️ Environment Variables

```env
# Discord
DISCORD_TOKEN=                    # Bot token
CLIENT_ID=                        # Application ID

# Supabase
SUPABASE_URL=https://...         # Supabase project URL
SUPABASE_ANON_KEY=               # Anon key

# Optional
MUSIC_MONITOR_CHANNEL_ID=        # Music monitoring channel
STREAK_CHANNEL_ID=               # Streak announcements
GEMINI_API_KEY=                  # AI features
```

---

## 📊 Database Tables (TL;DR)

- `guilds` - Guild configs
- `users` - User profiles
- `infractions` - Mod actions
- `notes` - Member notes
- `tickets` - Support tickets
- `reminders` - User reminders
- `afk` - AFK tracking
- `giveaways` - Giveaway data
- `reaction_roles` - Role reactions
- `guild_members` - Member tracking
- `economy` - Currency
- `backups` - Backups
- `streaks` - Streaks

---

## 🚨 Error Handling

All commands have try-catch:
```javascript
try {
  // Do something
} catch (err) {
  console.error('[CommandName] Error:', err);
  await interaction.reply({
    embeds: [errorEmbed('Failed to execute')],
    ephemeral: true
  });
}
```

---

## 🎯 Event Handlers

| Event | File | Purpose |
|-------|------|---------|
| Ready | n/a | (in index.js) |
| InteractionCreate | `interactionCreate.js` | Commands |
| GuildCreate | `guildCreate.js` | Welcome |
| GuildMemberAdd | `guildMemberAdd.js` | AutoRole |
| GuildMemberRemove | `guildMemberRemove.js` | Cleanup |

---

## 🔐 Permissions Required

- `BanMembers` - `/ban`
- `KickMembers` - `/kick`
- `ManageChannels` - Logging setup
- `ManageRoles` - Verification, AutoRole
- `ReadMessageHistory` - Message deletion on ban
- `Administrator` - Most setup commands

---

## 📈 Monitoring

### Check Bot Health
```bash
# After starting, look for:
✅ Logged in as BotName#0000
✅ Database initialized successfully
✅ 8 slash commands loaded
✅ 5 events loaded
```

### Monitor Commands
```javascript
// In interactionCreate.js - logs each command
console.log(`[SlashCommand] ${user.tag} used ${commandName}`);
```

### View Database
1. Supabase Dashboard
2. SQL Editor
3. `SELECT * FROM guilds;`

---

## ✅ Testing Checklist

- [ ] Bot starts without errors
- [ ] Slash commands appear in Discord
- [ ] `/ban @test` works
- [ ] Infraction appears in database
- [ ] Logging channel receives messages
- [ ] Guild settings save correctly
- [ ] AutoRole triggers on member join
- [ ] Verification button works

---

## 📞 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Bot won't start | Check .env, Discord token |
| Commands missing | Check commands folder, restart bot |
| Database connection fails | Check Supabase URL/key, create tables |
| Logs not appearing | Check `logs_enabled` in guilds table |
| AutoRole not working | Check `autorole_enabled` and role ID |

---

## 🚀 Deployment

**Development:**
```bash
npm start
```

**Production (using PM2):**
```bash
npm install -g pm2
pm2 start index.js --name "bot"
pm2 save
pm2 startup
```

---

## 📚 Full Documentation

- **Quick Start:** This file
- **Detailed Setup:** See `SETUP.md`
- **Feature Details:** See `MIGRATION_GUIDE.md`
- **Complete Stats:** See `SUMMARY.md`

---

**Last Updated:** April 14, 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
