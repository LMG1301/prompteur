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

async function synth(text, voice, rate, pitch) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, {
    rate: `${rate >= 0 ? "+" : ""}${rate}%`,
    pitch: `${pitch >= 0 ? "+" : ""}${pitch}Hz`,
  });
  const chunks = [];
  await new Promise((resolve, reject) => {
    audioStream.on("data", (c) => chunks.push(c));
    audioStream.on("end", resolve);
    audioStream.on("error", reject);
  });
  try { tts.close(); } catch {}
  return Buffer.concat(chunks);
}

function audioResponse(buffer) {
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(buffer.length),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400, immutable",
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
  try {
    const buffer = await synth(text, voice, rate, pitch);
    return audioResponse(buffer);
  } catch (e) {
    console.error("TTS error", e);
    return new Response("TTS failed: " + (e?.message || "unknown"), { status: 500 });
  }
}

// GET : permet à <audio src="/api/tts?text=..."> de streamer directement.
// C'est l'approche la plus iOS-friendly (pas de blob URL intermédiaire).
export async function GET(req) {
  const url = new URL(req.url);
  return handle(readParams({
    text: url.searchParams.get("text"),
    voice: url.searchParams.get("voice"),
    rate: url.searchParams.get("rate"),
    pitch: url.searchParams.get("pitch"),
  }));
}

// POST : conservé pour usage programmatique (fetch + cache préchargement)
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  return handle(readParams(body || {}));
}
