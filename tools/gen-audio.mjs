// Pre-records everything the narrator says into public/audio/<hash>.mp3.
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

const [mode, base = "https://spelling.world", voice = "theia"] = process.argv.slice(2);
if (mode === "texts") {
  fs.writeFileSync(path.join(root, "functions/api/tts-texts.json"), JSON.stringify(texts));
  console.log(texts.length + " lines written to functions/api/tts-texts.json");
} else if (mode === "fetch") {
  const dir = path.join(root, "public/audio");
  fs.mkdirSync(dir, { recursive: true });
  const todo = texts.filter((t) => !fs.existsSync(path.join(dir, ctx.vhash(t) + ".mp3")));
  console.log(todo.length + " of " + texts.length + " clips to record with voice " + voice);
  let done = 0, failed = [];
  async function one(t) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetch(base + "/api/tts?v=" + voice + "&t=" + encodeURIComponent(t));
        if (!r.ok) throw new Error(r.status + " " + (await r.text()).slice(0, 120));
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 500) throw new Error("tiny response");
        fs.writeFileSync(path.join(dir, ctx.vhash(t) + ".mp3"), buf);
        return;
      } catch (e) {
        if (attempt === 3) failed.push(t + " -> " + e.message);
        else await new Promise((res) => setTimeout(res, 1500 * attempt));
      }
    }
  }
  const queue = todo.slice();
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) { await one(queue.shift()); if (++done % 50 === 0) console.log(done + " / " + todo.length); }
  }));
  console.log("done. failed: " + failed.length);
  failed.slice(0, 20).forEach((f) => console.log("  " + f));
} else {
  console.log("usage: node tools/gen-audio.mjs texts | fetch <base-url> [voice]");
}
