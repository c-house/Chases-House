# ADR-017: Asteroids

**Status**: Accepted — design + architecture passes complete; ready for implementation
**Date**: 2026-04-24 (planning); 2026-04-25 (architecture resolved through adversarial review)

## Summary

Recreate Atari's 1979 vector-arcade *Asteroids* as a self-contained game at `games/asteroids/`. Pure mono vector aesthetic on black, Web Audio–synthesized SFX (including the iconic two-note bass heartbeat), inertia-based physics with screen-wrap, keyboard + `SharedGamepad` controls, and a 2-player local co-op variant. Local-only high scores via `localStorage`. No backend, no networking — fits the static-site, single-PC fun model already proven by Snake and Pac-Man.

## Decisions

- **Modes**: Solo (1P) and Local Co-op (2P, same keyboard or 1 keyboard + 1 gamepad). No versus, no online, no AI bots.
- **Controls**:
  - Keyboard P1: `←/→` rotate, `↑` thrust, `Space` fire, `Shift` hyperspace.
  - Keyboard P2 (co-op): `A/D` rotate, `W` thrust, `F` fire, `G` hyperspace.
  - Gamepad (via `games/shared/gamepad.js`): `D-pad ←/→` rotate, `D-pad ↑` thrust, `A` fire, `D-pad ↓` hyperspace. Uses only the buttons already exposed by `SharedGamepad.BUTTONS` — no new shared-utility surface required.
  - **No mobile/touch controls in v1** — Asteroids' rotate-and-thrust scheme is hostile to touch; defer until a real touch design exists.
- **Persistence**: Local top-10 high-score table in `localStorage` (`asteroids-highscores`: `[{ initials, score, wave, date }]`). Mute preference persisted. Nothing else.
- **Visual direction**: Authentic late-70s vector arcade. Pure black play canvas, white-phosphor glowing line art, subtle scanline + bloom overlay. Site chrome (nav, page title, footer) keeps Warm Hearth tokens — the canvas is the "arcade cabinet within the room." Type: `Major Mono Display` (or similar geometric mono) for HUD, `Fraunces` for page title. Justified break from site palette inside the canvas because vector-arcade is a self-contained aesthetic universe.
- **Tech approach**: Plain HTML/CSS/JS, IIFEs on `window.AsteroidsX` (matches Chess / Pac-Man). Folder lowercase (`games/asteroids/`) per existing convention. Canvas 2D rendering with stroke-only drawing and `shadowBlur` glow. `requestAnimationFrame` with fixed-timestep accumulator at 60Hz (cap of 3 catch-up steps). Files: `index.html`, `physics.js`, `entities.js`, `input.js`, `audio.js`, `render.js`, `ui.js`, `game.js` — see Architecture section below for the locked module split.
- **Audio**: **Pure Web Audio synthesis** — the iconic Asteroids sounds (two-note bass thump, laser pew, UFO siren, hyperspace warble, noise-burst explosions) are *defined* by being synthesized and would feel wrong as recorded samples. Asteroids' SFX surface is mostly discrete one-shots with simple envelopes — much smaller than Pac-Man's continuous AM-modulated sirens that initially buzzed in ADR-014. White-noise asteroid explosions use `AudioBuffer` filled with `Math.random()` through a band-pass + amplitude envelope. Two short loops (heartbeat thump tempo, UFO siren) use periodic tones, not modulated drones. Mute persisted to `localStorage`.
- **Co-op rules**: Separate lives per player (3 each), shared score, shared wave. No friendly fire. Either player still alive = round continues. Both dead = game over.
- **Gallery card**: Both `solo` and `multiplayer` tags shown side-by-side. Existing card markup uses a single `<span class="game-card-tag">` — extending it to render two adjacent tag chips is a small `games/index.html` styling addition; both Pac-Man (currently `multiplayer`-only despite supporting solo) and Asteroids should pick up the dual-tag pattern at the same time, since this site convention should be consistent across the gallery.

## v1 Scope (ship)

- Solo + 2P local co-op modes
- Authentic asteroid behavior: 3 sizes (large → 2 medium → 2 small), classic point values (20 / 50 / 100), wave count `min(11, 4 + 2*wave)`, screen-wrap on every entity
- Bullets wrap the screen and time out by distance (~screen-width); cap of 4 simultaneous bullets per ship
- Both UFOs: large (random aim, low score) and small (accurate, appears at higher score thresholds)
- Hyperspace with random destination and a small chance of explode-on-arrival
- Bass heartbeat (two-note alternating thump) that accelerates as wave clears
- Web Audio SFX: laser, thrust rumble, asteroid explode (3 sizes), UFO siren, UFO fire, hyperspace warble, player explode, extra-life chime
- Title → play → game over → high-score-entry → title loop, restart in <1 s with `R`
- Pause (`P`), mute (`M` — persisted), respect `prefers-reduced-motion` (no screen shake / hit-pause when set)
- Small randomized "flavor" line on game over (e.g. *"One rock left. So close."*)
- Local top-10 high scores in `localStorage`
- Games-gallery card added (10th entry) with both `solo` and `multiplayer` tag chips; Pac-Man card updated to also carry both tags for consistency
- Verification per CLAUDE.md Chrome DevTools MCP protocol: zero console errors, zero failed network requests, screenshot match on title and active-play frames

## Out of scope / follow-ups (parked for v2 ADR)

- **Daily seed + shareable result** (Wordle-style emoji grid: 🪨🛸💀 + wave + score)
- **Idle attract mode** (autonomous AI ship plays the title screen after 30 s idle)
- **Photo mode** (pause + screenshot button)
- **Speedrun timer** mode (clear N waves fastest)
- **High-contrast toggle** (line color brighter)
- **Mobile/touch controls** — only if a real touch design is validated
- **Multiplier streak scoring** (consecutive hits without missing)
- **`games/shared/highscores.js` extraction** — wait for a 3rd game (Snake + Asteroids alone is not enough to justify, per DRY-vs-YAGNI tension; flag it as the next consumer triggers extraction)
- **Cross-game "House Cup" meta-leaderboard** — its own ADR, not Asteroids-specific

## Dropped (explicitly considered, not pursued)

Power-ups (changes the game's tone), Asteroids Deluxe satellites, difficulty selector (the wave curve *is* the difficulty), 2P versus deathmatch (different game — Combat 1977), replay system, Konami-code easter eggs, date-aware palettes, dynamic favicon, hidden second game. All fail YAGNI or KISS.

## Scope discipline (DRY · YAGNI · SOLID · KISS)

- **DRY**: Reuses `games/shared/gamepad.js`. High-score `localStorage` pattern duplicates Snake's — accepted for v1 (one duplication ≠ extract); flag as the next-consumer trigger.
- **YAGNI**: Cut difficulty selector, power-ups, replay, daily seed, mobile, achievements. None are required for the core loop.
- **SOLID**: Each proposed module has one responsibility (physics ≠ rendering ≠ entities ≠ audio ≠ input). `game.js` orchestrates only.
- **KISS**: Canvas 2D over WebGL, synthesis over a sample-pack download, `localStorage` over Firebase. Fixed-timestep accumulator is the one slightly-clever choice — justified because determinism unlocks v2 daily-seed without rewriting physics.

**Decision**: Proceed to v1 as scoped above.

## Resolved questions

1. **Folder casing**: `games/asteroids/` (lowercase) — matches existing convention.
2. **Audio**: Pure Web Audio synthesis — most authentic to the original and best-matched to Asteroids' simple-envelope SFX surface.
3. **Co-op life model**: Separate lives (3 per player), shared score, shared wave.
4. **Gallery tag**: Both `solo` and `multiplayer` chips. Pac-Man's card updated to the same dual-tag pattern for consistency.

## Hand-off briefs (to invoke after review)

### `/frontend-design` brief — visual & UI

> Mood: **luminous, line-only, breathing-glow, monochrome, 1979-arcade-honest.** Era: late-70s vector arcade (Asteroids 1979 / Tempest 1981 / Battlezone 1980). Inside the canvas: pure black `#000000`, white phosphor `#f0f0e6` strokes with subtle bloom + faint horizontal scanline overlay. Outside the canvas: site Warm Hearth tokens — gold accent for score, ember for ship glyph, Fraunces page title. The break from site palette is intentional and justified — the canvas is a "vector arcade cabinet" embedded in the warm site frame. HUD font: a thin geometric mono (Major Mono Display or similar). Motion: weighty, drifty, linear-physics on entities; UI overlays use 200 ms ease-out. Iconography: pure SVG/canvas line art — irregular ~8-vertex asteroid polygons whose vertices breathe ±5% during rotation, the iconic isoceles-triangle ship with a flame cutout on thrust, and a 70s saucer UFO. Backgrounds stay solid black during play (authentic — no starfield); title screen has a single giant tumbling asteroid behind stroke-by-stroke wireframe `ASTEROIDS` lettering. Screens to design: title/attract, mode select, active-play HUD, pause overlay, game-over + initial-entry, top-10 high-score table. The "one detail nobody asked for": vertex-jitter breathing on every asteroid, plus phosphor afterimage on bullets via partial canvas-clear.

### `/feature-dev:feature-dev` brief — architecture & code plan

> Build *Asteroids* at `games/asteroids/` per ADR-017. Proposed files (challenge if a tighter cut works): `index.html`, `game.js` (entry + RAF loop + state machine `attract → menu → playing → paused → gameover → highscore`), `entities.js` (`Ship`, `Asteroid`, `Bullet`, `UFO`, `Particle` factories), `physics.js` (vector math, screen-wrap, circle-circle broadphase + line-segment collision for ship-vs-asteroid), `input.js` (keyboard + `SharedGamepad`, P1/P2 binding), `audio.js` (Web Audio synth: heartbeat, laser, thrust, explosions, UFO siren, hyperspace), `render.js` (canvas vector strokes with `shadowBlur` glow + particle system). Module pattern: IIFE on `window.AsteroidsX`, matching Chess and Pac-Man. Tick: `requestAnimationFrame` with fixed-timestep accumulator (~16.67 ms logical step) and render interpolation — determinism enables future daily-seed without rework. Reuse `games/shared/gamepad.js`; DO NOT prematurely extract a high-score helper (Snake's pattern is not yet a 3rd consumer). High scores: `localStorage` key `asteroids-highscores`, JSON top-10 with `{ initials, score, wave, date }`. Mute preference: `localStorage` `asteroids-muted`. Per-wave asteroid count `min(11, 4 + 2*wave)`; UFO spawn gates on score thresholds (large UFO from wave 1, small UFO from ~5,000 pts). Exact tuning constants (rotation deg/s, thrust accel, max velocity, bullet TTL, hyperspace cooldown, beat tempo curve) belong in a single `CONSTANTS` block at the top of `game.js` for easy tweaking. Verification: Chrome DevTools MCP per CLAUDE.md — navigate, snapshot, screenshot title + active play, `list_console_messages` filtered to errors, confirm zero failed network requests, manually verify rotate / thrust / fire / wrap / split-cascade / hyperspace / death-respawn / high-score persistence.

---

## Architecture (resolved through adversarial review)

The `/frontend-design` pass shipped the visual mockup at [games/asteroids/index.html](../../games/asteroids/index.html) (all seven screens, design tokens, drawing primitives). The `/feature-dev:feature-dev` pass produced an implementation blueprint that was then run through an adversarial DRY/SOLID/YAGNI/KISS review. Six findings; all six fixes are baked in below. This section is the implementation contract.

### File layout (8 files)

```
games/asteroids/
├── index.html      page shell · canvas · overlay markup (mockup; surgical edits — see "Mockup surgery" below)
├── physics.js      window.AsteroidsPhysics  — pure math: vec2, screen-wrap, circle-circle, point-in-polygon
├── entities.js     window.AsteroidsEntities — factories + per-tick update for Ship/Asteroid/Bullet/UFO/Particle
├── input.js        window.AsteroidsInput    — keyboard + SharedGamepad, intent provider, fire/hyperspace cooldown owner
├── audio.js        window.AsteroidsAudio    — Web Audio synth, bus mix, sync(state) drains state.events
├── render.js       window.AsteroidsRender   — phosphor-decay clear, draw* primitives, screen shake/flash
├── ui.js           window.AsteroidsUI       — overlay show/hide, bind flow, initials entry, HUD writes, meta-key handlers, mute persistence
└── game.js         window.AsteroidsGame     — RAF loop with fixed-step accumulator, state machine, step(), physics orchestration, CONSTANTS, storage (load/saveHighScore)
```

Script load order in `index.html` (end of `<body>`, no `DOMContentLoaded` gate — matches Pac-Man):

```
../shared/gamepad.js → physics.js → entities.js → input.js → audio.js → render.js → ui.js → game.js
```

`game.js` is the terminal bootstrap; its last statement is `init()`.

### Locked architectural decisions

1. **Single drainer for `state.events`.** `audio.js` drains during `sync(state)`. `render.js` does NOT drain — it reads state directly for visual effects (`state.shakeAmp`, `state.flashFrames`, etc.). No render-side event queue, no protocol ambiguity.

2. **Input owns cooldowns.** `input.js` maintains per-slot fire and hyperspace cooldowns internally. `consumeFire(slot)` returns `true` only when the edge is detected AND the cooldown has elapsed. No `fireCooldown` / `hyperspaceCooldown` fields on `state.players[i]`. Single source of truth.

3. **Bind screen is a state-machine state, not a Promise.** While `state.scene === 'bind'`, the tick loop runs `UI.updateBindScreen(dt)` which polls `Input.peekUnclaimedInput()` and assigns to the next-unbound slot. No Promises in the input layer. Game RAF continues; physics step is gated on `scene === 'playing'`.

4. **No `state.rng` abstraction in v1.** Daily-seed is explicitly v2 in this ADR. `Math.random()` is called directly. A grep-friendly comment marks the call sites for future v2 conversion: `// rng:v2-daily-seed will replace`. The audit list of randomized choices lives in the v2 ADR, not here.

5. **`AST_TIERS` / `UFO_TIERS` as data arrays, not flat constants.** Asteroid tiers `[{radius, speed:[min,max], score, vertCount:[min,max]}, ...]` enable `AST_TIERS[tierIndex + 1]` lookups in `splitAsteroid`. Same shape for UFO sizes. Eliminates branching across `splitAsteroid`, scoring, and UFO targeting.

6. **Renderer primitives move verbatim from the mockup's inline `<script>` IIFE** into `render.js` (`drawShip`, `drawAsteroid`, `drawBullet`, `drawUFO`, `drawDebris`, `phosphorClear`, `hardClear`) and `entities.js` (`makeAsteroid` factory). The mockup file's existing inline `<script>` block is removed wholesale during the surgery.

### Module responsibilities (one-line spec each)

| Module | Owns |
|---|---|
| `physics.js` | `vec`, `add/sub/mul/len/normalize`, `wrap`, `wrapEntity`, `circleHit`, `pointInPolygon`, `randRange(min, max)` |
| `entities.js` | Factories (`makeShip/Asteroid/Bullet/UFO/Particle/DebrisFan`), update functions (`updateShip(ship, intent, dt, state)`, etc., that mutate in place; return `false` to remove), `splitAsteroid(a)` |
| `input.js` | Single global `keydown`/`keyup`, `SharedGamepad` polling on demand, `getIntent(slot)` → `{rotate, thrust}`, `consumeFire(slot)` (cooldown-gated edge), `consumeHyperspace(slot)` (cooldown-gated edge), `peekUnclaimedInput()` for bind, internal per-slot cooldown timers |
| `audio.js` | Pac-Man-derived bus structure (master → sfxBus + beatBus + sirenBus), `ensure/resume/setMuted/isMuted/setVolume`, `sync(state)` drains `state.events` and manages heartbeat + UFO siren loops, 10 synth recipes per event type |
| `render.js` | `init({canvas})`, `beginFrame()` (phosphor-decay clear with reduced-motion gate), `drawShip/Asteroid/Bullet/UFO/Particle/Debris`, `flash(intensity)`, `shake(amplitude)`. HUD is DOM, not canvas. |
| `ui.js` | `setScene(name)` overlay show/hide, `updateBindScreen(dt)`, `enterHsEntry()`/`updateHsEntry(key)`, `renderHsTable()`, `updateHUD(state)` writes to DOM, `M`/`P`/`R`/`Esc` meta-key handlers, mute localStorage persistence |
| `game.js` | `CONSTANTS` block, `state` object, RAF loop with fixed-step accumulator, `step(dt)`, `spawnWave/maybeSpawnUFO/applyHit/killShip` orchestration, `loadHighScores/saveHighScore/isHighScore`, terminal `init()` |

### State shape (single object)

```js
state = {
  scene: 'attract'|'menu'|'bind'|'playing'|'paused'|'gameover'|'hsentry'|'hstable',
  tickCount: 0, events: [],
  coop: false, wave: 0, asteroidsAtWaveStart: 0, waveClearTimer: 0,
  score: 0, hitPauseFrames: 0, shakeAmp: 0, flashFrames: 0,
  players: [
    { slot: 1, ship: null|Ship, lives: 3, lifeStatus: 'alive'|'waiting'|'out',
      respawnTimer: 0, bulletCount: 0,
      input: { scheme: 'arrows'|'wasd'|null, gamepadIndex: number|null } },
    /* slot 2 only when coop=true */
  ],
  asteroids: [], bullets: [], ufo: null, ufoSpawnTimer: 0, particles: [],
  beatPhase: 0, beatNoteIndex: 0,
  hsEntry: { initials: ['A','A','A'], cursor: 0 },
};
```

(Note: no `fireCooldown` / `hyperspaceCooldown` / `state.rng` — moved or removed per fixes #2 and #4.)

### CONSTANTS block (top of game.js)

```js
const CONSTANTS = Object.freeze({
  // Display / timing
  CANVAS_W: 1024, CANVAS_H: 768,
  FIXED_STEP_MS: 1000/60, MAX_STEPS_PER_FRAME: 3, MAX_DT_MS: 250,

  // Ship physics
  SHIP_ROTATE_RAD_PER_S: 4.71,    // ≈270°/s
  SHIP_THRUST_ACCEL: 280, SHIP_MAX_VEL: 360, SHIP_DRAG: 0.999,
  SHIP_RADIUS: 12, SHIP_INVULN_S: 2.0, SHIP_RESPAWN_CLEAR_RADIUS: 100,

  // Bullets
  BULLET_SPEED: 600, BULLET_TTL_DIST: 720,
  BULLET_MAX_PER_SHIP: 4, BULLET_COOLDOWN_S: 0.15, BULLET_RADIUS: 2,

  // Hyperspace
  HYPERSPACE_COOLDOWN_S: 1.0, HYPERSPACE_EXPLODE_CHANCE: 0.08,
  HYPERSPACE_FLASH_FRAMES: 8,

  // Asteroid tiers (data array — see fix #5)
  AST_TIERS: [
    { name: 'large',  radius: 60, speed: [30, 60],   score: 20,  vertCount: [11, 12] },
    { name: 'medium', radius: 35, speed: [60, 100],  score: 50,  vertCount: [10, 11] },
    { name: 'small',  radius: 18, speed: [80, 150],  score: 100, vertCount: [9, 10]  },
  ],
  AST_VERT_OFFSET: [0.65, 1.05], AST_BREATHE_AMP: 0.05,

  // UFO tiers (data array — see fix #5)
  UFO_TIERS: [
    { name: 'large', speed: 100, score: 200,  radius: 18, aimInaccuracyRad: 0.6,  spawnAfterWave: 1,         spawnAfterScore: 0    },
    { name: 'small', speed: 140, score: 1000, radius: 14, aimInaccuracyRad: 0.05, spawnAfterWave: 1,         spawnAfterScore: 5000 },
  ],
  UFO_SPAWN_INTERVAL_S: [12, 25],
  UFO_BULLET_SPEED: 350, UFO_BULLET_COOLDOWN_S: 1.4,

  // Wave progression
  WAVE_COUNT: w => Math.min(11, 4 + 2 * w),
  WAVE_CLEAR_DELAY_S: 1.5,

  // Heartbeat
  BEAT_INTERVAL_MIN_S: 0.45, BEAT_INTERVAL_MAX_S: 1.4,
  BEAT_LOW_HZ: 110, BEAT_HIGH_HZ: 165,

  // Lives & scoring
  STARTING_LIVES: 3, EXTRA_LIFE_EVERY: 10000, HIGHSCORE_TOP_N: 10,

  // Particles
  SHIP_EXPLODE_PARTICLE_COUNT: 14, ASTEROID_BREAK_PARTICLE_COUNT: 6,
  UFO_EXPLODE_PARTICLE_COUNT: 10, HYPERSPACE_PARTICLE_COUNT: 8,
  PARTICLE_LIFE_S: [0.6, 1.2],

  // Render / feel
  PHOSPHOR_FADE_ALPHA: 0.18, LINE_WIDTH: 1.6, SHADOW_BLUR: 8,
  SCREEN_SHAKE_DECAY: 0.85, HIT_PAUSE_MS: 80,
});
```

### Tick loop (Pac-Man pattern, cap=3)

```js
function tick(ts) {
  const dt = Math.min(CONSTANTS.MAX_DT_MS, ts - lastTs); lastTs = ts;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= CONSTANTS.FIXED_STEP_MS && steps < CONSTANTS.MAX_STEPS_PER_FRAME) {
    if (state.scene === 'playing' && state.hitPauseFrames === 0) {
      step(CONSTANTS.FIXED_STEP_MS / 1000);
    } else if (state.scene === 'bind') {
      UI.updateBindScreen(CONSTANTS.FIXED_STEP_MS / 1000);
    } else if (state.hitPauseFrames > 0) {
      state.hitPauseFrames--;
    }
    Audio.sync(state);
    accumulator -= CONSTANTS.FIXED_STEP_MS;
    steps++;
  }
  Render.beginFrame();
  drawScene();
  UI.updateHUD(state);
  requestAnimationFrame(tick);
}
```

### Audio synth recipes (one-shots created/destroyed per event)

| Event | Recipe |
|---|---|
| `fire` | Sawtooth 880→220 Hz exp over 80 ms; gain 0→0.4→0 |
| `thrust` | Brown-noise `AudioBuffer` through bandpass @ 250 Hz Q=2; 60 ms bursts rate-limited |
| `asteroidBreak[tier]` | Filtered noise burst; bandpass {large 200, med 350, small 600} Hz Q=1.5; decay {250, 180, 120} ms |
| `shipExplode` | Brown noise @ 150 Hz + descending square 200→40 Hz over 600 ms; total 800 ms |
| `ufoExplode` | shipExplode shape, 500 ms, slightly higher pitch |
| `ufoFire` | Square 320→80 Hz exp over 100 ms; gain 0→0.3→0 |
| `hyperspace` | Sine sweep 110→1100 Hz over 200 ms with 5 Hz vibrato ±20 Hz; gain 0.3 |
| `extraLife` | 3-note arpeggio: square 660 / 880 / 1320 Hz, 80 ms each |
| `heartbeat` (loop) | Two sine osc 110 / 165 Hz alternating; tempo lerps `BEAT_INTERVAL_MAX_S → BEAT_INTERVAL_MIN_S` based on `(asteroidsAtWaveStart - asteroidsRemaining) / asteroidsAtWaveStart` |
| `ufoSiren` (loop) | Triangle 440 Hz with sawtooth LFO ±60 Hz @ 4 Hz; ramped via `sirenBus` |

### Storage layer (in game.js)

```js
const HS_KEY = 'asteroids-highscores', MUTE_KEY = 'asteroids-muted';

function loadHighScores() {
  try {
    const raw = localStorage.getItem(HS_KEY); if (!raw) return [];
    const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveHighScore(entry) {
  const list = loadHighScores(); list.push(entry);
  list.sort((a,b) => b.score - a.score);
  list.length = Math.min(list.length, CONSTANTS.HIGHSCORE_TOP_N);
  try { localStorage.setItem(HS_KEY, JSON.stringify(list)); } catch {}
}
function isHighScore(score) {
  const list = loadHighScores();
  return list.length < CONSTANTS.HIGHSCORE_TOP_N || score > (list[list.length-1]?.score ?? 0);
}
```

(Snake's per-difficulty-scalar pattern is a different shape — Asteroids is the first top-10-with-initials consumer on the site; extraction to `games/shared/highscores.js` waits for a 2nd consumer of *this* shape per ADR-017's locked YAGNI position.)

### Mockup surgery (when implementation starts)

The current [games/asteroids/index.html](../../games/asteroids/index.html) is the design-pass mockup. Implementation removes/adds:

1. Remove `data-demo="true"` from `<body>`.
2. Delete the `<div class="screen-switcher">…</div>` block.
3. Delete the inline `<script>` IIFE — its primitives migrate to `render.js` / `entities.js`.
4. Add 8 `<script src="…">` tags in load order (above).
5. Mockup's hardcoded HUD values (`12 480`, `WAVE 04`, etc.) stay in markup; `UI.updateHUD()` overwrites them.
6. Mockup's hardcoded high-score table rows: `UI.renderHsTable()` clears `<tbody>` on `hstable` enter and populates from `loadHighScores()`.
7. `.hud-p2` block has `hidden` by default; `UI.updateHUD()` toggles based on `state.coop`.
8. Initial-cell `data-active` attribute set by `UI.enterHsEntry()` based on `state.hsEntry.cursor`.
9. Inline `<style>` stays as-is — design tokens and overlay styles are correct.

### Build sequence (suggested order)

1. `physics.js` — pure math, easy to verify in isolation.
2. `entities.js` factories only (no `update*` yet) — confirm shapes render the same as mockup.
3. `render.js` — port draw functions verbatim from the mockup `<script>`.
4. `game.js` skeleton — RAF, state object, scene transitions stub; no physics.
5. `ui.js` — overlay show/hide, HUD writes, meta-key handlers; verify scene transitions visible.
6. `input.js` — keyboard + gamepad, intent provider, internal cooldowns.
7. `entities.js update*` functions — wire ship rotate/thrust/fire; verify movement.
8. Collision + asteroid splitting (with `AST_TIERS` lookup) — verify cascade.
9. UFO + AI (with `UFO_TIERS` lookup) — verify spawn cadence and aim.
10. Hyperspace + respawn-clear-zone.
11. `audio.js` — port Pac-Man bus structure; implement synth recipes.
12. `ui.js` HsEntry + HsTable + bind-screen update loop.
13. Co-op (P2 ship, dual life pools, gameover only when both out).
14. Reduced-motion gates.
15. Verification per CLAUDE.md MCP protocol.

Estimated total: ~1,800 LOC across the 7 JS files. `game.js` ≈ 350 LOC after the `ui.js` split.

### Verification (per CLAUDE.md MCP protocol)

After step 15: navigate `/games/asteroids/`, snapshot, screenshot title + active-play, `list_console_messages types=['error']` must be empty, `list_network_requests` no 4xx/5xx. Manual checklist:

- [ ] Ship rotates ~270°/s, thrusts with inertia, drifts, wraps screen
- [ ] Bullets ≤4 per ship, wrap, expire at TTL distance, fade with age
- [ ] Asteroid cascade: large→2 medium→2 small→nothing
- [ ] Wave clear → 1.5s pause → next wave with N+2 capped at 11
- [ ] Large UFO from wave 1, small UFO at score ≥5000, only one UFO at a time
- [ ] Small UFO aims accurately, large UFO sloppy
- [ ] Hyperspace teleports randomly, explodes ~8% of the time
- [ ] Death + respawn waits for clear zone; respawn invuln blink visible
- [ ] Co-op: both ships, separate lives, shared score, gameover only when both out
- [ ] Heartbeat tempo accelerates as wave depletes; stops between waves
- [ ] UFO siren active only while UFO exists; gain ramps prevent clicks
- [ ] Mute (M) persists across reload; M during attract works
- [ ] R from gameover restarts in <1 s; top-10 score triggers initials entry
- [ ] `prefers-reduced-motion`: phosphor trail off, no shake, no hit-pause

---

**Next**: Implementation per the build sequence above. No further design or planning passes needed.
