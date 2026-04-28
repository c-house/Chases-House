# ADR-027 — Jeopardy audio cues + visual polish

**Status:** Accepted, 2026-04-28. Code merged to branch `jeopardy-host-control-split`. No deployment dependencies of its own (additive on top of ADR-026). Companion to [ADR-026](026-jeopardy-host-control-split.md).

## Context

ADR-026 split the Jeopardy host surface into a TV display and a host phone control surface. With the architecture sound, the experience still felt flat — no sound at any signature show moment, no animation beyond the existing fade-in, scores snapped instantly. Real Jeopardy gets a lot of its charm from incidental audio (the "doot doot doot" buzzer cue, the Daily Double sting, the "Think!" countdown music) and visual rhythm (cell flip, score count-up, category slide-in).

User direction:

- "Match the real show" — Jeopardy-faithful structure for every applicable moment.
- "Stardew-warm" — pleasant CC0 audio with a comforting timbre, like Stardew Valley.
- "Don't make AI slop" — quality over quantity; synthesize warmly or source CC0; **do not use the original copyrighted Merv Griffin compositions.**
- One TV speaker as the only audio source. Phones vibrate but stay silent. Controllers rumble.

## Decision

### Audio: synthesis-first with a CC0 file fallback

A new `games/jeopardy/audio.js` module exposes `window.JeopardyAudio` with `play(name)`, `startThinkMusic()`, `stopThinkMusic()`, `cueScoreUpdate(...)`. It is loaded **only on the TV** (`host.html`) — control.html and play.html do not include it, keeping phones silent.

For each named cue, the module checks an explicit `KNOWN_FILES` array first. If the cue's name is in that array, it loads `audio/<name>.mp3` and plays it; otherwise it falls back to a WebAudio synthesis function. This means the repo ships with **zero audio files** but is fully playable; future curation can drop CC0 files in to upgrade the timbre.

#### Why opt-in instead of "auto-detect with 404 fallback"

The first iteration tried to be clever: just probe `audio/<name>.mp3` on first play, fall back to synthesis on 404, mark the name `fileMissing` so subsequent plays don't re-probe. In practice this pollutes the DevTools console with one error per cue per session — Chrome logs both `<audio>`-element load failures and `fetch`-HEAD probes as red console errors regardless of how the JS handles the rejection. For a static-site personal project that aims to ship with zero audio files, that's a permanent red badge in DevTools every time you open `host.html`. Not worth the convenience.

The opt-in model is two steps to add a real file:

1. Drop `audio/<name>.mp3`.
2. Add `'<name>'` to the `KNOWN_FILES` array at the top of `audio.js`.

`KNOWN_FILES` ships empty. No 404s, no console noise, and the trade-off (one line of JS per audio file added) is trivial. Documented in [`games/jeopardy/audio/ATTRIBUTION.md`](../../games/jeopardy/audio/ATTRIBUTION.md).

#### Synthesis design — why this sounds Stardew-warm

Every synth cue uses the same primitive `bell()`: a sine fundamental + detuned 3rd-harmonic shimmer (×3.01 at 18% gain) routed through a `BiquadFilter` lowpass at ~3.5–4 kHz, with a 12 ms linear attack and exponential decay. This produces a soft plucked-string-meets-bell timbre that's noticeably warmer than typical UI alerts (which use square/sawtooth or pure sine without harmonics). The lowpass shaves the harsh upper partials. The same primitive is used for every cue; the differences between cues are pitch + rhythm.

#### Per-cue scheduling

| Cue | Structure | Jeopardy-faithful? |
|---|---|---|
| `buzz-open` | three E5 bells, 60ms each, 80ms total spacing | **Yes** — mirrors "doot-doot-doot" lectern cue, lower pitch / warmer timbre |
| `correct` | C-E-G major arpeggio, ~70 ms per note | Yes — affirming triad |
| `incorrect` | F4 → E4 descending minor 2nd, soft thunks | Yes — disappointment cadence |
| `daily-double` | C-E-G-C arpeggio + octave shimmer | Yes — sparkly fanfare without copying the original |
| `theme-sting` | V → I cadence in C major, ~3s | Yes — short opener; replaces full theme song |
| `final-think` | 30s loop, Am-F-C-G at 60 bpm with bass + pad + arpeggio + tick | **Yes — most show-defining replacement.** Mirrors the *function* of the Merv Griffin "Think!" piece (slow ticking pulse, 4-chord rotation) without using the protected composition |
| `game-over` | V → I → octave doubling | Yes — warm closing cadence |

The 30s Think synth is the most ambitious piece. It schedules ~60 oscillator events ahead of time (two passes of the 4-bar / 16s pattern), with bass on beat 1, sustained pad voicings, an arpeggio sparkle, and a subtle 2200→1800 Hz tick on each beat to keep the time-pressure feel from the original. Cleanly stoppable via `Audio.stopThinkMusic()` (linear gain ramp to 0 over 400 ms, then disconnect).

#### Triggering

Audio fires at edges in `host.js`'s existing Firebase listeners — no event bus, no Firebase coupling inside `audio.js`:

| Edge | Trigger | Cue |
|---|---|---|
| `meta/status` ≠ `playing` → `playing` | first-time game start | `theme-sting` |
| `meta/status` ≠ `ended` → `ended` | end of game | `game-over` |
| `currentClue.dailyDouble === true` newly appears | DD revealed | `daily-double` |
| `currentClue.state` ≠ `BUZZING` → `BUZZING` | host opens buzzers | `buzz-open` + visual flash |
| `players/$pid/score` increases | correct judgment | `correct` |
| `players/$pid/score` decreases | incorrect judgment | `incorrect` |
| `finalJeopardy.state` ≠ `clue` → `clue` | FJ clue revealed | `startThinkMusic()` |
| `finalJeopardy.state` → `answer`/`judging` | timer expired or judging begins | `stopThinkMusic()` |

#### AudioContext gating (browsers block until user gesture)

`audio.js` attaches a one-shot pointerdown/keydown listener on init that initializes the AudioContext on first interaction. Once unlocked, subsequent plays are immediate. The host clicks Start Game on their phone — but the TV needs its own gesture; `host.html`'s lobby has the "+ Add couch player" button which counts. Adding a couch player is the natural first gesture; if no couch player is added, the first audio cue may fail silently the first time. Future polish: a small "Click to enable sound" overlay on the TV before the first audio fire.

### Visual polish

All animation lives in CSS keyframes inside `host.html`'s inline stylesheet. JS only adds/removes class names at the right Firebase edges. The mechanism per item:

| Animation | CSS hook | Trigger in JS |
|---|---|---|
| Buzzer-open border flash | `.buzzer-flash.fire` 700 ms ease-out keyframe | `triggerBuzzerFlash()` on BUZZING edge |
| DD splash entrance | `.phase-daily-double.active` 480 ms cubic-bezier(.34, 1.56, .64, 1) | Auto-fires when phase activates |
| Category slide-in (game start) | `.jeopardy-board.first-reveal .category-header:nth-child(N)` 320 ms with 110 ms stagger | `firstBoardReveal` flag in `renderBoard()`, reset on round transitions |
| Cell slide-in (after categories) | `.jeopardy-board.first-reveal .board-cell` with `--cell-i` index variable, 280 ms with 18 ms stagger after a 700 ms baseline delay | Same flag |
| Round transition title | `.phase-round-transition .round-transition-title` 600 ms cubic-bezier(.16, 1, .3, 1) scale | Auto on phase activate |
| Game-over winner pop | `.standing-row.winner` 480 ms cubic-bezier(.34, 1.56, .64, 1) + 200 ms delay | Auto when phase activates |
| Lectern-light pulse (buzzed-in chip) | `.score-chip.buzzed-in` infinite 1.2 s ease-in-out gold glow | Auto while in ANSWERING state |
| Score count-up | `Audio.cueScoreUpdate()` rAF loop, cubic ease-out, 280-900 ms based on delta size | Called from `renderScoreboard` when delta detected |

WAAPI was considered for the score count-up but rejected — `textContent` isn't a CSS property, so the natural choice for numeric-text interpolation is `requestAnimationFrame`. CSS keyframes are the right tool for everything that animates a CSS property (transform/opacity/box-shadow). Tool selection is per-effect, not arbitrary.

### Phone + controller cues (no audio)

Per the locked decision (one TV speaker, phones silent):

- `player.js` adds `navigator.vibrate([60, 40, 60, 40, 60])` on the BUZZING state edge — a haptic version of the lectern light cue. Silent.
- `couch.js` adds a triple `OPEN_PULSE` rumble (60 ms × 3 with 100 ms spacing) on the same edge so controllers match.

### Cell-flip animation deliberately deferred

CSS for `.board-cell.flipping` exists, but I'm not wiring it in this commit. The board listener fires on `asked: true` → re-renders the entire board → cell loses its flip class before the animation completes. Doing this right requires either (a) targeted DOM updates instead of full re-renders, or (b) a hold-board-render-while-flipping coordination flag. Either is more polish work than I want to bundle here. Marked as a known gap; keyframes are present so future work just needs the JS plumbing.

## Files changed

| File | Change |
|---|---|
| `games/jeopardy/audio.js` | New — synthesis-first audio module with per-cue scheduling and the 30 s Think loop. |
| `games/jeopardy/audio/ATTRIBUTION.md` | New — drop-in instructions + cue inventory + license logging table. |
| `games/jeopardy/host.html` | + audio.js script tag, + `#buzzer-flash` overlay element, + visual polish CSS keyframes (buzzer flash, DD splash, category slide-in, round transition, winner pop, lectern light, cell flip placeholder). |
| `games/jeopardy/host.js` | Edge-detect tracking (`prevClueState`, `prevStatus`, `prevPlayerScores`, `firstBoardReveal`), audio plays at appropriate edges, score count-up replaces snap rendering, `--cell-i` CSS variable on each cell, `.first-reveal` class management in `renderBoard`. |
| `games/jeopardy/player.js` | + `navigator.vibrate` on BUZZING state edge. |
| `games/jeopardy/couch.js` | + `OPEN_PULSE` rumble pattern, edge-detect on clueState transition to BUZZING fires three pulses on every assigned pad. |

## What didn't change

- `control.html` / `control.js` — the host phone is silent. No animation on the control surface (it's a tool, not a stage). Future polish could add subtle button-tap haptics via `navigator.vibrate(20)`; out of scope.
- `play.html` / `player.js` — beyond the buzzer-open vibrate, no changes. Phones don't make audio.
- Firebase schema or rules — visual polish is purely client-side.
- `builder.html` — untouched.

## Verification

End-to-end smoke test on localhost via Chrome DevTools MCP, three isolated browser contexts (TV, host phone, two player phones), Wave A–I per ADR-026's verification table. Audio-specific checks all passed:

- Theme sting fires once on first lobby → playing transition; doesn't refire on Play Again's lobby → playing.
- Buzzer-open cue + visual flash fire on every BUZZING state edge; no double-firing.
- Score count-up animates over ~280 ms (cubic ease-out) for $200 deltas; survives renderScoreboard re-renders mid-animation thanks to the `lookup()` function pattern in `cueScoreUpdate` (rAF re-queries the chip element by ID each frame, aborts cleanly if the chip is gone — fix from the review-fixups commit).
- Daily Double splash entrance bounces in cleanly. Audio fires once on DD reveal.
- The 30 s Think synth schedules ~60 oscillator events at FJ CLUE state; `stopThinkMusic` ramps gain to 0 over 400 ms when state moves to ANSWER. No audio leaks past the stop.
- Final-reveal category slide-in stagger fires only on round-1 entry and round-2 entry (`firstBoardReveal` flag reset on round transition only).
- **Zero console errors** on TV reload after the file-fallback fix landed in `dd1091f` (down from 8 audio 404s in the auto-probe iteration).

The "no false-positive correct/incorrect on play-again" guard from the review-fixups commit was implicitly verified by Wave H — Alice + Bob scores zeroed back to $0 from $-200 / $2,800 with no audio cue activity.

## Open follow-ups (not blocking; ordered roughly by impact)

### Polish gaps

1. **Cell-flip animation JS plumbing.** CSS `.board-cell.flipping` keyframes ship in this ADR, but the JS isn't wired. Problem: the board listener fires on `asked: true` → re-renders the entire board → flip class is on a now-detached element, animation never completes visually. Two viable fixes:
   - **(a)** Targeted DOM update — when `currentClue` is written, find the matching cell node and add `.flipping`; suppress the next `renderBoard()` call for ~400 ms (its duration); after the animation, re-render with the cell properly in the asked state.
   - **(b)** Move from full-board `innerHTML = ''` re-renders to per-cell delta updates, so unrelated cell DOM nodes survive across listener fires. Bigger refactor.
   Recommend (a) as the smallest viable shape.

2. **Real CC0 audio files for the named cues.** Synthesis is decent but mechanical-sounding by nature. The biggest perceptual win would be a 30s `final-think.mp3` (warm acoustic waltz, ~60 bpm, mandolin/dulcimer/flute) — search hints in `audio/ATTRIBUTION.md`. Each file added needs a one-line `KNOWN_FILES` entry in `audio.js` and an attribution row in the `.md`.

3. **AudioContext gesture-unlock UX.** Browsers block `AudioContext` until first user interaction. The TV's first interaction is typically "+ Add couch player." If the operator skips couch and goes straight to game start (host phone clicks Start), the TV's first cue (theme-sting) will fail silently because no gesture has happened on the TV. Future polish: a small "Click anywhere to enable sound" overlay that auto-dismisses on first click.

4. **Per-player FJ judging mirror to TV.** Cross-cuts ADR-026. Today the TV stays on the FJ wager roster during host's per-player judging. Cleaner: control.js writes `game/finalJeopardy/judging/{currentPid}` so the TV reveals each player's answer + wager + the audio "correct"/"incorrect" cue lands on a TV-side animation. Currently those cues fire from `renderScoreboard` score-delta detection, which works for regular clues but doesn't give the TV a per-player "and the answer was…" reveal cadence during FJ judging.

### Future-feature placeholders

5. **TTS clue narration** (ADR-025) plugs into the same `audio.js` module. Proposed shape: `Audio.narrate(text, opts) → Promise<HTMLAudioElement>`, opts include voice + provider. The Open Buzzing button on `control.html` would gate on the audio's `ended` event. The Final Jeopardy clue reveal would start the 30s timer on `ended` rather than on click. Out of scope for ADR-027.

6. **Player-phone subtle button-tap haptic** on `control.html` button presses (`navigator.vibrate(20)`). Tactile confirmation that the button registered. Out of scope; control.html is silent for ADR-026/027 (it's a tool, not a stage).

## Cross-references

- **ADR-026** (host/control split) — the architecture this audio + polish layer rides on top of. Cell-flip and FJ judging mirror items above are cross-cutting with ADR-026's deferred work.
- **ADR-025** (TTS, future) — Audio module's `play()` API is the integration point. `KNOWN_FILES` opt-in pattern would extend naturally to TTS-cached clips per (text, voice) tuple.
- **ADR-016** (shared gamepad) — `couch.js`'s `OPEN_PULSE` triple-rumble for buzzer-open uses `SharedGamepad.rumble` and shares the rumble taxonomy.
