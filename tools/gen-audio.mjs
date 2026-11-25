// Pre-records everything the narrator says into public/audio/<voice>/<hash>.mp3.
//
//   node tools/gen-audio.mjs texts                 -> writes functions/api/tts-texts.json (the allow-list)
//   node tools/gen-audio.mjs fetch https://spelling.world [voice]
//                                                   -> downloads any missing clips from /api/tts
//
// After changing words or phrases in public/index.html: run "texts", push (so the function
// knows the new lines), then run "fetch" and push again.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const start = html.indexOf("// Word lists");
const end = html.indexOf("(function () {", start);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(html.slice(start, end) + "\nthis.ttsTexts = ttsTexts; this.vhash = vhash;", ctx);
const texts = ctx.ttsTexts();

// Records every missing line into public/audio/<folder>/, using get(text) -> Response.
async function record(folder, get, workers) {
  const dir = path.join(root, "public/audio", folder);
  fs.mkdirSync(dir, { recursive: true });
  const todo = texts.filter((t) => !fs.existsSync(path.join(dir, ctx.vhash(t) + ".mp3")));
  console.log(todo.length + " of " + texts.length + " clips to record into public/audio/" + folder);
  let done = 0, failed = [];
  async function one(t) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await get(t);
        if (!r.ok) throw new Error(r.status + " " + (await r.text()).slice(0, 160));
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 500) throw new Error("tiny response");
        fs.writeFileSync(path.join(dir, ctx.vhash(t) + ".mp3"), buf);
        return;
      } catch (e) {
        if (attempt === 3 || /^(401|402|403)/.test(e.message)) { failed.push(t + " -> " + e.message); return; }
        await new Promise((res) => setTimeout(res, 2000 * attempt));
      }
    }
  }
  const queue = todo.slice();
  await Promise.all(Array.from({ length: workers }, async () => {
    while (queue.length) { await one(queue.shift()); if (++done % 50 === 0) console.log(done + " / " + todo.length); }
  }));
  console.log("done. failed: " + failed.length);
  failed.slice(0, 20).forEach((f) => console.log("  " + f));
}

const [mode, a, b, c] = process.argv.slice(2);
if (mode === "texts") {
  fs.writeFileSync(path.join(root, "functions/api/tts-texts.json"), JSON.stringify(texts));
  console.log(texts.length + " lines, " + texts.join("").length + " characters written to functions/api/tts-texts.json");
} else if (mode === "fetch") {
  // Cloudflare Workers AI through the site's own /api/tts function
  const base = a || "https://spelling.world", voice = b || "theia";
  await record(voice, (t) => fetch(base + "/api/tts?v=" + voice + "&t=" + encodeURIComponent(t)), 6);
} else if (mode === "eleven") {
  // ElevenLabs: node tools/gen-audio.mjs eleven <folder> <voice-id> [model]
  // Reads your key from the ELEVENLABS_API_KEY environment variable. Safe to stop and re-run: it skips lines already recorded.
  // The key comes from ELEVENLABS_API_KEY, or from a line "ELEVENLABS_API_KEY=..." in .env.local (git ignores that file).
  let key = process.env.ELEVENLABS_API_KEY;
  try { if (!key) key = (fs.readFileSync(path.join(root, ".env.local"), "utf8").match(/ELEVENLABS_API_KEY\s*=\s*["']?([^\s"']+)/) || [])[1]; } catch (e) {}
  const folder = a, voiceId = b, model = c || "eleven_multilingual_v2";
  if (!key || !folder || !voiceId) { console.log("usage: ELEVENLABS_API_KEY=... node tools/gen-audio.mjs eleven <folder> <voice-id> [model]"); process.exit(1); }
  await record(folder, (t) => fetch("https://api.elevenlabs.io/v1/text-to-speech/" + voiceId + "?output_format=mp3_44100_64", {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text: t, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } })
  }), 2);
} else {
  console.log("usage: node tools/gen-audio.mjs texts | fetch [base-url] [voice] | eleven <folder> <voice-id> [model]");
}
