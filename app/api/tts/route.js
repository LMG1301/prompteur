import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_VOICES = new Set([
  "fr-FR-DeniseNeural",
  "fr-FR-HenriNeural",
  "fr-FR-VivienneMultilingualNeural",
  "fr-FR-RemyMultilingualNeural",
  "fr-FR-EloiseNeural",
  "fr-FR-AlainNeural",
  "fr-FR-BrigitteNeural",
  "fr-FR-CelesteNeural",
  "fr-FR-ClaudeNeural",
  "fr-FR-CoralieNeural",
  "fr-FR-JacquelineNeural",
  "fr-FR-JeromeNeural",
  "fr-FR-JosephineNeural",
  "fr-FR-MauriceNeural",
  "fr-FR-YvesNeural",
  "fr-FR-YvetteNeural",
  "fr-CA-SylvieNeural",
  "fr-CA-AntoineNeural",
  "fr-CA-JeanNeural",
  "fr-CA-ThierryNeural",
]);

function clamp(n, min, max) {
  const v = Number(n);
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

// TTS primaire : Microsoft Edge neural voices via WebSocket
async function synthEdge(text, voice, rate, pitch) {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Edge TTS timeout")), 25000);
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text, {
        rate: `${rate >= 0 ? "+" : ""}${rate}%`,
        pitch: `${pitch >= 0 ? "+" : ""}${pitch}Hz`,
      });
      const chunks = [];
      audioStream.on("data", (c) => chunks.push(c));
      audioStream.on("end", () => {
        clearTimeout(timeout);
        try { tts.close(); } catch {}
        resolve(Buffer.concat(chunks));
      });
      audioStream.on("error", (e) => {
        clearTimeout(timeout);
        try { tts.close(); } catch {}
        reject(e);
      });
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
}

// Fallback : Google Translate TTS (robotique mais marche partout, sans clé).
// Limite 200 chars par requête → on split.
async function synthGoogleTranslate(text) {
  const MAX = 190;
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX) { chunks.push(remaining); break; }
    let cut = remaining.lastIndexOf(" ", MAX);
    if (cut < 50) cut = MAX;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  const buffers = [];
  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=fr&client=tw-ob&ttsspeed=1`;
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": "https://translate.google.com/",
      },
    });
    if (!r.ok) throw new Error("Google TTS " + r.status);
    buffers.push(Buffer.from(await r.arrayBuffer()));
  }
  return Buffer.concat(buffers);
}

function audioResponse(buffer, engine) {
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(buffer.length),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400, immutable",
      "X-TTS-Engine": engine,
    },
  });
}

function readParams(source) {
  const text = (source.text || "").toString().trim();
  const voice = ALLOWED_VOICES.has(source.voice) ? source.voice : "fr-FR-DeniseNeural";
  const rate = clamp(source.rate ?? 0, -50, 100);
  const pitch = clamp(source.pitch ?? 0, -50, 50);
  return { text, voice, rate, pitch };
}

async function handle(params) {
  const { text, voice, rate, pitch } = params;
  if (!text) return new Response("Missing text", { status: 400 });
  if (text.length > 5000) return new Response("Text too long", { status: 400 });

  // 1) Essai Edge TTS (voix naturelles)
  try {
    const buffer = await synthEdge(text, voice, rate, pitch);
    if (buffer && buffer.length > 100) return audioResponse(buffer, "edge");
    throw new Error("Edge returned empty buffer");
  } catch (edgeErr) {
    console.warn("Edge TTS failed, falling back to Google Translate:", edgeErr?.message || edgeErr);
  }

  // 2) Fallback Google Translate TTS (robotique mais fiable)
  try {
    const buffer = await synthGoogleTranslate(text);
    if (buffer && buffer.length > 100) return audioResponse(buffer, "google");
    throw new Error("Google TTS returned empty buffer");
  } catch (gErr) {
    console.error("Google TTS also failed:", gErr?.message || gErr);
    return new Response("All TTS engines failed: " + (gErr?.message || "unknown"), { status: 500 });
  }
}

export async function GET(req) {
  const url = new URL(req.url);
  return handle(readParams({
    text: url.searchParams.get("text"),
    voice: url.searchParams.get("voice"),
    rate: url.searchParams.get("rate"),
    pitch: url.searchParams.get("pitch"),
  }));
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  return handle(readParams(body || {}));
}
