# 🛡️ Advanced Moderation System - Dokumentasi Lengkap

## 📋 Overview
Sistem moderation terpadu dengan fitur-fitur advanced:
- ✅ **Invite Blocker dengan Whitelist** - Block semua Discord invite links
- ✅ **Bad Words Detector** - Filter kata-kata tidak pantas dengan severity levels
- ✅ **Spam Pattern Detector** - Deteksi spam dengan regex support
- ✅ **Warning Counter System** - Track pelanggaran & auto-action
- ✅ **Auto-Action System** - Warn → Mute → Kick otomatis
- ✅ **Statistics Tracking** - Track semua moderation activities
- ✅ **Detailed Logging** - Log ke channel yang ditentukan

---

## 🚀 Quick Start

### 1. Deploy Database
Copy SQL dari `lib/setupDatabase.js` dan jalankan di Supabase Dashboard:
- Buka Supabase Dashboard → SQL Editor
- Paste seluruh SQL dan klik "Run"

### 2. Setup AutoMod
```
/automod settings inviteblock enabled: true
/automod settings logchannel channel: #mod-logs
```

### 3. Start Using!
Bot akan otomatis block violations dan track statistics

---

## 📖 Command Reference

### Global Settings (`/automod settings`)

#### Enable/Disable Features
```
/automod settings inviteblock enabled: true/false      (Block invite links)
/automod settings badwordblock enabled: true/false     (Block bad words)
/automod settings spamblock enabled: true/false        (Block spam patterns)
/automod settings autodelete enabled: true/false       (Auto-delete violations)
```

#### Set Log Channel
```
/automod settings logchannel channel: #mod-logs
```
Set ke channel mana logs akan dikirim. Kosongkan untuk disable logging.

#### Configure Thresholds & Duration
```
/automod settings thresholds
  mute: 2              (Mute setelah 2 pelanggaran)
  kick: 3              (Kick setelah 3 pelanggaran)
  mute_duration: 300   (Mute selama 5 menit)
```

---

### Bad Words Management (`/automod badwords`)

#### Add Bad Word
```
/automod badwords add
  word: "profanity"
  severity: 1              (1=Warn, 2=Mute, 3=Kick)
  is_regex: false          (Normal text matching)
```

#### Add Regex Pattern
```
/automod badwords add
  word: "(word1|word2|word3)"
  severity: 2              (Automatically mute)
  is_regex: true           (Regex pattern)
```

#### Remove Bad Word
```
/automod badwords remove word: "profanity"
```

#### View All Bad Words
```
/automod badwords list
```

**Contoh Regex Pattern:**
- `(spam|junk)` - Match "spam" atau "junk"
- `(?:buy|sell).*(now|today)` - Match "buy/sell now/today"
- `(https?://)?discord\.gg/\w+` - Discord invite patterns

---

### Spam Detection (`/automod spam`)

#### Add Spam Pattern
```
/automod spam add
  pattern: "^.{50,}$"      (50+ character messages)
  severity: 1              (Warn threshold)
```

#### Remove Spam Pattern
```
/automod spam remove pattern: "^.{50,}$"
```

#### View All Patterns
```
/automod spam list
```

**Contoh Spam Patterns:**
- `[a-z]{100,}` - Detect flooding dengan karakter repetitif
- `(.)\1{50,}` - Detect character spam (aaaaaaa)
- `(http|https)://` - Remove link flooding
- `[\U0001F600-\U0001F64F]{10,}` - Emoji spam

---

### Whitelist Management (`/automod whitelist`)

#### Add Safe URL
```
/automod whitelist add
  url: "discord.gg/safe-community"
  reason: "Official community server"
```

URLs dalam whitelist akan **tidak di-block** oleh invite blocker.

#### Remove from Whitelist
```
/automod whitelist remove url: "discord.gg/safe-community"
```

#### View Whitelist
```
/automod whitelist list
```

---

### Status & Monitoring (`/automod`)

#### View All Settings
```
/automod status
```
Menampilkan semua konfigurasi AutoMod saat ini.

#### View Statistics
```
/automod stats
```
Menampilkan:
- 🔗 Invites Blocked
- 🚫 Bad Words Blocked
- 📧 Spam Blocked
- ⚠️ Warnings Given
- 🔇 Mutes Given
- 🦵 Kicks Given

---

## ⚙️ How It Works

### Warning System Flow
```
User violates rule
    ↓
Record violation
    ↓
Increment warning counter
    ↓
Check threshold:
  - Severity >= 3 → KICK immediately
  - Counter >= kick_threshold → KICK
  - Counter >= mute_threshold → MUTE
  - Otherwise → WARN
    ↓
Delete message (if auto_delete=true)
    ↓
Send warning to channel
    ↓
Log to mod-logs channel
```

### Severity Levels
- **1 (⚠️ WARN)** - User gets warned, visible to all
- **2 (🔇 MUTE)** - User muted for configured duration
- **3 (🦵 KICK)** - User immediately kicked from server

### Admin/Mod Bypass
Users dengan permission **Manage Messages** (admin/mod) dapat:
- Post invite links
- Post bad words
- Trigger spam patterns

---

## 📊 Database Schema

### Key Tables
```
automod_settings
  - Server settings & thresholds
  - invite_block, badword_block, spam_block
  - warning_threshold_mute, warning_threshold_kick
  - mute_duration (seconds)

mod_violations
  - Detailed record setiap pelanggaran
  - User, type, content, timestamp

mod_warnings
  - Tracking warning count per user
  - Last violation, action taken

mod_whitelist_urls
  - Safe URLs yang tidak di-block

mod_badwords
  - List of bad words/patterns dengan severity

mod_spam_patterns
  - Regex patterns untuk spam detection

mod_statistics
  - Aggregate stats (invites_blocked, mutes_given, etc)
```

---

## 🔧 Advanced Configuration Examples

### Strict Mode (3 Strikes System)
```
/automod settings thresholds
  mute: 2              (Strike 2 → Mute 10min)
  kick: 3              (Strike 3 → Kick)
  mute_duration: 600
```

### Custom Bad Words Filter
```
/automod badwords add word: "(badword1|badword2)" is_regex: true severity: 1
/automod badwords add word: "(hate|spam)" is_regex: true severity: 2
/automod badwords add word: "NSFW_CONTENT" is_regex: false severity: 3
```

### No-Nonsense Spam Setup
```
/automod spam add pattern: "([a-z])\1{50,}" severity: 2  (Character spam)
/automod spam add pattern: "(.){100,}" severity: 1        (Wall of text)
/automod spam add pattern: "(http|https)://{3,}" severity: 2  (Link spam)
/automod settings spamblock enabled: true
```

### Whitelist Safe Communities
```
/automod whitelist add url: "discord.gg/official" reason: "Official Discord"
/automod whitelist add url: "discord.gg/community" reason: "Community server"
```

---

## 🎯 Best Practices

### ✅ DO
- Enable invite blocking untuk prevent server spam
- Setup moderation log channel untuk audit trail
- Use regex patterns untuk lebih fleksibel
- Set appropriate severity levels
- Monitor `/automod stats` regularly

### ❌ DON'T
- Block legitimate words tanpa testing
- Set mute_duration terlalu lama (max 1 hour recommended)
- Forget to whitelist official community servers
- Use overly aggressive regex patterns (test first!)

---

## 💡 Tips & Tricks

### Test Regex Pattern
1. Google "regex tester" atau gunakan regex101.com
2. Test pattern sebelum add ke bot
3. Gunakan flags like `/gi` untuk case-insensitive

### Monitor Moderation Activity
```
/automod stats          (View statistics)
```

### Mass Add Bad Words
1. Buat list of words
2. Add satu-satu dengan chatting `/automod badwords add`

### Emergency Shutdown
```
/automod settings inviteblock enabled: false
/automod settings badwordblock enabled: false
/automod settings spamblock enabled: false
```

---

## 🔍 Troubleshooting

### Bot tidak block invite links
- ✅ Check: `/automod status` → Invite Blocking harus enabled
- ✅ Check: Bot punya permission untuk delete messages
- ✅ Check: Mod/Admin users bypass otomatis

### Regex pattern tidak work
- ✅ Test di regex101.com dulu
- ✅ Ensure `is_regex: true` ketika add pattern
- ✅ Check error log di terminal

### Mute tidak work
- ✅ Check: Bot punya permission untuk manage roles
- ✅ Check: Ada role dengan nama "mute" atau "muted"
- ✅ Manual create "mute" role jika tidak ada

### Statistics tidak update
- ✅ Pastikan database tables sudah dibuat
- ✅ Check Supabase connection di config

---

## 📞 Support
Jika ada masalah:
1. Check terminal logs untuk error messages
2. Verify database connection
3. Ensure bot permissions
4. Check Discord server settings
