# ADR-031 — CTD3 WFC procedural fill + Cartographer Phase A3

**Status:** Implemented + verified, 2026-05-19.
**Extends:** [ADR-028](028-castle-tower-defense-3d.md) (3D rewrite) + [ADR-030](030-castle-tower-defense-tile-renderer.md) (tile renderer) + [ADR-029](029-castle-tower-defense-map-editor.md) (Cartographer A1 / A2).
**Supersedes the deferral:** ADR-029 Phase A2 originally promised WFC, then re-deferred it; this ADR is what actually shipped. ADR-029's "Phase A3 (hypothetical)" line is now retired.

## 1. Context & goal

ADR-030 wired Kenney path tiles into the runtime and Cartographer. In-browser testing surfaced three issues:

1. **HOW TO PLAY button was a no-op stub** (`game.js` line 239, `case 'show-help': break;`). User couldn't see a tower/enemy legend in-game.
2. **Path tiles showed visible seams** after the ADR-030 corner-rotation fix. Root cause (found via UV inspection): the kit's default tile orientation points **+Z**, not +X — my DIR_ROTATION table was inverted by 90°, so straight tiles were laid down perpendicular to the corner tiles' band, creating visible jogs at every junction.
3. **Maps looked "really really bare."** The non-path field was a uniform `tile_ground` grid; 20+ kit terrain variants (`tile_bump`, `tile_hill`, `tile_rock`, `tile_tree*`, snow versions) were unused.

User direction: keep hand-authoring/modify/override; add WFC as a complement, not a replacement; build the strongest authoring tools possible in the editor; root-cause the seams.

The intended outcome: every map has visually rich, replayable terrain; authors can hand-tune or let WFC fill; the editor offers WFC-fill + seed control + live 3D preview; the title screen has a working in-game reference modal; the kit-tile path renders without visible discontinuities.

## 2. Pillars (carried from ADR-028)

P1 cozy · P2 deliberate · P3 phone-readable · P4 asset-driven · P5 belongs at chases.house. Specific call-outs:

- **P4** is the biggest driver: 13 new GLB variants finally pull their weight; the kit is no longer asset-fighting by neglect.
- **P1 cozy** dictates the WFC adjacency restrictions (no dense tree-quad fields; crystals breathe).
- **P3 readability** budgets the WFC palette to 9 ids per theme — visual variety without overwhelming small viewports.

## 3. What shipped

### 3.1 HOW TO PLAY modal (Phase 1, commit `3ef2a74`)

A new `<div class="screen" data-screen="help">` modal hydrated at click time from `window.CTD3Entities.TOWERS` / `.ENEMIES`. Tower cards show cost + targets + a one-line role hint; enemy cards show HP + speed + a meta tag (`standard` / `flying` / `armored` / `boss`). Captain card gets a terracotta border (`.boss` class). Tips section below the legends.

Wiring: `case 'show-help': window.CTD3Ui.fillHelpScreen(); window.CTD3Ui.setScreen('help')` replaces the no-op stub. `case 'dismiss-help': window.CTD3Ui.setScreen('title')` returns the user.

### 3.2 Path-seam root-cause fix (Phase 2, commit `d25f375`)

Vertex/UV inspection in the live browser of `tile-straight.glb` (UV (0.09, 0.68) spans tile-local x ∈ [-0.38, +0.38], z ∈ [-0.5, +0.5]) and `tile-end-round.glb` (band reaches z=+0.5 edge; rounded back at z=-0.38) revealed the kit's default tile orientation is **+Z**, not +X. The CORNER_ROTATION table fix in commit `ac4d358` had been derived correctly for corners, but the DIR_ROTATION lookup for straights and ends was based on the wrong assumption.

Fix in `tile-grid.js`:

```js
const DIR_ROTATION = { 'x+': Math.PI / 2, 'z+': 0, 'x-': -Math.PI / 2, 'z-': Math.PI };
```

And the straight branch:

```js
cell.rotation = (nextDir === 'x+' || nextDir === 'x-') ? Math.PI / 2 : 0;
```

Corner table unchanged (it was already correct per the empirical derivation in `ac4d358`).

Verified: Plains now renders a continuous, seamless brown ribbon. Corner-to-straight transitions show no visible band-width discontinuities.

### 3.3 WFC core + new kit assets (Phase 3, commit `e823b87` part 1)

`games/castle-tower-defense/wfc.js` (~190 LOC, pure IIFE, `window.CTD3WFC`):

- **Mulberry32 PRNG** seeded per call (deterministic).
- **FNV-1a `hashSeed(str)`** maps `map.id` strings to uint32 seeds.
- **Per-cell possibility-set lattice**: each cell holds `Set<tileId>` of currently-possible IDs.
- **Entropy-collapse loop**: pick lowest-entropy cell (fewest possibilities), weighted-random collapse from `palette`, propagate constraints to 4 neighbors. Repeat.
- **Contradiction recovery**: if a cell's possibility set is emptied, restore the full palette rather than crash. Visual variety degrades gracefully under impossible constraints.
- **Pre-seed map**: cells handed in as pinned (path classifications, hand-authored decorations) are honored as immutable neighbors during propagation.

Decision: NOT a port of Web-DnD's 1580-LOC WFC. That implementation handles 3D modules with socket coherence, multi-tier validation, etc. — overkill for a 24×16 grid with 9 mutually-compatible tile types. A focused 190-LOC implementation gets the same visual outcome.

`games/castle-tower-defense/wfc-rules.js` (~95 LOC, `window.CTD3WFCRules`):

- **STANDARD_PALETTE** (9 ids): `tile_ground` weight 55 (dominant), then `tile_bump` 10, `tile_tree` 9, `tile_rock` 7, `tile_ground_dirt` 6, `tile_hill` 6, `tile_tree_double` 4, `tile_tree_quad` 2, `tile_crystal` 1.
- **SNOW_PALETTE** (9 ids): snow_tile_ground dominates; `tile_ground` weight 3 leaves a sparse green peek-through for visual interest.
- **Adjacency** built by `buildAdjacency`: universal compatibility by default (every kit terrain tile shares the same flat-grass base, so they all sit happily next to each other). Restrictions: `tile_tree_quad` doesn't sit next to itself (avoids visually solid forest blocks) or next to rock (cluster separation); crystals avoid neighboring trees (visual breathing room).
- **`allowPathNeighbors`** extends every ground tile's adjacency to also accept any of the 6 path tile IDs (`tile_path_*` + `snow_tile_path_*`). Path tiles in turn accept any ground or path neighbor.
- **`rulesForMap(map)`** picks the right palette + adjacency by `map.id` (currently only `'snowfall_pass'` switches to snow).

13 new GLBs from the Kenney TD kit copied to `assets/models/`:
- Standard: `tile_bump`, `tile_hill`, `tile_rock`, `tile_tree`, `tile_tree_double`, `tile_tree_quad`, `tile_crystal`.
- Snow: `snow_tile_bump`, `snow_tile_hill`, `snow_tile_rock`, `snow_tile_tree`, `snow_tile_tree_double`, `snow_tile_tree_quad`.

MANIFEST.json + LICENSE.txt updated.

### 3.4 WFC runtime integration (Phase 4, commit `e823b87` part 2)

`scene.paintTerrain` rewritten:

```
1. Compute path cell set (existing, ADR-030 §9).
2. Determine palette + adjacency from CTD3WFCRules.rulesForMap(map).
3. Build pre-seed Map: each path cell → its classified path tile ID.
4. Run CTD3WFC.generate({ bounds, palette, adjacency, preSeed, seed }).
5. Group emitted tile IDs → one InstancedMesh per variant; add to scene.
6. Path tiles render unchanged (cloned, rotated per CORNER_ROTATION).
7. Castle + slots unchanged.
8. paintDecorations(map.id) — hand-authored decorations still respected.
```

Previous `groundInstancedMesh` (single InstancedMesh) replaced with `groundInstancedMeshes: Map<tileId, InstancedMesh>`. New helper `clearGroundInstancedMeshes()` disposes per-instance GPU buffers across all variants on map switch (geometry/material refs are shared with the assets cache and never disposed — see review-#3 MAJOR-2 in ADR-030 §21).

**wfcMode behavior** (Map shape addition):

- `'off'`: uniform `tile_ground` / `snow_tile_ground` (pre-ADR-031 visuals).
- `'augment'` (default): WFC generates terrain variants; hand-authored decorations render on top untouched.
- `'fill'`: same as augment in current implementation; reserved for a future pass where WFC also generates decoration placements (currently hand-authored decorations always render).

**wfcSeed** (optional Map field, uint32): explicit seed. Default = `hashSeed(map.id)`, so each map's "look" is stable across reloads. Authors can pin a specific seed if they like a particular layout.

Performance: 9 InstancedMeshes (one per variant) vs the previous 1. FPS measured at 30 on desktop (down from 60); within ADR-028 §13's ≥30 budget. The kit's tree/rock tiles add visible-detail vertices that account for the cost.

### 3.5 Cartographer Phase A3 (Phase 6, commit `e238479`)

Editor (`tools/map-editor.html`):

- `<script src="../wfc.js">` + `<script src="../wfc-rules.js">` loaded after `tile-grid.js` (classic order; before any inline scripts read `window.CTD3WFC`).
- New **"Procedural fill (WFC)"** section in the Map Header sidebar:
  - **WFC mode** dropdown: `off` / `augment` (default) / `fill`.
  - **Seed** number input (blank = auto-hash of `map.id`) + **Re-roll** button.
  - Brief help text explaining the mode semantics.
- **Re-roll** generates a fresh `uint32` seed via `Math.random() * 0xFFFFFFFF >>> 0`, writes it into the seed textbox, and triggers `refresh()` which re-runs the preview.
- **3D preview** module: the existing lazy-imported Three.js preview pane now calls `CTD3WFC.generate` for non-path cells. Path cells stay pre-seeded so the band traces correctly. Falls back to uniform ground when `wfcMode === 'off'` or WFC modules are unloaded.
- **`buildExportMap`**: emits `wfcMode` only when non-default ('augment'); emits `wfcSeed` only when explicitly set. Keeps the runtime Map JSON clean for default cases.

Note: A future "Generate Path" feature (Scope C-lite from the plan) was deferred. The current editor still requires hand-authored waypoints. Generating an axis-aligned starting path via WFC is a viable additive feature.

### 3.6 Maps file shape (backwards-compatible)

The runtime Map shape (ADR-028 §6) is extended with two **optional** fields:

```ts
type Map = {
  // ...existing fields...
  wfcMode?: 'off' | 'augment' | 'fill';   // default: 'augment'
  wfcSeed?: number;                        // default: hashSeed(map.id)
};
```

Existing maps in `maps.js` do not need to declare these. `paintTerrain` reads `map.wfcMode || 'augment'` and computes the default seed. Any existing map gets WFC variety automatically; opting out is a single field add.

## 4. Decisions deferred / out of scope

- **Generate Path (Scope C-lite)**: editor-only procedural starting paths. Deferred; current editor still requires hand-authored waypoints.
- **WFC for tower/enemy placement**: not in scope.
- **Procedural water/river networks**: river decorations remain hand-authored. The kit's river slope/transition/waterfall variants are deferred.
- **Lighthouse / mobile FPS detailed analysis under WFC**: bare-minimum desktop FPS check (≥30) passed; rigorous mid-range mobile measurement is deferred.

## 5. Verification

End-to-end via Chrome DevTools MCP (2026-05-19):

1. **HOW TO PLAY** — title → click → modal opens with 4 tower cards (Ranger/Catapult/Mage/Warden) + 6 raider cards (Footman/Heavy/Runner/Skirmisher/Shielded/Captain) hydrated from CTD3Entities. Captain card boss-bordered. GOT IT returns to title. Zero console errors.
2. **Seams** — Plains renders a continuous brown ribbon with smooth L-bends; no visible band-width discontinuity at corner-to-straight transitions.
3. **WFC determinism** — Node-side test: same seed → bit-identical output. Different seeds → ~75% of cells differ.
4. **WFC pre-seed** — Path cells stay pinned during propagation; the WFC fills around them.
5. **WFC variety in browser** — Plains' field shows trees + bumps + rocks + hills distributed across cells; not uniform.
6. **Editor WFC controls** — Map Header sidebar has wfcMode dropdown + seed input + Re-roll button.
7. **Editor 3D preview** — reflects WFC: cells visibly populated with variety.
8. **Maps shape backwards-compat** — all 6 existing maps load without explicit `wfcMode` / `wfcSeed`; default 'augment' + hashed seed renders them with WFC variety.
9. **FPS** — 30 desktop (down from 60 pre-WFC; within ADR-028 §13 ≥30 budget).
10. **Console hygiene** — 0 new errors. The pre-existing `bgm_loop.ogg` / `ambient_loop.ogg` 404s remain (documented in `assets/LICENSE.txt`).

## 6. Risks + mitigations

| # | Risk | Mitigation |
|---|------|------------|
| R1 | WFC contradicts on small bounded grids | `propagate` falls back to full-palette possibility set on contradiction (never crashes). Universal-compat adjacency keeps contradictions rare. |
| R2 | Multiple InstancedMeshes blow draw-call budget | 9 ground variants + 3 path types + castle + 24 towers ≈ 37 draw calls — within ADR-028 §13's 80 budget. |
| R3 | FPS regression on mobile | Desktop measured at 30 FPS post-WFC. Mobile measurement deferred; if regression is >50%, ship the `wfcMode: 'off'` escape hatch per-map or tune palette down to 5-6 variants. |
| R4 | Re-rolling editor seed surprises authors | Re-roll explicitly invoked by button; the chosen seed is shown in the input field so authors can save it via the combined JSON export. |
| R5 | Future map adds an `id` that hits a contradiction-prone seed | Author can override via the editor's seed input until visually satisfied. |

## 7. Files

| File | Status | What |
|------|--------|------|
| `games/castle-tower-defense/wfc.js` | NEW | WFC core (190 LOC, pure IIFE). |
| `games/castle-tower-defense/wfc-rules.js` | NEW | Palettes + adjacency + theme selector (95 LOC). |
| `games/castle-tower-defense/scene.js` | MAJOR | paintTerrain WFC integration; clearGroundInstancedMeshes helper. |
| `games/castle-tower-defense/index.html` | MINOR | help screen markup + CSS + script loads. |
| `games/castle-tower-defense/ui.js` | MINOR | `fillHelpScreen()` hydrator. |
| `games/castle-tower-defense/game.js` | MINOR | `show-help` / `dismiss-help` handlers. |
| `games/castle-tower-defense/tile-grid.js` | MINOR | DIR_ROTATION + straight rotation fix. |
| `games/castle-tower-defense/tools/map-editor.html` | MAJOR | WFC controls + preview integration. |
| `games/castle-tower-defense/assets/MANIFEST.json` | EXPAND | +13 entries for ambient terrain. |
| `games/castle-tower-defense/assets/models/` | EXPAND | +13 kit GLBs (tile_bump/hill/rock/tree*/crystal + snow). |
| `games/castle-tower-defense/assets/LICENSE.txt` | APPEND | Per-file kit source mapping. |
| `docs/adr/031-wfc-procedural-fill-and-editor.md` | NEW | This file. |
| `docs/adr/029-castle-tower-defense-map-editor.md` | n/a | Phase A2 deferral note remains accurate; this ADR supersedes the "Phase A3 (hypothetical)" line. |

---

*End of ADR-031.*
