# ADR-028 — Castle Tower Defense 3D

**Status:** Accepted, 2026-05-16. Implemented + cutover complete 2026-05-17.
**Supersedes:** [ADR-023](023-castle-tower-defense.md).

> ## Cutover note (2026-05-17)
> Phases 0 through 10 landed. The 2D `games/castle-tower-defense/` was deleted
> and the 3D folder renamed into the same slug at this commit. ADR-023 is
> marked Superseded. Documentation cross-references (ADR-029, map-editor.html,
> shared/storage.js) were updated to the new path. The new game runs at
> `/games/castle-tower-defense/` and is the canonical implementation.
>
> Notes on what shipped vs. spec:
> - Phase 1.7 audio: 13 SFX from Kenney CC0 packs landed; BGM + ambient
>   loops deferred (audio.js degrades gracefully when missing).
> - Phase 9.5 real-device mobile test: covered via Chrome DevTools MCP at
>   390×844 (deviceScaleFactor=3, mobile, touch); a real-phone LAN-devserver
>   test is still recommended before the next public deploy.
> - All §C/§M review findings landed as code (verified at each phase).

> This is the hardened spec for the 3D re-architecture of `games/castle-tower-defense/`. It encodes decisions from two adversarial reviews and is intended to be mechanically transcribable into code: file paths, data shapes with types, function signatures, and a granular task list. Where this spec and ADR-023 conflict, this spec wins.

---

## Table of contents

1. Context & goal
2. Pillars
3. Gameplay design
4. Architecture
5. File manifest
6. Data schemas
7. Function signatures
8. Engine return enums + caller contracts
9. Event types
10. Asset pipeline + icon-baking workflow
11. Audio direction + filter
12. UI / UX
13. Performance + real-device testing
14. Persistence + first-load notice
15. Migration, cutover, 2D refactor
16. Failure modes & risks
17. Spec-phase gate (must run before code)
18. Out of scope
19. Task list (phased, ralph-loop-sized)

---

## 1. Context & goal

The 2D Castle Tower Defense (ADR-023) shipped clean and works. The re-architecture goal is tonal and technological, not corrective: a 3D, asset-driven, Stardew-warm cozy tower defense built on Kenney's Tower Defense Kit (CC0) and a CC0 audio palette. The 2D version is replaced wholesale at cutover; the new code is inspired by the 2D module split but is fresh implementation.

**Hard constraints (CLAUDE.md):**
- Plain HTML/CSS/JS. No build step. No bundler. No backend.
- ESM via CDN is permitted (Three.js lives there).
- All third-party assets CC0 (no attribution-required without explicit on-site attribution).
- Mobile Safari 16.4+ and Chrome 89+ are required floors.
- Mobile-first; phone viewports (~360–430 px) must be playable, not just visible.

**Engineering priority (CLAUDE.md):** DRY > YAGNI > SOLID > KISS.

---

## 2. Pillars

Five pillars. Each is falsifiable.

| # | Pillar | Falsifiable test |
|---|--------|------------------|
| P1 | Cozy, not anxious | Any decision that adds time pressure the player didn't ask for fails. |
| P2 | Every placement feels deliberate | If a slot's value is interchangeable with the slot next to it, we have too many slots. |
| P3 | Readable at phone scale | At 360 px wide, a non-player can name tower types and identify dangerous enemies. |
| P4 | Asset-driven, not asset-fighting | If the kit lacks a mesh for an archetype, the archetype is dropped entirely (no relabeling). |
| P5 | Belongs at chases.house | Title screenshot reads as a sibling to Sudoku/Pacman/Crossword. |

---

## 3. Gameplay design

### Core loop
Day (build) → Night (wave) → twilight (clear) → repeat. Day/night is diegetic via lighting interpolation.

### Win / lose / score
- **Win:** survive all waves ≥ 1 life.
- **Lose:** lives reach 0 (with 900 ms grace before screen).
- **Score:** `(goldEarned − goldSpent) + lives × 100 + wavesCleared × 500`.
- **Stars (1–3):** 3 = no lives lost, 2 = ≥ half remaining, 1 = survived.

### Economy
- Per-enemy gold bounties.
- Per-wave clear reward.
- Sell refund 75% of cumulative invested gold.
- **No "send next wave early" bonus.** (Removed: contradicts P1; without a countdown the bonus rewarded impatience.)

### Wave progression
- 6–8 waves per map. Target session 6–10 min.
- Final wave on the last map: slow heavy **Captain** (no regen mechanic).

### Tower archetypes (4)

| Type | Behavior | Targets | Distinguishing trait |
|------|----------|---------|----------------------|
| `ranger` | projectile | all | Highest range, low DPS |
| `catapult` | projectile | ground only | Slow, AoE splash |
| `mage` | projectile | all | Magic (ignores armor); chains at higher tiers |
| `warden` | **aura** | n/a | Always-visible passive slow ring; no cooldown, no projectile |

3 tiers each. Tier visualization uses kit mesh variants (wood → stone → stone+detail). Top-tier twists: volley / bigger splash / more chains / larger radius + stronger slow.

### Enemy archetypes

| Type | Trait | Counter | Conditional on kit |
|------|-------|---------|---------------------|
| `footman` | baseline | any | required |
| `heavy` | high HP, slow | catapult AoE | required |
| `runner` | fast, fragile | warden + ranger | required |
| `shielded` | physical-armored | mage | drop if no shielded mesh |
| `skirmisher` | bypasses ground-only | mage / ranger | drop if no flying mesh — wave-3 surprise becomes a runner swarm |
| `captain` | high HP heavy hitter, final wave only | combined arms | drop if no large-humanoid mesh |

### Maps & difficulties
- **3 maps** for v1 (Plains, Forest, Mountain).
- **2 difficulties:** `quiet` and `spirited`. Spirited adds one extra wave with tougher composition. No third tier.
- **5–8 build slots per map** (down from 7–9 in 2D). Slots are visible kit pieces (stone plinths) at fixed world positions.
- **Baked polyline paths** in world space (x/z plane). No runtime pathfinding.

### Carried over from 2D (intact)
Polyline path baking · build slots · 75% sell · wave preview UI · gold/lives/stars/score system · reduced-motion accommodation · tutorial gating on map 1 wave 1 · castle-hit damage (1 normal, 5 for captain).

### Dropped from 2D
3rd difficulty tier · 10–11 wave length · boss regen mechanic · gamepad support (DELETED — see §15) · ink-bird parchment marginalia · all 2D audio · early-wave bonus · all 2D SVG sprites.

---

## 4. Architecture

### Module decomposition

| Module | Responsibility | Depends on |
|--------|---------------|------------|
| `game.js` | Boot · FSM · rAF tick · event delegation · audio bring-up · localStorage callsites | engine · scene · renderer · lighting · ui · input · audio · assets · maps · `/games/shared/storage` |
| `engine.js` | Pure sim: waves, economy, lives, tower behavior dispatch, projectile sim. Emits `state.events`. | entities · maps |
| `entities.js` | Data tables · factories · predicates · `TOWER_FIRE_SFX` table · `refreshTowerSnapshot` | — |
| `maps.js` | Map data · lookups (`byId`, `maxStars`) | — |
| `assets.js` | GLTFLoader cache · instance pools · shared materials · preload manifest · icon URL lookups | three |
| `renderer.js` | Three.js `WebGLRenderer` · camera · resize · DPR · low-power mode · blob-shadow path | three |
| `scene.js` | Scene-graph diff · `InstancedMesh` pools · range decals · Warden aura rings · gold popups | three · assets |
| `lighting.js` | Directional + hemisphere lights · day-night interpolation via `phaseTransition` events | three |
| `ui.js` | DOM HUD · palette · sheets · pause · end-of-run · map select · owns `goldDeficitFlash` UI state · first-load notice | entities · maps |
| `input.js` | Pointer (mouse + touch) · keyboard · gestures · **raycast hit-test** | three · scene |
| `audio.js` | Web Audio bus · sample loading · `flushEvents` event → SFX dispatch via `TOWER_FIRE_SFX` table | entities |
| `/games/shared/storage.js` *(NEW)* | `safeGet(key, default)` · `safeSet(key, value)` | — |

### Dependency arrows (one-way)
```
game ─→ engine ─→ entities, maps
   ├─→ scene ──→ assets
   ├─→ renderer (three)
   ├─→ lighting (three)
   ├─→ ui ────→ entities, maps
   ├─→ input ─→ scene
   ├─→ audio ─→ entities
   ├─→ assets
   └─→ /games/shared/storage
```

### Module pattern
`window.CTD3<Submodule>` per file (`window.CTD3Engine`, `window.CTD3Scene`, etc.). Same IIFE pattern as the rest of the site. Three.js is the one exception — imported as ES module via an `<script type="importmap">` block in `index.html`.

### State mutation flow
1. UI / input handler calls `actions.<name>(...)`.
2. Action calls `CTD3Engine.<mutator>(state, …)`; engine mutates state and pushes to `state.events`.
3. Next tick `game.consumeEngineEvents(state)` drains events to **audio + lighting + scene flourishes + ui flashes**.
4. `scene.sync(state)` and `ui.update(state)` diff state into presentation.

### Render loop vs. sim tick
`requestAnimationFrame` with 60 Hz fixed-step accumulator, cap 5 steps/frame. Page-visibility pause. Mobile perf trigger: rAF interval > 33 ms for 60 consecutive frames → `renderer.setLowPower(true)` (drops DPR to 1.0, disables PCF, switches to blob-shadow decals). Sim is not throttled.

---

## 5. File manifest

### New game (the 3D version)
All under `games/castle-tower-defense/` until cutover; renamed to `games/castle-tower-defense/` at merge.

```
games/castle-tower-defense/
├── index.html              page shell, importmap, inline CSS, <script> tags in dep order
├── game.js                 boot, FSM, rAF tick, event delegation, persistence
├── engine.js               pure sim — tower behavior dispatch, projectile sim, wave manager
├── entities.js             TOWERS/ENEMIES/DIFFICULTY tables, factories, refreshTowerSnapshot, TOWER_FIRE_SFX
├── maps.js                 3 hand-authored maps
├── assets.js               GLTFLoader cache, instance pools, icon URL lookup
├── renderer.js             WebGLRenderer, camera, resize, DPR, low-power mode
├── scene.js                Scene-graph diff, InstancedMesh pools, range/aura decals
├── lighting.js             Sun + hemi lights, day-night interpolation
├── ui.js                   DOM HUD, sheets, palette, map select, goldDeficitFlash
├── input.js                Pointer/keyboard/gestures, raycast hit-test
├── audio.js                Web Audio bus, SFX dispatch
├── assets/
│   ├── models/             GLB files from Kenney TD Kit (subset)
│   ├── icons/              12 pre-baked PNG tower thumbnails (64×64)
│   ├── audio/              13 SFX (.wav) + 1 BGM (.mp3 with .ogg fallback) + 1 ambient (.mp3)
│   ├── MANIFEST.json       Asset manifest (id/role/kind/path/variantTag) — single source of truth
│   ├── LICENSE.txt         Per-asset CC0 sources
│   └── README.txt          Re-baking workflow for icons
└── tools/
    └── bake-icons.html     One-shot dev page: loads GLBs, renders 64×64 thumbnails, triggers download
```

### Shared (new)
```
games/shared/storage.js     safeGet(key, default), safeSet(key, value)
```

### Modified (storage refactor)
```
games/castle-tower-defense/game.js       refactored to use shared/storage (2D regression-verified)
games/crossword/<files using localStorage>   migrated to shared/storage in a follow-up PR (out of scope for this ADR)
games/jeopardy/<files using localStorage>    same
games/pacman/<files using localStorage>      same
games/snake/<files using localStorage>       same
games/sudoku/<files using localStorage>      same
```
(2D CTD migration is **in-scope** for this ADR's Phase 0. Other migrations are recommended follow-ups but not blocking.)

### Doc updates
```
docs/adr/023-castle-tower-defense.md     add "Status: Superseded by ADR-028" header
docs/adr/028-castle-tower-defense-3d.md  this file
games/index.html                          gallery card hero swapped after cutover
CLAUDE.md                                 no change (slug preserved)
```

---

## 6. Data schemas

> Field names and types are normative. Sim fields use ms (number) for durations, world units (number) for positions. Presentation fields are denormalized snapshots refreshed by `refreshTowerSnapshot(tower)`.

### Tower entity
```ts
{
  id: string,                          // 'tw_1', 'tw_2', ...
  type: 'ranger' | 'catapult' | 'mage' | 'warden',
  behavior: 'projectile' | 'aura',     // string-tag dispatch in engine
  slotId: string,                      // 's1', 's2', ...
  x: number, y: number, z: number,     // world coords; y is up
  tier: 0 | 1 | 2,
  cooldownMs: number,                  // projectile only; ignored when behavior==='aura'
  lastFireMs: number,                  // projectile only

  // Snapshot of presentation/gameplay props (refreshed by refreshTowerSnapshot).
  // Populated on placement and on every upgrade. Scene reads these directly.
  range: number,                       // projectile only
  fireRate: number,                    // projectile only, shots/sec
  damage: number,                      // projectile only
  damageType: 'physical' | 'magic',    // projectile only
  splashRadius: number,                // projectile + has-splash only; 0 otherwise
  chains: number,                      // projectile + chain only; 0 otherwise
  projSpeed: number,                   // projectile only
  projKind: 'arrow' | 'cannonball' | 'magebolt',
  volley: number,                      // projectile only; default 1
  auraRadius: number,                  // aura only
  auraSlowMult: number,                // aura only; 0.4–0.65

  sceneRef: any                        // opaque — assigned by scene module
}
```

### Enemy entity
```ts
{
  id: string,                          // 'en_1', ...
  type: 'footman' | 'heavy' | 'runner' | 'shielded' | 'skirmisher' | 'captain',
  hp: number,
  maxHp: number,
  pathT: number,                       // [0,1] along map.path
  x: number, y: number, z: number,     // derived from pathT
  slowMs: number,                      // remaining slow duration
  slowMult: number,                    // 1.0 = no slow, <1 = slower
  freezeMs: number,                    // remaining freeze duration
  hitFlashMs: number,                  // remaining hit-flash visual duration
  regenSuppressedMs: number,           // captain only

  sceneRef: any                        // opaque — assigned by scene module
}
```

### Projectile entity
```ts
{
  id: string,                          // 'pr_1', ...
  kind: 'arrow' | 'cannonball' | 'magebolt',
  x: number, y: number, z: number,
  vx: number, vy: number, vz: number,
  ttlMs: number,
  damage: number,
  damageType: 'physical' | 'magic',
  splashRadius: number,                // 0 if not splash
  chainsLeft: number,                  // 0 if not chain
  hitIds: Set<string>,                 // enemies already hit (for chain/splash dedup)
  slowMs: number, slowMult: number,    // status payload
  freezeChance: number,
  fromTowerId: string,
  sceneRef: any
}
```

### Effect entity (purely visual; TTL-decayed)
```ts
{
  id: string,                          // 'fx_1', ...
  kind: 'goldPopup' | 'splash' | 'castleHit' | 'waveStart' | 'waveClear',
  x: number, y: number, z: number,
  ttlMs: number,
  totalTtlMs: number,                  // for fade interpolation
  text?: string,                       // goldPopup
  r?: number                           // splash radius
}
```

### Wave (data)
```ts
{
  enemies: Array<{
    type: EnemyType,
    count: number,
    spacing: number,                   // ms between spawns
    delay: number                      // ms from wave start
  }>,
  reward: number,                      // gold on clear
  isBoss: boolean
}
```

### Map (data, runtime shape)
```ts
{
  id: string,                          // 'plains', 'forest', 'mountain'
  displayName: string,
  roman: string,                       // 'Field the First'
  chip: string,                        // 'Open Field' / 'Sealed' / etc.
  chipKind: '' | 'gold' | 'locked',
  description: string,
  thumbIcon: string,                   // icon asset id
  unlockRequirement: number,           // stars threshold
  theme: 'plains' | 'forest' | 'mountain',

  // 3D world
  castle: { x: number, y: number, z: number },
  path: Array<{ x: number, z: number }>,           // y is implicit (ground)
  buildSlots: Array<{ id: string, x: number, z: number }>,

  // Baked at load time by engine.bakeMap(map):
  segmentLengths?: number[],
  cumulativeLengths?: number[],
  totalLength?: number,
  _baked?: boolean,

  waves: Wave[]
}
```

(Tile grid is an authoring-time artifact only — documented in `assets/README.txt`. It is NOT in the runtime map shape.)

### Run state (in-flight)
```ts
{
  fsm: 'title' | 'mapSelect' | 'prepWave' | 'inWave' | 'wonRun' | 'lostRun',
  paused: boolean,                     // orthogonal to fsm

  mapId: string,
  mapDef: Map,
  difficulty: 'quiet' | 'spirited',
  difficultyMult: { hpMult: number, startGold: number, startLives: number },

  gold: number,
  startingGold: number,
  goldEarned: number,
  goldSpent: number,

  lives: number,
  startingLives: number,

  waveIndex: number,
  waveTotal: number,
  waveProgress: null | { spawnQueue: Array<{ type, spawnAtMs }>, elapsedMs: number },
  fastForward: boolean,
  gameOverDelayMs: number,
  gameOverTriggered: boolean,

  towers: Tower[],
  enemies: Enemy[],
  projectiles: Projectile[],
  effects: Effect[],

  selectedSlotId: string | null,
  selectedTowerId: string | null,
  paletteSelection: TowerType | null,
  hoverSlotId: string | null,
  cursor: { x: number, z: number },

  tutorialActive: boolean,
  tutorialStep: 'showPrompt' | 'done',

  events: EngineEvent[]                // drained each tick by game.consumeEngineEvents
}
```

> **NOT in state:** `earlyBonusEligible` (removed — see review #2 C-2). `goldDeficitFlash*` (lives in `ui.js`-local).

### localStorage schemas
```
ctd3:scores    → { [mapId]: { [difficulty]: { stars: 0|1|2|3, bestScore: number } } }
ctd3:settings  → { musicVolume: number(0..1), sfxVolume: number(0..1), ambientVolume: number(0..1),
                   musicMuted: boolean, sfxMuted: boolean, reducedMotion: boolean, lowPowerForced: boolean }
ctd3:tutorialSeen → '1' (string flag)
ctd3:noticeSeen   → '1' (first-load notice dismissal flag — see §14)
```

### Asset manifest (`assets/MANIFEST.json`)
```ts
Array<{
  id: string,                          // 'tower_ranger_t1', 'enemy_footman', 'tile_path_straight', etc.
  role: string,                        // 'tower' | 'enemy' | 'tile' | 'prop' | 'castle' | 'icon' | 'audio'
  kind: 'mesh' | 'icon' | 'audio',
  path: string,                        // relative to assets/, e.g. 'models/towers/ranger_t1.glb'
  variantTag?: string                  // 'wood' | 'stone' | 'stone-detail' (for tower tier coloring)
}>
```

---

## 7. Function signatures

> Internal helpers are listed only when their signature is non-obvious. Module-level public surfaces are listed exhaustively.

### `games/shared/storage.js` → `window.SharedStorage`
```js
safeGet(key: string, defaultValue: any): any
  // Returns JSON-parsed value or defaultValue. On parse error: console.warn + return defaultValue.
  // On localStorage unavailable: return defaultValue silently.

safeSet(key: string, value: any): boolean
  // JSON.stringify + setItem. Returns true on success, false on quota/error (swallowed silently).
```

### `entities.js` → `window.CTD3Entities`
```js
TOWERS: Record<TowerType, TowerDef>                  // static data table
ENEMIES: Record<EnemyType, EnemyDef>                 // static data table
DIFFICULTY: { quiet: DiffMult, spirited: DiffMult }
TOWER_FIRE_SFX: Record<TowerType, string | null>    // declarative event→SFX map; warden = null

makeTower(type: TowerType, slotId: string, slotPos: {x,z}): Tower
  // Allocates id, sets behavior from TOWERS[type].behavior, calls refreshTowerSnapshot.

makeEnemy(type: EnemyType, hpMult: number): Enemy
makeProjectile(opts: ProjectileOpts): Projectile
makeEffect(kind: string, x: number, z: number, opts?: object): Effect

refreshTowerSnapshot(tower: Tower): void
  // Reads TOWERS[tower.type].tiers[tower.tier] and copies presentation/gameplay
  // properties onto the tower entity. Called by makeTower (initial) AND engine.upgrade (tier bump).
  // DRY: single source of truth for the snapshot.

towerInvested(type: TowerType, tierIndex: number): number
towerSellValue(type: TowerType, tierIndex: number): number
canTarget(towerDef: TowerDef, enemyDef: EnemyDef): boolean
applyDamage(enemy: Enemy, dmg: number, dmgType: string): number
```

### `maps.js` → `window.CTD3Maps`
```js
MAPS: Map[]                                          // 3 entries, frozen-ish
byId(id: string): Map | null
maxStars(): number                                   // MAPS.length * 3 * 2 (3 stars × 2 difficulties)
```

### `engine.js` → `window.CTD3Engine`
```js
createState(mapId: string, difficulty: 'quiet'|'spirited', opts?: { tutorial?: boolean }): State

bakeMap(map: Map): Map                               // idempotent; sets segmentLengths/cumulative/totalLength
sampleOnPath(map: Map, t: number): { x: number, z: number }

// Mutators — all return enum strings. See §8 for caller contract.
place(state: State, slotId: string, towerType: TowerType): 'ok' | 'occupied' | 'unaffordable' | 'invalid'
upgrade(state: State, towerId: string): 'ok' | 'unaffordable' | 'maxed' | 'invalid'
sell(state: State, towerId: string): 'ok' | 'invalid'
sendNextWave(state: State): 'ok' | 'invalid'
togglePause(state: State): void
setFastForward(state: State, on?: boolean): void

selectTower(state: State, towerId: string | null): void
selectSlot(state: State, slotId: string | null): void
setPaletteSelection(state: State, type: TowerType | null): void

// Helper for ui — replaces dropped `earlyBonusEligible` flag (review #2 C-2):
canSendNextWave(state: State): boolean               // state.fsm === 'prepWave' && !state.paused

step(state: State, dtMs: number): void               // orchestrator; calls below internally

computeScore(state: State): number
computeStars(state: State): 0 | 1 | 2 | 3

// Behavior dispatch table (private, see §M-1 fix):
BEHAVIOR_HANDLERS: { projectile: (state, tower, dtMs) => void,
                     aura:       (state, tower, dtMs) => void }

// Constants (private, exported for testing):
AURA_SLOW_FLOOR_MS: number                           // 250; minimum slow duration the aura sets per tick (NOT a refresh interval)
HIT_FLASH_MS, SPLASH_FX_MS, GOLD_POPUP_MS, CASTLE_FX_MS, DEFEAT_FRAMES_DELAY: number
```

### `assets.js` → `window.CTD3Assets`
```js
preload(): Promise<void>
  // Loads MANIFEST.json, fetches every mesh + icon. Resolves when critical path done.
  // Background-fetches the rest. Idempotent.

getMesh(id: string): THREE.Group                     // returns a clone of the cached GLB scene
getInstanced(id: string, capacity: number): InstancedMeshHandle
  // returns a handle that exposes setMatrixAt(i, matrix), setColorAt(i, color), commit().
  // Capacity may grow on demand (handle reallocates internally).

getIconUrl(towerType: TowerType, tier: 0|1|2): string  // 'assets/icons/ranger_t1.png' etc.
getMaterialAtlas(): THREE.MeshStandardMaterial          // shared material; called by scene
isReady(): boolean                                       // critical-path complete
onReady(cb: () => void): void                            // fires once; multiple subscribers OK
```

### `renderer.js` → `window.CTD3Renderer`
```js
init(canvasEl: HTMLCanvasElement): void
  // Creates WebGLRenderer, sets DPR per device, attaches resize listener.

getRenderer(): THREE.WebGLRenderer
getCamera(): THREE.OrthographicCamera

setLowPower(on: boolean): void
  // Drops DPR to 1.0, disables PCF shadows, signals scene.js to swap to blob shadows.

isLowPower(): boolean

renderFrame(scene: THREE.Scene): void                // called by game.js each rAF

// Perf monitor (private):
trackFrame(dtMs: number): void                       // called each rAF; triggers setLowPower(true) on 60-frame budget overrun
```

### `scene.js` → `window.CTD3Scene`
```js
init(): void                                         // creates scene, sky/ground, sets up registries

paintTerrain(map: Map): void                         // one-time per map: ground tiles, path tiles, castle, slot plinths
clearPlayfield(): void                               // removes per-run nodes; keeps assets warm

sync(state: State): void                             // entity diff: towers/enemies/projectiles/effects/ranges/auras

setHover(slotId: string | null, paletteSelection: TowerType | null): void
  // Drives placement-preview translucent mesh

raycastFromNormalizedPointer(nx: number, nz: number): RaycastHit | null
  // Returns { kind: 'slot'|'tower'|'empty', id?: string }. Used by input.js.

setLowPowerShadows(on: boolean): void                // swap PCF→blob decals
```

### `lighting.js` → `window.CTD3Lighting`
```js
init(scene: THREE.Scene): void
beginPhase(phase: 'prepWave' | 'inWave', durationMs?: number): void
  // Starts a tween from current to target. Default duration 1200 ms.
update(dtMs: number): void                           // ticks the active tween
```

### `ui.js` → `window.CTD3Ui`
```js
init(): void

setScreen(name: 'title' | 'map-select' | 'play' | 'pause' | 'game-over' | 'tutorial'): void

hydrateMapSelect(scores: object, isMapUnlocked: (id)=>bool, isHardUnlocked: (id)=>bool, totalStars: ()=>number): void
fillGameOver(opts: { won, mapName, difficulty, stars, livesRemaining, startLives, score, bestScore }): void

update(state: State): void                           // updates HUD + palette + tower-info + next-wave button
                                                     // also ticks goldDeficitFlash visual decay

setGoldFlash(on: boolean): void
  // Sets goldFlashUntilMs = performance.now() + 800 when on, 0 when off.
  // Decay is checked in update() against performance.now() — NOT setTimeout (review #2 C-3).

flashWaveClear(label: string): void                  // ribbon overlay
showFirstLoadNoticeIfNeeded(): void                  // see §14
setReducedMotion(on: boolean): void
```

### `input.js` → `window.CTD3Input`
```js
init(opts: { getState: () => State, actions: ActionsBag }): void
  // Attaches: keydown, pointerdown (mouse + touch), pointermove (hover), wheel (zoom), gesture handlers.

// Helpers (private):
pointerToWorld(ev: PointerEvent): { x: number, z: number } | null
handleSlotTap(slotId: string): void
handleTowerTap(towerId: string): void
```

(Gamepad code is **deleted** — no `pollGamepad`, no `rumble`, no `SharedGamepad` init. See §15.)

### `audio.js` → `window.CTD3Audio`
```js
ensure(): AudioContext | null
resume(): void
play(name: string, opts?: { gain?: number, rate?: number }): void
startBGM(): void
stopBGM(): void
startAmbient(): void
stopAmbient(): void
setMusicVolume(v: number): void
setSfxVolume(v: number): void
setAmbientVolume(v: number): void
setMusicMuted(m: boolean): void
setSfxMuted(m: boolean): void
flushEvents(events: EngineEvent[]): void              // see §9
getState(): { musicVolume, sfxVolume, ambientVolume, musicMuted, sfxMuted }
```

### `game.js` → `window.CastleTowerDefense`
```js
start(): void
// Actions bag (also exposed to input.js):
actions: {
  go(screen): void,
  selectTower(type): void,
  selectSlot(slotId): void,
  selectTowerInstance(towerId): void,
  upgrade(): void,
  sell(): void,
  sendNextWave(): void,
  toggleFastForward(): void,
  pause(): void,
  resume(): void,
  restart(): void,
  nextMap(): void,
  dismissTutorial(): void
}
// Test hook (gated by ?test=1):
_test?: { getState(), setLives(n), grantGold(n), jumpToWave(idx) }
```

---

## 8. Engine return enums + caller contracts

> The mutator return values are part of the public API. The caller MUST handle each case as specified.

### `place(state, slotId, towerType)`
| Return | Meaning | Caller behavior |
|--------|---------|-----------------|
| `'ok'` | Tower placed, gold deducted | Clear paletteSelection, no flash. (Engine already clears.) |
| `'occupied'` | Slot already has a tower | **Silent.** No flash. (Future polish: subtle shake.) |
| `'unaffordable'` | Tower cost > gold | `ui.setGoldFlash(true)`. |
| `'invalid'` | Bad FSM (wonRun/lostRun) OR unknown towerType OR slotId not on map | **Silent.** Caller bug or off-grid raycast — no user-facing feedback. |

### `upgrade(state, towerId)`
| Return | Meaning | Caller behavior |
|--------|---------|-----------------|
| `'ok'` | Tier bumped, gold deducted, snapshot refreshed | None |
| `'unaffordable'` | Next tier cost > gold | `ui.setGoldFlash(true)` |
| `'maxed'` | Already at tier 2 | **Silent.** (Button is disabled in this state anyway.) |
| `'invalid'` | towerId not found OR FSM wrong | **Silent.** |

### `sell(state, towerId)`
| Return | Meaning | Caller behavior |
|--------|---------|-----------------|
| `'ok'` | Tower removed, refund credited | None |
| `'invalid'` | towerId not found | **Silent.** |

### `sendNextWave(state)`
| Return | Meaning | Caller behavior |
|--------|---------|-----------------|
| `'ok'` | Wave started | None (event emission handles audio cues) |
| `'invalid'` | Not in prepWave OR paused OR tutorialActive | **Silent.** (Button is disabled.) |

---

## 9. Event types (`state.events`)

`game.consumeEngineEvents(state)` drains the queue each tick and dispatches to subscribers.

| `kind` | Payload | Consumers |
|--------|---------|-----------|
| `place` | `{ towerType, towerId }` | audio (build_place) |
| `upgrade` | `{ towerId }` | audio (upgrade) |
| `sell` | `{ towerId }` | audio (sell) |
| `fire` | `{ towerType }` | audio (`TOWER_FIRE_SFX[towerType]`, may be null) |
| `hit` | `{ enemyId, damage }` | audio (enemy_hit) |
| `kill` | `{ enemyType }` | audio (enemy_death) |
| `castleHit` | `{ enemyType }` | audio (castle_hit) |
| `waveStart` | `{ waveIndex, isBoss }` | audio (wave_start_horn) · lighting (`beginPhase('inWave')`) |
| `waveClear` | `{ waveIndex }` | audio (wave_clear) · ui (`flashWaveClear`) · lighting (`beginPhase('prepWave')`) |
| `victory` | `{}` | audio (victory) |
| `defeat` | `{}` | audio (defeat) |
| `phaseTransition` | `{ from, to }` | **lighting only in v1.** (Audio crossfade is a future ADR.) |

> Note: `phaseTransition` is emitted as a separate event from `waveStart`/`waveClear` to decouple lighting from wave semantics — a future feature (e.g., manual day skip) can emit `phaseTransition` without a wave context.

---

## 10. Asset pipeline + icon-baking workflow

### Models
- Format: **GLB** (binary GLTF). If the kit ships only .obj/.fbx, a one-time manual conversion (offline, any 3D tool) produces GLBs committed to the repo. This is not a build step.
- Loader: Three.js `GLTFLoader`, ESM imported.
- Cache: `assets.js` holds `Map<id, THREE.Group>` of parsed scenes; clones issued on request.
- Instancing: every repeated mesh (path tiles, enemies of a given type) goes through `THREE.InstancedMesh` via `assets.getInstanced(id, capacity)`. Capacity grows on demand.
- Materials: single shared `MeshStandardMaterial` per atlas, assigned via `assets.getMaterialAtlas()`. Assumes Kenney's standard atlas pattern (verified in Phase 1 of §19).

### Audio
- `.wav` SFX, `.mp3` BGM (.ogg fallback for browsers that prefer it).
- Pipeline: `fetch` + `decodeAudioData`, eager fetch on first user gesture (autoplay-policy compliant).
- Layout: `assets/audio/`.

### Pre-baked PNG icons (review #2 M-6)
12 files (4 towers × 3 tiers), 64×64 PNG, transparent background, at `assets/icons/<type>_t<n>.png` (e.g. `ranger_t1.png`).

**Baking workflow** — fully specified, not hand-waved:
1. `tools/bake-icons.html` is a one-shot dev page. Open it in a browser locally.
2. The page loads each tower GLB at each tier, positions Three.js camera identically to the in-game camera but framed tight on the mesh, renders to a 64×64 offscreen `<canvas>`, calls `canvas.toBlob` → `URL.createObjectURL` → triggers a download with the standardized filename.
3. Move the 12 downloaded PNGs into `assets/icons/`.
4. Re-run any time tier meshes change.

The tool is committed but is NOT loaded by the game. Zero runtime cost. Manual but trivial and reproducible.

### First-paint streaming
- **Critical path** (~10 GLBs + 12 PNGs + HUD font, ~600 KB combined): one ground tile, one path tile, castle, one tower mesh, one enemy mesh, plus all icons. Loaded before title screen interactive.
- **Background fetch:** the full kit subset while the user is on title / map-select.
- **Play-screen block:** the chosen map's full asset set must be loaded before play begins. Loading bar shown.

### Budgets (hard caps; spec-phase verification per §17)
- GLBs (uncompressed total): **≤ 8 MB**
- Audio: **≤ 3 MB**
- Icons: **≤ 100 KB**

### Drop order if over budget
Decorative props → tier-2 mesh variations → enemy variety (in that order).

---

## 11. Audio direction + filter

### "Stardew-warm" filter (audit criteria)
A candidate is acceptable iff **all** of:
1. **Instrumental palette** led by acoustic instruments (piano / acoustic guitar / harp / flute / fiddle / light strings / accordion). No overdriven electric, no chiptune squarewaves, no aggressive synths, no heavy brass.
2. **Mood:** predominant major key or modal (lydian / dorian / mixolydian). Minor allowed only for night/boss/loss; reflective minor, not aggressive.
3. **Tempo:** 60–110 BPM for music; ≤ 1 s for clicks/UI, ≤ 2.5 s for stingers.
4. **Production:** ≥ 44.1 kHz; RMS ≈ −16 to −20 LUFS; peak ≤ −3 dBFS; no harsh transients.
5. **Loop quality (music only):** bar-aligned, click-free seam.
6. **License: CC0 only** for v1.

### Candidate sources
- **Kenney** (CC0, verified on kenney.nl):
  - RPG Audio (50 files) — bowshots, weapon thuds
  - UI Audio (50) — soft clicks/switches
  - Impact Sounds (130) — thuds for build/place/sell/hit/death
  - Music Jingles (85) — stingers
- **OpenGameArt** (CC0 only, search "medieval folk loop," "pastoral")
- **Freesound** (CC0 ambient — birdsong + wind + crickets for the ambient bed)
- **Pixabay Music** (per-track CC0 verification required)

### SFX inventory (13 events)
| Event | Source category | Notes |
|-------|----------------|-------|
| `ui_click` | UI Audio | Softest click variant |
| `ui_back` | UI Audio | Softest switch |
| `build_place` | Impact Sounds | Wooden thud / stone-set |
| `sell` | UI Audio | Descending two-note |
| `upgrade` | UI Audio | Ascending two-note + chime |
| `ranger_fire` | RPG Audio | Bowshot |
| `cannon_fire` | RPG Audio | Muffled boom |
| `mage_fire` | RPG Audio | Soft magic shimmer |
| `enemy_hit` | Impact Sounds | Cloth / leather thud |
| `enemy_death` | Impact Sounds | Heavier thud + coin chime |
| `castle_hit` | Impact Sounds | Door thud + low rumble |
| `wave_start_horn` | Music Jingles | Gentle horn (warm, not battle) |
| `wave_clear` | Music Jingles | 2–3 s major-key stinger |

(No `warden_aura_loop` — Warden is visually silent; the ring is the feedback.)

### Declarative dispatch table (in `entities.js`)
```js
TOWER_FIRE_SFX = {
  ranger:   'ranger_fire',
  catapult: 'cannon_fire',
  mage:     'mage_fire',
  warden:   null            // aura tower — emits no fire event
}
```
`audio.flushEvents` for `'fire'`: `const sfx = TOWER_FIRE_SFX[ev.towerType]; if (sfx) play(sfx);`

### Music + ambient
- **BGM:** ~120 s loop, acoustic + ~80 BPM modal major.
- **Ambient bed:** 30 s outdoor loop (birds + wind + crickets) at 25 % of music gain.

### Defaults
Music 0.40 · SFX 0.80 · Ambient 0.25 × music (i.e. 0.10 absolute).

---

## 12. UI / UX

### Screens
Title · Map select · In-game HUD · Pause · End-of-run · Settings · How-to-play.

### Mobile portrait (~390 × 844)
```
┌──────────────────────────────┐
│ Gold 120   Wave 3/8   ⚙      │  top bar 44 px
├──────────────────────────────┤
│                              │
│         3D scene             │
│        (full viewport)       │
├──────────────────────────────┤
│ [R] [C] [M] [W]  ▶ Send wave │  bottom bar 96 px
└──────────────────────────────┘
```
Bottom-anchored action sheet rises on slot tap (tower-select) or tower tap (upgrade/sell). Sheet dims scene to 60 %.

### Desktop landscape
Palette becomes vertical strip on left. Tower-info sheet slides in from right. Hover shows range continuously.

### Interaction map

| Action | Mobile | Mouse/Keyboard |
|--------|--------|----------------|
| Select tower type | Tap palette card | Click card / `1`–`4` |
| Place tower | Tap slot | Click slot |
| Select placed tower | Tap mesh | Click mesh |
| Upgrade | Sheet button | Button / `U` |
| Sell | Sheet button | Button / `S` |
| Pause | Cog | `Esc` / `Space` |
| Zoom | Pinch | Wheel |
| Send next wave | Bottom button | Button / `N` |
| Fast-forward | 2× button | `F` |

**No long-press · no double-tap · no pan.**

### Diegetic (in-scene)
Range circles as ground decals · placement preview as translucent mesh · 3D billboard gold popups · Warden aura ring always-visible · day/night light interpolation.

### Overlay (HTML/CSS)
Top bar · palette (using pre-baked PNG icons) · sheets · pause · end-of-run · how-to-play.

### Site-aligned styling
- Fraunces for screen titles ("Castle Tower Defense", "Victory")
- Bricolage Grotesque for HUD numerics
- Canvas-bg `#0a0a0b`
- Gold `#c8943e` accent · ember `#a06828` warning · terracotta `#b05a3a` for boss/defeat

### Tutorial
Three popups on map-1 wave-1: "Tap a slot" → "Tap a tower in the palette" → "Tap 'Send wave' when ready." Gated by `ctd3:tutorialSeen`.

### Wave-clear flourish (review #2 m-2 — bird mesh dropped)
A thin **gold-bar wipe** across the scene (CSS keyframe overlay over the canvas) + a 600 ms golden-light brightness pulse on the directional light. No new mesh assets. Reduced-motion skips both.

### First-load notice (review #2 m-4)
On `start()`: if `localStorage` contains `ctd:scores` AND `ctd3:noticeSeen !== '1'`, `ui.showFirstLoadNoticeIfNeeded()` displays a dismissible banner:

> **Fresh start.** This is the rebuilt 3D Castle Tower Defense — your old scores don't carry over.

On dismiss: `SharedStorage.safeSet('ctd3:noticeSeen', '1')`.

---

## 13. Performance + real-device testing

### Frame budget
- **30 fps** mid-range Android, **60 fps** desktop.
- **≤ 80 draw calls/frame** — instancing mandatory for repeated meshes.
- **≤ 50 k triangles/frame.**
- **Sim tick ≤ 4 ms · Scene sync ≤ 6 ms.**

### Mobile defaults
- DPR clamped: desktop ≤ 2, mobile ≤ 1.5.
- MSAA off · FXAA desktop only.
- Single directional shadow caster (PCF 1024² desktop / 512² mobile).
- Hemi light for ambient.

### Perf trigger (auto low-power)
`renderer.trackFrame(dtMs)` watches rAF interval. If > 33 ms for **60 consecutive frames** → `renderer.setLowPower(true)`:
- DPR → 1.0
- PCF shadows off
- `scene.setLowPowerShadows(true)` (blob decals replace shadow casters)

Manual override via Settings → "Force low-power mode" → `ctd3:settings.lowPowerForced = true`.

### Real-device testing protocol (review #2 M-5)
**Local LAN devserver, phone on same WiFi.** Mandatory before merge.

1. `npx serve -p 3003` (or `python -m http.server 3003`) from repo root.
2. Find dev machine's LAN IP (e.g. `192.168.1.42`).
3. On phone, navigate to `http://192.168.1.42:3003/games/castle-tower-defense/`.
4. Test on **at least one real mid-range Android** (≥ 3 years old). Measure FPS via the built-in `?test=1` overlay (added in Phase 9; see task list).
5. Verify perf trigger fires correctly when forced (simulate via DevTools CPU throttling).
6. Verify touch tap-targets ≥ 44 px.

This is a merge gate, not a nice-to-have.

---

## 14. Persistence + first-load notice

### Storage helper (`/games/shared/storage.js`)
```js
window.SharedStorage = {
  safeGet(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[storage] safeGet failed for', key, e);
      return defaultValue;
    }
  },
  safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[storage] safeSet failed for', key, e);
      return false;
    }
  }
};
```
- `console.warn` on parse error (explicit, not silent — review #2 m-3).
- Returns `defaultValue` on missing key (raw === null) without warning.

### Keys
| Key | Shape | Notes |
|-----|-------|-------|
| `ctd3:scores` | `{[mapId]: {[difficulty]: {stars, bestScore}}}` | Only overwrites if new is better |
| `ctd3:settings` | settings blob (see §6) | All audio + a11y prefs |
| `ctd3:tutorialSeen` | `'1'` | Single-flag string |
| `ctd3:noticeSeen` | `'1'` | First-load notice dismissed |

### First-load notice
- Trigger: `localStorage.getItem('ctd:scores') !== null && SharedStorage.safeGet('ctd3:noticeSeen', null) !== '1'`.
- Banner copy in §12.
- On dismiss: `SharedStorage.safeSet('ctd3:noticeSeen', '1')`.

### 2D scores are NOT migrated
Deliberate. The 3D map structure (different wave counts, different slot configs) makes a migrated star rating meaningless. `ctd:*` keys orphan in browsers (< 1 KB, harmless). The 3D game does not read them.

---

## 15. Migration, cutover, 2D refactor

### Branch strategy
- Develop on branch `refactor/castle-tower-defense-3d` (already exists).
- 2D on `main` untouched throughout except for the storage extraction (Phase 0).
- **Real-device testing during dev** via LAN devserver (§13).

### Phase 0 (the 2D refactor; merges to main FIRST, separately)
1. Create `games/shared/storage.js`.
2. Refactor `games/castle-tower-defense/game.js` to use `SharedStorage`.
3. **Run CLAUDE.md MCP verification protocol against 2D:** boot dev server, navigate to `/games/castle-tower-defense/`, play through one map (or use `?test=1` jumpers), verify `ctd:scores` persists across reload, zero console errors. **This is a merge gate.** (Review #2 M-4.)
4. Merge to main.

### Phase 1+ (the 3D build)
Phases 1–9 land on `refactor/castle-tower-defense-3d`. Reviewed iteratively but **not merged until the full cutover PR**.

### Cutover (Phase 10, single atomic PR)
1. Delete `games/castle-tower-defense/` entirely.
2. Move `games/castle-tower-defense/` → `games/castle-tower-defense/`.
3. Update `games/index.html` gallery card with new hero screenshot.
4. Mark ADR-023 as "Status: Superseded by ADR-028" with a one-paragraph context note.
5. Add bidirectional link.
6. Final verification: full §13 protocol + Chrome DevTools MCP protocol per CLAUDE.md.
7. Merge.

The new code takes the same slug. External links survive. Bookmarks survive. No URL transition state.

### Gamepad removal (review #2 m-6)
The 3D `game.js` and `input.js` are written from scratch and contain none of:
- `actions.gamepadConfirm`, `actions.gamepadCancel`, `actions.cyclePalette`
- `window.CTDInput.pollGamepad`, `window.CTDInput.rumble`
- `window.SharedGamepad` init or import
- Any `consumeEngineEvents` branches that call `CTDInput.rumble`
- The `input.js` `pollGamepad` / `moveCursor` cursor-snap logic

These are explicitly absent from the file manifest in §5. Re-adding gamepad in a future ADR is new feature work.

---

## 16. Failure modes & risks

| # | Risk | Mitigation |
|---|------|------------|
| 1 | Mobile WebGL frame budget | DPR cap, mandatory instancing, single dir shadow, FXAA off mobile, page-vis pause, real-device test (§13). |
| 2 | GLTFLoader CDN drift | Pin Three.js minor version; code comment with "last verified" date. |
| 3 | Touch raycast precision on small slot meshes | Invisible ~80×80 collider planes above slot meshes — raycast against those, not the mesh. |
| 4 | iOS Safari audio autoplay | First-click `audio.resume()`. Ambient is opt-in (default-on but mute-able). |
| 5 | GLTF version compat | Prefer GLB. One-time manual conversion if kit ships only .obj/.fbx. |
| 6 | Asset payload bloat | Hard 8 MB budget. Drop order: props → tier-2 variations → enemy variety. |
| 7 | iOS < 16.4 unsupported | Documented as required floor. No fallback. |
| 8 | Cloudflare cache on chases.house | Standard post-deploy purge applies. |
| 9 | Audio licensing | Per-file CC0 verification + `assets/LICENSE.txt`. |
| 10 | Cozy reframe loses 2D iconic moments | Cozy applies *between* waves; within-wave difficulty stays real. |
| 11 | 3D camera disorientation on mobile | Zoom-only camera, no pan; tip on first encounter. |
| 12 | Range vis on 3D ground | Maps flat (no elevation); alpha-blended ring decal unambiguous. |
| 13 | InstancedMesh per-instance hit-flash | `InstancedMesh.setColorAt(index, color)`. |
| 14 | Memory leaks on restart | Scene clears entity registries; assets cache stays warm. |
| 15 | `phaseTransition` event fan-out | Lighting consumes only in v1. Audio crossfade is a future ADR. |
| 16 | Aura+Frost slow stacking ambiguity | `stepAuras` uses `min(slowMult)` and `max(slowMs)` so the stronger slow always wins. Documented in `engine.js` near `AURA_SLOW_FLOOR_MS`. |
| 17 | Snapshot drift if upgrade forgets to refresh | `refreshTowerSnapshot` is mandatory in both `makeTower` and `engine.upgrade`; covered by integration test (place + upgrade + verify scene reflects new range). |

---

## 17. Spec-phase gate (must run before code)

**Phase 1 deliverable** — verify kit before writing engine code.

1. Download Kenney's Tower Defense Kit from kenney.nl/assets/tower-defense-kit. Confirm CC0.
2. Inventory every GLB by category (tile / tower / enemy / prop / castle). Record file size + triangle count per file.
3. Map against §3 archetype tables. For each conditional archetype (`shielded`, `skirmisher`, `captain`), confirm or drop.
4. Verify single-atlas material assumption (open one GLB in a viewer; if multiple textures across the kit, revise `assets.getMaterialAtlas()` to return a `Map<atlasId, Material>`).
5. Sum used-subset GLB sizes; confirm ≤ 8 MB.
6. **Hard gate (review #2 m-5):** if fewer than 3 of 4 tower archetypes can be confirmed from the kit, escalate to a design decision before any code is written. The §3 tower roster may need revision.

Phase 1 produces `assets/MANIFEST.json` as its primary deliverable. Without it, Phase 2 cannot start.

---

## 18. Out of scope

Items explicitly NOT in v1, with origin (R = review, P = pillar, A = author):

- **Gamepad support** — DELETED (R) — re-adding is new feature work.
- Online / cross-game leaderboards (A).
- Multiplayer (A).
- Sandbox / free-build / map editor (A).
- Daily seed / procgen waves (A).
- Persistent meta-progression beyond map gating (A).
- Replay export (A).
- Localization (A).
- VR / 6DoF (A).
- Mods beyond `maps.js` (A).
- Bestiary screen (A).
- Shareable result card (A).
- Camera orbit / free fly (P1).
- **Camera pan** (R) — no big maps in v1.
- **Send-next-wave early bonus** (R) — contradicts P1.
- **`warden_aura_loop` SFX** (R) — silent aura, visual ring is the feedback.
- **Offscreen-rendered palette icons** (R) — pre-baked PNGs only.
- **Per-wave music override** (R) — not in v1 data model.
- **UMD importmap fallback** (R) — single loading path, iOS 16.4+ required.
- **Skirmisher / Captain / Shielded archetypes** — conditional on kit (P4).
- **Wave-clear 3D bird flourish** (R) — replaced with gold-bar wipe + light pulse (no new asset).
- Battery-aware perf scaling beyond `setLowPower(true)` (A).
- Skeletal animation on enemies (A) — translate + bob only.
- Particle systems beyond sprite-quads (A).
- Asset hot-reload (A).
- Manual graphics-quality toggle beyond "force low-power" (A).
- Save/resume mid-run (A).
- Achievements (A).
- Cloud save (A).
- **Audio crossfade on `phaseTransition`** (R m-1) — future ADR.
- Migration of 2D scores (R m-4) — first-load notice instead.

---

## 19. Task list (phased, ralph-loop-sized)

> Each task is a single-PR-sized unit. Phases are ordered; tasks within a phase may parallelize.
> Phase 1 MUST complete before Phase 2 starts (asset gate).
> Phase 0 ships to main independently of the rest.

### Phase 0 — Pre-work (ships to main first)
- [ ] **0.1** Create `games/shared/storage.js` per §14 implementation. Test in isolation.
- [ ] **0.2** Refactor `games/castle-tower-defense/game.js` to use `SharedStorage`. Remove the six local try/catch wrappers. Update the localStorage-7th-caller code comment to reference §15 of this ADR.
- [ ] **0.3** Run CLAUDE.md MCP verification protocol against 2D CTD. Boot dev server, navigate to `/games/castle-tower-defense/`, play tutorial + first wave, reload, verify scores persist. Zero console errors, all network 200. Screenshot to `docs/screenshots/`. **Merge gate.**
- [ ] **0.4** Open follow-up issue noting other 6 games (crossword, jeopardy, pacman, snake, sudoku, etc.) could be migrated to `SharedStorage` in future ADR.
- [ ] **0.5** Merge Phase 0 PR to main.

### Phase 1 — Spec gate (must complete before code)
- [ ] **1.1** Download Kenney TD Kit. Confirm CC0. Note version (e.g. 2.1).
- [ ] **1.2** Inventory every GLB by category. Record file size + tri count in a working doc.
- [ ] **1.3** Map kit meshes against §3 archetype tables. Mark conditional archetypes as confirmed or dropped.
- [ ] **1.4** Verify single-atlas material assumption (open a GLB in any viewer). If false, note revised material strategy.
- [ ] **1.5** Sum used-subset sizes. Confirm ≤ 8 MB. If over, apply §10 drop order.
- [ ] **1.6** **Hard gate check:** if < 3 of 4 tower archetypes confirmable, ESCALATE — do not continue.
- [ ] **1.7** Audition CC0 audio candidates against §11 filter. Pick: 1 BGM, 1 ambient, 13 SFX. Verify CC0 per file.
- [ ] **1.8** Produce `assets/MANIFEST.json` listing every model + icon + audio that will ship. This file is the Phase 1 deliverable.

### Phase 2 — Foundation
- [ ] **2.1** Create `games/castle-tower-defense/` directory. Author `index.html` shell: HTML doctype, `<meta viewport>`, font preconnect (Fraunces + Bricolage), `<script type="importmap">` with pinned Three.js URL, inline CSS skeleton with site tokens.
- [ ] **2.2** Stub all 11 JS module files with the IIFE pattern and empty `window.CTD3<Module>` exports. Wire `<script>` tags in dep order in `index.html`.
- [ ] **2.3** Commit Kenney GLBs (per `MANIFEST.json`) to `assets/models/`. Commit CC0 audio to `assets/audio/`. Commit `assets/LICENSE.txt` with per-file source attribution.
- [ ] **2.4** Build `tools/bake-icons.html` per §10 workflow. Bake 12 icons. Commit PNGs to `assets/icons/`. Commit the tool. Commit `assets/README.txt` documenting the workflow.
- [ ] **2.5** Implement `assets.js`: GLTFLoader cache, `preload()`, `getMesh`, `getInstanced`, `getIconUrl`, `getMaterialAtlas`. Test by loading one GLB and logging the scene tree.

### Phase 3 — Engine
- [ ] **3.1** Implement `entities.js`: `TOWERS`, `ENEMIES`, `DIFFICULTY`, `TOWER_FIRE_SFX` tables. Factories: `makeTower` (calls `refreshTowerSnapshot`), `makeEnemy`, `makeProjectile`, `makeEffect`. Predicates: `canTarget`, `applyDamage`. Snapshot helper: `refreshTowerSnapshot`.
- [ ] **3.2** Implement `maps.js`: 3 hand-authored maps (path polylines in x/z, slot positions, castle position, theme tags, wave scripts). `byId`, `maxStars` helpers.
- [ ] **3.3** Implement `engine.js` core: `createState`, `bakeMap`, `sampleOnPath`.
- [ ] **3.4** Implement engine mutators with return enums per §8: `place`, `upgrade` (calls `refreshTowerSnapshot`), `sell`, `sendNextWave`, `togglePause`, `setFastForward`, selection helpers, `canSendNextWave`.
- [ ] **3.5** Implement engine tick orchestrator: `step(state, dtMs)`. Implement `BEHAVIOR_HANDLERS` dispatch table per §M-1. Implement `stepProjectileTower`, `stepAuraTower` (uses `AURA_SLOW_FLOOR_MS`).
- [ ] **3.6** Implement enemy movement (`stepEnemies`), projectile sim (`stepProjectiles`, hits/splash/chain), wave dripper (`stepWave`), wave-clear/loss detection, effect decay. Emit `state.events` for all kinds in §9, including `phaseTransition`.
- [ ] **3.7** Unit-test engine in isolation via `?test=1` jumpers: `getState`, `setLives`, `grantGold`, `jumpToWave`. Verify aura slows enemies in radius; verify snapshot refresh on upgrade.

### Phase 4 — Presentation: renderer, scene, lighting
- [ ] **4.1** Implement `renderer.js`: `init(canvasEl)`, `WebGLRenderer` with shadow map, orthographic camera positioned per §3, resize handler, DPR clamp, `setLowPower` toggling, `trackFrame` perf monitor, `renderFrame`.
- [ ] **4.2** Implement `lighting.js`: directional + hemisphere lights, `beginPhase` tween, `update`. Subscribe to `phaseTransition` events (handled in `game.consumeEngineEvents`).
- [ ] **4.3** Implement `scene.js` core: scene-graph init, ground plane, sky color, `paintTerrain(map)` (path tiles + slot plinths + castle from assets), `clearPlayfield`.
- [ ] **4.4** Implement `scene.sync(state)`: tower diff (place/remove/upgrade-swap-mesh), enemy diff (using `InstancedMesh` per type, `setMatrixAt` for transforms, `setColorAt` for hit-flash), projectile diff, effect diff.
- [ ] **4.5** Implement scene decals: range ring on selected tower, placement-preview translucent mesh, Warden aura ring (read `tower.auraRadius`).
- [ ] **4.6** Implement `setHover`, `setLowPowerShadows` (blob-decal swap).
- [ ] **4.7** Implement raycast hit-test on invisible collider planes above slot meshes (~80×80 world units). Returns `{kind, id}`.

### Phase 5 — UI
- [ ] **5.1** Author `index.html` overlay HTML: top bar, palette, bottom controls, action sheets (slot-tap / tower-tap), pause overlay, end-of-run overlay, map-select grid, title, how-to-play. Inline CSS with site tokens, mobile-first layout per §12.
- [ ] **5.2** Implement `ui.js`: `init`, `setScreen`, `hydrateMapSelect`, `fillGameOver`, `update(state)` (HUD + palette + tower-info + next-wave button using `canSendNextWave`).
- [ ] **5.3** Implement `ui.setGoldFlash`: sets `goldFlashUntilMs = performance.now() + 800`. Decay in `update()` against `performance.now()` (NOT `setTimeout` — see §C-3).
- [ ] **5.4** Implement `ui.showFirstLoadNoticeIfNeeded()` per §14. Wire dismiss handler.
- [ ] **5.5** Implement `flashWaveClear` (gold-bar wipe + light pulse trigger; no birds), `setReducedMotion`.

### Phase 6 — Input
- [ ] **6.1** Implement `input.js`: `init`, keyboard handlers (`Esc`, `Space`, `1`–`4`, `U`, `S`, `N`, `F`).
- [ ] **6.2** Implement pointer handlers: pointerdown → raycast → action dispatch. Pointermove → hover state. Wheel → zoom (desktop). Pinch → zoom (mobile, two-pointer tracking).
- [ ] **6.3** Verify on touch: tap targets, sheet interactions, palette selection. Verify no gamepad code present.

### Phase 7 — Audio
- [ ] **7.1** Implement `audio.js`: Web Audio bus (`master → music + sfx + ambient`), lazy buffer load.
- [ ] **7.2** Implement `play`, `startBGM`/`stopBGM`, `startAmbient`/`stopAmbient`, volume setters.
- [ ] **7.3** Implement `flushEvents` per §9 event map. Use `TOWER_FIRE_SFX[ev.towerType]` for `'fire'`.

### Phase 8 — Boot + integration
- [ ] **8.1** Implement `game.js`: `start()`, FSM transitions, `requestAnimationFrame` tick with fixed-step accumulator, page-visibility pause, document event delegation, first-click audio bring-up.
- [ ] **8.2** Implement `actions` bag wiring engine mutators to UI. Wire `consumeEngineEvents` dispatch to `audio.flushEvents`, `lighting.beginPhase`, `ui.flashWaveClear`, `ui.setGoldFlash`.
- [ ] **8.3** localStorage wiring via `SharedStorage`: `loadScores`/`saveScores`/`loadSettings`/`saveSettings`/`tutorialSeen`/`markTutorialSeen`/`commitResult`.
- [ ] **8.4** End-to-end smoke: title → map-select → start map → place tower → walk wave → wave-clear → game-over → reload → score persisted.

### Phase 9 — Polish + verification
- [ ] **9.1** Tutorial flow on map-1 wave-1 (3 popups, dismissible, gated by `ctd3:tutorialSeen`).
- [ ] **9.2** Settings panel: music vol, SFX vol, ambient vol, reduced-motion toggle, force-low-power toggle, all persisted to `ctd3:settings`.
- [ ] **9.3** Add `?test=1` overlay: FPS counter, frame-time graph, low-power mode indicator, test hooks (`setLives`, `grantGold`, `jumpToWave`).
- [ ] **9.4** Run CLAUDE.md MCP verification protocol on desktop. Zero console errors, all network 200, all screens snapshotted.
- [ ] **9.5** **Real-device test per §13.** LAN devserver, mid-range Android, measure FPS, verify perf trigger, verify tap targets. **Merge gate.**
- [ ] **9.6** Reduced-motion verification: confirm gold-bar wipe + light pulse skipped, captain regen telegraph still visible.

### Phase 10 — Cutover
- [ ] **10.1** Delete `games/castle-tower-defense/` (the 2D version) entirely.
- [ ] **10.2** Rename `games/castle-tower-defense/` → `games/castle-tower-defense/`.
- [ ] **10.3** Update `games/index.html` gallery card: new hero screenshot captured from the running 3D game (during Phase 9 verification).
- [ ] **10.4** Mark ADR-023 `Status: Superseded by ADR-028`. Add one-paragraph context note + bidirectional link.
- [ ] **10.5** Final verification: re-run §13 protocol against the renamed slug.
- [ ] **10.6** Merge cutover PR. Trigger Cloudflare cache purge per repo's deploy notes.

---

## Appendix A — Constants

```js
// engine.js
HIT_FLASH_MS         = 80
SPLASH_FX_MS         = 350
GOLD_POPUP_MS        = 900
CASTLE_FX_MS         = 350
DEFEAT_FRAMES_DELAY  = 900
AURA_SLOW_FLOOR_MS   = 250   // see §M-2: floor value of slow per tick, NOT an execution interval
FIXED_STEP_MS        = 1000 / 60

// renderer.js
PERF_TRIGGER_THRESHOLD_MS = 33
PERF_TRIGGER_FRAMES       = 60
DPR_DESKTOP_MAX           = 2.0
DPR_MOBILE_MAX            = 1.5
DPR_LOW_POWER             = 1.0
SHADOW_MAP_DESKTOP        = 1024
SHADOW_MAP_MOBILE         = 512

// scene.js
SLOT_COLLIDER_SIZE        = 80   // invisible raycast plane size, world units
RANGE_DECAL_OPACITY       = 0.4
AURA_DECAL_OPACITY        = 0.5

// ui.js
GOLD_FLASH_DURATION_MS    = 800

// audio.js
DEFAULT_MUSIC_VOLUME      = 0.40
DEFAULT_SFX_VOLUME        = 0.80
DEFAULT_AMBIENT_VOLUME    = 0.25
```

## Appendix B — Cross-reference: review findings → spec sections

| Review | Finding | Spec section addressing it |
|--------|---------|----------------------------|
| #1 C1 | Warden interface | §3 (behavior tag), §6 (Tower shape), §7 (BEHAVIOR_HANDLERS) |
| #1 C2 | Hardcoded SFX dispatch | §7 (TOWER_FIRE_SFX), §9, §11 |
| #1 C3 | scene god module | §4 (split into renderer + scene + lighting), §5 |
| #1 C4 | localStorage extraction | §14, Phase 0 of §19 |
| #1 M1 | goldDeficitFlash home | §7 (ui.setGoldFlash), §6 (NOT in run state) |
| #1 M2 | day/night FSM coupling | §9 (phaseTransition event), §7 (lighting subscribes) |
| #1 M3 | offscreen palette icons | §10 (bake-icons.html), §5 (`assets/icons/`) |
| #1 M4 | P4 contradiction | §3 (drop conditions), §17 (kit gate) |
| #1 M5 | UMD fallback | §1 (iOS 16.4+ floor), §18 (out of scope) |
| #1 M6 | gamepad deferral | §15 (DELETED, enumerated removals) |
| #1 M7 | scene→entities dep | §4 (scene→assets only), §6 (snapshot fields on tower) |
| #1 M8 | early-wave bonus | §3 (removed), §6 (NOT in run state), §7 (`canSendNextWave`) |
| #1 m1 | per-wave music override | §6 (Wave shape; absent), §18 |
| #1 m2 | warden_aura_loop | §11 (13 SFX, no loop), §18 |
| #1 m3 | camera pan | §12 (interactions), §18 |
| #1 m4 | parallel dev URL | §15 (branch strategy, no parallel slug) |
| #1 m5 | tile grid runtime shape | §6 (Map shape excludes grid) |
| #1 m6 | score reset comms | §14 (first-load notice) |
| #2 C-1 | place() enum caller contract | §8 (full table for place/upgrade/sell/sendNextWave) |
| #2 C-2 | earlyBonusEligible/button bug | §3, §6 (removed from state), §7 (`canSendNextWave`), §11 Phase 5.2 |
| #2 C-3 | goldDeficitFlash setTimeout | §7 (`setGoldFlash` uses performance.now in update loop), §19 Phase 5.3 |
| #2 M-1 | step* split is if-chain | §7 (`BEHAVIOR_HANDLERS` dispatch table) |
| #2 M-2 | AURA_REFRESH_MS naming | §7, Appendix A (renamed to `AURA_SLOW_FLOOR_MS`, semantics documented) |
| #2 M-3 | snapshot writer | §7 (`refreshTowerSnapshot` called by both `makeTower` and `upgrade`) |
| #2 M-4 | 2D regression verification | §15, §19 Phase 0.3 (merge gate) |
| #2 M-5 | real-device testing | §13 (LAN devserver protocol), §19 Phase 9.5 (merge gate) |
| #2 M-6 | icon baking workflow | §10 (`tools/bake-icons.html` workflow), §19 Phase 2.4 |
| #2 m-1 | phaseTransition fan-out | §9 (lighting only in v1) |
| #2 m-2 | wave-clear bird mesh | §12 (gold-bar wipe + light pulse, no bird), §18 |
| #2 m-3 | safeGet silent swallow | §14 (`console.warn` on parse error) |
| #2 m-4 | score-reset comms | §12, §14 (first-load notice) |
| #2 m-5 | spec-phase exit condition | §17 (< 3 of 4 archetypes → escalate) |
| #2 m-6 | gamepad call sites | §15 (enumerated removals) |

---

*End of ADR-028.*
