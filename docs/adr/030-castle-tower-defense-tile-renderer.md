# ADR-030 — CTD3 tile-grid path renderer, asset animations, decorations, editor extensions, two new maps

**Status:** Accepted (planning), 2026-05-18. Implementation pending.
**Extends:** [ADR-028](028-castle-tower-defense-3d.md) (the 3D rewrite) and [ADR-029](029-castle-tower-defense-map-editor.md) (the Cartographer map editor).
**Reopens:** ADR-028 §18 ("river as first-class terrain" — only as decoration, not blocking); ADR-029 §10 ("no 3D preview" — re-opened, see §13 below); ADR-029 §5 ("no editor module deps" — preserved via lazy-import + shared utility).

> This spec hardens the plan at `C:\Users\chase\.claude\plans\ultrathink-step-by-step-use-chain-of-tho-elegant-sifakis.md` after two adversarial reviews. It is intended to be mechanically transcribable into code: file paths, data shapes with types, function signatures, and a granular task list.

---

## Table of contents

1. Context & goal
2. Pillars (carried from ADR-028)
3. Architecture changes vs. ADR-028
4. File manifest
5. Data schemas
6. Function signatures
7. Engine event payload changes
8. Tile-grid algorithm (`classifyPathCells`)
9. Path renderer (`scene.paintTerrain`)
10. Decoration runtime (`scene.paintDecorations`)
11. Asset animations (bob, projectile rotation, aura pulse, muzzle flash)
12. Persistent Warden aura registry
13. Map editor — Phase A2 (Cartographer extensions)
14. Persistence helper (`registerMap`)
15. Maps re-authoring
16. Two new maps — Snowfall Pass + Riverbend
17. Progression curve
18. Verification (per CLAUDE.md MCP protocol)
19. Out of scope
20. Risks
21. Spec-phase gate (must run before code)
22. Task list (phased, single-PR-sized)
23. Appendix A — Constants
24. Appendix B — Cross-reference: review findings → spec sections

---

## 1. Context & goal

ADR-028 shipped CTD3 with a procedural brown-ribbon path and **19 of 161** Kenney TD Kit GLBs (towers + enemies + castle). ADR-029 Phase A1 shipped the Cartographer (2D waypoint editor); the user authored a 4th map (Tidewater) with it. **137 GLBs in the kit remain unused** — every path tile, every decoration mesh, every spawn tile, the snow theme set, the river theme set.

Concretely missing:

- The runtime renders the path as a procedural ribbon (`makeRibbonGeometry`); no Kenney tile pieces are placed.
- The editor is 2D-canvas only with no Kenney mesh preview.
- Enemy meshes only translate along the path (no bob, no yaw toward direction of travel).
- Projectiles do not rotate toward their velocity vector.
- The Warden's always-visible aura ring is geometrically static (no pulse).
- Towers give no visual feedback at the moment they fire.

**Goal of this ADR:** Wire the Kenney path tiles + decorations into the runtime; add the missing motion polish; extend the Cartographer with a decoration palette and a 3D preview; author two new maps using the extended editor; document a new shared utility (`tile-grid.js`) that the runtime renderer and the editor preview both consume.

**Hard constraints (CLAUDE.md, unchanged):** plain HTML/CSS/JS, no build step, no bundler, no backend; Three.js via ESM CDN with importmap; iOS 16.4+ required; all third-party assets CC0; mobile-first.

**Priority (CLAUDE.md):** DRY > YAGNI > SOLID > KISS.

---

## 2. Pillars (carried from ADR-028)

Unchanged. The five pillars from ADR-028 §2 (P1 Cozy / P2 Deliberate placement / P3 Phone-readable / P4 Asset-driven / P5 Belongs at chases.house) apply to every decision in this ADR. Specific call-outs:

- **P4 asset-driven** is the single biggest driver here — 137 unused kit pieces is asset-fighting by neglect, not asset-driven. This ADR brings the kit into the runtime.
- **P3 readable at phone scale** is the constraint that disqualified richer mid-frame animations (e.g., particle puffs); the runtime-transform animations chosen in §11 stay legible on small viewports.
- **P1 cozy not anxious** dictates the aura pulse cadence (slow ~1 Hz, gentle 5% scale variation) and the muzzle flash duration (80 ms — feedback, not flicker).

---

## 3. Architecture changes vs. ADR-028

| Area | Before | After |
|------|--------|-------|
| Path rendering | Procedural triangle-strip ribbon via `makeRibbonGeometry` in scene.js | Grid-derived Kenney tile placement via shared `CTD3TileGrid.classifyPathCells` |
| Warden aura ring | Built per frame in transient `decalsGroup`, cleared each tick (no pulse possible) | Persistent `wardenAuraNodes` registry in scene.js, parented to new `wardenAurasGroup`; updated in place each frame |
| Tile-grid algorithm | n/a | New file `games/castle-tower-defense/tile-grid.js` — pure IIFE exporting `window.CTD3TileGrid` |
| Decorations | n/a | Runtime-private `window.CTD3Decorations[mapId]` populated by `registerMap` helper in `maps.js`. Map shape unchanged (ADR-028 §6 m-5 preserved) |
| Map data file | `maps.js` defines a `MAPS` array literal | `maps.js` defines `MAPS = []` and `window.CTD3Decorations = {}` at top; each map registered via `registerMap({ map, decorations })` |
| `fire` engine event | `{ kind, towerType }` | `{ kind, towerType, towerId }` (additive — audio's existing consumer reads only `towerType`, so non-breaking) |
| Editor (Cartographer) | 2D canvas only, no Kenney mesh awareness | Adds 5th tool "Decor", decoration palette, **lazy-imported** Three.js 3D preview pane, export validator, single combined JSON export |
| ADR-029 §10 | "No 3D preview" | Re-opened: 3D preview IS in scope; ADR-029 amended with a Phase A2 section justifying the reversal |
| Module pattern | `window.CTD3<Sub>` IIFE | Unchanged. New utilities (`tile-grid.js`, `registerMap` helper inside `maps.js`) follow the same pattern |

The boundary between **simulation** (engine) and **presentation** (scene + ui + audio) is unchanged. New presentation state (bob phases, aura ring `t0` timestamps, muzzle-flash deadlines) lives in `scene.js` node `userData` — never on engine entities.

---

## 4. File manifest

### New files
```
games/castle-tower-defense/tile-grid.js          NEW — pure IIFE, shared between game runtime + editor
                                                 — no Three.js, no DOM, no state
                                                 — exports window.CTD3TileGrid
games/castle-tower-defense/assets/models/        +23 GLBs (path tiles, snow variants, river, decorations, spawn)
                                                 — copy from C:/Users/chase/Downloads/kenney_tower-defense-kit/
```

### Modified files
```
games/castle-tower-defense/index.html            Add <script src="tile-grid.js"> before engine.js
games/castle-tower-defense/scene.js              MAJOR REWRITE — see §9, §10, §11, §12
games/castle-tower-defense/engine.js             MINOR — fire event +towerId (one line)
games/castle-tower-defense/assets.js             MINOR — add assets.hasMesh(id) helper
games/castle-tower-defense/assets/MANIFEST.json  +23 entries (8 tiles, 5 snow, 3 river, 5 decorations, 2 spawn)
games/castle-tower-defense/assets/LICENSE.txt    Append Kenney source mapping for the 23 new GLBs
games/castle-tower-defense/maps.js               MAJOR REWRITE — all 4 maps' paths re-authored axis-aligned;
                                                 add registerMap helper; convert existing literals to
                                                 registerMap({ map, decorations }) form; append 2 new maps
games/castle-tower-defense/tools/map-editor.html MODIFY — Decor tool, palette, export validator, 3D preview,
                                                 single combined JSON export
docs/adr/029-castle-tower-defense-map-editor.md  AMEND — add Phase A2 section (3D preview justification,
                                                 decoration palette, shared tile-grid.js)
```

### Files NOT changed
```
games/castle-tower-defense/entities.js           Untouched — no bobPhase here (review-#1 C-1)
games/castle-tower-defense/lighting.js           Untouched
games/castle-tower-defense/renderer.js           Untouched
games/castle-tower-defense/audio.js              Untouched — fire event +towerId is additive
games/castle-tower-defense/input.js              Untouched
games/castle-tower-defense/game.js               Untouched
games/castle-tower-defense/ui.js                 Untouched
games/shared/storage.js                          Untouched
docs/adr/028-castle-tower-defense-3d.md          Untouched (this ADR extends, doesn't supersede)
```

### Files NOT created
```
games/castle-tower-defense/decorations.js        REJECTED — replaced by single-paste registerMap approach
                                                 (review-#2 MAJ-3)
```

---

## 5. Data schemas

### Map shape (runtime) — UNCHANGED from ADR-028 §6
The Map shape consumed by `engine.createState` is unchanged. **No `decorations` field is added to the runtime Map shape** — preserves ADR-028 §6 m-5.

### Combined export shape (authoring-time only)
The editor's "Copy JSON" outputs this shape, wrapped in a `registerMap(...)` call:

```ts
type CombinedMapExport = {
  map: Map,                                      // runtime Map shape per ADR-028 §6 — UNCHANGED
  decorations: Decoration[]
};
```

The `registerMap` helper in maps.js destructures this shape; only `map` reaches the runtime. `decorations` lives in a parallel runtime-private global.

### Decoration entity (presentation-only)
```ts
type Decoration = {
  type: 'detail_tree' | 'detail_rocks' | 'detail_crystal',
  x: number,        // world units, free-form (not grid-snapped)
  z: number,        // world units, free-form
  rotation?: number,// radians around Y; if omitted, runtime randomizes
  size?: 'normal' | 'large'  // default 'normal'
};
```

**`size: 'large'` lookup rules:**
- Kit ships `_large` for all 3 decoration types (tree, rocks, crystal) — verified during Phase 2 kit ingestion. The `detail_crystal_large.glb` predicted absent in the original review-#2 MAJ-2 finding IS present in the kit; the deviation is recorded in the Phase 2 commit.
- Logic: `scene.paintDecorations` calls `assets.hasMesh(`${type}_large`)`. True → mesh swap (`assets.getMesh(`${type}_large`)`). False → base mesh + `scale.setScalar(1.5)` (defensive fallback for hypothetical future decorations whose `_large` variant is missing).
- `hasMesh` checks manifest membership only — NOT cache presence. preload()'s critical path covers only the first 10 manifest entries (towers); tile and decoration meshes background-load, so cache presence is non-deterministic when paintDecorations runs. The dispatch's actual question is "does the kit ship this id?", and manifest membership answers it correctly.

### Runtime-private decoration registry
```ts
window.CTD3Decorations: Record<string, Decoration[]>
// keyed by mapId; populated by maps.js at module init via registerMap
```

### Tile-classification result (`CTD3TileGrid.classifyPathCells`)
```ts
type ClassifyOk = {
  ok: true,
  cells: PathCell[]
};
type ClassifyErr = {
  ok: false,
  error: string,                                 // human-readable, e.g. "diagonal segment"
  badSegment?: { i: number, a: Waypoint, b: Waypoint }
                                                 // i = index of offending segment in input array
};
type ClassifyResult = ClassifyOk | ClassifyErr;

type PathCell = {
  x: number,                                     // integer world coord
  z: number,                                     // integer world coord
  tileType: 'tile_path_straight'
          | 'tile_path_corner_round'
          | 'tile_path_end_round',
  rotation: number                               // radians around Y; one of {0, π/2, π, 3π/2}
};

type Waypoint = { x: number, z: number };       // x, z MUST be integers for ok:true
```

### `state.events` `fire` payload — extended
```ts
// Before (ADR-028 §9):
type FireEventOld = { kind: 'fire', towerType: TowerType };
// After (this ADR):
type FireEvent = { kind: 'fire', towerType: TowerType, towerId: string };
```
Audio's existing `flushEvents` reads only `ev.towerType`; the addition is non-breaking.

### `scene` node userData additions
```ts
// Per enemy node (created at first sync in scene.syncEnemies):
node.userData.bobPhase: number    // radians, Math.random() * 2π — never on engine entity (review-#1 C-1)

// Per Warden aura ring node (created at first sync in scene.syncWardenAuras):
node.userData.t0: number          // performance.now() at creation; drives pulse phase

// Per tower node (set transiently in scene.flashTower):
node.userData.flashUntilMs: number  // performance.now()-relative deadline; checked in syncTowers
```

### Asset manifest entries (23 new entries appended to `assets/MANIFEST.json`)
```ts
type ManifestEntry = {
  id: string,                                    // matches scene.js lookup key
  role: 'tile' | 'decoration' | 'spawn',
  kind: 'mesh',
  path: string                                   // relative to assets/
};
```

Exhaustive list of new entries in §22 task 2.1.

---

## 6. Function signatures

### `tile-grid.js` → `window.CTD3TileGrid`
```js
classifyPathCells(waypoints: Waypoint[]): ClassifyResult
  // Pure function. Never throws. Returns ok:false on:
  //  - any waypoint with non-integer x or z
  //  - duplicate consecutive waypoints (a.x === b.x AND a.z === b.z)
  //  - diagonal segment (both dx !== 0 AND dz !== 0)
  // On ok:true, returns one PathCell per integer cell the path traverses,
  // classified by neighbor direction (straight | corner_round | end_round).

GRID_SIZE: 1                                     // world units per tile; constant
```

### `assets.js` → `window.CTD3Assets` (additive)
```js
hasMesh(id: string): boolean
  // True iff the asset manifest declares this id (manifest membership only —
  // NOT cache presence; tile + decoration meshes background-load, so cache
  // state is non-deterministic when paintDecorations runs).
  // Synchronous. Used by scene to decide mesh-swap vs scale-fallback for
  // `_large` decorations.
```

All other `CTD3Assets` methods unchanged from ADR-028 §7.

### `scene.js` → `window.CTD3Scene` (additive + rewrites)
```js
// Public surface — additions:
sync(state: State): void
  // Now calls syncWardenAuras(state) in addition to existing sync* functions.

flashTower(towerId: string): void
  // Sets node.userData.flashUntilMs = performance.now() + MUZZLE_FLASH_MS on
  // the matching tower node. Per-frame syncTowers checks this and applies
  // emissive pulse. Cache original emissive on first call to avoid GC churn.

// Public surface — rewritten:
paintTerrain(map: Map): void
  // No longer builds a procedural ribbon. Instead:
  // 1. Ground: instances tile_ground (or snow_tile_ground for snowfall_pass)
  //    across the playfield bounds.
  // 2. Path: calls CTD3TileGrid.classifyPathCells(map.path). On ok:false,
  //    logs console.error and renders bare ground (no throw).
  // 3. Castle, slots: unchanged.
  // 4. Decorations: see paintDecorations below.

clearPlayfield(): void
  // EXTENDED — additionally clears wardenAuraNodes registry AND
  // empties wardenAurasGroup. Review-#2 CRIT-2.

// Internal additions (not on public surface):
paintDecorations(mapId: string): void           // reads CTD3Decorations[mapId]
syncWardenAuras(state: State): void             // persistent registry diff, pulse update
```

### `engine.js` → `window.CTD3Engine` (one-line change)
```js
// fireAt(state, tw, def, target) — line ~340:
//   BEFORE: state.events.push({ kind: 'fire', towerType: tw.type });
//   AFTER:  state.events.push({ kind: 'fire', towerType: tw.type, towerId: tw.id });
```
Mirrors the existing `place` event's `{ kind: 'place', towerType, towerId }` precedent.

### `maps.js` (rewritten top-level structure)
```js
const MAPS = [];
window.CTD3Decorations = window.CTD3Decorations || {};

function registerMap(combined) {
  try {
    if (!combined || !combined.map || !combined.map.id) {
      console.error('[maps] registerMap: missing combined.map.id', combined);
      return;
    }
    MAPS.push(combined.map);
    window.CTD3Decorations[combined.map.id] = combined.decorations || [];
  } catch (e) {
    console.error('[maps] registerMap failed:', e, combined);
  }
}

// ... 4 existing maps re-authored as registerMap({...}) calls ...
// ... 2 new maps appended as registerMap({...}) calls ...

function byId(id) { return MAPS.find(m => m.id === id) || null; }
function maxStars() { return MAPS.length * 3 * 2; }

window.CTD3Maps = { MAPS, byId, maxStars };
```

### Editor: `buildExportMap()` (in `tools/map-editor.html` IIFE)
```js
buildExportMap(): string
  // Validates: classifyPathCells(state.path) returns ok:true.
  //            All slots have integer coords.
  // On failure: returns null; calling code shows red inline error.
  // On success: returns formatted multi-line string:
  //   "registerMap({\n  map: { ... },\n  decorations: [ ... ]\n});\n"
  // Ready for clipboard copy + paste at bottom of maps.js.
```

---

## 7. Engine event payload changes

The only engine.js change is one line: the `fire` event payload gains a `towerId` field.

### Affected consumers
| Consumer | File | Reads | Action |
|----------|------|-------|--------|
| `audio.flushEvents` | audio.js:148-171 | `ev.towerType` only | No change (additive field ignored). |
| `game.consumeEngineEvents` | game.js | `ev.kind === 'fire'` | New: routes to `scene.flashTower(ev.towerId)`. |
| `scene.flashTower` | scene.js (new) | `ev.towerId` | New consumer. Lands in **same commit** as the engine.js line change. |

**No event kind is added or removed.** The `phaseTransition` event from ADR-028 §9 is unchanged.

---

## 8. Tile-grid algorithm (`classifyPathCells`)

### Pure-function contract
- Input: array of `Waypoint` (any coords).
- Output: `ClassifyResult` discriminated union.
- **Never throws.** Pure (no DOM, no globals, no I/O).
- Loadable in two contexts:
  - Game runtime: via `<script src="tile-grid.js">` in `index.html` before any module-typed script.
  - Editor: via `<script src="../tile-grid.js">` in `tools/map-editor.html` `<head>` immediately after the importmap.

### Validation phase (early returns on `ok: false`)
```
1. For each waypoint w[i]:
     if !Number.isInteger(w.x) || !Number.isInteger(w.z):
       return { ok:false, error: 'waypoint N has non-integer coord', badSegment: {i, a: w[i-1], b: w[i]} }

2. For each consecutive pair (a, b) at index i:
     dx = b.x - a.x;  dz = b.z - a.z
     if dx === 0 && dz === 0:
       return { ok:false, error: 'duplicate waypoint at index i', badSegment: {i, a, b} }
     if dx !== 0 && dz !== 0:
       return { ok:false, error: 'diagonal segment at index i', badSegment: {i, a, b} }
```

### Walk phase (only reached on validation success)
```
cells = []
for each consecutive (a, b):
  step = sign(b.x - a.x) for x-axis segments, sign(b.z - a.z) for z-axis segments
  for axis-aligned integer steps from a toward b (exclusive of a if not first cell):
    cells.push({ x, z, tileType: PLACEHOLDER, rotation: 0 })

// Second pass: assign tileType and rotation by examining each cell's
// prev-direction and next-direction:

for each cell[i]:
  prevDir = direction(cells[i-1] -> cells[i])  or null if i === 0
  nextDir = direction(cells[i] -> cells[i+1])  or null if i === cells.length - 1

  if prevDir === null:
    tileType = 'tile_path_end_round'
    rotation = rotation to face nextDir
  else if nextDir === null:
    tileType = 'tile_path_end_round'
    rotation = rotation to face away from prevDir (path "arrives" here)
  else if prevDir === nextDir:
    tileType = 'tile_path_straight'
    rotation = 0 if direction is horizontal (±x), π/2 if vertical (±z)
  else:
    // 90° turn
    tileType = 'tile_path_corner_round'
    rotation = one of {0, π/2, π, 3π/2} per (prevDir, nextDir) lookup table

return { ok: true, cells }
```

### Rotation conventions (verified empirically per R1)
The kit's `tile-straight.glb` faces along the +x axis by default. Corner-round connects -z (entry) to +x (exit). The rotation lookup table for corners:

| prevDir → nextDir | Rotation (radians) |
|---|---|
| +x → +z | π/2 |
| +x → -z | -π/2 |
| -x → +z | π |
| -x → -z | 0 |
| +z → +x | 0 |
| +z → -x | -π/2 |
| -z → +x | π/2 |
| -z → -x | π |

**Empirical verification before Phase 3 lands:** the `?test=tile-debug` URL hook (see §21) renders one of each tile at known rotations near the origin and labels each. Manual visual confirmation closes R1.

### Self-test
Guarded by `if (window.location.search.includes('tile-grid-test'))`:
- Test 1: valid 4-corner polyline `[(0,0), (4,0), (4,4), (0,4), (0,0)]` → expect `ok:true` with 16 cells.
- Test 2: diagonal segment `[(0,0), (2,2)]` → expect `ok:false`, error mentions 'diagonal'.
- Test 3: duplicate `[(0,0), (0,0)]` → expect `ok:false`, error mentions 'duplicate'.
- Test 4: non-integer `[(0.5, 0), (1, 0)]` → expect `ok:false`, error mentions 'non-integer'.
- Logs results to console; no asserts.

---

## 9. Path renderer (`scene.paintTerrain`)

### Replaces
`makeRibbonGeometry()` and the entire procedural-ribbon branch in `paintTerrain`. **`makeRibbonGeometry` is removed from scene.js.**

### New flow
```
paintTerrain(map):
  1. Compute playfield bounds:
       minX = min over map.path[i].x and map.castle.x and slots, then -4 cell padding
       maxX = max over same, +4 cell padding
       minZ, maxZ similarly

  2. Determine theme variants:
       isSnow = (map.id === 'snowfall_pass')
       groundId = isSnow ? 'snow_tile_ground' : 'tile_ground'
       pathPrefix = isSnow ? 'snow_tile_path_' : 'tile_path_'

  3. Ground: instance groundId across (maxX - minX) × (maxZ - minZ) cells
       use assets.getInstanced(groundId, capacity = totalCells)
       one setMatrixAt per cell; one commit() at end of loop

  4. Path:
       result = window.CTD3TileGrid.classifyPathCells(map.path)
       if (!result.ok):
         console.error('[scene] path invalid for', map.id, result.error,
                       result.badSegment)
         // skip path rendering — ground is already visible
         return
       for each cell in result.cells:
         actualTileType = pathPrefix + cell.tileType.replace('tile_path_', '')
         mesh = assets.getMesh(actualTileType).clone()
         mesh.position.set(cell.x, 0.01, cell.z)
         mesh.rotation.y = cell.rotation
         pathGroup.add(mesh)

  5. Castle: assets.getMesh('castle'), positioned at map.castle (unchanged)

  6. Slots: plinth + invisible 80×80 collider plane per slot (unchanged)

  7. Decorations:
       paintDecorations(map.id)
```

### Performance budget
Ground tiles: one `InstancedMesh` per map (~600 instance slots). One `setMatrixAt` pass, one `commit()` — `paintTerrain` runs once per map load, not per frame. After load, instance matrices are static.

Path tiles: up to ~40 cells per map. Three tile types (straight / corner / end). Use `getInstanced` per type, capacity 80, share material. Total tile-related draw calls per frame after `paintTerrain` completes: **1 ground InstancedMesh + 3 path InstancedMeshes = 4**. Well within ADR-028 §13's 80-draw-call budget.

Decorations: see §10.

---

## 10. Decoration runtime (`scene.paintDecorations`)

### Flow
```
paintDecorations(mapId):
  decorations = window.CTD3Decorations[mapId] || []
  for each decoration:
    targetId = (decoration.size === 'large')
               ? `${decoration.type}_large`
               : decoration.type
    if (decoration.size === 'large' && !assets.hasMesh(targetId)):
      // Defensive fallback: scale base mesh when kit lacks `_large` variant.
      // As of Phase 2 the kit ships `_large` for all 3 decoration types
      // (tree, rocks, crystal), so this branch is currently dead. Kept as
      // a safety net for hypothetical future decoration types.
      node = assets.getMesh(decoration.type).clone()
      node.scale.setScalar(1.5)
    else:
      node = assets.getMesh(targetId).clone()

    node.position.set(decoration.x, 0, decoration.z)
    node.rotation.y = decoration.rotation ?? (Math.random() * Math.PI * 2)
    decorationsGroup.add(node)
```

### Cleanup
`clearPlayfield()` (extended in §12) empties `decorationsGroup` as part of its existing per-group `clear()` calls.

### Performance
Up to ~15 decorations per map × 3 types = ~45 instance slots if instanced. For v1, decorations are NOT instanced — each is a unique `clone()` call. This sacrifices 5-10 draw calls per frame for code simplicity (KISS); if a future map needs 100+ decorations, switch to `getInstanced` per type.

---

## 11. Asset animations

All four animations are runtime transform updates inside the existing `scene.sync()` loop. **Zero changes to engine.js or entities.js for animation purposes.**

### 11.1 Enemy bob + yaw
Location: `scene.syncEnemies(state)` per-enemy loop.

**On node first creation:**
```js
node.userData.bobPhase = Math.random() * Math.PI * 2;  // per-enemy random offset
```

**Per frame:**
```js
const t = performance.now() / 1000;
const isFlying = window.CTD3Entities.ENEMIES[en.type].isFlying;
let baseY = isFlying ? 1.2 : 0;
let bob;
if (isFlying) {
  bob = Math.sin(t * 1.6 + node.userData.bobPhase) * 0.18;   // floaty hover
} else {
  bob = Math.abs(Math.sin(t * 4 + node.userData.bobPhase)) * 0.05;  // walk gait
}
node.position.set(en.x, baseY + bob, en.z);

// Yaw toward direction of travel
const lookT = Math.min(1, en.pathT + 0.005);
const next = window.CTD3Engine.sampleOnPath(state.mapDef, lookT);
const yaw = Math.atan2(next.z - en.z, next.x - en.x);
node.rotation.y = yaw + Math.PI;  // adjust for kit front-axis convention
```

### 11.2 Projectile rotation toward velocity
Location: `scene.syncProjectiles(state)` per-projectile loop.

**Per frame:**
```js
node.rotation.y = Math.atan2(pr.vz, pr.vx);
```

Arrow / cannonball / magebolt geometries are Y-axis-symmetric enough that yaw alone is sufficient. No pitch needed (projectiles travel parallel to ground in current physics).

### 11.3 Warden aura pulse
Location: new `scene.syncWardenAuras(state)` — see §12.

**Per frame (per persistent aura node):**
```js
const elapsed = performance.now() - node.userData.t0;
const k = 0.95 + Math.sin(elapsed / 800) * 0.05;   // 5% scale variation, ~1 Hz period
node.scale.setScalar(k);
node.material.opacity = 0.5 * (0.85 + Math.sin(elapsed / 800) * 0.15);
```

### 11.4 Tower muzzle flash
Location: `scene.flashTower(towerId)` (new) called from `game.consumeEngineEvents` for `fire` events; per-frame check in `scene.syncTowers`.

**On fire event:**
```js
// In game.consumeEngineEvents:
if (ev.kind === 'fire') {
  window.CTD3Scene.flashTower(ev.towerId);
}

// In scene.flashTower(towerId):
const node = towerNodes.get(towerId);
if (!node) return;
node.userData.flashUntilMs = performance.now() + MUZZLE_FLASH_MS;
```

**Per frame in syncTowers (after position update):**
```js
const flashing = performance.now() < (node.userData.flashUntilMs || 0);
node.traverse((o) => {
  if (!o.isMesh) return;
  if (!node.userData._originalEmissive) {
    // First flash: cache original
    node.userData._originalEmissive = {
      hex: o.material.emissive.getHex(),
      intensity: o.material.emissiveIntensity ?? 0
    };
  }
  if (flashing) {
    o.material.emissive.setHex(0xc8943e);          // warm gold
    o.material.emissiveIntensity = 0.6;
  } else if (node.userData._originalEmissive) {
    o.material.emissive.setHex(node.userData._originalEmissive.hex);
    o.material.emissiveIntensity = node.userData._originalEmissive.intensity;
  }
});
```

**Mesh swap on tier upgrade caveat:** when `syncTowers` swaps a tower's mesh for a new tier, the new node's `userData._originalEmissive` is undefined. The first flash after upgrade caches the new mesh's emissive. Acceptable.

---

## 12. Persistent Warden aura registry

### New scene.js elements
```js
// At top of scene.js IIFE:
let wardenAurasGroup = null;             // THREE.Group, separate from decalsGroup
const wardenAuraNodes = new Map();       // id (= tower.id) → ring node

// In scene.init():
wardenAurasGroup = new THREE.Group();
scene.add(wardenAurasGroup);

// New sync function called from sync(state):
function syncWardenAuras(state) {
  const present = new Set();
  for (const tw of state.towers) {
    if (tw.behavior !== 'aura') continue;
    present.add(tw.id);
    let node = wardenAuraNodes.get(tw.id);
    if (!node) {
      const geo = new THREE.RingGeometry(tw.auraRadius * 0.97, tw.auraRadius, 48);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x9bb0d4,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      node = new THREE.Mesh(geo, mat);
      node.position.set(tw.x, 0.05, tw.z);
      node.userData.t0 = performance.now();
      wardenAuraNodes.set(tw.id, node);
      wardenAurasGroup.add(node);
    }
    // Per-frame pulse (§11.3)
    const elapsed = performance.now() - node.userData.t0;
    const k = 0.95 + Math.sin(elapsed / 800) * 0.05;
    node.scale.setScalar(k);
    node.material.opacity = 0.5 * (0.85 + Math.sin(elapsed / 800) * 0.15);
  }
  // Remove vanished (sold)
  for (const [id, node] of wardenAuraNodes) {
    if (!present.has(id)) {
      wardenAurasGroup.remove(node);
      node.geometry.dispose();
      node.material.dispose();
      wardenAuraNodes.delete(id);
    }
  }
}
```

### `clearPlayfield()` extension (review-#2 CRIT-2)
```js
function clearPlayfield() {
  // ... existing registry clears for towerNodes, enemyNodes, projNodes, etc. ...

  // NEW:
  for (const [id, node] of wardenAuraNodes) {
    wardenAurasGroup.remove(node);
    node.geometry.dispose();
    node.material.dispose();
  }
  wardenAuraNodes.clear();
}
```

### `syncDecals` change
`syncDecals` no longer creates Warden aura rings. It continues to handle:
- Selected-tower range circle (transient, rebuilt per frame).
- Placement-preview range/aura circle on hover (transient).

`decalsGroup.clear()` at top of `syncDecals` remains; it does NOT affect `wardenAurasGroup`.

### Verification (CRIT-2 regression test)
Restart Plains 3× consecutively, place 2 Wardens after each restart. Inspect `wardenAurasGroup.children.length` — must equal **2** every time, never **4** or **6**.

---

## 13. Map editor — Phase A2 (Cartographer extensions)

This section is also serialized into a new "Phase A2" section in ADR-029. Mirror this content there with provenance back to this ADR.

### Re-opened decisions from ADR-029
- **§10 "no 3D preview" → reversed.** User explicitly requested a 3D preview. Phase A2 builds it as an opt-in collapsible sidebar pane with **lazy-imported Three.js**, preserving §5's spirit (editor still functions without the preview expanded).
- **§5 dev-tool DRY exemption → narrowed.** The exemption for inlining `bakeMap` / `sampleOnPath` is unchanged for those utilities. The tile-grid algorithm is **extracted to a shared file (`tile-grid.js`)** rather than inlined, because both the runtime and the preview need byte-identical behavior; drift would be silent and ugly.

### New tool: "Decor" (5th tool button, kbd `5`)
- Click in canvas to place a decoration at the cursor (free-form, NOT snapped — review-#2 §13).
- Right-click within 0.5 world units of a decoration to remove it.
- Active decoration type chosen from palette (next section).

### Decoration palette
3 buttons below the toolbar (M-4 cleanup — only 3 types in the palette, large variants exposed via the `size` field on the decoration data):
- **Tree** — color `#4a7a3a` on 2D canvas dot rendering.
- **Rocks** — color `#8a7a6a`.
- **Crystal** — color `#7ab8d4`.

Hex values explicit to avoid clashes with existing canvas colors (slot grey `#9b9080`, waypoint gold `#c8943e`).

Declared as CSS custom props in the editor's inline `<style>` block: `--decor-tree`, `--decor-rocks`, `--decor-crystal`.

### Visual snap (always-on for waypoints + slots; off for decorations)
- Path tool + Slot tool: click position is rounded to nearest integer world coord before being added to state.
- Decor tool: click position kept at click-precision (decorations don't drive the renderer).
- Move tool: snap policy follows the moved element's class.

### Export validator
`buildExportMap()`:
1. Calls `window.CTD3TileGrid.classifyPathCells(state.path)`.
2. If `result.ok === false`:
   - Disables Copy JSON button.
   - Shows red inline error: `Path invalid: ${result.error}` and highlights `result.badSegment.i` on the 2D canvas (e.g., red outline on the offending segment).
   - Returns `null`.
3. Validates every slot has integer x and z. Same red-inline-error UX on failure.
4. On success, returns a formatted multi-line string ready for clipboard (see §6 signature).

### Single combined JSON export
Output format:
```js
registerMap({
  map: {
    id: 'foo',
    displayName: 'Foo',
    roman: 'Field the N-th',
    chip: 'Open',
    chipKind: 'gold',
    description: '...',
    thumbIcon: 'map_foo',
    unlockRequirement: 0,
    theme: 'plains',
    castle: { x: 11, y: 0, z: -2 },
    path: [ ... ],
    buildSlots: [ ... ],
    waves: [ ... ]
  },
  decorations: [
    { type: 'detail_tree', x: -10.3, z: 4.7 },
    { type: 'detail_rocks', x: 7.1, z: -2.4, rotation: 1.57 },
    { type: 'detail_crystal', x: 9, z: 3, size: 'large' }
  ]
});
```

User pastes the entire `registerMap({...});` block at the bottom of `maps.js`. One paste per new map (review-#2 MAJ-3, ADR-029 E1 preserved).

### 3D preview pane
Collapsible sidebar element, default collapsed (collapse arrow shows "Preview ▸"). On expand:

1. Lazy `import('three')` + `import('three/addons/loaders/GLTFLoader.js')`. Show "Loading preview…" pill if import takes > 500 ms.
2. Reuse `window.CTD3TileGrid` (loaded earlier via classic script — see script order).
3. Build a small Three.js scene: orthographic camera at the same ¾ angle as the game, sized to ~300×220 px.
4. Each render:
   - Clear preview scene contents.
   - `result = window.CTD3TileGrid.classifyPathCells(state.path)`.
   - If `result.ok === false`: render an empty playfield + a yellow pill over the preview saying "Path has diagonals — snap segments to single-axis steps (segment N)". No throw escapes.
   - If `result.ok === true`: instance ground tiles, place path tiles per cell, place decorations (with `_large` fallback), place slot plinths, place castle.
5. Re-render debounced at 150 ms after any state change.
6. Three.js version pinned to match the game's importmap (`three@0.170.0` at time of writing). No version drift.

### Editor `<head>` script order (mandatory)
```html
<head>
  <meta ... />
  <title>CTD3 — Cartographer</title>
  <!-- ORDER MATTERS: tile-grid.js must define window.CTD3TileGrid
       before any inline IIFE or module preview reads it. -->
  <script type="importmap">
  { "imports": { "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
                 "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/" } }
  </script>
  <script src="../tile-grid.js"></script>
  <style> ... </style>
</head>
```
The inline editor IIFE script tag remains at the bottom of `<body>`, as it already is.

### Editor IIFE additions (high-level)
- `state.decorations = []` initialized in the existing state object.
- New event handlers for the Decor tool's click / right-click.
- New palette button row rendered next to the existing toolbar.
- Canvas redraw includes decoration dots (in addition to waypoints, slots, castle).
- `buildExportMap` validator and output format (signatures in §6).
- 3D preview pane DOM + expand button.

---

## 14. Persistence helper (`registerMap`)

Implementation in `maps.js` (full signature in §6, source pasted in §22 task 3.4). Key properties:

- **Side effects:** `MAPS.push(...)`, `window.CTD3Decorations[id] = ...`.
- **Error path:** wraps the per-map operation in `try/catch`. On any error (bad combined shape, missing id), logs `console.error` and SKIPS the map. Other `registerMap` calls in the file continue to execute. **One bad map ≠ broken game** (review-#2 MIN-3).
- **Idempotency:** if called twice with the same `map.id`, the second call adds a duplicate to `MAPS` (caller bug). `MAPS.find(m => m.id === id)` returns the first instance. No de-duplication intentionally — keeps the helper simple.

---

## 15. Maps re-authoring

All four existing maps (Plains, Forest, Mountain, Tidewater) have diagonal waypoint segments (review-#2 MAJ-5). Every diagonal becomes a staircase of axis-aligned + corner segments.

### Authoring procedure (per map)
1. Open the existing map's path in the editor (paste the current waypoint array into the path tool's state, or hand-edit `state.path`).
2. For each diagonal segment (a → b where both dx ≠ 0 and dz ≠ 0):
   - Choose an L-shape: either (a → {a.x, b.z}) then ({a.x, b.z} → b), or (a → {b.x, a.z}) then ({b.x, a.z} → b). Pick whichever produces the better visual path.
   - Insert the intermediate waypoint into `state.path`.
3. `buildExportMap()` validates — if `result.ok === false`, locate the still-diagonal segment and repeat.
4. Visually compare the new path to the old (procedural-ribbon) version. If the new shape is significantly different, refine intermediate waypoints to better preserve the original aesthetic.
5. Save the new `registerMap({...})` block; replace the old map literal in `maps.js`.

### Acknowledged aesthetic delta
The new paths will have **visible right-angle corners** where the old paths had smooth diagonal arcs. This is the cost of switching from procedural ribbon to grid tiles. The pillars permit this (P4 asset-driven: use what the kit provides). Players who played the procedural-ribbon versions will notice; the shape change is documented in code comments per map.

### Tidewater special case
Tidewater is user-authored (ADR-029 Phase A1 test artifact). Mark its `registerMap({...})` block with a code comment: "User-authored 2026-05-17; re-tiled 2026-05-18. Original coords preserved in the comment below for user review."

---

## 16. Two new maps — Snowfall Pass + Riverbend

Authored using the extended editor (after Phase 5 lands). Both are exported via the single combined JSON, pasted into `maps.js`.

### Snowfall Pass
```ts
{
  id: 'snowfall_pass',
  displayName: 'Snowfall Pass',
  roman: 'Field the Fifth',
  chip: 'Frozen',
  chipKind: '',                                  // no special chip color
  description: 'A high col between the peaks. The crystals remember every step.',
  thumbIcon: 'map_mountain',                     // reuse mountain icon — no winter variant
  unlockRequirement: 14,                         // post-Mountain (review-#2 MIN-1)
  theme: 'mountain',                             // existing enum (review-#1 C-3)
  // ... castle, path (all axis-aligned), 6 slots, 8 waves ...
}
```

**Decoration set:** `detail_crystal` (sparse, including 2-3 `size: 'large'` which trigger 1.5× scale fallback), `detail_rocks_large` near the path corners.

**Snow rendering:** scene.paintTerrain detects `map.id === 'snowfall_pass'` and substitutes `snow_tile_*` for `tile_*` ground + path meshes. The classifyPathCells output is theme-agnostic; only the consumer remaps.

### Riverbend
```ts
{
  id: 'riverbend',
  displayName: 'Riverbend',
  roman: 'Field the Sixth',
  chip: 'River Pass',
  chipKind: '',
  description: 'The river curls slow. A footbridge keeps the keep dry — for now.',
  thumbIcon: 'map_forest',
  unlockRequirement: 13,
  theme: 'forest',
  // ... castle, path (axis-aligned), 6 slots, 8 waves ...
}
```

**Decoration set:** `tile_river_straight` + `tile_river_corner` arranged alongside the path edges (placed as decorations, not as terrain — they render visually but don't block); `tile_river_bridge` at one or two path crossings (visual flourish, not gameplay); `detail_tree` + `detail_tree_large` scattered through grass cells.

Wave compositions and slot counts authored to taste during Phase 4 of §22. Both maps land with 8 waves each.

---

## 17. Progression curve (6 maps after this ADR ships)

| Map | Theme | Unlock | Notes |
|-----|-------|--------|-------|
| Plains | plains | 0 | Tutorial |
| Forest | forest | 0 | Early |
| Tidewater | forest | 0 | Early (ADR-029 Phase A1 artifact, re-tiled here) |
| Mountain | mountain | 5 ★ | Mid-game gate |
| Riverbend | forest | 13 ★ | Mid-late |
| Snowfall Pass | mountain | **14 ★** | Effectively post-Mountain (review-#2 MIN-1) |

`maxStars() = 6 × 3 × 2 = 36`. The 5★/13★/14★ thresholds keep Mountain meaningful and stage the endgame maps.

---

## 18. Verification (per CLAUDE.md MCP protocol)

Each phase commit MUST pass the protocol below before merging. Run end-to-end with Chrome DevTools MCP on both desktop (1536×756) and mobile-emulated (390×844 × DPR 3, mobile, touch).

### Per-commit
1. Boot dev server (`python -m http.server 3003` from repo root).
2. Navigate to `/games/castle-tower-defense/`. Wait for title screen.
3. `list_console_messages types:["error"]` — must be empty.
4. `list_network_requests` — confirm all 200/304, no 4xx/5xx.
5. Take a representative screenshot, save to `docs/screenshots/` (gitignored).

### Per-phase additional checks (see §22 task list for which checks attach to which phase)
- Phase 1: place 4 tower types, observe muzzle flash; spawn enemies, observe bob+yaw; verify projectile rotation by jumping to a wave with Catapult shots.
- Phase 2: `await window.CTD3Assets.preload()` resolves; `getMesh('tile_path_straight')` returns a non-placeholder Group; `hasMesh('detail_crystal_large')` returns `false`.
- Phase 3 (atomic): every existing map renders with kit tiles; no z-fighting; corners look correct; restart Plains 3× and confirm `wardenAurasGroup.children.length` matches placed Warden count each time.
- Phase 5: editor 3D preview matches runtime for the same map; export validator shows red error on a deliberately-diagonal segment; preview shows yellow pill on the same.
- Phase 6: both new maps appear in map-select with correct unlock states; both play through; scores persist.

### Final acceptance checklist
All boxes in §22's "Verification checklist" section must be ticked.

---

## 19. Out of scope

Carried from the plan, with origin (R = review, A = author):

- Magic-missile / fancier mage projectile from Web-DnD assets (A — future ADR).
- Skeletal animations on Kenney meshes (kit doesn't ship rigs).
- Snow biome ground across non-snowfall maps (A — only Snowfall Pass uses snow tiles).
- River as first-class blocking terrain (A — rivers are decorations).
- 3D preview as the primary editor canvas (R — 2D stays primary).
- Asset hot-reload in the editor (A — refresh).
- `tile_path_split` and `tile_path_crossing` (R M-4 — no branching paths in v1).
- `decoration.rotation` exposed in editor UI (A — runtime randomizes; authors can hand-edit if needed).
- `theme: 'winter'` enum value (R C-3 — snow selection is by `map.id`, not theme).
- Separate `decorations.js` file (R M-7 / R MAJ-3 — replaced by `registerMap` combined paste).
- ~~Decoration `_large` variants for `detail_crystal` (kit doesn't ship; ×1.5 scale fallback)~~ — Resolved during Phase 2 kit ingestion: kit DOES ship `detail-crystal-large.glb`. Included it.
- Grid-snap visual toggle in editor (R MAJ-5 / M-5 — always-on for path/slot; off for decoration).
- Per-tile rotation control in editor (A — runtime randomizes).

---

## 20. Risks

| # | Risk | Mitigation |
|---|------|------------|
| R1 | Kit's `tile_path_corner_round` rotation convention may not match `CTD3TileGrid.classifyPathCells`'s rotation output | `?test=tile-debug` URL hook in `scene.js` renders one of each tile at known rotations with text labels near the origin. Verify visually BEFORE Phase 3 commit lands. |
| R2 | InstancedMesh count grows with map size (~600 ground + ~40 path cells per map) | `paintTerrain` runs once per map load; instance matrices static after that. setMatrixAt + commit are one-shot. Cheap. |
| R3 | Editor 3D preview lazy-import latency on slow connections (~200 KB Three.js + GLTFLoader) | Preview is opt-in (collapsed by default). Editor functions fully without it. "Loading preview…" pill if > 500 ms. |
| R4 | `wardenAuraNodes` not cleaned up on tower sell or map restart | `syncWardenAuras` removes entries when towers vanish from state. `clearPlayfield` extension (§12) clears the full registry on map restart. CRIT-2 regression test in §22 catches this. |
| R5 | Map ↔ decoration drift (orphan decorations referencing a deleted map) | Single combined export (MAJ-3) reduces drift risk — both blobs land in one paste. `scene.paintDecorations` skips unknown decoration types with a console.warn (no throw). |
| R6 | `tile-grid.js` is a 3rd shared utility on the site (after `gamepad.js`, `storage.js`); naming + location convention | Use IIFE + `window.CTD3*` pattern. Lives in `games/castle-tower-defense/` (CTD3-specific). If a future game wants tile grids, extract to `games/shared/` then. |
| R7 | All 4 existing maps re-authored — paths look visibly different post-Phase-3 | Document old vs new path coords in code comments. Tidewater explicitly flagged as user-authored. Aesthetic regression is the acknowledged cost. |
| R8 | Editor 3D preview may try to render mid-drag with a diagonal waypoint | `classifyPathCells` returns `{ ok: false, error }` (never throws — MAJ-1). Preview shows a yellow pill explaining the segment is diagonal. No silent crash. |
| R9 | Bad paste of `registerMap({...})` into `maps.js` could break the file | `registerMap` wraps each per-map operation in `try/catch`. One bad paste degrades to "that map missing" not "game won't boot" (MIN-3). |
| R10 | Snow-tile colormap atlas might differ from standard `colormap.png` | Verified during ADR-028's original 19-GLB ingestion: tile-* and snow-tile-* reference the same `Textures/colormap.png`. No atlas split needed. If a future kit version splits atlases, `assets.getMaterialAtlas()` becomes per-atlas. |

---

## 21. Spec-phase gate (must run before code)

Before any Phase 1 implementation:

1. **Verify kit inventory:** confirm at `C:/Users/chase/Downloads/kenney_tower-defense-kit/Models/GLB format/` that all 23 GLBs listed in §22 task 2.1 exist. Specifically check for `detail-crystal-large.glb` (should be ABSENT — confirms MAJ-2 scale fallback is needed) and for the snow-tile and tile-river variants needed.

2. **Run `?test=tile-debug` page** (built as part of Phase 1, but separately verifiable):
   - Load tile-grid.js's self-test by visiting `index.html?tile-grid-test=1`. Console logs 4 test results (3 ok:false cases + 1 ok:true case).
   - Visually render one of each tile (tile_path_straight, tile_path_corner_round, tile_path_end_round) at known rotations (0, π/2, π, 3π/2) near the origin. Confirm Kenney's front-axis convention matches the rotation table in §8.

3. **Confirm Three.js version compatibility:** the importmap pins `three@0.170.0`. Open `tools/bake-icons.html` to verify Three.js still loads from unpkg without 404. (Sanity check; should be no-op since ADR-028 already verified this.)

If any gate check fails, escalate before continuing.

---

## 22. Task list (phased, single-PR-sized)

Each phase is a single PR / commit. Phases ordered for safe incremental landing. Phase 3 (renderer + maps re-author) is atomic — these two MUST land together.

### Phase 1 — Animations + tile-grid utility + persistent aura registry + fire event extension

Single commit. No new GLB assets yet.

- [ ] **1.1** Create `games/castle-tower-defense/tile-grid.js` per §6 + §8. Pure IIFE; `window.CTD3TileGrid = { classifyPathCells, GRID_SIZE: 1 }`. Self-test guarded by URL param. **Never throws.**
- [ ] **1.2** Wire `<script src="tile-grid.js">` into `index.html` BEFORE `engine.js`.
- [ ] **1.3** `scene.js`: add `wardenAurasGroup = new THREE.Group()` to scene.init(); add `wardenAuraNodes = new Map()` at top of IIFE.
- [ ] **1.4** `scene.js`: implement `syncWardenAuras(state)` per §12; call from `sync(state)` after `syncTowers`.
- [ ] **1.5** `scene.js`: remove Warden-aura code from `syncDecals`. `decalsGroup.clear()` remains for transient elements (selected-tower range, hover preview).
- [ ] **1.6** `scene.js`: extend `clearPlayfield()` to clear `wardenAuraNodes` + empty `wardenAurasGroup`. Dispose geo + mat on each removed node.
- [ ] **1.7** `scene.js syncEnemies`: at first node creation, set `node.userData.bobPhase = Math.random() * Math.PI * 2`. Per frame, apply bob + yaw per §11.1.
- [ ] **1.8** `scene.js syncProjectiles`: set `node.rotation.y = Math.atan2(pr.vz, pr.vx)` per §11.2.
- [ ] **1.9** `engine.js`: change `state.events.push({ kind: 'fire', towerType: tw.type })` to `state.events.push({ kind: 'fire', towerType: tw.type, towerId: tw.id })`. **Single line change.**
- [ ] **1.10** `scene.js`: implement `flashTower(towerId)` per §11.4. Export on `window.CTD3Scene`.
- [ ] **1.11** `game.js consumeEngineEvents`: for `ev.kind === 'fire'`, call `window.CTD3Scene.flashTower(ev.towerId)`. **Same commit as 1.9 + 1.10.**
- [ ] **1.12** Verification: open game; place each of 4 tower types; observe muzzle flash; spawn enemies; observe bob + yaw; observe projectile rotation. Zero console errors. Restart Plains 3× while a Warden is placed; verify `wardenAurasGroup.children.length === 1` each time (not 2 or 3).

**Commit message:** `ADR-030 Phase 1: tile-grid utility + animations + persistent aura registry + fire event +towerId`

---

### Phase 2 — Asset expansion (Kenney GLBs)

Single commit. Copies 24 GLBs from kit; updates manifest + license.

- [x] **2.1** Copy 24 GLBs from `C:/Users/chase/Downloads/kenney_tower-defense-kit/Models/GLB format/` to `games/castle-tower-defense/assets/models/`. Rename per the kit→repo mapping:
  - Path tiles (8): `tile.glb → tile_ground.glb`, `tile-dirt.glb → tile_ground_dirt.glb`, `tile-straight.glb → tile_path_straight.glb`, `tile-corner-round.glb → tile_path_corner_round.glb`, `tile-corner-inner.glb → tile_path_corner_inner.glb`, `tile-corner-outer.glb → tile_path_corner_outer.glb`, `tile-end.glb → tile_path_end.glb`, `tile-end-round.glb → tile_path_end_round.glb`.
  - Snow theme (5): `snow-tile.glb → snow_tile_ground.glb`, `snow-tile-straight.glb → snow_tile_path_straight.glb`, `snow-tile-corner-round.glb → snow_tile_path_corner_round.glb`, `snow-tile-end-round.glb → snow_tile_path_end_round.glb`, `snow-tile-crystal.glb → snow_tile_crystal.glb`.
  - River (3): `tile-river-straight.glb → tile_river_straight.glb`, `tile-river-corner.glb → tile_river_corner.glb`, `tile-river-bridge.glb → tile_river_bridge.glb`.
  - Decorations (6): `detail-tree.glb → detail_tree.glb`, `detail-tree-large.glb → detail_tree_large.glb`, `detail-rocks.glb → detail_rocks.glb`, `detail-rocks-large.glb → detail_rocks_large.glb`, `detail-crystal.glb → detail_crystal.glb`, `detail-crystal-large.glb → detail_crystal_large.glb`. (Original spec predicted no `_large` for crystal; the kit ships it. Including it for visual consistency — hasMesh dispatch routes either way.)
  - Spawn (2): `spawn-round.glb → spawn_round.glb`, `tile-spawn.glb → tile_spawn.glb`.
- [x] **2.2** Append 24 entries to `assets/MANIFEST.json` per the §5 manifest schema. Role tags: `tile` (16 incl. snow + river), `decoration` (6), `spawn` (2).
- [x] **2.3** Append per-file source mapping to `assets/LICENSE.txt` under the existing Kenney TD Kit CC0 source.
- [x] **2.4** `assets.js`: add `hasMesh(id)` helper per §6. Returns `true` iff manifest declares the id (manifest membership only — see §6 note on cache-presence race). Export on `window.CTD3Assets`.
- [x] **2.5** Verification: boot the game; `await window.CTD3Assets.preload()` resolves; `getMesh('tile_path_straight')` returns a non-placeholder Group; `hasMesh('detail_tree_large')` === `true`; `hasMesh('detail_crystal_large')` === `true` (kit deviation — see §5). Total GLB payload still ≤ 8 MB.

**Commit message:** `ADR-030 Phase 2: expand Kenney subset (23 GLBs — tiles, snow, river, decorations, spawn)`

---

### Phase 3 — Path renderer rewrite + grid-snap all existing maps (ATOMIC)

Single commit. Phase 3 must NOT land without Phase 4 (map data) in the same commit. Renamed "Phase 3+4 combined" per review-#1 M-1 and §3 of this ADR.

- [ ] **3.1** `scene.js`: remove `makeRibbonGeometry` function entirely.
- [ ] **3.2** `scene.js paintTerrain`: implement new flow per §9. Ground via `getInstanced`. Path via `CTD3TileGrid.classifyPathCells` + `getInstanced` per tile type. Snow override via `map.id === 'snowfall_pass'`. Castle + slots unchanged. Decorations via `paintDecorations(map.id)`.
- [ ] **3.3** `scene.js`: implement `paintDecorations(mapId)` per §10. Read `window.CTD3Decorations[mapId]`. Apply `_large` mesh swap or 1.5× scale fallback per §10.
- [ ] **3.4** `maps.js`: rewrite top-level structure per §6:
  ```js
  const MAPS = [];
  window.CTD3Decorations = window.CTD3Decorations || {};
  function registerMap(combined) { try { ... } catch (e) { console.error(...) } }
  ```
- [ ] **3.5** `maps.js`: re-author **all 4 existing maps' paths** with axis-aligned waypoints per §15. Insert intermediate corners for every diagonal segment. Comment old vs new coords inline. Convert each map literal to `registerMap({ map, decorations })` form. Author 8–12 decorations per existing map keyed by theme (plains gets `detail_rocks` + `detail_tree`; forest gets dense `detail_tree_large` + `detail_tree`; mountain gets `detail_rocks_large` + `detail_crystal`; tidewater gets `detail_tree` + `tile_river_*` decorations along path edges).
- [ ] **3.6** Verification per §18 per-phase checks + every existing map renders with kit tiles, no z-fighting, no gaps, corners look correct. Restart each map 3× while Wardens are placed; verify aura ring count matches placed Warden count each restart (CRIT-2).

**Commit message:** `ADR-030 Phase 3: tile-grid path renderer + re-author all existing maps`

---

### Phase 4 — Editor extensions (Cartographer Phase A2)

Single commit. Edits `tools/map-editor.html` + amends ADR-029.

- [ ] **4.1** `tools/map-editor.html` `<head>`: add `<script src="../tile-grid.js">` immediately after the importmap and BEFORE the inline `<script>` block. Add `<!-- ORDER MATTERS -->` comment per §13.
- [ ] **4.2** Editor IIFE: extend `state` with `decorations: []`.
- [ ] **4.3** Editor: add 5th tool button "Decor" with kbd `5`. Wire click/right-click handlers per §13.
- [ ] **4.4** Editor: add 3-button decoration palette below toolbar. CSS custom props for the 3 hex colors per §13.
- [ ] **4.5** Editor: extend canvas redraw to render decoration dots in their type-specific hex colors.
- [ ] **4.6** Editor: implement visual snap for Path + Slot tools (decorations NOT snapped). Snap rounding visible in cursor preview.
- [ ] **4.7** Editor: rewrite `buildExportMap()` per §6 + §13. Validation via `classifyPathCells` returning `ok:false` disables Copy JSON + shows red inline error with `result.badSegment.i` highlight on canvas.
- [ ] **4.8** Editor: change Copy JSON output to single `registerMap({ map: {...}, decorations: [...] });` block per §13.
- [ ] **4.9** Editor: add collapsible 3D preview pane on the right sidebar (~300×220 px). Lazy-import Three.js + GLTFLoader. Render orthographic top-down view per §13. Show yellow pill on `result.ok === false`. Debounced re-render at 150 ms. "Loading preview…" pill if import > 500 ms.
- [ ] **4.10** Amend `docs/adr/029-castle-tower-defense-map-editor.md`: add a "Phase A2" section per §13. Cross-reference this ADR.
- [ ] **4.11** Verification: open editor; place 4 waypoints, 2 slots, 6 decorations; expand 3D preview; see tile pieces forming the path, ground tiles around, decorations placed; deliberately drag a waypoint to a non-integer position via hand-edit — Copy JSON button disabled with red error; preview shows yellow pill; restoring integer coords clears both.

**Commit message:** `ADR-029 Phase A2: decoration palette + 3D preview + export validator + single-paste export`

---

### Phase 5 — Two new maps (Snowfall Pass + Riverbend)

Single commit. Uses the editor from Phase 4 to author the maps.

- [ ] **5.1** Open the Cartographer. Author Snowfall Pass per §16:
  - `id: 'snowfall_pass'`, `theme: 'mountain'`, `unlockRequirement: 14`.
  - Axis-aligned path with ~10–12 waypoints (1–2 right-angle turns).
  - 6–7 build slots scattered for diverse tactical placements.
  - 8 waves authored to escalation (trickle → mid → swarm). Final wave does NOT include `captain` (Captain is Mountain's signature; keep maps distinct).
  - Decorations: 3–4 `detail_crystal` (1–2 with `size: 'large'`), 4–6 `detail_rocks_large`.
- [ ] **5.2** Copy JSON. Paste at bottom of `maps.js` as a new `registerMap({...})` block.
- [ ] **5.3** Verify Snowfall Pass loads, uses snow tile variants, plays through.
- [ ] **5.4** Author Riverbend per §16:
  - `id: 'riverbend'`, `theme: 'forest'`, `unlockRequirement: 13`.
  - Axis-aligned path with 1–2 corners crossing the "river" (visually).
  - 6 build slots.
  - 8 waves leaning into runner + skirmisher (river map evokes mobility).
  - Decorations: `tile_river_straight` + `tile_river_corner` placed alongside path edges to suggest a river; 1 `tile_river_bridge` at a path crossing; `detail_tree` + `detail_tree_large` scattered.
- [ ] **5.5** Copy JSON. Paste into `maps.js`.
- [ ] **5.6** Verify Riverbend loads, uses standard (non-snow) tile variants, plays through.
- [ ] **5.7** Verification: map-select now shows 6 maps with correct unlock states (Plains/Forest/Tidewater immediately; Mountain at 5★; Riverbend at 13★; Snowfall Pass at 14★). Star totals reflect actual progress. Both new maps' scores persist across reload.

**Commit message:** `ADR-030 Phase 5: Snowfall Pass + Riverbend authored via Cartographer Phase A2`

---

### Phase 6 (optional) — Doc update reflecting 6 maps

If the 6-map count differs from anything documented in CLAUDE.md or `games/index.html` gallery card text, update those references.

- [ ] **6.1** Check `games/index.html` gallery card description; update if it mentions a specific map count.
- [ ] **6.2** Check CLAUDE.md; update if needed.
- [ ] **6.3** Optional: refresh the gallery hero screenshot using the new tile-rendered Plains.

**Commit message:** `ADR-030 Phase 6 (optional): update gallery copy + hero screenshot for 6 maps`

---

### Verification checklist (final — all boxes must tick before merging the PR sequence)

**From review #1:**
- [ ] `window.CTD3TileGrid.classifyPathCells` produces correct cell + rotation lists for all 6 maps
- [ ] All 4 animations visible in-game (bob, projectile rotation, aura pulse, muzzle flash)
- [ ] All 4 existing maps render correctly with kit tiles (no z-fighting, no gaps, smooth corners)
- [ ] Both new maps (Snowfall Pass, Riverbend) load + play + persist scores
- [ ] Snowfall Pass uses `snow_tile_*` variants; Mountain uses standard tiles
- [ ] Editor 3D preview matches what the runtime renders for the same map
- [ ] Editor Decor tool places decorations that round-trip through `window.CTD3Decorations`
- [ ] Editor export validator rejects non-integer waypoints (red error visible)
- [ ] Decorations live in `window.CTD3Decorations[map.id]`; runtime Map shape has NO `decorations` field
- [ ] `engine.makeEnemy` does NOT have a `bobPhase` field (C-1 verified)
- [ ] `wardenAuraNodes` registry persists across frames (verified by inspecting scene graph at runtime)
- [ ] `fire` engine event has `towerId` AND consumer in `scene.flashTower` is wired in the same commit (M-2)
- [ ] `tile_path_split` and `tile_path_crossing` NOT present in manifest (M-4)
- [ ] Mobile emulation (390×844) — palette, sheets, settings, editor all readable
- [ ] FPS ≥ 30 on mobile-emulated with all 6 maps
- [ ] Total GLB payload ≤ 8 MB
- [ ] Zero console errors on all screens, desktop + mobile
- [ ] ADR-029 amended with Phase A2 section (3D preview justification + decoration palette)

**Added by review #2:**
- [ ] **CRIT-2**: Restart Plains 3× consecutively; `wardenAurasGroup.children.length` matches currently-placed Wardens, never accumulates
- [ ] **CRIT-3**: `wardenAurasGroup` exists as a Three.js Group distinct from `decalsGroup` in `scene.init()`; `decalsGroup.clear()` does NOT empty aura rings
- [ ] **MAJ-1**: Edit a waypoint to a diagonal coord in the editor; preview shows a yellow pill instead of throwing; runtime `paintTerrain` logs an error and renders bare ground
- [ ] **MAJ-2**: Place a Snowfall Pass `detail_crystal` decoration with `size: 'large'`; runtime renders the kit's `detail_crystal_large` mesh (kit ships it — see §5 deviation note). For decoration types whose `_large` is absent, the defensive `scale.setScalar(1.5)` branch in `paintDecorations` activates instead. Either path produces no magenta cube.
- [ ] **MAJ-3**: Author a new map via the editor; single Copy JSON click → paste once into `maps.js`; both map and decorations populate correctly
- [ ] **MAJ-4**: View page source of `tools/map-editor.html`; `<script src="../tile-grid.js">` appears BEFORE any inline `<script>` block
- [ ] **MAJ-5**: Every existing map's path is axis-aligned (no segment where both dx and dz differ); each map entry in `maps.js` has an old-vs-new comment block
- [ ] **MIN-1**: Snowfall Pass unlock requirement is **14★** (not 7★) in `maps.js`
- [ ] **MIN-2**: Editor canvas dot colors verified: tree `#4a7a3a`, rocks `#8a7a6a`, crystal `#7ab8d4`; none collide with slot grey or waypoint gold
- [ ] **MIN-3**: Deliberately corrupt one `registerMap({...})` call in `maps.js` (missing comma in decorations) → console.error logs the bad entry, other maps still load
- [ ] `assets.hasMesh(id)` helper exists and returns the correct boolean for both present and absent manifest entries
- [ ] No file `games/castle-tower-defense/decorations.js` exists (obsoleted by MAJ-3)

---

## 23. Appendix A — Constants

```js
// scene.js (in addition to ADR-028 Appendix A constants)
MUZZLE_FLASH_MS           = 80
WARDEN_AURA_PULSE_PERIOD_MS = 800     // 1 / (2π / period_in_seconds) → ~1.25 Hz period
WARDEN_AURA_SCALE_AMP     = 0.05
WARDEN_AURA_OPACITY_BASE  = 0.5
WARDEN_AURA_OPACITY_AMP   = 0.15

ENEMY_BOB_RATE_GROUND     = 4         // rad/sec multiplier (gait)
ENEMY_BOB_RATE_FLYING     = 1.6       // rad/sec multiplier (hover)
ENEMY_BOB_AMP_GROUND      = 0.05      // world units
ENEMY_BOB_AMP_FLYING      = 0.18

DECORATION_LARGE_SCALE_FALLBACK = 1.5 // for missing _large variants (e.g., detail_crystal)

// tile-grid.js
GRID_SIZE                 = 1         // world units per tile
PATH_TILE_CAPACITY        = 80        // InstancedMesh capacity per type
```

---

## 24. Appendix B — Cross-reference: review findings → spec sections

| Review | Finding | Spec sections addressing it |
|--------|---------|-----------------------------|
| #1 C-1 | bobPhase belongs in presentation, not sim | §5 (Decoration schema does NOT add bobPhase to engine entity); §11.1 (scene.userData.bobPhase); §22 Phase 1 task 1.7 |
| #1 C-2 | tile-grid algorithm duplication | §4 (new tile-grid.js file); §6 (signatures); §8 (algorithm); §22 task 1.1 |
| #1 C-3 | theme 'winter' silently widens enum | §9 (snow override by map.id, not theme); §16 (Snowfall Pass uses theme: 'mountain') |
| #1 M-1 | Phase 3 + Phase 4 must be atomic | §22 Phase 3 (atomic, renamed "renderer + maps re-author") |
| #1 M-2 | fire event +towerId with consumer atomic | §7; §11.4; §22 Phase 1 tasks 1.9, 1.10, 1.11 (same commit) |
| #1 M-3 | Warden aura needs persistent registry | §12; §22 Phase 1 tasks 1.3, 1.4, 1.5, 1.6 |
| #1 M-4 | split/crossing tiles YAGNI | §19 out of scope; §22 Phase 2 task 2.1 (excluded from copy list) |
| #1 M-5 | grid-snap toggle is a footgun | §13 (always-on snap for path+slot; export validator catches non-integers); §22 task 4.6, 4.7 |
| #1 M-6 | 3D preview contradicts ADR-029 §10 | §13 (re-opened formally); §22 task 4.9, 4.10 |
| #1 M-7 | decorations on Map shape erodes m-5 | §5 (Map shape unchanged; CTD3Decorations parallel); §14 (registerMap helper) |
| #1 N-1 | "Bresenham" overstates algorithm | §8 (renamed "axis-aligned segment walk") |
| #1 N-2 | new maps' unlock unspecified | §16, §17 (unlock requirements set: 13, 14) |
| #2 CRIT-1 | "addressed" framing confuses plan vs code | §22 task list calls out code work explicitly per phase |
| #2 CRIT-2 | clearPlayfield doesn't clear wardenAuraNodes | §12 (clearPlayfield extension); §22 task 1.6 + verification regression test |
| #2 CRIT-3 | aura rings need separate Three.js Group | §12 (wardenAurasGroup distinct from decalsGroup); §22 task 1.3 |
| #2 MAJ-1 | classifyPathCells must not throw | §6 (return ClassifyResult discriminated union); §8 (never throws); §9 (caller graceful degrade); §13 (preview yellow pill) |
| #2 MAJ-2 | _large fallback for missing kit variants | §5 (Decoration size rules); §10 (paintDecorations fallback); §6 (assets.hasMesh helper); §22 task 2.4 |
| #2 MAJ-3 | two-paste violates ADR-029 E1 | §13 (single combined export); §14 (registerMap helper); §22 task 4.8 |
| #2 MAJ-4 | classic vs ESM script timing | §13 (explicit `<head>` order with ORDER MATTERS comment); §22 task 4.1 |
| #2 MAJ-5 | existing maps have diagonal segments | §15 (all 4 maps re-authored); §22 Phase 3 task 3.5 |
| #2 MIN-1 | Snowfall Pass unlock too low | §16, §17 (raised to 14★) |
| #2 MIN-2 | decoration dot colors specified | §13 (explicit hex: #4a7a3a, #8a7a6a, #7ab8d4) |
| #2 MIN-3 | decorations.js syntax fragility | §14 (registerMap try/catch); §19 out of scope (decorations.js not created) |

---

*End of ADR-030.*
