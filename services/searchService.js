"use strict";

/**
 * services/searchService.js
 * Lightweight, zero-config web search helper using Bing.
 * Extracts real-time context to feed to the LLM.
 */

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Kata kunci yang menandakan perlunya pencarian web real-time (Indonesian & English)
const SEARCH_KEYWORDS = [
  // Indonesian
  "akankah", "siapa", "kapan", "dimana", "skor", "menang", "kalah", "pertandingan",
  "vs", "berita", "cuaca", "suhu", "hari ini", "kemarin", "esok", "besok", "terbaru",
  "jadwal", "juara", "klasemen", "turnamen", "info terkini", "perkembangan", "update",
  // English
  "who is", "who won", "who lost", "who plays", "when is", "where is", "score",
  "match", "vs", "news", "weather", "temperature", "today", "yesterday", "tomorrow",
  "latest", "schedule", "winner", "champion", "standings", "tournament"
];

// Regex untuk mendeteksi kata kunci (menggunakan batas kata \b)
const SEARCH_REGEX = new RegExp(
  `\\b(${SEARCH_KEYWORDS.join("|")})\\b`,
  "i"
);

/**
 * Detect if the user prompt requires web search.
 * @param {string} prompt 
 * @returns {boolean}
 */
function shouldSearch(prompt) {
  if (!prompt) return false;
  return SEARCH_REGEX.test(prompt);
}

/**
 * Clean HTML tags from a string.
 * @param {string} html 
 * @returns {string}
 */
function cleanText(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Decode Bing's tracking URL to extract the original URL.
 * Bing encodes the target URL in the 'u' query parameter as base64 with a 'a1' prefix.
 * @param {string} trackingUrl 
 * @returns {string}
 */
function decodeBingUrl(trackingUrl) {
  try {
    const uMatch = trackingUrl.match(/[\?&]u=a1([a-zA-Z0-9_=-]+)/);
    if (!uMatch) return trackingUrl;
    
    let base64 = uMatch[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
      
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }
    
    return Buffer.from(base64, "base64").toString("utf8");
  } catch {
    return trackingUrl;
  }
}

/**
 * Execute web search via Bing and parse the top results.
 * @param {string} query 
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
async function searchWeb(query) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT
      }
    });

    if (!res.ok) {
      throw new Error(`Bing Search returned HTTP ${res.status}`);
    }

    const html = await res.text();
    const results = [];
    
    // Bing search results are wrapped in <li class="b_algo">
    const bAlgoRegex = /<li[^>]+class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    
    while ((match = bAlgoRegex.exec(html)) !== null && results.length < 3) {
      const content = match[1];
      
      // Extract main link & title
      const linkMatch = content.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;
      
      const trackingUrl = linkMatch[1];
      const title = cleanText(linkMatch[2]);
      const decodedUrl = decodeBingUrl(trackingUrl);
      
      // Extract snippet (usually in a <p> or <div class="b_caption">)
      const snippetMatch = content.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || 
                           content.match(/<div[^>]+class="[^"]*b_caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      
      const snippet = snippetMatch ? cleanText(snippetMatch[1]) : "";
      
      results.push({
        title,
        url: decodedUrl,
        snippet
      });
    }

    return results;
  } catch (err) {
    console.error("[searchService] Error performing web search:", err.message);
    return [];
  }
}

/**
 * Generate formatted search context block for the system prompt.
 * @param {string} query 
 * @returns {Promise<string>}
 */
async function getSearchContext(query) {
  console.log(`[searchService] Triggering web search for: "${query}"`);
  const results = await searchWeb(query);
  
  if (results.length === 0) {
    return "";
  }

  const currentDate = new Date().toISOString().split("T")[0];
  let context = `\n\n=== [TEMPORARY WEB CONTEXT] ===\n`;
  context += `Informasi terkini hasil pencarian internet real-time (Hari ini: ${currentDate}):\n\n`;

  results.forEach((r, idx) => {
    context += `[Sumber ${idx + 1}]\n`;
    context += `Judul: ${r.title}\n`;
    context += `Link: ${r.url}\n`;
    context += `Konteks: ${r.snippet}\n\n`;
  });

  context += `Instruksi penggunaan informasi:\n`;
  context += `- Gunakan informasi di atas jika relevan untuk menjawab pertanyaan pengguna.\n`;
  context += `- Jawablah dengan wawasan yang alami, seolah-olah Anda memang mengetahuinya secara langsung.\n`;
  context += `- Jangan sebutkan bahwa Anda mencari di internet menggunakan mesin pencari, Google, atau Bing.\n`;
  context += `- Tetap patuhi aturan pemformatan dasar Discord.\n`;
  context += `=================================\n\n`;

  return context;
}

module.exports = {
  shouldSearch,
  searchWeb,
  getSearchContext
};
