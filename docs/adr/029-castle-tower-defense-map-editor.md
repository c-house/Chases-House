# ADR-029 — Castle Tower Defense map editor ("The Cartographer")

**Status:** Accepted (Phase A1 only), 2026-05-17.
**Re-opens:** [ADR-028](028-castle-tower-defense-3d.md) §18 ("Sandbox / free-build / map editor" was out of scope for v1).
**Inspired by:** the Wave Function Collapse implementation in the user's `Web-DnD` project (`packages/engine/src/maps/wfc/`) and the original [WaveFunctionCollapse README](https://github.com/mxgmn/WaveFunctionCollapse).

## Accepted decisions (from §8 open questions)

1. **Name: "The Cartographer."** Fits the chases.house parchment / cozy aesthetic and is honest about being an authoring tool (not a player-facing feature).
2. **§4: NO WFC in v1.** Per YAGNI burden of proof — none of the three justification criteria are met (3 maps today, no Phase B in scope, click-to-paint untested). §6 and §7 are recorded below for historical context but are NOT in the accepted scope.
3. **§5 polyline shape: Option (B) — continuous-world waypoint editor.** Click to drop waypoints in world space, NOT a tile-grid painter. Preserves the diagonal waypoint look of existing maps (e.g. Plains' `{x: -8, z: 3}, {x: -4, z: 2}`). Eliminates the C-R2 stepped-vs-diagonal divergence entirely. Simpler authoring; no tile-grid → polyline derivation step needed.
4. **Tool-page loading: Option (b) — inline.** Copy ~30 LOC of `bakeMap` + `sampleOnPath` into the editor with a provenance comment pointing to `engine.js` as canonical. Consistent with the existing `bake-icons.html` precedent.
5. **Sequencing: ship now**, independent of ADR-028 Phase 1.7 (audio sourcing).

Sections §6 and §7 (WFC + tile model) remain in the document for historical context but are explicitly **out of accepted scope**. They would be re-opened only if a future ADR justifies WFC per §4's criteria.

> The Phase A1 task list in §9 is the authoritative implementation plan. Phase A2 (WFC) and Phase B (player Workshop) are not scoped here.

---

## 1. Context

### Why now
ADR-028 deferred a map editor as out of scope to ship the 3D rewrite. The 3D base game now exists (Phases 0–1, Phase 2 foundation committed). The user surfaced a proven WFC implementation in `Web-DnD` — a sibling project with a fully-engineered, extraction-friendly WFC core in TypeScript. That changes the cost calculus: a procedural editor is closer to reach than it was at ADR-028 time.

### What's already in the game
- 3 hand-authored maps in [games/castle-tower-defense/maps.js](../../games/castle-tower-defense/maps.js) — Plains, Forest, Mountain.
- Each map carries a `path: Array<{x, z}>` polyline (~8–13 waypoints), `buildSlots`, `castle`, `theme`, and a `waves` array.
- The engine consumes the polyline via [`bakeMap` and `sampleOnPath`](../../games/castle-tower-defense/engine.js) — segment lengths + linear interpolation along path-t.
- A tool-page precedent exists at [tools/bake-icons.html](../../games/castle-tower-defense/tools/bake-icons.html) (one-shot, self-contained, no game runtime loaded).

### Scope statement
The user's clarifying answer "Both, in phases" means the editor will eventually be player-accessible. **This ADR scopes Phase A — the dev tool — only.** Phase B (player-accessible Workshop UI, `ctd3:userMaps`, shareable maps, daily-seed mode) is a follow-up ADR contingent on Phase A shipping. The user's "Both, in phases" should NOT be read as approval of any specific Phase B features.

### Engineering priority (from CLAUDE.md)
**DRY > YAGNI > SOLID > KISS.** No build step. No backend. Plain HTML/CSS/JS. GitHub Pages hosting.

---

## 2. Pillars

Three pillars. Each is falsifiable.

| # | Pillar | Falsifiable test |
|---|--------|------------------|
| E1 | Authoring should be faster than hand-typing JSON. | Time-to-author a new map drops from "many minutes of hand-typing + browser reloads" to "place tiles, click export, paste once." If editor produces maps no faster than typing JSON, the editor failed. |
| E2 | Editor output must be drop-in compatible with existing engine code. | New maps load into the running game with no changes to `engine.js`/`scene.js`. Export format = the existing `Map` shape verbatim. |
| E3 | Editor is a dev tool, not a game feature. | Lives at `tools/map-editor.html` alongside `bake-icons.html`. Not linked from the game UI. Not loaded by the game. No player-facing surface. |

---

## 3. Name workshop

| Candidate | Vibe | Tradeoff |
|-----------|------|----------|
| **The Cartographer** | parchment-warm, literary; carries the 2D-era manuscript aesthetic forward | doesn't telegraph "for devs"; sounds player-facing |
| **The Loom** | concise; fits WFC "weave the world" metaphor | only makes sense if §4 = "yes WFC"; opaque otherwise |
| **Field Forge** | fits the "Field the First / Second / Third" map naming; medieval-craft active verb | rhymes with too many other "Forge" products |
| **Mapmaker** | concise, plain | flavorless |
| **The Workshop** | matches the deferred Phase B "Workshop" framing; honest | generic; doesn't lean on any theme |

**Recommendation:** **The Cartographer** for the dev tool (Phase A), reserving **The Workshop** for the player-facing Phase B if it ever ships. Author surfaces the Cartographer's tool from the file system; players never see it.

---

## 4. Forced decision: does this editor need WFC?

YAGNI is the project's third-highest principle. **WFC requires positive justification to be included.** Without justification, the default per YAGNI is: editor ships click-to-paint only, no procedural generation.

### What counts as justification
At least one of the following must hold for WFC to land in v1:
- **Authoring volume:** more than ~10 maps will be authored over the next year. (Today: 3 maps, no concrete plan for more.)
- **User-facing generation:** a player feature requires runtime generation (a Daily Random mode, infinite mode, etc.). **(Phase B; not in scope for this ADR.)**
- **Click-to-paint is genuinely insufficient:** the author has tried click-to-paint and finds it slower than typing JSON. (Untested; needs Phase A1.1 first.)

### Honest comparison
The choice is not "WFC vs. hand-typing JSON" (the existing 3 maps are typed). It's "WFC vs. a click-to-paint editor" — both options require the editor to exist; WFC is an additive feature on top. Click-to-paint serves authoring volume up to dozens of maps with no algorithmic complexity. WFC adds value only when authoring volume scales beyond what manual placement comfortably handles.

### Default if no justification surfaces
**§4 = "no WFC".** §6 (WFC option appendix) and §7 (Tile model adaptation) are dropped from the accepted ADR. §5 (manual editor) ships alone. The Cartographer's tool is click-to-paint and JSON-export; the WFC code is never written.

---

## 5. Editor scope (manual baseline)

This section ships regardless of §4's outcome.

### File manifest

```
games/castle-tower-defense/tools/
└── map-editor.html              NEW — top-down grid canvas, palette, pin tools, export
```

That is the entire file set for Phase A1. The editor is a single self-contained HTML page mirroring [bake-icons.html](../../games/castle-tower-defense/tools/bake-icons.html)'s pattern — no game runtime, no module dependencies on `engine.js`/`scene.js`/`ui.js`. Inlines the ~30 LOC of `bakeMap` + `sampleOnPath` with a provenance comment (see §5.5).

### Editor internal state (NOT exported, NOT persisted)

```ts
{
  gridW: number,             // columns
  gridH: number,             // rows
  tileGrid: number[][],      // [row][col] → tileTypeIndex (0 = empty ground)
  entry: { col: number, row: number } | null,
  exit:  { col: number, row: number } | null,
  slots: Array<{ id: string, col: number, row: number }>,
  theme: 'plains' | 'forest' | 'mountain',
  meta: {                    // header fields editable in a sidebar
    id: string,
    displayName: string,
    roman: string,
    chip: string,
    chipKind: '' | 'gold' | 'locked',
    description: string,
    thumbIcon: string,
    unlockRequirement: number,
  },
  waves: Wave[]              // editing waves is OUT of scope for v1; passthrough only
}
```

### Tile palette (manual baseline)

Tile-type indexes 0..N where N is the minimal vocabulary derived from the Kenney TD kit's path tiles. **Number deferred to implementation time** (must inventory `assets/models/Textures/` consumers and the kit's `tile-*.glb` set; expected count is ~5: `ground`, `path_straight`, `path_corner`, `path_t`, `path_cross`).

The editor's palette is a row of buttons (one per tile-type) at the top of the screen. Clicking selects active tile. Clicking a grid cell paints with active tile. Right-click clears to `ground`.

### Pin tools

A second row of buttons: `[Entry] [Exit] [Slot+]`. Clicking puts the editor in "pin mode" for that pin kind. Clicking a grid cell sets the pin (Entry/Exit replace; Slot+ adds with auto-incremented id `s1`, `s2`, ...). Right-click in slot mode removes the nearest slot.

### Tile-grid → polyline conversion (the centerpiece — see §8 open question)

The export step derives a polyline by walking the grid from `entry` to `exit` along path-typed tiles:

```js
function derivePolylineFromGrid(state) {
  // BFS/A* over tileGrid, starting at state.entry, ending at state.exit,
  // traversing only tiles whose tile-type is path-typed (not 'ground').
  // Output: ordered array of grid cells along the path.
  const cells = walkPathCells(state);
  // Convert grid cells to world coords (1 tile = 1 world unit, grid origin centered).
  return cells.map(({col, row}) => ({
    x: col - state.gridW / 2,
    z: row - state.gridH / 2
  }));
}
```

**Important characteristic** (see §8 C-R2 open question): this produces an **axis-aligned stepped polyline** (90° corners at tile boundaries). Current hand-authored maps in `maps.js` use **diagonal world-space waypoints** (e.g., Plains has `{x: -8, z: 3}, {x: -4, z: 2}` — a long diagonal across several tiles). Two possible resolutions:

- **(A) Accept stepped paths** as the editor's character. New maps will look different from the existing 3 (right-angle corners instead of diagonals). Verify `scene.js:paintTerrain`'s ribbon mesh handles 90° corners without degenerate segments.
- **(B) Editor works in continuous world space** — click-to-place waypoints (no tile grid). Eliminates the WFC connection entirely; §4 = "no WFC" becomes forced. Simpler authoring, no shape divergence.

This question must be resolved by the user before implementation begins.

### Connectivity validator

Reuses inlined `bakeMap` + `sampleOnPath`:

```js
function validateConnectivity(map) {
  // map is the constructed export-shape object.
  if (!map.path || map.path.length < 2) return { ok: false, reason: 'path too short' };
  const baked = bakeMap(map);  // mutates map in place; sets totalLength etc.
  if (baked.totalLength <= 0) return { ok: false, reason: 'zero-length path' };
  // Endpoint sanity: last polyline point should be within 1 unit of castle.
  const last = map.path[map.path.length - 1];
  const dCastle = Math.hypot(last.x - map.castle.x, last.z - map.castle.z);
  if (dCastle > 1.5) return { ok: false, reason: 'path does not reach castle' };
  return { ok: true };
}
```

Validation runs on the *derived polyline*, not the tile grid. Tile-grid sanity (entry connected to exit through path tiles) is a separate check that runs during `derivePolylineFromGrid` and fails fast if no path exists.

### Export format (drop-in compatible with `maps.js`)

The export produces the exact `Map` shape consumed by [engine.js:bakeMap](../../games/castle-tower-defense/engine.js):

```ts
{
  id: string,
  displayName: string,
  roman: string,
  chip: string,
  chipKind: '' | 'gold' | 'locked',
  description: string,
  thumbIcon: string,
  unlockRequirement: number,
  theme: 'plains' | 'forest' | 'mountain',
  castle: { x: number, y: number, z: number },
  path: Array<{ x: number, z: number }>,    // derived polyline (NOT tile-grid)
  buildSlots: Array<{ id: string, x: number, z: number }>,
  waves: Wave[]                              // passthrough; editor doesn't author waves in v1
}
```

The editor's `tileGrid` is **NOT in the export**. This preserves [ADR-028 §8 m-5](028-castle-tower-defense-3d.md) (tile grid is authoring-time-only, never in the runtime Map shape). The user pastes the JSON into the `MAPS` array in `maps.js` and commits.

### Function signatures (editor's internal API)

```js
// Painting + pins
function paintTile(state, col, row, tileTypeIndex): void
function setEntry(state, col, row): void
function setExit(state, col, row): void
function addSlot(state, col, row): { id: string }   // returns the auto-assigned id
function removeSlot(state, col, row): void          // removes nearest slot

// Derivation
function derivePolylineFromGrid(state): Array<{ x: number, z: number }>
function deriveBuildSlots(state): Array<{ id: string, x: number, z: number }>
function deriveCastle(state): { x: number, y: number, z: number }   // from exit pin + theme

// Validation
function validateConnectivity(map): { ok: boolean, reason?: string }

// Export
function exportToMapJson(state): object                              // the Map shape above
function copyExportToClipboard(state): Promise<void>

// Inlined from engine.js (copy with provenance comment)
function bakeMap(map): object                       // ~20 LOC; canonical source is engine.js
function sampleOnPath(map, t): { x: number, z: number }   // ~10 LOC; canonical source is engine.js
```

---

## 6. WFC option appendix *(conditional on §4 = "yes")*

If §4's justification criteria are met, this section's content lands in the accepted ADR. Otherwise it is dropped.

### File manifest (additional)

```
games/castle-tower-defense/tools/
└── wfc.js                       NEW — plain-JS port of Web-DnD WFC core
```

Located under `tools/` because WFC runs **only in the editor**, never in the runtime game (per ADR-028 §8 m-5 + §5 export-as-polyline). Not in `games/shared/` because per ADR-028 §7's first-caller precedent, `shared/` placement requires at least two confirmed callers. The Cartographer is the first and only caller.

### What ports cleanly (from `Web-DnD/packages/engine/src/maps/wfc/`)

| Web-DnD source | Ports to | Notes |
|----------------|----------|-------|
| `wfc-grid.ts` — `WFCGrid` class, `collapse()`, `collapseProgressive()` | `WFCGrid` factory in `wfc.js` | Drop `WFCPin.moduleId`; the source's `pin.moduleId ?? pin.tile` resolution collapses to plain `pin.tile`. |
| `propagate.ts` — AC-3 + `AdjacencyRules` (n/e/s/w) + delta-journal | `propagate()` + `AdjacencyRules` shape | Pure algorithm; no D&D coupling. |
| `entropy.ts` — `EntropyHeap`, Shannon entropy + cached invalidation | `EntropyHeap` class | Pure algorithm. |
| `build-adjacency.ts` — `SocketCompatFn<T>` → `AdjacencyRules` factory | `buildAdjacency()` function | Generic over tile vocabulary. |
| `modules.ts` — D4 symmetry expansion (X/I/L/T/F codes) | `expandSymmetry()` function | See §7 for which codes CTD3 actually needs. |
| `maps/prng.ts` — mulberry32 seeded PRNG (15 lines, ONE LEVEL ABOVE the wfc/ folder) | **Inline directly** into `wfc.js` | NOT a separate file. No second caller in CTD3. |

### What is NOT ported

| Web-DnD source | Why skipped |
|----------------|-------------|
| `seed.ts` — `seedTacticalMap()` | D&D-specific orchestrator (TerrainProfile, TerrainFeature). CTD3's editor orchestrates separately. |
| `pre-seed.ts` — water/path simplex + A* | D&D-specific terrain pre-seeding. CTD3 uses click-to-pin endpoints. |
| `regional/wfc-region.ts`, `world/wfc-world.ts` | Hex-grid biome/category solvers. CTD3 is square-tile. |
| `modular3d-compat.ts`, `modular3d-pre-seed.ts` | ADR-097 modular-3D extensions. CTD3 has no modular-3D system. |

### DRY framing — honest fork acknowledgement

**This port is a deliberate DRY violation.** It creates a second source of truth for the WFC algorithm. Web-DnD's WFC is actively evolving (ADR-097 added modular-3D; future ADRs may add more). `tools/wfc.js` will drift from Web-DnD as that evolution continues. **We accept this cost** because:

1. The no-build constraint is load-bearing for the rest of chases.house (CLAUDE.md). Importing the TS source would cascade into a build step.
2. The WFC core is ~800 LOC of pure algorithm. The fork is comprehensible and self-contained.
3. CTD3's WFC use case is much narrower than Web-DnD's: 2D square tiles, P/G socket alphabet, no modular-3D, no seed pre-seeding. Most of Web-DnD's WFC complexity isn't needed here.

Alternates the brainstorm rejected:
- **Vendor a built bundle from Web-DnD's `dist/`**: introduces a build-step coupling at update time; the bundle is opaque to a reader of the chases.house repo.
- **Publish as `@c-house/wfc` on npm + import via ESM CDN like Three.js**: most ceremony; only worth it if a second chases.house game wants WFC.

### Public API surface (port target)

```js
// wfc.js (port — public surface mirrors WFCGrid)
class WFCGrid {
  constructor(config: {
    width: number, height: number,
    weights: Record<string, number>,
    adjacency: AdjacencyRules,
    seed: number,
    maxBacktracks?: number,
    queueOrder?: 'fifo' | 'lifo'
  })
  collapse(): { tiles: string[][], seed: number, backtracks: number }
  collapseProgressive(): Generator<WFCProgress, WFCResult, unknown>
  collapseCell(pos: {x, y}, tile: string): void   // pre-collapse a cell (replaces WFCPin)
}

function pickWeightedTile(weights, rng): string | null
function buildAdjacency(tiles, compatFn): AdjacencyRules
function expandSymmetry(modules): Array<ExpandedTile>
function mulberry32(seed: number): () => number   // inlined helper
```

### Wiring in the editor

When the user clicks the (conditional) "Generate" button in `tools/map-editor.html`:
1. Editor collects grid dimensions, optional pinned tiles (entry, exit), and seed.
2. Calls `new WFCGrid({...})` → `collapse()`.
3. Maps result tiles into `state.tileGrid`.
4. User reviews; clicks "Regenerate" (new seed) or "Accept" (commit to editor state).
5. From there the normal §5 export flow runs (derive polyline, validate, copy JSON).

---

## 7. Tile model adaptation *(conditional on §4 = "yes")*

### Socket vocabulary

**CTD3-local, not derived from Web-DnD's `G/H/S/W`.** Binary alphabet:

```
'P' = path-edge (an edge that connects to a path-tile)
'G' = ground-edge (an edge that connects to a ground/empty tile)
```

Each tile has 4 edges (N/E/S/W) labeled with one socket each. Two tiles are compatible across a shared edge iff their socket labels match.

### Tile catalog (provisional — deferred to kit inventory at implementation time)

| Tile id | Sockets (N,E,S,W) | Symmetry | Kenney mesh (provisional) |
|---------|-------------------|----------|----------------------------|
| `ground` | G,G,G,G | X | `tile.glb` |
| `path_straight` | P,G,P,G | I | `tile-straight.glb` |
| `path_corner` | P,P,G,G | L | `tile-corner-inner.glb` (or `tile-corner-round.glb`) |
| `path_t_split` | P,P,G,P | T | `tile-split.glb` |
| `path_crossing` | P,P,P,P | X | `tile-crossing.glb` |
| `path_end` *(start/finish cap)* | P,G,G,G | L | `tile-end.glb` |

Final count and Kenney mappings deferred until implementation phase verifies the kit inventory matches.

### Symmetry handling

| Code | Meaning | D4 variants | CTD3 uses it? |
|------|---------|-------------|---------------|
| X | full symmetry | 1 | yes (ground, crossing) |
| I | 2-fold rotation | 2 | yes (straight) |
| L | corner/elbow | 4 (rotations only) | yes (corner, end) |
| T | T-junction | 4 (rotations only) | yes (T-split) |
| F | full dihedral (chiral) | 8 (rotations + reflections) | **NO** — verify at implementation time that no Kenney piece is chiral |

**Decision:** Port `expandSymmetry()` with X/I/L/T support only. Omit F. If kit inventory turns up a chiral tile, revisit.

---

## 8. Risks, open questions, recommended spike

### Risks

| # | Risk | Mitigation |
|---|------|------------|
| R1 | Tile-grid stepped paths break `scene.js:paintTerrain` ribbon mesh at 90° corners | Verify visually with one editor-generated map before authoring all three; or pick resolution (B) in §5 (continuous-world editor). |
| R2 | The WFC port drifts from Web-DnD over time | Accept per §6's honest fork acknowledgement; do NOT chase parity with Web-DnD WFC. |
| R3 | Click-to-paint produces maps that look mechanical (90° corners only) compared to existing diagonals | Acceptable for new maps; existing 3 maps may be left as-is. Or pivot to §5(B). |
| R4 | Adding a "Generate" button blurs the editor's purpose — is it a hand-tool or a procgen tool? | Resolved by §4: WFC ships only if positively justified. If §4 = "no", no Generate button exists. |
| R5 | Inlining `bakeMap` + `sampleOnPath` is a DRY violation | Accept for the dev tool. Mark the copy with a provenance comment pointing to engine.js as canonical. If engine.js's signatures change, the editor breaks silently — covered by R6. |
| R6 | Silent drift between editor's inlined utilities and engine.js | Add a CI/manual check that re-runs an editor-exported map through the engine on every implementation pass. Cheap: just play one editor-generated map after every change. |

### Open questions for the user

The brainstorm cannot proceed to Accepted until these are answered:

1. **Name pick** (from §3) — Cartographer, Loom, Field Forge, Mapmaker, or Workshop?
2. **§4 outcome** — does WFC ship in v1? (YAGNI default: no.)
3. **§5 polyline-shape resolution** — accept stepped tile-grid paths (A), or pivot to a continuous-world waypoint editor (B)?
4. **Tool-page module loading** — load `engine.js` IIFE chain into the tool (option a), or inline ~30 LOC of `bakeMap`/`sampleOnPath` per `bake-icons.html` precedent (option b)? Recommendation: **(b)**, consistent with the existing tool pattern.
5. **Sequencing relative to ADR-028** — does the editor ship before, alongside, or after ADR-028's deferred Phase 1.7 (audio sourcing)? The editor is independent of audio; can ship in any order.

### Recommended spike *(only if §4 = "yes")*

**A single self-contained HTML page** at `games/castle-tower-defense/tools/wfc-spike.html` (no external dependencies beyond a local `wfc.js`). It runs WFC on a 10×10 grid with the 5–6 tile vocabulary from §7 and the `P/G` socket alphabet, verifies the result contains at least one entry→exit connected path, and reports total time.

**Gate:** the spike must produce a connected path in **under 1 second** on a mid-range laptop. If it doesn't, the WFC approach is unworkable for CTD3's editor and §4 must flip to "no."

The spike is the only WFC deliverable before any UI work. If it fails the gate, neither `tools/wfc.js` nor the Generate button in `map-editor.html` is built.

---

## 9. Task list (phased, ralph-loop-sized)

### Phase A1 — Manual editor baseline (ships regardless of §4)

- [ ] **A1.1** Author `games/castle-tower-defense/tools/map-editor.html` shell mirroring `bake-icons.html` structure (importmap if needed, inline CSS, no game runtime).
- [ ] **A1.2** Top-down 2D canvas with grid rendering (HTML5 canvas; one tile = N pixels). Resolution toggle (configurable grid dimensions in a header panel).
- [ ] **A1.3** Tile palette UI: row of buttons sourced from the §7 catalog. Active-tile state. Click-to-paint, right-click-to-clear interactions.
- [ ] **A1.4** Pin tools UI: `[Entry] [Exit] [Slot+]` buttons + pin overlays on the canvas.
- [ ] **A1.5** Header form for `meta` fields (id, displayName, roman, chip, chipKind, description, thumbIcon, unlockRequirement, theme).
- [ ] **A1.6** Inline `bakeMap` and `sampleOnPath` (~30 LOC copy) into the editor with provenance comment pointing to `engine.js`.
- [ ] **A1.7** Implement `derivePolylineFromGrid(state)` per §5. BFS over path-typed tiles from entry to exit.
- [ ] **A1.8** Implement `validateConnectivity(map)` per §5. Wire to a status indicator that updates live as the user paints.
- [ ] **A1.9** Implement `exportToMapJson(state)` per §5. "Copy to clipboard" + JSON preview pane.
- [ ] **A1.10** Re-author the existing 3 maps with the editor; diff exported output against `maps.js`. Resolve any deltas (§8 open question 3).
- [ ] **A1.11** Run Chrome DevTools MCP verification: navigate, paint a sample map, export, paste into `maps.js`, boot game, confirm map plays correctly (rest of the game per ADR-028 §13 protocol).

### Phase A2 — WFC integration (*only if §4 = "yes"*)

- [ ] **A2.1** Build the WFC spike (`tools/wfc-spike.html`) per §8. Gate: <1s for a 10×10 grid producing a connected path.
- [ ] **A2.2** If spike passes: port `WFCGrid` from `Web-DnD/packages/engine/src/maps/wfc/wfc-grid.ts` to `tools/wfc.js` with `WFCPin.moduleId` dropped.
- [ ] **A2.3** Port `propagate.ts` (AC-3 + delta-journal backtracking) and `entropy.ts` (`EntropyHeap`).
- [ ] **A2.4** Port `modules.ts` `expandSymmetry()` with X/I/L/T support only (skip F).
- [ ] **A2.5** Port `build-adjacency.ts` `SocketCompatFn → AdjacencyRules` factory.
- [ ] **A2.6** Inline mulberry32 (from `Web-DnD/packages/engine/src/maps/prng.ts`, ~15 LOC) directly into `wfc.js`.
- [ ] **A2.7** Wire "Generate" button in `map-editor.html`. Inputs: grid dimensions, seed, optional entry/exit pins (from existing pin tools). Output: populate `state.tileGrid` from WFC result.
- [ ] **A2.8** "Regenerate" button (new seed) and "Accept" button (commit WFC result to editor state).
- [ ] **A2.9** Repeat A1.11 with one WFC-generated map.

### Phase A3 — Promote to Accepted

- [ ] **A3.1** Edit this ADR's `Status:` line from `Brainstorm (draft)` to `Accepted` with a date.
- [ ] **A3.2** Add an "Accepted decisions" section recording §8's resolved open questions.
- [ ] **A3.3** If A1.10 verified editor parity with existing maps, optionally replace `maps.js` polylines with editor-exported versions in the same PR.

---

## 10. Out of scope (this ADR)

- **Phase B** — player-accessible Workshop UI, `ctd3:userMaps` localStorage, shareable user maps, daily-seed mode. Separate follow-up ADR.
- **Wave editing UI** — `Wave` objects (enemy groups, spacing, reward, isBoss) are not authored by the editor in v1. The export carries `waves` as a passthrough; author edits the array by hand in the JSON paste step.
- **Runtime WFC** — WFC, if it ships per §4, runs only in `tools/`. The runtime game never sees WFC; `engine.js` and `scene.js` are unchanged.
- **Tile-grid in runtime `Map` shape** — preserved as out of scope per [ADR-028 §8 m-5](028-castle-tower-defense-3d.md).
- **Mobile editor UX** — dev tool is desktop-only, matching `bake-icons.html` precedent.
- **3D preview in the editor** — top-down 2D canvas only. To preview in 3D, export and load in the game.
- **Multi-map projects / batch generation** — one map per editor session. Open and edit a different map = reload the page.
- **Undo/redo** — accept the cost of "delete tile and re-paint." Add if user demand exists.
- **Saving editor state mid-edit** — exported JSON is the save format; copy/paste replaces session save.
- **Phase B's open questions** — id-namespacing of user maps vs built-in, dual-source map-select merge logic, save versioning. All moot for Phase A.

---

## Appendix A — Files referenced (read-only)

For the brainstorm reader to follow up:

**ADR-028 + project principles:**
- [CLAUDE.md](../../CLAUDE.md) — engineering priority + no-build constraint
- [docs/adr/028-castle-tower-defense-3d.md](028-castle-tower-defense-3d.md) §7 (first-caller precedent), §8 m-5 (tile grid NOT in runtime Map shape), §18 (out-of-scope source for this ADR)

**CTD3 current state (Phase A1 touches none of these except read-only inlining):**
- [games/castle-tower-defense/maps.js](../../games/castle-tower-defense/maps.js) — `Map` shape the editor exports against
- [games/castle-tower-defense/engine.js](../../games/castle-tower-defense/engine.js) — `bakeMap` and `sampleOnPath` (lines 19–49) — source of the editor's inlined utilities
- [games/castle-tower-defense/scene.js](../../games/castle-tower-defense/scene.js) — `paintTerrain`, the ribbon-mesh renderer that consumes the polyline at runtime (R1 risk surface)
- [games/castle-tower-defense/tools/bake-icons.html](../../games/castle-tower-defense/tools/bake-icons.html) — tool-page pattern precedent

**Web-DnD WFC reference (Phase A2 ONLY; read-only refs):**
- `C:\Users\chase\Projects\Web-DnD\packages\engine\src\maps\wfc\wfc-grid.ts`
- `C:\Users\chase\Projects\Web-DnD\packages\engine\src\maps\wfc\propagate.ts`
- `C:\Users\chase\Projects\Web-DnD\packages\engine\src\maps\wfc\entropy.ts`
- `C:\Users\chase\Projects\Web-DnD\packages\engine\src\maps\wfc\build-adjacency.ts`
- `C:\Users\chase\Projects\Web-DnD\packages\engine\src\maps\wfc\modules.ts`
- `C:\Users\chase\Projects\Web-DnD\packages\engine\src\maps\prng.ts` *(ONE LEVEL ABOVE the wfc/ folder; 15-line mulberry32 — inline directly)*
- `C:\Users\chase\Projects\WaveFunctionCollapse\README.md` — algorithm grounding

---

*End of ADR-029 (Brainstorm draft).*
