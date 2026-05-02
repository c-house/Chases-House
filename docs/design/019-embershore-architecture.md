# Embershore — Architecture Blueprint

**Companion to**: [ADR-019](../adr/019-embershore.md), [design bible mockup](../../games/embershore/mockup.html)
**Status**: Proposed (awaiting approval before PR1)
**Date**: 2026-04-25

---

## 1. Module map

```
games/embershore/
├── index.html              page shell, canvas, overlays, inline CSS, script tags
├── world.js                tile data: 5×4 overworld + 4 dungeons, hand-authored
├── engine.js               state, tick loop, room-scroll, collision, save/load
├── entities.js             player, NPC archetype, enemy archetypes, projectile, pickup
├── ai.js                   per-enemy behaviors, totem-hint resolver, bard verse picker
├── input.js                keyboard scheme + gamepad polling (delegates to SharedGamepad)
├── audio.js                Web Audio init, sample loading, music + SFX (Pac-Man parallel)
├── render.js               canvas drawing — tilemap bake, sprites, HUD, dialogue glyphs
├── dialogue.js             NPC text data + dialogue-box state machine, {name} interp
├── ui.js                   title, name-entry, pause, inventory menu, map, game-over, ending
├── game.js                 module wiring, per-frame loop, public start/stop API
├── sprites/
│   ├── terrain.png         tile atlas (sand/grass/water/stone/dungeon variants)
│   ├── player.png          player character sheet (4 dirs × 2 walk frames + idle + tunic-flutter)
│   ├── npcs.png            6 NPCs × 2 idle frames each
│   ├── enemies.png         4 enemy types × directions × frames
│   ├── items.png           5 items + heart container + rupee + 4 sigils + conch shell
│   ├── effects.png         particle frames (sparkle, dust, sword arc, heart fracture)
│   └── portraits/          PNG per NPC (Gemini-painted, ~256×256, painterly)
└── sounds/                 CC0 audio (Patrick de Arteaga + Junkala supplements)
```

### Dependency graph

```
SharedGamepad ←─────────── input.js
                              ▲
world.js ─────────┐           │
                  ▼           │
              engine.js       │
                  ▲           │
                  │           │
   ┌──────────────┼──────────┐│
   │              │          ││
entities.js    ai.js     render.js
   │              │          │
   └──────────────┼──────────┘
                  │
              audio.js (standalone)
                  │
              dialogue.js (data + advancer)
                  │
                  ▼
                game.js  (wires everything, owns rAF loop)
                  │
                  ▼
                ui.js  (boots on parse, owns DOM overlay flow)
```

### Script load order in `index.html`

```html
<script src="../shared/gamepad.js"></script>
<script src="world.js"></script>
<script src="entities.js"></script>
<script src="ai.js"></script>
<script src="engine.js"></script>
<script src="render.js"></script>
<script src="input.js"></script>
<script src="audio.js"></script>
<script src="dialogue.js"></script>
<script src="game.js"></script>
<script src="ui.js"></script>   <!-- last; boots on parse -->
```

### Module pattern

Standard chases.house IIFE — every file is:

```js
(function () {
  'use strict';
  const W = window.EmbershoreWorld;  // alias deps at top
  const E = window.EmbershoreEngine;
  // ... private state and functions ...
  window.EmbershoreX = { /* public api */ };
})();
```

No build step. No imports. Globals only. Same pattern as Pac-Man and Chess.

---

## 2. Public APIs (`window.EmbershoreX` shapes)

### `window.EmbershoreWorld` — tile + room data

```js
{
  // Tile constants (Uint8 values)
  EMPTY, SAND, GRASS, WATER, STONE,
  WALL, DOOR_N, DOOR_S, DOOR_E, DOOR_W,
  TOTEM, BUSH, ROCK, CHEST, SIGN, FIRE, INN,

  // Room dimensions
  COLS,  // 10
  ROWS,  // 9
  TILE,  // 16 (logical px)

  // Room registry
  ROOMS,                            // { [roomId]: roomDef }
  getRoom(roomId),                  // → roomDef | null
  isWalkable(tile, item, equipped), // tile + player state → bool
  isInteractable(tile),             // → bool

  // Room IDs for v1
  OVERWORLD_IDS,  // ['ow_0_0', ..., 'ow_4_3']
  DUNGEON_IDS,    // ['d1_entry', 'd1_r1', ..., 'd4_boss']
}
```

A `roomDef` is:

```js
{
  id: 'ow_2_1',
  scene: 'overworld' | 'dungeon' | 'fishing' | 'inn',
  music: 'overworld' | 'dungeon_1' | 'boss' | ...,
  tiles: Uint8Array(90),   // 10 × 9 grid, mutated by gameplay (chest opened, etc)
  baseTiles: Uint8Array(90), // pristine copy for reset/respawn
  objects: [{ x, y, type, id, data }],  // npcs, totems, signs, enemies
  exits: { N: 'ow_2_0', S: 'ow_2_2', E: 'ow_3_1', W: 'ow_1_1' },
  hudSafeZone: { x: 0, y: 0, w: 4, h: 2 },  // tiles
}
```

### `window.EmbershoreEntities` — entity factories + step

```js
{
  createPlayer(state, pos),                // → player obj
  createNpc(state, pos, npcId),            // → npc obj
  createEnemy(state, pos, enemyType),      // → enemy obj
  createProjectile(state, pos, dir, kind), // → projectile obj
  createPickup(state, pos, item),          // → pickup obj
  step(state, ent, dt),                    // mutate ent for one tick
  damage(state, ent, amount, source),
  destroy(state, ent),
}
```

### `window.EmbershoreAI` — behaviors

```js
{
  enemyStep(state, enemy),    // dispatches to behavior fn by enemy.type
  totemLineFor(state, totem), // → string  (context-aware hint)
  bardVerseFor(state),        // → { roomId: string, melody: string }
  bossStep(state, boss),
}
```

### `window.EmbershoreEngine` — state + tick + persistence

```js
{
  // Constants
  FIXED_STEP_MS,         // 1000/60
  PLAYER_SPEED,          // 1.0 logical px/tick
  ROOM_SCROLL_FRAMES,    // 17 (~280ms at 60fps)

  // Lifecycle
  createState(saveData),  // → state obj (fresh OR restored)
  step(state, input),     // one logical tick — mutates state
  startRoomScroll(state, exit),  // begin transition to neighbor
  enterScene(state, scene, payload),

  // Persistence
  save(state),            // writes localStorage 'embershore.save.v1'
  load(),                 // → saveData | null
  clearSave(),
  loadPrefs(),            // → { muted, reducedMotion, sfxVol, musicVol }
  savePrefs(prefs),
  loadScores(),           // → { biggestFish, fastestRun }
  saveScore(category, value),

  // Helpers (used by render + ai)
  isPlayerFacing(player, ent),
  entitiesNear(state, pos, radius),
  pushEvent(state, type, data),
}
```

### `window.EmbershoreRender` — drawing

```js
{
  init(canvasEl, sprites),  // sets up canvas, bakes first room, caches atlases
  render(state, alpha),     // alpha = interpolation factor for sub-tick smoothing

  // Atlas helpers (used by entities + ui)
  drawSprite(ctx, atlas, frameIdx, dx, dy, opts),
  drawTile(ctx, tileType, dx, dy),

  // Geometry constants
  CANVAS_W,  // 640
  CANVAS_H,  // 576
  SCALE,     // 4
  TILE_PX,   // 64 (TILE * SCALE)

  // Hooks for ui.js (DOM overlay sync)
  cameraOffset(state),  // → { x, y } for HUD positioning
}
```

### `window.EmbershoreInput`

```js
{
  init({ onAnyInput }),
  teardown(),
  poll(state),              // returns { dir, btnA, btnB, btnE, btnPause } per-tick
  isAnyPressed(),           // for title-screen "press anything"
  rebindPad(idx),           // assign a controller to the single player slot
  getDirection(),           // current 4-way input as 'up'|'down'|'left'|'right'|null
  consumeButton(name),      // rising edge: 'A'|'B'|'E'|'PAUSE'|'INVENTORY'
}
```

### `window.EmbershoreAudio`

```js
{
  ensure(),                  // lazy: AudioContext + buses + start fetching
  resume(),                  // post-gesture context.resume()
  loadAll(),                 // returns Promise — fetch+decode all WAVs
  setMuted(bool),
  isMuted(),
  setVolume(channel, v),     // channel: 'master'|'music'|'sfx'
  sync(state),               // crossfade music based on state.scene + state.events
  play(sfxName, opts),       // one-shot SFX
  resetForNewSession(),
}
```

### `window.EmbershoreDialogue`

```js
{
  // Data
  LINES,                     // { [npcId]: { default: [...], conditions: [{when, lines}] } }
  TOTEM_LINES,               // function-driven hints
  BARD_VERSES,               // 20 entries, one per overworld screen

  // Runtime
  start(state, npcId),       // begin a conversation
  advance(state),             // next line OR close box
  isActive(state),            // → bool
  current(state),             // → { text, portraitId, frameVariant } | null
  interpolate(text, state),  // {name} → state.player.name
}
```

### `window.EmbershoreUI`

```js
// no public api — boots on parse, owns DOM overlay flow
// (matches Pac-Man's ui.js — self-executing module)
```

### `window.EmbershoreGame` — orchestrator

```js
{
  init({ canvas, onGameOver }),
  startNew(name),            // begin fresh game with chosen player name
  startContinue(),           // load save + resume in last scene
  pause(),
  resume(),
  isRunning(),
  getState(),                // → state | null
  showToast(msg, durationMs),
}
```

---

## 3. State machine

The single source of truth is `state.scene` (a string). Each scene owns its own update logic in `engine.step`.

```
title ─────── press start ──────→ name-entry         (fresh save only)
title ─────── press continue ───→ overworld          (loaded save)

name-entry ── continue button ──→ cutscene_intro     (wash-ashore animation, 4s)
cutscene_intro ─ ends ──────────→ overworld

overworld ─── walk to door ─────→ overworld          (room-scroll, same scene)
overworld ─── enter dungeon ────→ dungeon            (fade transition)
overworld ─── press E on NPC ───→ dialogue           (overlay; world paused)
overworld ─── press TAB ────────→ menu               (pause overlay)
overworld ─── press M (map) ────→ map                (overlay)
overworld ─── enter cove tile ──→ fishing
overworld ─── hearts → 0 ───────→ cutscene_wake      (1.8s fade to inn)

dungeon ──── walk to door ──────→ dungeon            (room-scroll)
dungeon ──── walk into boss ────→ boss               (door slams shut, music swap)
dungeon ──── press TAB ─────────→ menu
dungeon ──── hearts → 0 ────────→ cutscene_wake

boss ─────── boss defeated ─────→ cutscene_sigil     (2.4s item-get pose)
cutscene_sigil ─ ends ──────────→ dungeon (exit)

dialogue ─── press E (advance) ─→ dialogue           (next line) OR scene's prior
menu ─────── press ESC ─────────→ <scene resumed>
fishing ──── press B (leave) ───→ overworld

cutscene_wake ─ ends + key press → overworld (player at inn, full hearts)
cutscene_intro ─ ends ──────────→ name-entry         (returning from intro on fresh)

# Final ending (4 sigils collected + light campfire)
overworld ─── E on campfire ────→ cutscene_ending
cutscene_ending ─ 12s ──────────→ credits
credits ──── press any ─────────→ title (with save now flagged 'completed')
```

**Sub-states** (held in scene-specific fields):

- `state.scroll`: when present, indicates a room-scroll is in flight. Has `{ from, to, dir, frame, totalFrames }`. World tick paused; only camera + transition animation runs.
- `state.dialogue`: when present, dialogue is active. World tick paused except for ambient anim (idle leaf, fire flicker).
- `state.menu`: similar, paused with menu rendering.
- `state.itemGet`: 2.4s freeze pose (when picking up sigil, heart container, signature item).

---

## 4. Runtime state shape

```js
state = {
  // Persistence-relevant
  name,                  // string, set at name-entry
  scene,                 // current scene string
  roomId,                // current room id
  player,                // player entity (see below)
  inventory,             // ['sword'] — array of item ids
  equipped,              // { A: 'sword', B: null }
  hearts,                // { current: 4, max: 6 }  (whole-heart units in v1)
  rupees,                // int (called "found" in NPC dialogue)
  sigils,                // { earth:false, tide:false, ember:false, gale:false }
  shells,                // [] — array of shell IDs found
  npcsTalkedTo,          // Set serialized as Array
  fishCaught,            // { [species]: { biggest:cm, count:int } }
  bardVersesHeard,       // Set of room ids
  totemsRead,            // Set of totem ids (gates which contextual hints to show next)
  visitedRooms,          // Set — for fog-of-map
  currentDate,           // ISO date when save was last written (used for date-easter-egg parity)

  // Transient (not persisted; rebuilt on load)
  tiles,                 // Uint8Array(90) — current room mutable tiles
  entities,              // [] — array of npcs/enemies/projectiles/pickups in current room
  scroll,                // null OR { from, to, dir, frame, totalFrames }
  dialogue,              // null OR { npcId, lineIndex, charsRevealed, totalChars, frame }
  menu,                  // null OR { tab: 'inventory'|'map' }
  itemGet,               // null OR { item, frame }
  events,                // [] — cleared each tick, written by step() — drives audio/render
  tick,                  // int frame counter
  inputThisFrame,        // { dir, btnA, btnB, btnE, btnPause } — set by input.poll
  cameraOffset,          // { x, y } in logical px — for room-scroll smoothing

  // Settings (mirror of localStorage prefs, written through)
  prefs: { muted, reducedMotion, sfxVol, musicVol },
}
```

**Player entity**:

```js
{
  type: 'player',
  x, y,                   // logical px, NOT tile coords
  dir: 'down',            // 'up'|'down'|'left'|'right'
  walkFrame: 0,           // 0..1 alternates each tile traversed
  swingFrames: 0,         // > 0 when sword is mid-swing
  invulnFrames: 0,        // i-frames after damage
  fallFrames: 0,          // > 0 when falling into a pit (cozy reset, 24f)
}
```

**NPC entity**:

```js
{
  type: 'npc',
  npcId: 'inn-keeper',    // looks up dialogue.LINES + portrait
  x, y, dir,
  blinkFrame: 0,          // 0..160, blinks at frame 0
  wanderFrames: 0,        // simple ambient idle motion (NPCs sway)
}
```

**Enemy entity** (same fields as NPC plus `hearts`, `behavior`, `aggroRange`).

---

## 5. Tick loop

Lifted from Pac-Man's `game.js`. Fixed-step accumulator, raw rAF, max 5 catch-up steps.

```js
const FIXED_STEP_MS = 1000 / 60;

function tick(ts) {
  if (!running) return;
  const dt = Math.min(250, ts - lastTs);
  lastTs = ts;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED_STEP_MS && steps < 5) {
    state.inputThisFrame = Input.poll(state);
    Engine.step(state, state.inputThisFrame);
    Audio.sync(state);
    rumbleEvents(state);
    accumulator -= FIXED_STEP_MS;
    steps++;
  }
  const alpha = accumulator / FIXED_STEP_MS;  // for render interpolation
  Render.render(state, alpha);
  if (state.scene === 'credits' && state.creditsFinished) {
    running = false;
    onGameOverCb(state);
    return;
  }
  requestAnimationFrame(tick);
}
```

The `events` array decoupling (Pac-Man's pattern) is preserved: any step-time function that wants to trigger audio or rumble pushes to `state.events`; `Audio.sync` and `rumbleEvents` consume it after the step. Events: `dot_pickup, sword_swing, enemy_hit, enemy_kill, door_open, door_locked, dialogue_start, dialogue_advance, item_get, sigil_get, heart_container_get, fish_bite, fish_caught, room_enter, dungeon_enter, boss_defeat, hearts_zero, save_written`.

---

## 6. Render architecture

### Canvas sizing

```
Logical:  160 × 144  (10 tiles × 9 tiles × 16 px)
Scale:    4×
Render:   640 × 576
```

`canvas.width = 640; canvas.height = 576` set imperatively in `init`. CSS uses `image-rendering: pixelated; width: 100%; height: auto` on a wrapper that integer-scales (via container queries or fixed scale tiers). The `.game-frame` outer container uses Pac-Man's pattern.

### Layer order per render call

```
1. Black fill (clears canvas)
2. Baked tilemap of current room (drawImage from offscreen canvas)
3. During room-scroll: baked tilemap of NEXT room offset by camera transition
4. Floor objects (dropped pickups, projectiles, fire)
5. Entities (player + npcs + enemies), z-sorted by .y
6. Above-floor objects (sword arc, heart-fracture sparkle, dust)
7. Date easter-egg overlay layer (snow/blossoms/fireworks if date matches)
8. HUD (hearts, found, equip slots) — top-left, 70% opacity by default
9. Dialogue box overlay (DOM, separate stack — see §13)
10. Cutscene/menu overlays (DOM)
```

### Tilemap baking

When entering a room (or starting room-scroll), the engine calls `Render.bakeRoom(roomId)`. This:
1. Allocates an offscreen `<canvas>` 160×144 (logical, then scaled 4× via `imageSmoothingEnabled = false`)
2. For each tile in `room.tiles`, calls `drawTile(ctx, type, dx, dy)` which atlases from `terrain.png`
3. Stores in `bakedRooms[roomId]` keyed by mutation hash so chest-open invalidates only that room

Per-frame render then draws the baked canvas with `drawImage(bakedRooms[roomId], 0, 0)`. Single ~80μs operation for the tile layer regardless of tile count.

### Sprite atlas convention

Each PNG is a grid. Frame index → atlas position via:

```js
function atlasFrame(atlas, idx) {
  const cols = atlas.cols;       // declared at load time per atlas
  const w = atlas.frameW;        // 16 for game sprites, 256 for portraits
  const h = atlas.frameH;
  return { sx: (idx % cols) * w, sy: Math.floor(idx / cols) * h, sw: w, sh: h };
}
```

Animation tables live alongside data. E.g., `player.png` has frame indices:

```js
const PLAYER_FRAMES = {
  idle:   { down: 0, up: 8,  left: 16, right: 24 },
  walk_a: { down: 1, up: 9,  left: 17, right: 25 },
  walk_b: { down: 2, up: 10, left: 18, right: 26 },
  swing:  { down: 3, up: 11, left: 19, right: 27 },
  fall:   { down: 4, up: 4,  left: 4,  right: 4  },  // dir-agnostic
  flutter:{ down: 5, up: 13, left: 21, right: 29 },  // 6s-idle flourish
};
```

### HUD on canvas

HUD draws every frame at top-left. Five hearts (10×10 logical), found-counter (3-char Press Start 2P), and 2 equip slots (16×16 each with 8×8 icon). 70% global opacity by default; flashes to 100% on event then eases back over 60 frames.

Heart fracture is rendered as a 4-frame inline animation when an event `damage` fires: full → cracking → cracked → empty (each frame on canvas). Implemented as a per-heart `fractureFrame` field that ticks down from 16 to 0.

### Dialogue box — DOM, not canvas

The deckled-edge parchment scroll, NPC portrait, and `{name}` highlight from the design bible are best as a DOM overlay (`#dialogue-overlay` div, positioned absolute over the `.game-frame`). Reasons:
1. SVG `clip-path` for the deckled edge needs DOM context anyway
2. Painted portraits are independent PNGs not in the sprite atlas
3. Typewriter effect is one CSS animation + JS char counter
4. Reusing the design bible's CSS verbatim is the cheapest path

Engine pauses world tick when `state.dialogue !== null`. UI module owns the DOM.

---

## 7. Camera & room-scroll

The signature mechanic. Implementation:

```
State at scroll start:  state.scroll = { from: 'ow_2_1', to: 'ow_3_1', dir: 'right', frame: 0, totalFrames: 17 }
                        Engine pauses: no entity step, no input poll for movement
                        Music continues unbroken (no audio touch)

Each render frame during scroll:
  alpha = state.scroll.frame / state.scroll.totalFrames
  eased = cubicEaseInOut(alpha)
  offset = eased * 160 (logical px = room width for horizontal scroll)
  drawImage(bakedRooms[from], -offset, 0)
  drawImage(bakedRooms[to],   160 - offset, 0)
  drawPlayerAtSeam()  // player walks across the seam at the exit/entry tile

  player.x interpolates from "exit edge of from-room" to "entry edge of to-room"

When state.scroll.frame === totalFrames:
  state.roomId = to
  load to-room entities (run room.objects through Entities.create*)
  bake to-room if not already cached
  state.scroll = null
  resume world tick
```

For reduced-motion: instant cut. Just set `state.roomId = to` and skip the in-flight rendering.

The "music continues unbroken" requirement is handled by `Audio.sync` checking `state.scene` (scene-level, not room-level). Since same scene throughout overworld, no music change. When entering a dungeon, scene changes from `overworld` to `dungeon`, triggering crossfade.

---

## 8. World data file format

`world.js` declares rooms as nested objects. Tiles are encoded as character-strings (Pac-Man's pattern, easier to read than numeric arrays):

```js
const OW_2_1 = {
  id: 'ow_2_1',
  scene: 'overworld',
  music: 'overworld',
  tilesRaw: [
    'SSSSSSSSSS',
    'SGGGGGSSSS',
    'SGGTGGSSSS',
    'SGGGGGSSSS',
    'SGGGGGGGGS',
    'WWWWWGGGGS',
    'WWWWWGGGGS',
    'WWWWWGGGGS',
    'SSSSSGGGGS',
  ],
  objects: [
    { x: 3, y: 2, type: 'totem', id: 'tot_2_1', },
    { x: 7, y: 4, type: 'npc',   id: 'fisher',  },
  ],
  exits: { N: 'ow_2_0', S: 'ow_2_2', E: 'ow_3_1', W: 'ow_1_1' },
  hudSafeZone: { x: 0, y: 0, w: 4, h: 2 },
};
```

A boot-time pass converts `tilesRaw` strings into the `Uint8Array(90)` via a character map (`S` → SAND, `G` → GRASS, `W` → WATER, `T` → TOTEM, etc.). The runtime array is mutable (chest opened, bush cut).

**Fog of map**: a tile-grid is "visited" when the player enters the room. `state.visitedRooms` is the source of truth for the map screen.

---

## 9. Save / load schema

Three localStorage keys, all wrapped in try/catch (matches crossword pattern):

```js
'embershore.save.v1'    // null OR JSON of save snapshot
'embershore.scores.v1'  // JSON of high scores
'embershore.prefs.v1'   // JSON of settings
```

### Save snapshot

```json
{
  "v": 1,
  "name": "cinder",
  "scene": "overworld",
  "roomId": "ow_2_1",
  "player": { "x": 80, "y": 72, "dir": "down" },
  "inventory": ["sword", "feather"],
  "equipped": { "A": "sword", "B": null },
  "hearts": { "current": 4, "max": 6 },
  "rupees": 12,
  "sigils": { "earth": true, "tide": false, "ember": false, "gale": false },
  "shells": ["sh_1_2", "sh_3_0", "sh_4_3"],
  "npcsTalkedTo": ["inn-keeper", "fisher"],
  "fishCaught": { "trout": { "biggest": 38, "count": 3 } },
  "bardVersesHeard": ["ow_0_0", "ow_1_0"],
  "totemsRead": ["tot_2_1"],
  "visitedRooms": ["ow_2_1", "ow_3_1", "ow_2_2"],
  "currentDate": "2026-04-25",
  "completed": false
}
```

### Auto-save points

- After every `room_enter` event
- After every menu-close
- After every `dialogue_advance` final line (to capture "talked to NPC" state)
- After every `item_get`, `sigil_get`, `heart_container_get`
- On `pagehide` (soft-best-effort)

No manual save button. UI shows "Save & Quit" but it's just "Quit" — the auto-save invariant means quitting is always safe.

### Versioning

Key is `embershore.save.v1`. If a future v2 ships:
- v2 reads from `embershore.save.v1` first, runs a migration, writes `embershore.save.v2`, deletes v1
- If migration fails, falls back to fresh save (cozy: never crashes on bad save)

### Scores

```json
{
  "biggestFish": { "trout": 38, "tarpon": 121, "perch": 18 },
  "fastestRun": { "completed": false, "seconds": null }
}
```

### Prefs

```json
{ "muted": false, "reducedMotion": false, "sfxVol": 1.0, "musicVol": 0.7 }
```

---

## 10. Sprite atlas conventions

Atlas metadata is declared in a single boot-time table loaded by `render.js`:

```js
const ATLASES = {
  terrain:   { src: 'sprites/terrain.png', frameW: 16, frameH: 16, cols: 16 },
  player:    { src: 'sprites/player.png',  frameW: 16, frameH: 16, cols: 8 },
  npcs:      { src: 'sprites/npcs.png',    frameW: 16, frameH: 16, cols: 8 },
  enemies:   { src: 'sprites/enemies.png', frameW: 16, frameH: 16, cols: 8 },
  items:     { src: 'sprites/items.png',   frameW: 16, frameH: 16, cols: 8 },
  effects:   { src: 'sprites/effects.png', frameW: 16, frameH: 16, cols: 8 },
};
const PORTRAITS = {  // separate — different size, separate files per NPC
  'inn-keeper': 'sprites/portraits/inn-keeper.png',
  'fisher':     'sprites/portraits/fisher.png',
  // ...
};
```

`Render.init` fetches all atlases in parallel via `Image()` `Promise.all`. Failures fall back to a magenta placeholder tile so missing assets don't crash. Atlas frame indices are referenced by name from the game code; a `FRAMES` table per atlas maps human-readable names to indices (see §6 sample).

**Resolution note**: Q2 commit is 16×16 *native art*. Browser scales 4× via `image-rendering: pixelated`. Authoring tool can be Aseprite, Piskel, or any pixel editor. PNG export at native size — no double-export needed.

---

## 11. Audio bus

Mirrors `games/pacman/audio.js` exactly. Five gain buses on a single `AudioContext`:

```
AudioContext
└── master (0.7 default)
    ├── sfx (1.0)              ← all one-shots
    ├── music_overworld (0)    ← looped tracks crossfade between these four
    ├── music_dungeon (0)
    ├── music_boss (0)
    └── music_special (0)      ← fishing, ending, intro cutscene share this bus
```

### Music crossfade priority (`Audio.sync(state)`)

```
if state.scene === 'boss': music_boss = 1.0; others → 0
elif state.scene === 'dungeon': music_dungeon = 1.0
elif state.scene === 'fishing': music_special.special_track = 'fishing'; music_special = 1.0
elif state.scene === 'cutscene_ending' || 'credits': music_special.special_track = 'ending'; music_special = 1.0
elif state.scene === 'overworld' || 'inn': music_overworld = 1.0
elif state.scene === 'title': music_special.special_track = 'title'; music_special = 0.5
```

Crossfade ramp: 80ms (matches Pac-Man). When `state.scene` changes, current loop ramps to 0 over 800ms while next loop ramps from 0 to target over the same window. Different from Pac-Man's instant siren-priority swap because dungeon→boss should feel ceremonial.

### SFX inventory (v1)

| Name | When | Source candidate |
|---|---|---|
| `step_grass` | every other tile traversed | Junkala |
| `step_sand` | every other tile traversed (sand) | Junkala (alt) |
| `sword_swing` | sword button | Junkala `powerup6` retuned |
| `enemy_hit` | sword connects | Junkala `hit2` |
| `enemy_kill` | enemy → 0 hp | Junkala `powerup14` |
| `damage_taken` | player hit | Junkala `hit5` |
| `dot_pickup` | rupee collected | Junkala `Blip3` |
| `heart_pickup` | heart drop collected | Junkala `Blip5` |
| `door_open` | door state change | Junkala `door_open` |
| `door_locked` | door bounce | Junkala `bump1` |
| `dialogue_blip` | typewriter char (every 4th) | Junkala `Blip1` low-pitch |
| `item_get_short` | small pickup (item, shell) | Junkala `fanfare2` |
| `item_get_long` | sigil / heart container (with the 2.4s freeze) | Junkala `fanfare3` |
| `fish_bite` | rod tug | Junkala `Blip2` |
| `fish_caught` | reel-in success | Junkala `powerup10` |
| `menu_move` | menu nav | Junkala `Blip4` |
| `menu_confirm` | menu select | Junkala `Blip6` |
| `error` | invalid action | Junkala `error1` |

### Mute persistence

Owned by `ui.js` via `Engine.savePrefs({ muted: true })`. `audio.js` itself never touches localStorage.

### First-gesture unlock

`Audio.ensure()` called from `EmbershoreGame.startNew` / `startContinue` (which fire on a click, satisfying the autoplay policy). All prior page time runs without an AudioContext. Fonts and atlases preload regardless.

---

## 12. Input layer

Single-player simplifies considerably vs Pac-Man's 4-slot system.

### Keyboard

One scheme, with both arrow keys and WASD active simultaneously:

```js
const KEYS = {
  up:    ['ArrowUp', 'KeyW'],
  down:  ['ArrowDown', 'KeyS'],
  left:  ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  A:     ['Space', 'KeyJ'],
  B:     ['ShiftLeft', 'KeyK'],
  E:     ['KeyE', 'KeyZ', 'Enter'],
  PAUSE: ['Tab', 'Escape'],
  INV:   ['KeyI'],
};
```

Same "most-recently-pressed direction wins" semantics as Pac-Man. `pressOrder` array tracked.

### Gamepad

Single slot. First connected controller auto-binds. `SharedGamepad.consumeButtonPress(idx, BUTTONS.A)` for rising edge, `getDirection(idx)` for direction. Mappings:

```
DPAD / left stick → direction
A button → action A (sword/use slot A item)
B button → action B (shield/use slot B item)
Y button → talk / interact / pickup
X button → reserved (currently unused — could be quick-equip swap in v2)
START   → pause menu
BACK    → map screen
```

If a gamepad is plugged in mid-game, a small toast appears ("controller connected"). Rumble fires on `damage_taken`, `enemy_kill`, `boss_defeat`, `sigil_get`.

---

## 13. Dialogue system

### `LINES` shape

```js
const LINES = {
  'inn-keeper': {
    default: [
      "{name}, you're awake. The seabird carried you here.",
      "Sleep heals what the dream hurt. The bed's yours whenever.",
    ],
    conditions: [
      { when: s => s.sigils.tide,
        lines: ["The tide quiets when you walk by, {name}. Strange."] },
      { when: s => Object.values(s.sigils).every(Boolean),
        lines: ["Light the campfire when you're ready, {name}. She's waiting."] },
    ],
  },
  // ...
};
```

`Dialogue.start(state, npcId)` resolves which line array to use:
1. Walk `conditions` array; first `when(state)` that returns true wins
2. If none match, use `default`
3. Save the chosen array on `state.dialogue.lines`

### `{name}` interpolation

```js
function interpolate(text, state) {
  return text.replace(/\{name\}/g, state.name);
}
```

The renderer wraps the substituted name in a span with the ember-glow underbox class (see [mockup.html](../../games/embershore/mockup.html) `.cursor-name`). Implementation: split text by `{name}`, render player name as a styled span between the slices.

### Frame variants

`dialogue.frameVariant` enum: `'parchment'` (default) | `'staff'` (bard, with music-staff watermark) | `'stone'` (totem). Set by NPC ID lookup at `start()` time. The DOM overlay's CSS class toggles to render the right framing.

### Advance flow

- Press E: if typewriter is mid-reveal, fast-forward to full reveal. If full reveal, advance to next line. If on last line, close dialogue.
- World tick paused. NPCs blink, bard hums (audio-only, not dialogue-driven), idle leaf can still drop.

---

## 14. Inventory & equip

### Inventory

Array of item ids. v1 ships at most 5 items: `sword`, `feather`, `bombs`, `boomerang`, `bow`.

### Equip slots

`state.equipped = { A: 'sword', B: null }`. Both slots can hold any inventory item. Sword in A doesn't lock — player can move sword to B and put feather in A.

### Equip swap UX (in pause menu)

1. Player opens menu (TAB / START)
2. Tab to inventory grid (Bricolage typography per design bible)
3. Click/select an item
4. Press A or B to assign — gold-glow ring snaps to that slot
5. Press ESC: menu closes, save written, gameplay resumes

Both keyboard (arrow + Enter) and mouse work. No drag-and-drop.

---

## 15. Entity system

Heterogeneous entity list per room. Type-dispatched step:

```js
function stepEntity(state, ent) {
  switch (ent.type) {
    case 'player':     return stepPlayer(state, ent);
    case 'npc':        return stepNpc(state, ent);
    case 'enemy':      return AI.enemyStep(state, ent);
    case 'projectile': return stepProjectile(state, ent);
    case 'pickup':     return stepPickup(state, ent);
    case 'effect':     return stepEffect(state, ent);
  }
}
```

Each entity has `{ x, y, type, alive }` minimum. Type-specific fields stay on the same object (no ECS, deliberate). When `ent.alive === false` after a step, removed from the list at end of tick.

### Z-sorting

Render iterates entities sorted by `.y` (so the player walks behind a tree's top half). Sword arc and projectiles are drawn on a separate top layer regardless of y.

---

## 16. Interaction system

When player presses E (or Y on pad):
1. Compute the tile directly in front of player based on `player.dir`
2. Find any entity at that tile via `Engine.entitiesNear(state, frontPos, 0.5)`
3. If found and entity has `interact` handler: invoke
4. Otherwise check the tile type — `TOTEM` reads the totem hint, `SIGN` reads signpost, `BUSH` cuts (if sword equipped), `CHEST` opens, `INN` enters/exits
5. If none of the above: small "no" SFX (optional, easy to disable)

Adjacency is "directly facing"; player must auto-face is not done (LA convention: you must already face the thing to interact). This is intentional — players soon learn to nudge into NPCs, which feels right.

---

## 17. Date-keyed easter eggs

Single render-side function called once per render:

```js
function renderDateEggs(ctx, state) {
  const today = state.currentDate || new Date().toISOString().slice(0, 10);
  const [y, m, d] = today.split('-').map(Number);
  if (m === 12) renderSnowParticles(ctx, state);
  if (m === 10 && d >= 25 && d <= 31 && state.roomId === 'inn_room') renderPumpkinOnSill(ctx);
  if (m === 4  && d >= 1  && d <= 15 && state.scene === 'overworld') renderBlossomDrift(ctx, state);
  if (m === 1  && d === 1 && state.scene === 'title') renderFireworks(ctx, state);
}
```

`state.currentDate` is captured at session start so the eggs are stable for one play session even if the user plays through midnight. It updates only on `Engine.startNew` / `startContinue`.

For users who want a personal date trigger later, they edit one constant in the function (e.g., `if (m === 7 && d === 12) renderBalloons(ctx)`).

---

## 18. Cross-game cameos

Two specific cameos, both in PR3:

**Pac-Man pellet** — placed in a hidden screen `ow_4_3` (the unreachable-without-bombs corner). On tile-enter via player moving onto pellet:
- Pellet sprite (atlas item index, hand-pixeled to read as a tiny "○" with a yellow halo)
- Plays the actual `waka.wav` from `games/pacman/sounds/` via the audio bus (no copy; cross-references the existing asset path) — wait, actually, `games/pacman/sounds/` may not be relative-accessible from the embershore page. Safer: copy waka.wav into `games/embershore/sounds/cameo/` and respect the CC0 attribution.
- Awards 5 found, sets `state.cameosFound.pacman = true` (ephemeral, not persisted in v1)

**Chess piece on totem** — one totem in the village screen has a small white pawn carved on it (a tile variation in `terrain.png` with a tiny piece glyph). Reading the totem says: "Every game on this island remembers you played another." No mechanical reward. Pure dialogue flavor.

Both cameos are render + dialogue surface only — no engine state changes beyond a flavor flag.

---

## 19. PR1 build sequence — proving the room-scroll feel first

Strict build order. Each step ends in a runnable demo.

| Step | Build | What it proves |
|---|---|---|
| **0** | `index.html` shell + canvas + script tags (empty modules with `window.EmbershoreX = {}` stubs) | Page loads, fonts load, no console errors |
| **1** | `world.js` with 1 hand-authored room, `render.js` with tile bake + draw + atlas loading (placeholder programmatic terrain.png authored at boot via Canvas) | One static room renders. The 4× scale + image-rendering pixelated chain works. Tilemap baking pipeline functional. |
| **2** | `engine.js` createState + step + player entity, `entities.js` createPlayer, `input.js` keyboard, `game.js` rAF loop | Player moves around inside the room with arrow keys. Fixed-step loop validated. Walking feel established. |
| **3** | `render.js` HUD + sprite drawing + entity z-sort, player walk-frame animation | HUD overlays. Player sprite animates. Stand-still 6s leaf flourish in. |
| **4** | Multi-room: 4 connected rooms in `world.js`, room-scroll transition in engine + render | **The room-scroll feel proves out — go/no-go gate for PR1.** If room-scroll doesn't feel right, fix it now. |
| **5** | `input.js` gamepad, `audio.js` minimum (1 overworld track + 5 SFX) | Pad works. Music continues across room-scroll. SFX on step + interact. |
| **6** | NPC entity + `dialogue.js` + DOM dialogue overlay, `{name}` interpolation, 1 NPC scripted | Inn-keeper dialogue works. Painterly portrait renders. Typewriter feels right. |
| **7** | `ui.js` title screen + name-entry modal + pause menu + map screen (in-place from mockup CSS) | Full menu system. Fresh-game flow start to current room. |
| **8** | Save/load (`Engine.save` / `Engine.load`), auto-save hooks | Refresh page, continue lands at last room. Player state restored. |
| **9** | Dungeon room set (1 dungeon, 4 rooms + boss room), 1 enemy type, sword combat, 1 boss, sigil pickup, item-get pose | First dungeon end-to-end. Proves dungeon → boss → cutscene_sigil → exit pipeline. |
| **10** | Wake-in-inn fade flow, soft-reset, reduced-motion toggle | Death is cozy. Reduced motion preserves accessibility. |
| **11** | Date easter-egg trigger surface (with snow as the only one wired up, as a representative example) | Plumbing for all date-based content lands once. |
| **12** | Final pass: menu CSS polish from mockup verbatim, gallery card added to `games/index.html`, README + ADR updates | Ship-ready PR1. |

---

## 20. Highest-risk technical bets

### Risk 1: Room-scroll feel

The single most load-bearing visual of the game. If 280ms cubic feels wrong (too fast → jarring, too slow → annoying, wrong easing → mechanical), the entire game's mood collapses. Pac-Man has no equivalent so we have no precedent in the codebase.

**De-risking in PR1**:
- Build it as **step 4** of PR1 (early). If it doesn't feel right, we have time to iterate before adding content.
- Implement two debug toggles wired to keys: `[` and `]` to scrub `ROOM_SCROLL_FRAMES` between 8 and 30 in real-time, and `\` to cycle easing functions (cubic, quart, quint, smoothstep). Lets us tune by feel during PR1, then bake the chosen values for PR2.
- Music continuity test: walk a 4-room loop with overworld music. If music ever stutters or restarts, that's an audio integration bug, fix before locking the scroll mechanic.
- A/B test reduced-motion-on path: instant cut. Confirm reduced-motion players still get the room-by-room composition (not just one giant scrollable map).

### Risk 2: Sprite pipeline & art-vs-code coordination

Hand-pixeling 16×16 sprites is a real production cost. If PR1 gets stuck waiting for art, the whole project stalls. Conversely, if art ships and the engine isn't ready to receive it, art gets revised wastefully.

**De-risking in PR1**:
- **PR1 ships placeholder-only art** that I generate programmatically: 16×16 solid-color tiles in the Embershore palette, character as a 2-frame ember-tinted blob with a tiny dir-indicating face dot, NPCs as parchment-pebble silhouettes, enemies as terracotta blobs.
- The atlas loader is **schema-stable**: when you swap in hand-pixeled terrain.png, the engine and frame indices don't change. PNG file replacement is sufficient.
- Atlas conventions documented in this file (§10) so any future contributor (or you, in a later session) can author a new atlas without reading code.
- Gemini-painted portraits are **also placeholder in PR1** (a default face per NPC). The painted finals can drop in any time after PR1 lands.

This means PR1 ships looking utilitarian, not pretty. Intentional. The point of PR1 is proving the *engine* feel; the visual layer comes in waves on top. **The room-scroll, music continuity, and dialogue system** are what PR1 is graded on, not pixel quality.

---

## Open architectural decisions (none — all resolved)

Per Phase 3, three questions were asked and resolved:
- **Sprite delivery**: placeholder in PR1, hand-pixel finals on user's cadence ✅
- **Render scale**: 160×144 logical at 4× = 640×576 ✅
- **PR1 scope**: end-to-end vertical slice ✅

Plus the corrections:
- `SharedGamepad.BUTTONS` already exposes all 16 — no extension needed ✅
- Art split: 16×16 native pixel for playfield + Gemini-painterly for dialogue portraits ✅

**Approval requested before PR1 begins.** Once approved, build sequence above is the implementation order.
