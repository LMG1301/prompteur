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

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const text = (body?.text || "").toString().trim();
  if (!text) return new Response("Missing text", { status: 400 });
  if (text.length > 5000) return new Response("Text too long", { status: 400 });

  const voice = ALLOWED_VOICES.has(body?.voice) ? body.voice : "fr-FR-DeniseNeural";
  const rate = clamp(body?.rate ?? 0, -50, 100);   // % adjust (-50..+100)
  const pitch = clamp(body?.pitch ?? 0, -50, 50);  // % adjust (-50..+50)

  try {
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
    const buffer = Buffer.concat(chunks);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (e) {
    console.error("TTS error", e);
    return new Response("TTS failed: " + (e?.message || "unknown"), { status: 500 });
  }
}
