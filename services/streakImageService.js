'use strict';

/**
 * streakImageService.js
 * Generates a 1920×1080 PNG streak card using Sharp.
 *
 * Layout:
 *   Left avatar  — top-left corner at (180, 350), 260×260 px
 *   Right avatar — top-left corner at (1480, 350), 260×260 px
 *   Streak number — horizontally centered (x=960), fire-orange gradient, large font
 *   Usernames — centered below each avatar
 *
 * Background:
 *   If  assets/streak-bg.png  exists → used as background (resized to 1920×1080).
 *   Otherwise → auto-generated dark purple gradient via SVG.
 */

const sharp = require('sharp');
const path  = require('path');
const { existsSync } = require('fs');

const ASSETS_DIR  = path.join(__dirname, '../assets');
const BG_PATH     = path.join(ASSETS_DIR, 'streak-bg.png');

const W           = 1920;
const H           = 1080;
const AVATAR_SIZE = 260;   // avatar square before outline
const OUTLINE     = 12;    // white ring thickness (px each side)

// ─── Background ──────────────────────────────────────────────────────────────

async function makeFallbackBg() {
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="#0a0015"/>
        <stop offset="45%"  stop-color="#1a0a3d"/>
        <stop offset="100%" stop-color="#0d1b4b"/>
      </linearGradient>
      <radialGradient id="cg" cx="50%" cy="50%" r="45%">
        <stop offset="0%"   stop-color="#7B2FBE" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#7B2FBE" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="lg" cx="16%" cy="50%" r="28%">
        <stop offset="0%"   stop-color="#5a1fcf" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#5a1fcf" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="rg" cx="84%" cy="50%" r="28%">
        <stop offset="0%"   stop-color="#2E0854" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#2E0854" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect width="${W}" height="${H}" fill="url(#cg)"/>
    <rect width="${W}" height="${H}" fill="url(#lg)"/>
    <rect width="${W}" height="${H}" fill="url(#rg)"/>
    <!-- decorative rings -->
    <circle cx="960"  cy="540" r="490" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1.5"/>
    <circle cx="960"  cy="540" r="360" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
    <circle cx="960"  cy="540" r="220" fill="none" stroke="rgba(123,47,190,0.12)"  stroke-width="2"/>
    <circle cx="310"  cy="480" r="200" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
    <circle cx="1610" cy="480" r="200" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ─── Avatar processing ───────────────────────────────────────────────────────

/**
 * Fetch a remote image URL into a Buffer.
 * Throws on HTTP error or timeout.
 */
async function fetchBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching avatar`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Resize a raw image buffer to a circle with a white outline + purple glow.
 * Returns a PNG buffer of size (AVATAR_SIZE + OUTLINE*2)².
 */
async function makeCircleAvatar(rawBuf) {
  const S     = AVATAR_SIZE;
  const total = S + OUTLINE * 2;
  const r     = S / 2;
  const tr    = total / 2;

  // 1. Circular crop mask
  const circleMask = Buffer.from(
    `<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
       <circle cx="${r}" cy="${r}" r="${r}" fill="white"/>
     </svg>`
  );

  // 2. Resize avatar + apply circular mask
  const cropped = await sharp(rawBuf)
    .resize(S, S, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()
    .then(buf =>
      sharp(buf)
        .composite([{ input: circleMask, blend: 'dest-in' }])
        .png()
        .toBuffer()
    );

  // 3. White-ring + glow backdrop (slightly larger square)
  const backdrop = Buffer.from(
    `<svg width="${total}" height="${total}" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
           <feGaussianBlur stdDeviation="10" result="blur"/>
           <feMerge>
             <feMergeNode in="blur"/>
             <feMergeNode in="SourceGraphic"/>
           </feMerge>
         </filter>
       </defs>
       <circle cx="${tr}" cy="${tr}" r="${tr - 1}" fill="white" filter="url(#glow)"/>
     </svg>`
  );

  // 4. Paste cropped avatar centred on the white ring
  return sharp(backdrop)
    .composite([{ input: cropped, left: OUTLINE, top: OUTLINE }])
    .png()
    .toBuffer();
}

/**
 * Letter-based placeholder avatar when the real one can't be fetched.
 */
async function makePlaceholder(letter) {
  const total = AVATAR_SIZE + OUTLINE * 2;
  const r     = total / 2;
  const svg   = `<svg width="${total}" height="${total}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${r}" cy="${r}" r="${r - 1}"          fill="#7B2FBE"/>
    <circle cx="${r}" cy="${r}" r="${r - OUTLINE - 1}" fill="#5a1f9a"/>
    <text x="${r}" y="${r}" text-anchor="middle" dominant-baseline="middle"
      font-family="Arial Black,sans-serif"
      font-size="${Math.floor(AVATAR_SIZE * 0.45)}"
      font-weight="900" fill="white">${escXml(letter.toUpperCase())}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ─── Text overlay ─────────────────────────────────────────────────────────────

function escXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build an SVG overlay that contains the streak number and user names.
 * The overlay is the full 1920×1080 canvas (transparent background).
 */
function makeTextOverlay(streakCount, name1, name2) {
  const n1  = escXml(name1.length > 16 ? name1.slice(0, 14) + '…' : name1);
  const n2  = escXml(name2.length > 16 ? name2.slice(0, 14) + '…' : name2);
  const num = String(streakCount);

  // Scale font size slightly for very large numbers
  const numFontSize = num.length <= 3 ? 200 : num.length === 4 ? 170 : 140;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Fire gradient for the big number -->
      <linearGradient id="fg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stop-color="#FFD700"/>
        <stop offset="45%"  stop-color="#FF6B35"/>
        <stop offset="100%" stop-color="#FF2244"/>
      </linearGradient>

      <!-- Glow bloom behind the number -->
      <filter id="numGlow" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="18" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Subtle glow for names -->
      <filter id="nameGlow" x="-15%" y="-15%" width="130%" height="130%">
        <feGaussianBlur stdDeviation="5" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- ── Big streak number, horizontally centred ── -->
    <text
      x="960" y="490"
      text-anchor="middle" dominant-baseline="middle"
      font-family="'Arial Black','Impact','DejaVu Sans Bold',sans-serif"
      font-size="${numFontSize}" font-weight="900"
      fill="url(#fg)" filter="url(#numGlow)"
    >${num}</text>

    <!-- ── "STREAK" caption below number ── -->
    <text
      x="960" y="630"
      text-anchor="middle" dominant-baseline="middle"
      font-family="Arial,sans-serif"
      font-size="28" font-weight="600" letter-spacing="14"
      fill="rgba(255,255,255,0.45)"
    >STREAK</text>

    <!-- ── Decorative divider lines flanking "STREAK" ── -->
    <line x1="680"  y1="630" x2="830"  y2="630" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
    <line x1="1090" y1="630" x2="1240" y2="630" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>

    <!-- ── User 1 name — centred below left avatar ── -->
    <!-- Avatar centre: x = 180 + 260/2 = 310 -->
    <text
      x="310" y="668"
      text-anchor="middle" dominant-baseline="middle"
      font-family="Arial,sans-serif"
      font-size="34" font-weight="700"
      fill="white" filter="url(#nameGlow)"
    >${n1}</text>

    <!-- ── User 2 name — centred below right avatar ── -->
    <!-- Avatar centre: x = 1480 + 260/2 = 1610 -->
    <text
      x="1610" y="668"
      text-anchor="middle" dominant-baseline="middle"
      font-family="Arial,sans-serif"
      font-size="34" font-weight="700"
      fill="white" filter="url(#nameGlow)"
    >${n2}</text>
  </svg>`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a 1920×1080 streak card PNG.
 *
 * @param {{ displayName: string, avatarURL: string }} user1  Left-side user
 * @param {{ displayName: string, avatarURL: string }} user2  Right-side user
 * @param {number} streakCount
 * @returns {Promise<Buffer>} PNG buffer ready to attach to a Discord message
 */
async function generateStreakCard(user1, user2, streakCount) {
  console.log(`[ImageSvc] Generating: ${user1.displayName} × ${user2.displayName}  streak=${streakCount}`);

  // ── 1. Background ──────────────────────────────────────────
  const bgBuf = existsSync(BG_PATH)
    ? await sharp(BG_PATH).resize(W, H, { fit: 'cover' }).png().toBuffer()
    : await makeFallbackBg();

  // ── 2. Avatars (concurrent; individual fallback per avatar) ─
  const [av1, av2] = await Promise.all([
    fetchBuffer(user1.avatarURL)
      .then(b  => makeCircleAvatar(b))
      .catch(() => makePlaceholder(user1.displayName[0] ?? '?')),
    fetchBuffer(user2.avatarURL)
      .then(b  => makeCircleAvatar(b))
      .catch(() => makePlaceholder(user2.displayName[0] ?? '?')),
  ]);

  // ── 3. Text overlay SVG ────────────────────────────────────
  const textSvg = Buffer.from(
    makeTextOverlay(streakCount, user1.displayName, user2.displayName)
  );

  // ── 4. Composite ───────────────────────────────────────────
  //
  // Spec positions are top-left of the 260×260 avatar area.
  // The outlined avatar is (AVATAR_SIZE + OUTLINE*2) wide/tall,
  // so we shift each avatar by -OUTLINE to keep the inner image
  // aligned to the spec coordinates.
  //
  //  Left avatar:  spec x=180, y=350  →  composite at (168, 338)
  //  Right avatar: spec x=1480, y=350 →  composite at (1468, 338)
  //
  const av1Left = 180  - OUTLINE;   // 168
  const av1Top  = 350  - OUTLINE;   // 338
  const av2Left = 1480 - OUTLINE;   // 1468
  const av2Top  = 350  - OUTLINE;   // 338

  const result = await sharp(bgBuf)
    .composite([
      { input: av1,     left: av1Left, top: av1Top },
      { input: av2,     left: av2Left, top: av2Top },
      { input: textSvg, left: 0,       top: 0      },
    ])
    .png({ compressionLevel: 6 })
    .toBuffer();

  console.log(`[ImageSvc] Done — ${(result.length / 1024).toFixed(0)} KB`);
  return result;
}

module.exports = { generateStreakCard };
