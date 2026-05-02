# ADR-025 — Jeopardy clue narration via OpenAI / Gemini TTS

**Status:** Proposed, 2026-04-26. *Not yet scheduled for implementation.*

## Context

The Jeopardy host currently reads clues aloud manually. This works for a co-located host but has gaps:

- Solo / couch-only games have no human host voice — the picker reads their own clue.
- Final Jeopardy expects players to read silently from their own device while the timer counts down; nothing matches the show's iconic spoken delivery.
- Daily Doubles work the same way but feel like they should be a moment.

A "press play" TTS narration of clue text would close the gap and make the game watchable on a TV in lieu of an actual host. Two providers are in scope:

| Provider | Endpoint | Notes |
|---|---|---|
| OpenAI | `POST https://api.openai.com/v1/audio/speech` | `tts-1` / `tts-1-hd`; voices `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`. Returns MP3/Opus. |
| Gemini | Google Cloud TTS REST (`texttospeech.googleapis.com/v1/text:synthesize`) | Many WaveNet/Neural2 voices, SSML support. |

Browser `SpeechSynthesisUtterance` already exists and runs free + offline, but voice quality is platform-dependent (decent on macOS/iOS, often robotic on Windows/Linux). Useful as a fallback, not the primary path.

## Decision (proposed)

Keep clues + answers as plain text in the board JSON. **Do not** persist generated audio in the board itself — TTS is a render-time effect, not part of the canonical board data.

### Architecture

The site is a static GitHub Pages deploy fronted by the existing `chases-house-router` Cloudflare Worker (see ADR-017-firebase-security). API keys cannot live in client code. The Worker is the right home for a small TTS proxy:

```
Client (host.html)
   │
   ├──> POST /api/tts  { text, voice, provider }
   │       (Worker validates origin, looks up the provider key from
   │        Worker secrets, forwards to OpenAI/Gemini)
   │
   └──< audio/mpeg     (Worker streams the response back)
```

The Worker:
- Holds `OPENAI_API_KEY` and `GEMINI_API_KEY` as secrets (`wrangler secret put`).
- Rate-limits per-IP and per-room (a single room shouldn't be able to burn $10/min).
- Restricts CORS to `https://chases.house` (and localhost during dev).
- Responds with `Cache-Control: public, max-age=2592000, immutable` so the CDN can cache identical text+voice combinations for ~30d.

### Caching

Identical (text, voice, provider) tuples produce identical audio, so the Worker should derive a deterministic cache key and check Cloudflare's Cache API before hitting the provider:

```
cacheKey = sha256(provider + '|' + voice + '|' + text)
```

For boards in active play, this means each clue is fetched at most once per voice across every game session site-wide. A 36-cell board × ~150 chars/clue × ~5KB MP3 ≈ 180KB total uncached, then free thereafter. With the sample board cached once for `nova`, the cost of running a session is essentially zero.

### Voice / provider selection

In the host lobby, alongside the existing rules toggles:

- **Narration:** `Off | Built-in (free) | OpenAI | Gemini`  *(default: Off until ADR is implemented)*
- **Voice:** populated based on provider; "Onyx" or similar gravelly choice as default to mimic a Trebek-ish read.

Persist selection in `meta/config/narration` so player.js (Final Jeopardy) and host.js share the same setting without re-asking.

### When narration plays

- **Regular clue:** auto-play once `currentClue` is written, while state = `READING`. Host's "Open Buzzing" button is disabled until the audio `ended` event fires (or after a 1.5s grace) — preventing players from buzzing before the clue is fully spoken.
- **Daily Double:** play after wager is submitted, when state transitions to `ANSWERING`. Same behaviour: judging buttons disabled until audio finishes.
- **Final Jeopardy:** play when the host clicks "Reveal Clue". Audio's `ended` event starts the 30s answer timer (matches the show — timer starts after the read, not at click time).

### Fallback ladder

1. Provider request succeeds → play `audio/mpeg`.
2. Provider request fails (timeout, 5xx, quota) → fall back to browser `SpeechSynthesisUtterance`. Show a small toast: "TTS unavailable, using built-in voice."
3. Built-in voice unavailable / muted → silent play; resume manual host-read flow.

## Open questions

1. Should each player device also play the audio (in sync), or just the host display? **Tentative:** host-only — players hear via the host's TV speakers in a couch setting, and per-device playback is a sync nightmare across phones.
2. Pre-warm: should the Worker pre-fetch all clue audio when a host creates a room (one-time burst, then ~free playback)? **Tentative:** lazy-fetch on cell click; pre-warm only Final Jeopardy's single clue+answer when host enters FJ.
3. Cost cap: should the Worker enforce a per-session $/clip ceiling? **Tentative:** rate-limit yes, $-cap no — pricing is so low (OpenAI tts-1 is $0.015 / 1K chars) that a worst-case board is < $0.05.

## Out of scope

- **Live spoken host commentary** ("Daily Double!", "Sorry, that's incorrect", "And the winner is…"). Could be added later as canned clips or LLM-generated lines — orthogonal to clue narration.
- **Player answer transcription** (Whisper). Real Jeopardy "in the form of a question" enforcement would need this. Out of scope.
- **Voice cloning** of any specific human voice. Not doing this.

## Implementation order (when scheduled)

1. Worker route + secrets + CORS + rate limit. Local-test with curl.
2. Client TTS module (`games/jeopardy/tts.js`) wrapping OpenAI/Gemini/builtin behind one `narrate(text, opts) → Promise<HTMLAudioElement>` API.
3. Lobby UI: provider/voice select.
4. Wire into host.js clue lifecycle (READING → audio → enable buzzing).
5. Wire into FJ flow.
6. Cache verification + cost monitoring dashboard.

## Files that would change

| File | Change |
|---|---|
| (new) `workers/tts/` | Cloudflare Worker route — see chases-house-router. |
| (new) `games/jeopardy/tts.js` | Provider-agnostic narration client. |
| `games/jeopardy/host.html` | Lobby provider/voice selectors. |
| `games/jeopardy/host.js` | Auto-narrate on clue READING, gate "Open Buzzing" on audio end. |
| `games/jeopardy/player.js` | Final Jeopardy: start 30s timer on audio end (when narration enabled). |
| `games/jeopardy/shared.js` | Add `narration` config field to `DEFAULT_CONFIG`. |
