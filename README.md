# Spelling World

A free spelling game for kids of every level, live at https://spelling.world

- 20 levels of steadily harder words across five worlds
- Win animals and scenery for each world by spelling words correctly
- Earn treats as you spell and feed them to your animals. Five treats makes an animal your best friend
- Every round ends with a golden word worth double treats, plus streak banners and a daily bonus
- A natural, recorded narrator voice reads every word, sentence and cheer (Lily from ElevenLabs by default, with two Cloudflare voices to choose from in Settings)
- Levels 1 to 4 sound each word out like at school, with pure sounds (c-a-t, sh-i-p, c-a_e-k) and sound buttons under the letters that light up as each sound plays. It can be turned off in Settings
- Player profiles, NZ/UK or US spelling. No build step, no accounts, no tracking. Progress is saved in the browser

## Layout

- `public/index.html`: the whole game (one file)
- `public/audio/<voice>/`: the narrator's recorded lines, one MP3 per line, named by a hash of the text
- `functions/api/tts.js`: Cloudflare Pages Function used only to record new lines (Workers AI, Deepgram Aura 2, voices "pandora" (British, default) and "theia" (Australian)). It only speaks lines listed in `functions/api/tts-texts.json`
- `tools/gen-audio.mjs`: builds that list and downloads any missing recordings

## Changing words or phrases

```bash
node tools/gen-audio.mjs texts
```

Commit and push so the function knows the new lines, then record them and push again:

```bash
node tools/gen-audio.mjs eleven lily pFZP5JQG7iQjIQuC4Bku
node tools/gen-audio.mjs fetch https://spelling.world pandora
node tools/gen-audio.mjs fetch https://spelling.world theia
```

The phonics sounds (`public/audio/phonics/`) come from `node tools/gen-audio.mjs phonics`, which records each sound in `PHONEMES` with an ElevenLabs IPA phoneme tag. How each word splits into sounds is in `PHONICS` in `public/index.html`.

The ElevenLabs lines read your key from `ELEVENLABS_API_KEY` or from `.env.local` (which git ignores).

## Deploy

Hosted on Cloudflare Pages (project `spelling`), deployed from this repo. Every push to `main` redeploys. `wrangler.toml` sets the output folder (`public`) and the Workers AI binding.
