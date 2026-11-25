// Text to speech for the narrator, used only to pre-record public/audio (see tools/gen-audio.mjs).
// It speaks nothing but the game's own lines, so it can't be used as a free TTS service.
import TEXTS from "./tts-texts.json";

const ALLOWED = new Set(TEXTS);
const VOICES = new Set(["theia", "pandora", "hyperion", "draco", "asteria", "luna"]);

export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const text = url.searchParams.get("t") || "";
  const voice = url.searchParams.get("v") || "theia";
  if (!ALLOWED.has(text) || !VOICES.has(voice)) return new Response("Not a line from the game", { status: 403 });

  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;

  const out = await env.AI.run("@cf/deepgram/aura-2-en", { text, speaker: voice, encoding: "mp3" }, { returnRawResponse: true });
  if (!out.ok) return new Response("TTS failed: " + (await out.text()).slice(0, 200), { status: 502 });
  const res = new Response(out.body, { headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=31536000, immutable" } });
  waitUntil(cache.put(request, res.clone()));
  return res;
}
