# ADR-014: Pac-Man

**Status**: Accepted
**Date**: 2026-04-23

## Context

The games collection has turn-based strategy (Tic Tac Toe → Chess), real-time solo action (Snake), solo puzzles (Sudoku, Crossword), and networked multiplayer party games (Jeopardy). What's missing is a real-time *arcade* game and a multiplayer format that works on a single device for people in the same room — not everyone has phones, a router, and the patience to enter a room code for a quick game.

Pac-Man (1980) is the archetype for both. It's the canonical arcade maze chaser, its ghost AI is the most famous piece of game AI ever documented, and the format naturally supports several play styles from a single core loop: play alone, play against your friends as the ghosts, or race friends for dots.

### How competitors handle this

**Browser Pac-Man implementations:**
- **google.com/doodles/pac-man** — Single-player only, one-level novelty. No source.
- **pacman.js / pacman.html5games.com** — Solo clones, no multiplayer.
- **Pac-Man 99 / Pac-Man Championship Edition** — Official Namco titles with online battle royale. Paywalled, not browser-based.

**Local multiplayer in browser arcade games:**
- **slither.io, agar.io** — Single browser, single player per tab. Multiplayer requires separate devices + server.
- **BrowserQuest** — Proved WebSocket arcade multiplayer works, but requires a backend.
- **Itch.io local-multiplayer jam games** — Most use split-keyboard input (two to four players sharing one keyboard, each on a different key scheme). No network needed.

The site is static (GitHub Pages, no backend). Networked multiplayer means adding a Firebase dependency like Jeopardy did, which is overkill for a game that's more fun next to each other on a couch anyway. Local couch multiplayer — with everyone sharing one PC — is the right fit.

### Audio constraints

Arcade Pac-Man's audio is iconic but **Bandai Namco–owned**. The usual fan-clone WAVs (`pacman_chomp.wav`, `pacman_beginning.wav`, etc.) are copyright-infringing copies circulating on archive sites. A public personal domain shouldn't be serving those — DMCA takedowns on fan projects are frequent (AM2R, countless Pac-Man clones on GitHub). Two legal alternatives: synthesize authentic-feeling audio via Web Audio, or use CC0 retro-arcade sample packs.

## Decision

Built a Pac-Man game with four play modes — solo, versus, co-op, and battle royale — all supporting up to 4 players on a single PC via split-keyboard and the Gamepad API. Classic 28×31 arcade maze, all four named ghosts with authentic personalities, and scatter/chase/frightened mode cycling. Audio uses CC0 retro samples from Juhani Junkala's OpenGameArt pack, decoded into Web Audio `AudioBuffer`s and played through a mix bus with looped background tracks.

### Modes

| Mode            | Humans | Pac-Men | Ghosts  | Win condition               |
|-----------------|--------|---------|---------|-----------------------------|
| Solo vs AI      | 1      | 1 human | 4 AI    | Clear all dots              |
| Pac vs Ghosts   | 2–4    | 1 human | 1–3 human + AI fill | Ghosts: catch Pac; Pac: clear dots |
| Co-op           | 2–4    | 2–4 human | 4 AI  | Together clear all dots (shared lives + dot pool) |
| Battle Royale   | 2–4    | 2–4 human | 4 AI  | Most dots when cleared, OR last Pac standing |

Modes were chosen to maximize reuse of the same engine — the maze, ghost AI, and collision rules are identical across all four, only player mapping and win-condition logic differ (handled in `modes.js`).

### Input: split-keyboard + Gamepad API

No device coordination, no networking. Four keyboard schemes (WASD / Arrows / IJKL / Numpad 8-4-5-6) plus up to four connected gamepads. Input is claimed by "binding" on the pre-game screen — each slot waits for a keypress/stick-move and locks onto whichever scheme or controller fired. Gamepad support covers Xbox, PlayStation, 8BitDo, and Switch Pro via the standard `navigator.getGamepads()` mapping (buttons 12–15 = D-pad, axes 0/1 = left stick).

### Module layout

Following the Chess pattern (`window.ChessEngine`), split by responsibility:

| File         | Role |
|--------------|------|
| `maze.js`    | 28×31 maze grid, tunnel wrap, dot/pellet positions (`window.PacmanMaze`) |
| `engine.js`  | Game state, tick loop, collision, mode/phase machine (`window.PacmanEngine`) |
| `ai.js`      | Ghost AI — scatter/chase target selection per ghost, frightened behavior |
| `input.js`   | Keyboard + Gamepad polling, scheme detection, slot binding |
| `audio.js`   | Web Audio init, sample loading, SFX + looped tracks |
| `render.js`  | Canvas drawing — maze, pellets, Pac-Men, ghosts, HUD |
| `modes.js`   | Mode definitions, player slot wiring, win conditions |
| `ui.js`      | DOM overlays — mode select, bind screen, pause, game over |
| `game.js`    | Entry point — wires engine ↔ render ↔ input ↔ audio each frame |
| `index.html` | Page shell, canvas element, overlay markup, inline CSS |

All JS files are IIFEs writing to `window.PacmanX` — same pattern as Chess, no build step.

### Ghost AI (authentic arcade behaviors)

Ghost targeting matches the documented arcade behaviors (Dossier / Don Hodges reverse-engineering):

| Ghost         | Scatter corner | Chase target |
|---------------|----------------|--------------|
| Blinky (red)  | Top-right      | Pac-Man's tile directly |
| Pinky (pink)  | Top-left       | 4 tiles ahead of Pac-Man's facing direction |
| Inky (cyan)   | Bottom-right   | Vector from Blinky through "2 tiles ahead of Pac", doubled |
| Clyde (orange)| Bottom-left    | Pac-Man if >8 tiles away, else scatter corner |

Mode cycling: `scatter(7s) → chase(20s) → scatter(7s) → chase(20s) → scatter(5s) → chase(indefinite)`. Power pellet flips all non-eaten ghosts to `frightened` (wander randomly at slow speed). Eating a frightened ghost transitions it to `eaten` — it returns to the ghost house at high speed, then rejoins as normal.

### Audio: CC0 samples via AudioBuffer

**Source pack:** [Juhani Junkala — The Essential Retro Video Game Sound Effects Collection](https://opengameart.org/content/512-sound-effects-8-bit-style), 512 sounds, CC0 (public domain, no attribution required). Ten samples copied into `games/pacman/sounds/` with canonical names, total ~456KB:

| Game event      | Source file                           | Local name            |
|-----------------|---------------------------------------|-----------------------|
| Dot eaten       | `sfx_sounds_Blip1.wav`                | `waka.wav`            |
| Power pellet    | `sfx_sounds_powerup5.wav`             | `pellet.wav`          |
| Eat ghost       | `sfx_sounds_powerup14.wav`            | `eat_ghost.wav`       |
| Eat rival Pac   | `sfx_sounds_powerup16.wav`            | `eat_rival.wav`       |
| Death           | `sfx_deathscream_robot4.wav`          | `death.wav`           |
| Intro jingle    | `sfx_sounds_fanfare1.wav`             | `intro.wav`           |
| Extra life      | `sfx_sounds_powerup10.wav`            | `extra_life.wav`      |
| Siren (active)  | `sfx_alarm_loop1.wav`                 | `siren_loop.wav`      |
| Frightened      | `sfx_alarm_loop4.wav`                 | `frightened_loop.wav` |
| Retreat (eyes)  | `sfx_lowhealth_alarmloop7.wav`        | `retreat_loop.wav`    |

**Playback architecture:** on first user gesture (clicking a mode button), `audio.js` creates an `AudioContext` and fetches all 10 WAVs in parallel, decoding each into an `AudioBuffer`. One-shot SFX create a fresh `AudioBufferSourceNode` per event and route through the `sfx` gain bus. The three background tracks (siren / frightened / retreat) are `AudioBufferSourceNode`s with `loop = true` through their own gain buses, ramped in/out on start/stop (80ms linear) to prevent clicks. The `sync(state)` function runs each frame and mediates which loop is active based on engine phase — retreat has priority over frightened (any eaten ghost), frightened over siren (any frightened ghost), siren otherwise.

Siren pitch rises as dots deplete via `playbackRate` modulation (1.0 → 1.6) instead of synthesizing a frequency sweep. Matches the arcade intensity ramp without a separate oscillator chain.

### Key design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Multiplayer model | Local couch (split keyboard + gamepads) | No backend needed; party games are more fun in person; matches the actual social use-case |
| Max players | 4 | Four is the most a standard keyboard can support without key-roll conflicts (WASD + Arrows + IJKL + Numpad) and maps naturally to four ghosts |
| Ghost AI | Authentic arcade targeting (Blinky/Pinky/Inky/Clyde) | Makes the game feel *right* — approximations feel off instantly to anyone who's played Pac-Man |
| Rendering | Canvas (2D context) | Same choice as Snake; pixel-perfect arcade look; faster than per-cell DOM |
| Module pattern | IIFEs on `window.PacmanX` | Follows `window.ChessEngine`; no build step; clear file-per-responsibility |
| Audio synthesis vs samples | CC0 samples | Hand-synthesized Web Audio buzzed (see [audio buzz fix](#audio-fix-history) below); authentic samples sound arcade-correct without copyright risk |
| Sample source | Juhani Junkala's OpenGameArt pack (CC0) | True public domain — no attribution required, no takedown risk, lots of choice within one pack |
| Real Pac-Man audio | **Rejected** | Bandai Namco IP; fan-clone WAV distribution is DMCA-risky; CC0 gives ~90% of the vibe with 0% legal exposure |
| Pause/mute controls | Overlay buttons + `P` / `M` hotkeys | Accessible on desktop and touch; mute persisted via localStorage |

### Styling

- Black background (`#0a0a0b`) with deep blue maze walls (`#0b1761`) — arcade-authentic palette within the Warm Hearth site frame
- Pac-Man colors: Player 1 yellow (arcade), P2 pink, P3 cyan, P4 orange — distinct at a glance
- Ghost colors fixed to arcade: Blinky red, Pinky pink, Inky cyan, Clyde orange; frightened = deep blue with white eyes, flashing white near expiry
- Press Start 2P font for the HUD (score / lives / level) to read as arcade without clashing with the site's Fraunces display font
- Overlay screens (mode select, bind, pause, game over) use the site's terracotta/ember accents so the game sits in the Warm Hearth aesthetic

## Files Changed

**New:**
- `games/pacman/index.html` — Page shell, canvas, overlay markup, inline arcade CSS
- `games/pacman/maze.js` — 28×31 maze data and pathing helpers
- `games/pacman/engine.js` — Tick loop, collision, phase/mode machine
- `games/pacman/ai.js` — Ghost personalities (scatter/chase target selection)
- `games/pacman/input.js` — Keyboard + Gamepad input and slot binding
- `games/pacman/audio.js` — Web Audio init, sample loading, SFX, looped tracks
- `games/pacman/render.js` — Canvas rendering (maze / pellets / Pac-Men / ghosts / HUD)
- `games/pacman/modes.js` — Mode definitions and win conditions
- `games/pacman/ui.js` — DOM overlay flow (mode → bind → play → over)
- `games/pacman/game.js` — Module wiring and per-frame loop
- `games/pacman/sounds/*.wav` — 10 CC0 samples (~456KB total)
- `games/pacman/sounds/README.txt` — CC0 provenance and filename mapping
- `docs/adr/014-pacman.md` — This document

**Modified:**
- `games/index.html` — Added Pac-Man card to the gallery (9th card, "multiplayer" tag)

## Audio fix history

The initial implementation used pure Web Audio synthesis — sawtooth/square oscillators with low-frequency LFO modulators for siren / frightened / retreat. The result sounded like a continuous buzz: sawtooth at 120 Hz with a 9 Hz LFO swinging ±14 Hz is a raw AM-modulated drone, not an arcade siren. A second latent bug compounded it — the `sfx` gain bus was initialized to `0` and never ramped up, so every one-shot SFX (dot / pellet / eat-ghost / death) was silently routing through a muted channel and never reached the output.

The rewrite removed both classes of problem at once: discrete SFX play through `sfx` gain (now initialized to 1.0) as one-shot `AudioBufferSourceNode`s from pre-loaded CC0 buffers, and the three loops are `AudioBufferSourceNode`s with `loop = true` through their own buses with 80 ms ramp-in/out. The scheduler in `sync(state)` mirrors the original event-and-phase logic, just swapping oscillator manipulation for buffer source lifecycle.

## Verification

- Page loads cleanly — zero console errors, zero failed network requests
- All 10 WAVs fetch 200 and decode without errors on first user gesture
- Solo mode: bind arrow keys, maze renders with all 244 dots + 4 power pellets, Pac-Man moves, ghosts spawn from house, AI targets match personality
- Scatter → chase transitions audible via ghost movement pattern change
- Power pellet activates frightened mode for all non-eaten ghosts; eating one transitions to retreat
- Audio: waka alternates pitch on dots, pellet/eat-ghost/eat-rival distinct, siren loops and speeds up (playbackRate) as dots deplete, frightened loop swaps in on power pellet, retreat loop swaps in when a ghost is eaten
- Pause (P) / mute (M) hotkeys and buttons work; mute persists across reloads via localStorage
- Gamepad detection updates the "No controllers" status line every second
- Visual output matches arcade palette (black bg, blue walls, yellow Pac, colored ghosts)
- Warm Hearth theme consistency on the surrounding page chrome (nav, heading, footer)
