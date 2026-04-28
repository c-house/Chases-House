# Jeopardy audio assets

ADR-027 ships with **synthesis-only** audio: every cue is generated at runtime
in [`../audio.js`](../audio.js) using WebAudio (sine fundamentals + soft envelopes
+ gentle harmonics + lowpass — Stardew-warm timbre, Jeopardy-faithful structure).

This directory exists so a CC0 file can be **dropped in** to upgrade any cue
without code changes. `audio.js` checks `audio/<name>.mp3` before falling back
to synthesis. If the file 404s once, the cue stays synth-only for the session.

## Cue inventory

| Filename to drop here | Synth fallback | When it fires |
|---|---|---|
| `buzz-open.mp3` | three soft bell ticks @ E5 | host opens buzzers (`game/buzzer/isOpen` → true) |
| `buzz-in.mp3` | one quiet bell @ C5 | (reserved for future "lectern light click" — not currently fired) |
| `correct.mp3` | C-E-G major arpeggio | a player's score increases |
| `incorrect.mp3` | F4 → E4 minor descent | a player's score decreases |
| `clue-reveal.mp3` | G-B-D-G ascending motif | (reserved — not currently fired) |
| `daily-double.mp3` | C-E-G-C arpeggio + octave shimmer | DD reveal (`currentClue.dailyDouble === true` first appears) |
| `theme-sting.mp3` | V → I cadence in C major (~3s) | game start (`meta/status` → `playing` for the first time) |
| `final-think.mp3` | (synthesized inline — see `synthThinkMusic`) | Final Jeopardy clue revealed |
| `game-over.mp3` | warm V → I → octave bell | game ends (`meta/status` → `ended`) |

## Sourcing CC0 audio

Prefer freesound.org's "Creative Commons 0" filter, OpenGameArt's "Sound Effect"
category with CC0 license, or Pixabay (no attribution required, but check the
specific clip's license badge). Search hints per cue:

- **buzz-open**: "game show ready bell triple" / "soft tone three"
- **correct**: "warm bell chime correct" / "xylophone happy"
- **incorrect**: "soft buzzer wrong" / "low thunk fail"
- **daily-double**: "fanfare reveal short" / "sparkle reward"
- **theme-sting**: "warm folk intro 3 seconds" / "fantasy stinger short"
- **final-think**: "music box waltz 30 seconds" / "ambient tense ticking" — 30s loop
- **game-over**: "victory chime resolve" / "warm orchestral cadence"

## Format

- MP3 preferred (smaller; HTMLAudioElement-friendly).
- Mono is fine; the room has one TV speaker source anyway.
- Length: under 2s for everything except `final-think.mp3` (target 30s exact).
- Normalize to ~-6 LUFS — the TV is the only audio source so peaks should not
  startle. The synthesis defaults assume ~0.55 master gain.

## License logging

When you drop a file in, add a row here:

| File | Source URL | License | Original creator |
|---|---|---|---|
| _none yet_ | _all cues currently synthesized_ | n/a | n/a |
