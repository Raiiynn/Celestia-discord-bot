"use strict";

/**
 * services/aiService.js
 * OpenRouter API wrapper for the Discord AI chatbot.
 */

const config = require("../config");
const searchService = require("./searchService");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Daftar model gratis yang diverifikasi aktif di OpenRouter API
// Urutan: utama → fallback → cadangan terakhir → auto router
const FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",  // Utama (Terbaik untuk chat & penalaran)
  "google/gemma-4-31b-it:free",              // Fallback 1 (Kualitas tinggi dari Google)
  "meta-llama/llama-3.2-3b-instruct:free",   // Fallback 2 (Ringan & paling stabil)
  "openai/gpt-oss-120b:free",                // Fallback 3 (Kuat, tapi ada mandatory reasoning)
  "openrouter/free"                          // Fallback 4 (Auto-router, mencari model gratis yang online)
];
const DEFAULT_MODEL = FREE_MODELS[0]; // untuk export
const MAX_TOKENS = 1024;
const MAX_HISTORY = 20;
const REQUEST_TIMEOUT = 60_000; // 60 detik — model gratis kadang lambat

const BASE_SYSTEM_PROMPT =
  "You are a helpful, friendly assistant in a Discord server. " +
  "Answer clearly and concisely. " +
  "Respond in Indonesian or English depending on the user's language. " +
  "Never reveal your model name, API provider, or any technical details. " +
  "If asked what AI you are, say you are the server's AI assistant. " +
  "If you do not know the answer or if the request requires real-time, current, or future information (such as recent sports events, live news, or upcoming matches) that you do not have access to, state honestly that you do not have access to real-time internet data to verify it, and do not make up or hallucinate details.\n\n" +
  "FORMATTING RULES (strictly follow these):\n" +
  "- NEVER use markdown tables (no | pipes | for tables). Discord cannot render them.\n" +
  "- NEVER use HTML tags like <br>, <b>, <strong>, etc.\n" +
  "- Use plain text and simple bullet points (- or •) for lists.\n" +
  "- Use **bold** for emphasis and `code` for technical terms only.\n" +
  "- Use numbered lists (1. 2. 3.) for steps.\n" +
  "- Keep responses short and readable in a chat window.";

// ─── Prompt ───────────────────────────────────────────────────────────────────

/**
 * Build the final system prompt.
 * Custom persona is prepended so it overrides the base prompt's tone.
 * @param {string|null} persona
 * @returns {string}
 */
function buildSystemPrompt(persona) {
  if (persona && persona.trim()) {
    return `${persona.trim()}\n\n${BASE_SYSTEM_PROMPT}`;
  }
  return BASE_SYSTEM_PROMPT;
}

// ─── History helpers ──────────────────────────────────────────────────────────

/**
 * Convert stored Gemini-style history → OpenAI messages format.
 * @param {Array} history
 * @returns {Array<{role: string, content: string}>}
 */
function historyToMessages(history) {
  return (history || []).map((h) => ({
    role: h.role === "model" ? "assistant" : h.role,
    content: h.parts?.[0]?.text ?? "",
  }));
}

/**
 * Append a completed turn and trim to MAX_HISTORY turns.
 * @param {Array}  history
 * @param {string} userInput
 * @param {string} aiReply
 * @returns {Array}
 */
function appendHistory(history, userInput, aiReply) {
  return [
    ...(history || []),
    { role: "user", parts: [{ text: userInput }] },
    { role: "model", parts: [{ text: aiReply }] },
  ].slice(-MAX_HISTORY);
}

// ─── API call ─────────────────────────────────────────────────────────────────

/**
 * Call OpenRouter and return the AI response text.
 * @param {string} systemPrompt
 * @param {Array}  history
 * @param {string} userInput
 * @returns {Promise<string>}
 */
async function callOpenRouter(systemPrompt, history, userInput) {
  const apiKey = config.openRouterKey || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("`OPENROUTER_API_KEY` belum diset di file `.env`");
  }

  let activeSystemPrompt = systemPrompt;
  try {
    if (searchService.shouldSearch(userInput)) {
      const searchContext = await searchService.getSearchContext(userInput);
      if (searchContext) {
        activeSystemPrompt += searchContext;
      }
    }
  } catch (searchErr) {
    console.error("[aiService] Web search failed:", searchErr.message);
  }

  const messages = [
    { role: "system", content: activeSystemPrompt },
    ...historyToMessages(history),
    { role: "user", content: userInput },
  ];

  // ── Coba semua model secara berurutan sampai ada yang berhasil ────────────
  for (const model of FREE_MODELS) {
    let res;
    try {
      res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://discord.com",
          "X-Title": "Discord Bot",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: MAX_TOKENS,
          temperature: 0.8,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });
    } catch (err) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        console.warn(`[aiService] Timeout pada model ${model}, mencoba fallback...`);
        continue; // coba model berikutnya
      }
      throw new Error(`Network error: ${err.message}`);
    }

    // Baca seluruh body sebagai teks —— lebih robust dari res.json()
    const rawText = await res.text().catch(() => "");

    if (!res.ok) {
      const msg = parseApiError(rawText) || `HTTP ${res.status} ${res.statusText}`;
      console.warn(`[aiService] Model ${model} HTTP error: ${msg}`);
      continue; // coba model berikutnya
    }

    // ── Ekstrak JSON dari respons (buang SSE artifacts / BOM / whitespace) ────
    const data = extractJson(rawText);
    if (!data) {
      console.warn(
        `[aiService] JSON parse gagal pada model ${model}. Raw (500 char):`,
        rawText.slice(0, 500)
      );
      continue; // coba model berikutnya
    }

    if (data?.error) {
      const errMsg = data.error.message || data.error.type || JSON.stringify(data.error);
      console.warn(`[aiService] API error dari model ${model}:`, errMsg);
      continue; // coba model berikutnya
    }

    const text = data?.choices?.[0]?.message?.content;
    const finishReason = data?.choices?.[0]?.finish_reason || "unknown";

    if (!text || text.trim() === "") {
      console.warn(
        `[aiService] Respons kosong dari model ${model}. finish_reason: ${finishReason}`
      );
      continue; // coba model berikutnya
    }

    return text.trim();
  }

  // Semua model gagal
  throw new Error(
    "AI tidak dapat merespons saat ini. Semua model sedang tidak tersedia atau overloaded. " +
    "Coba lagi beberapa saat kemudian."
  );
}

/**
 * Extract a human-readable message from an OpenRouter error body.
 * @param {string} body
 * @returns {string|null}
 */
function parseApiError(body) {
  try {
    const j = JSON.parse(body);
    return j?.error?.message ?? j?.message ?? null;
  } catch {
    return body ? body.slice(0, 300) : null;
  }
}

/**
 * Robustly extract & parse the first complete JSON object/array from a string.
 * Handles: BOM, SSE "data: " prefixes, leading whitespace/garbage.
 * Returns null if no valid JSON is found.
 * @param {string} raw
 * @returns {object|null}
 */
function extractJson(raw) {
  if (!raw) return null;

  // Hapus BOM dan strip baris SSE ("data: {...}")
  let cleaned = raw.replace(/^\uFEFF/, "");

  // Kalau ada SSE format, ambil konten setelah "data: "
  const sseMatch = cleaned.match(/data:\s*(\{[\s\S]*)/m);
  if (sseMatch) cleaned = sseMatch[1];

  // Cari indeks awal JSON yang valid ({ atau [)
  const start = cleaned.search(/[{[]/);
  if (start === -1) return null;
  cleaned = cleaned.slice(start).trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Jika partial JSON (terpotong), coba repair: potong di posisi objek terakhir yang valid
    // Ini menangani kasus "Unexpected end of JSON input"
    const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (lastBrace > 0) {
      try {
        return JSON.parse(cleaned.slice(0, lastBrace + 1));
      } catch {
        // Tidak bisa diperbaiki
      }
    }
    return null;
  }
}

// ─── Message splitting ────────────────────────────────────────────────────────

/**
 * Split a long string into Discord-safe chunks (max 1900 chars).
 * Prefers paragraph → newline → word boundaries.
 * Never splits inside a fenced code block.
 * @param {string} text
 * @param {number} [maxLen=1900]
 * @returns {string[]}
 */
function splitMessage(text, maxLen = 1900) {
  if (!text || text.length <= maxLen) return [text || ""];

  const parts = [];
  let buf = text;

  while (buf.length > maxLen) {
    // Protect fenced code blocks ─────────────────────────────────────────────
    const codeOpen = buf.indexOf("```");
    if (codeOpen !== -1 && codeOpen < maxLen) {
      const codeClose = buf.indexOf("```", codeOpen + 3);
      if (codeClose === -1 || codeClose + 3 > maxLen) {
        // Block overflows — split before it if possible
        if (codeOpen > 0) {
          const before = buf.slice(0, codeOpen).trimEnd();
          if (before.length > 0) {
            parts.push(before);
            buf = buf.slice(codeOpen);
            continue;
          }
        }
        // Block starts at 0 and is too long — force cut
        parts.push(buf.slice(0, maxLen));
        buf = buf.slice(maxLen);
        continue;
      }
    }

    // Natural split points ────────────────────────────────────────────────────
    let cut = buf.lastIndexOf("\n\n", maxLen);
    if (cut < maxLen * 0.4) cut = buf.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.4) cut = buf.lastIndexOf(" ", maxLen);
    if (cut <= 0) cut = maxLen;

    parts.push(buf.slice(0, cut).trimEnd());
    buf = buf.slice(cut).trimStart();
  }

  if (buf.length > 0) parts.push(buf);
  return parts.filter((p) => p.length > 0);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  callOpenRouter,
  buildSystemPrompt,
  splitMessage,
  appendHistory,
  DEFAULT_MODEL,
  MAX_HISTORY,
};
