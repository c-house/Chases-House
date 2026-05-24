# Spec — CTD3 level-design rulebook + 4-map remap

**Spec path:** `docs/audits/2026-05-18-ctd3-level-design.spec.md`
**Branch:** `refactor/castle-tower-defense-3d`
**Source plan:** `C:/Users/chase/.claude/plans/ultrathink-step-by-step-use-chain-of-tho-elegant-sifakis.md`

This spec defines two commits: a level-design rulebook (12 H-rules + 1 sub-rule + one editor `validate()` check), and a 4-map remap of `games/castle-tower-defense/maps.js`. Snowfall_pass and riverbend are verification-only per Tasks 2.5 and 2.6.

---

## 1. File manifest

| Commit | File | Action |
|---|---|---|
| 1 | `docs/level-design.md` | create |
| 1 | `games/castle-tower-defense/tools/map-editor.html` | modify — extend `validate()` |
| 1 | `games/castle-tower-defense/maps.js` | modify — add top-of-file comment pointer to `docs/level-design.md` |
| 2 | `games/castle-tower-defense/maps.js` | modify — remap plains, forest, tidewater, mountain |

No new ADRs. No new test files. No asset changes.

---

## 2. Interfaces

### 2.1 New `validate()` return form (H6 check)

Existing `validate()` in `games/castle-tower-defense/tools/map-editor.html` at lines 1167–1191 returns `{ ok: boolean, reason?: string, badSegment?: {...}, cellCount?: number }`. The extended function adds one rejection condition, using the same variable name (`m`) the surrounding code already binds (`const m = buildExportMap()`):

```js
{
  const pathCells = new Set();
  for (let i = 0; i < m.path.length - 1; i++) {
    const a = m.path[i], b = m.path[i + 1];
    const dx = Math.sign(b.x - a.x), dz = Math.sign(b.z - a.z);
    let x = a.x, z = a.z;
    while (x !== b.x || z !== b.z) {
      pathCells.add(x + ',' + z);
      x += dx; z += dz;
    }
    pathCells.add(b.x + ',' + b.z);
  }
  for (const s of m.buildSlots) {
    const k = s.x + ',' + s.z;
    if (pathCells.has(k)) {
      return { ok: false, reason: 'slot ' + s.id + ' at (' + s.x + ',' + s.z + ') sits on path' };
    }
  }
}
```

Insertion site: after the existing axis-aligned-path check, before the integer-slot-coords check. Slot coords are integer per the pre-existing integer-slot-coords check (line 1185), so no `Math.round` is required — direct string concatenation matches the path-cell key form.

### 2.2 `docs/level-design.md` structure

Each H-rule in the document follows this fixed shape:

```
### H<N> — <name>
Rule: <one-sentence imperative form>
Validation hint: <how an automated check would express this>
```

H-rules numbered: H1, H2, H3, H4, H5, H6, H7, H8, H8a, H9, H10, H11, H12. The complete H-rule content is specified in §3.3 below; the doc reproduces §3.3 verbatim.

### 2.3 `maps.js` top-of-file comment

A 3-line comment block at the top of `games/castle-tower-defense/maps.js`:

```
/* Map design — see docs/level-design.md for the H1–H12 rulebook.
   New maps must pass tools/map-editor.html validate() (which now
   enforces H6 — no slot on path). */
```

### 2.4 Map data shape (UNCHANGED)

The existing map shape in `maps.js` is unchanged:
```
Map := {
  id: string, displayName: string, roman: string, chip: string, chipKind: string,
  description: string, thumbIcon: string, unlockRequirement: integer,
  theme: 'plains' | 'forest' | 'mountain' | 'snowfall_pass',
  castle: { x: number, y: number, z: number },
  path: Array<{ x: integer, z: integer }>,
  buildSlots: Array<{ id: string, x: integer, z: integer }>,
  waves: Array<...>,
  wfcMode?: 'off' | 'augment' | 'fill',
  wfcSeed?: number
}
```

Only field values change per commit 2; shape is invariant.

---

## 3. Schemas

### 3.1 World bounds

```
WORLD_HALF_X = 14   (x ∈ [-14, 14] inclusive)
WORLD_HALF_Z = 9    (z ∈ [-9, 9] inclusive)
```

Source: `games/castle-tower-defense/tools/map-editor.html:580-581`.

### 3.2 Tower coverage radii (constraints — not modified)

Source: `games/castle-tower-defense/entities.js`.

| Tower | Behavior | T1 range/aura | T3 range/aura |
|---|---|---|---|
| Ranger | projectile | 7.5 | 10 |
| Catapult | projectile | 7.0 | 9.0 |
| Mage | projectile | 8.0 | 10 |
| Warden | aura | 6.0 | 8.0 |

**Canonical T1 range:** 7.5u (the Ranger). Any H-rule that references "T1 range" without naming a tower uses 7.5u.

### 3.3 H-rule rulebook (full content for `docs/level-design.md`)

### H1 — Inside-corner slot
Rule: at least 50% of a map's 90° turns (rounded up) must have ≥1 slot in the inside corner, ≤2u from both adjacent segments. Maps with N turns require ceil(N/2) corner-covered turns.
Validation hint: for each 3-waypoint window where the middle waypoint is a corner, find the inside-quadrant region within 2u of both segments; count corners with ≥1 slot in that region; assert count ≥ ceil(N_turns / 2).

### H2 — Slot-to-path proximity ceiling
Rule: every slot must be ≤3u from the nearest point on any path segment (segment-distance, not waypoint-distance).
Validation hint: for each slot, compute min over segments of the perpendicular-projection distance to that segment (clamped to segment endpoints). The min must be ≤3u.

### H3 — Straight-away coverage
Rule: every straight segment ≥6u long must have at least one slot within 5u of the segment's midpoint.
Validation hint: enumerate segments ≥6u; for each, compute midpoint; assert ≥1 slot within 5u.

### H4 — Synergy pair shares a path segment
Rule: every map has ≥1 pair of slots (i, j) such that the segments-set covered jointly by their T1 ranges (7.5u canonical) contains a continuous path sub-segment of length ≥3u.
Validation hint: for each slot pair (i, j), sample the path at 0.5u intervals; find the longest contiguous run of sampled points where both slot i and slot j are within 7.5u; assert ≥1 pair has a run ≥3u long.

### H5 — Anchor slots (spawn + castle)
Rule: ≥1 slot ≤4u from `path[0]`, and ≥1 slot ≤4u from `castle`.
Validation hint: assert `min(slot→path[0] distance) ≤ 4` AND `min(slot→castle 2D distance) ≤ 4`.

### H6 — No-slot-on-path invariant
Rule: no slot coordinate may coincide with a path cell.
Validation hint: build the set of integer-snapped path cells along each segment; assert no `(slot.x, slot.z)` pair appears in that set. Enforced automatically by `validate()` per §2.1.

### H7 — Slot diversity by role
Rule: within each map, the set of slots collectively covers ≥1 of each role-category: corner, flank, anchor. A single slot may belong to multiple categories simultaneously; categories are not mutually exclusive.
Validation hint: classify each slot by (a) corner if it's within 2u of a 90° turn; (b) flank if it's within 5u of a ≥6u segment midpoint; (c) anchor if it's within 4u of `castle`. A map passes if the union of slot-classifications covers all three categories.

### H8 — Path length + turn-count budget
Rule: total path length 28–42u; turn count 5–9; ≥2 segments are ≥6u and ≤1 segment is ≥10u.
Validation hint: compute total length and segment count; assert all 4 inequalities.

### H8a — Minimum segment length
Rule: no single segment may be shorter than 3u.
Validation hint: assert `min(segment length) ≥ 3`.

### H9 — Castle terminus + edge backing
Rule: castle's (x, z) projection equals `path[-1]`'s (x, z); the y-axis is ignored. That waypoint must be within 3u of a world edge.
Validation hint: assert `castle.x === path[-1].x && castle.z === path[-1].z`; assert `min(WORLD_HALF_X − |path[-1].x|, WORLD_HALF_Z − |path[-1].z|) ≤ 3`.

### H10 — Spawn telegraph
Rule: `path[0]` is within 2u of at least one world edge (any edge).
Validation hint: assert `min(WORLD_HALF_X − |path[0].x|, WORLD_HALF_Z − |path[0].z|) ≤ 2`.

### H11 — Slot count vs path length
Rule: slot count is in the range `[ceil(pathLen / 7), floor(pathLen / 5)]` (1 slot per 5–7u inclusive).
Validation hint: assert `slots.length ≥ Math.ceil(pathLen / 7) && slots.length ≤ Math.floor(pathLen / 5)`.

### H12 — Coverage redundancy
Rule: no single slot's T1 coverage (canonical 7.5u radius) accounts for more than 30% of the total path length covered by all slots combined. (Definition is over the slot's coverage as a fraction of TOTAL slot coverage — not as a fraction of total path length.)
Validation hint: sample the path at 0.5u intervals; for each sample point, count which slots have it within 7.5u; let `S_i` = sum of samples where slot `i` is the ONLY one within 7.5u; let `S_total` = sum of samples where at least one slot is within 7.5u. Assert `S_i / S_total ≤ 0.30` for every slot `i`.

### 3.4 Live-map state (entry conditions per map for §4 tasks)

| Map | Path length | Turns (= N − 2) | Slots | §4 task action |
|---|---|---|---|---|
| plains | 35u | 6 | 6 | targeted s6 move (Task 2.1) |
| forest | 34u | 6 | 7 | drop to 6 slots (Task 2.2) |
| mountain | 43u | 10 | 8 | full path + slot rewrite (Task 2.4) |
| tidewater | 38u | 7 | 5 | add 2 slots; move s5 to castle (Task 2.3) |
| snowfall_pass | 42u | 8 | 6 | verification-only (Task 2.5) |
| riverbend | 36u | 6 | 6 | verification-only (Task 2.6) |

### 3.5 World bounds + path waypoint convention

Path waypoints are integer-snapped: `x ∈ [-14, 14] ∩ ℤ`, `z ∈ [-9, 9] ∩ ℤ`. The world's full cell range is 29×19 = 551 cells.

### 3.6 "Turn" definition

In all H-rules and per-map task tables, `turn` means a 90° direction change at an interior waypoint. For a path with N waypoints (N segments + 1 endpoint count), the turn count is `N − 2` (path[0] and path[N-1] are not turns). Mountain (old): 12 waypoints → 10 turns. Mountain (new, Task 2.4): 8 waypoints → 6 turns. H1's `N_turns` denominator uses this count.

The §3.4 table column "Turns" uses this convention. (Prior session notes may have used `segments = N − 1` as a synonym for "turns"; this spec disambiguates.)

### 3.7 `pathLen` helper

All H-rule validation expressions referencing `pathLen` (H8, H11, H12) use the segment-length sum:
```
pathLen = Σ over i in [0..path.length-2] of |path[i+1] - path[i]|
```
where `|...|` is the Manhattan-equivalent (paths are axis-aligned per the existing validator). This computation lives in the implementer's verification scratch — it is NOT exposed as a runtime function in `maps.js` or `entities.js`. The Cartographer editor's existing `bakeMap()` function produces an equivalent sum if needed for visual verification.

---

## 4. Task list

### Task 1.1 — Create `docs/level-design.md`

Acceptance criteria:
- File exists at `docs/level-design.md`.
- File contains exactly 13 H-rules (H1, H2, H3, H4, H5, H6, H7, H8, H8a, H9, H10, H11, H12), each in the §2.2 shape.
- Each rule's text matches §3.3 verbatim (rule, why, validation hint).
- File contains zero references to specific maps; the rulebook is map-independent.

### Task 1.2 — Extend `validate()` with H6 check

Acceptance criteria:
- The code block from §2.1 is inserted into `tools/map-editor.html validate()` after the existing axis-aligned-path check, before the integer-slot-coords check.
- A map with a slot whose `(round(x), round(z))` lies on a path cell returns `{ ok: false, reason: 'slot <id> at (<x>,<z>) sits on path' }`.
- A map where no slot lies on a path cell passes through to the next existing check.
- Existing `validate()` callers (`refresh()`, `setCanvasPill`, `setCopyButtonEnabled`) need no changes.

### Task 1.3 — Add maps.js top-of-file pointer

Acceptance criteria:
- The 3-line comment from §2.3 appears at the very top of `games/castle-tower-defense/maps.js`, before any other code.

### Task 1.4 — Commit 1

Commit message: `docs+editor: level-design heuristics rulebook (H1-H12) + validate() slot-on-path check`.
Files: 3 from §1, commit 1 row.

### Task 2.1 — Remap plains

Acceptance criteria:
- `s6` moved from `(9, -5)` to `(9, -4)`. New segment-distance: 2.0u from the (6,-2)→(11,-2) segment (closest point (9,-2)). Under H2 limit.
- All other plains slots unchanged.
- Plains continues to satisfy H1–H12 + H8a.
- Cartographer paste-import → `validate()` returns `{ok: true}`.

### Task 2.2 — Remap forest

Acceptance criteria:
- Slot count: exactly **6** (H11 ceiling for 34u path is `floor(34/5) = 6`). One slot is removed.
- The four slots currently >3u from nearest path segment (s1, s2, s5, s7) are either pulled to a new coord ≤3u OR removed. At most one of these four may be removed.
- All surviving slots are ≤3u from nearest path segment (H2).
- Cartographer paste-import → `validate()` returns `{ok: true}`.
- H1–H12 + H8a hold for the post-edit forest.

### Task 2.3 — Remap tidewater

Acceptance criteria:
- Slot count: exactly **7** (38u / 7 = 5.4u/slot, within H11 range `[ceil(38/7)=6, floor(38/5)=7]`).
- 2 new slots added flanking the 10u straight `(-8,-2)→(2,-2)`. Specifically:
  - One new slot at `(-7, 0)` (within 3u of `(-8,-2)` via segment-distance; on the +z side of the straight).
  - One new slot at `(1, 0)` (within 3u of `(2,-2)` via segment-distance; on the +z side of the straight).
  - Both slots on the +z side (i.e., the side away from the castle terminus at `(10, 1)` reached via the path's south-then-east curve). This puts them in the "interior" of the path's U-shape.
- H5 anchor check: s5 at `(8, -5)` is 6.0u from castle `(10, 1)` — does NOT satisfy H5 (>4u). However, after adding the 2 new slots, neither new slot is near castle. **No third slot is added; instead, move s5 to `(9, 0)` (1.4u from castle).** This brings H5 into compliance without raising slot count.
- Cartographer paste-import → `validate()` returns `{ok: true}`.
- H1–H12 + H8a hold.

### Task 2.4 — Remap mountain

Acceptance criteria:
- Path is replaced with exactly these 8 waypoints (7 segments, 7 turns):
  ```
  { x: -12, z: -7 },
  { x: -6,  z: -7 },
  { x: -6,  z: 0  },
  { x: 0,   z: 0  },
  { x: 0,   z: -4 },
  { x: 7,   z: -4 },
  { x: 7,   z: 3  },
  { x: 11,  z: 3  },
  ```
- Castle: `{ x: 11, y: 0, z: 3 }`.
- Total path length: 41u. Segment lengths: 6, 7, 6, 4, 7, 7, 4. All ≥3u (H8a). 5 of 7 segments are ≥6u (H8 "≥2 segments ≥6u" satisfied). No segment ≥10u (H8 "≤1 ≥10u" satisfied). 6 turns per the §3.6 definition (8 waypoints − 2 endpoints), within H8 5–9 range. H1 corner-coverage requirement: ceil(6/2) = 3 inside-corner-covered turns. The 7-slot layout below covers ≥3 corners (verified at acceptance time).
- Slot count: exactly **7**. New slot coords:
  ```
  { id: 's1', x: -9, z: -5 },
  { id: 's2', x: -8, z: -2 },
  { id: 's3', x: -3, z: -2 },
  { id: 's4', x: 2,  z: -2 },
  { id: 's5', x: 4,  z: -2 },
  { id: 's6', x: 5,  z: 0  },
  { id: 's7', x: 9,  z: 1  },
  ```
- Verify per-slot H2 (≤3u from nearest path segment):
  - s1 (-9,-5) → segment (-12,-7)→(-6,-7) at (-9,-7), distance 2u ✓
  - s2 (-8,-2) → segment (-6,-7)→(-6,0) at (-6,-2), distance 2u ✓
  - s3 (-3,-2) → segment (-6,0)→(0,0) at (-3,0), distance 2u ✓
  - s4 (2,-2) → segment (0,0)→(0,-4) at (0,-2), distance 2u ✓
  - s5 (4,-2) → segment (0,-4)→(7,-4) at (4,-4), distance 2u ✓
  - s6 (5,0) → segment (7,-4)→(7,3) at (7,0), distance 2u ✓
  - s7 (9,1) → segment (7,3)→(11,3) at (9,3), distance 2u ✓
- H5 anchor check: s1 distance to path[0] (-12,-7) = √(9+4) = √13 ≈ 3.6u; s7 distance to castle (11,3) = √(4+4) = √8 ≈ 2.83u. ✓
- H6: no slot on path (verified above — all slots ≥2u from any path point).
- H11: 41u / 7 slots = 5.86u/slot — within `[ceil(41/7)=6, floor(41/5)=8]`.
- Cartographer paste-import → `validate()` returns `{ok: true}`.

### Task 2.5 — Verify snowfall_pass

Acceptance criteria:
- Run the H1–H12 checklist against the LIVE snowfall_pass map (no edits applied yet).
- If all rules pass: no edit.
- If any rule fails: scope a targeted fix limited to the violation (do not blanket-rewrite).
- Document the verification result in the commit message.

### Task 2.6 — Verify riverbend

Acceptance criteria: same form as 2.5, for riverbend.

### Task 2.7 — Commit 2

Commit message: `maps: remap plains/forest/tidewater/mountain per H1-H12 rulebook (snowfall+riverbend verified-only)`.
Files: 1 from §1, commit 2 row.

---

## 5. Test strategy

### 5.1 Per-task gates (run before each commit)

**HTML script-extractor protocol** (used for `node --check` against the editor):
```bash
python -c "
import re
with open('games/castle-tower-defense/tools/map-editor.html', encoding='utf-8') as f:
    s = f.read()
blocks = re.findall(r'<script[^>]*>(.*?)</script>', s, re.DOTALL)
for i, b in enumerate(blocks):
    if i in (4, 5):  # the two non-empty script blocks
        with open(f'games/castle-tower-defense/tools/_check_blk{i}.js', 'w', encoding='utf-8') as out:
            out.write(b)
"
node --check 'games/castle-tower-defense/tools/_check_blk4.js'
node --check 'games/castle-tower-defense/tools/_check_blk5.js'
rm games/castle-tower-defense/tools/_check_blk*.js
```

For commit 1:
- HTML script-extractor protocol above exits 0.
- Open `tools/map-editor.html`; paste an existing valid map → `validate()` returns `{ok: true}`.
- Construct a map with a slot at a known path-cell coord; paste-import → `validate()` returns `{ok: false, reason: 'slot ... sits on path'}`.
- After failed validation, confirm `[data-bind="canvas-pill"]` displays the reason text (verify via the `setCanvasPill` function in `tools/map-editor.html` which surfaces `v.reason` per Phase 7).

For commit 2:
- For each of the 4 remapped maps:
  - Paste the new map's JSON into Cartographer → `validate()` → `ok: true`.
  - Open `http://localhost:3003/games/castle-tower-defense/`, select the map at Quiet difficulty, confirm:
    - All slot plinths render (cream slabs + aged-gold rings visible).
    - Clicking any palette tower → all empty slots show bright green pulsing discs.
    - `performance.getEntriesByName('first-map-render-complete').at(-1).startTime` returns a finite number.
    - Zero console errors (excluding pre-existing `bgm_loop.ogg`/`ambient_loop.ogg` 404s).
    - Note: Mountain unlockRequirement is 5 stars and Snowfall Pass is 14. The current user save (`SharedStorage.safeGet('ctd3:scores')`) reports 18 stars, so both are unlocked. Cold-cache reload preserves localStorage; no test-mode unlock is required.

### 5.2 End-to-end gate (after commit 2)

For each of the 6 maps:
- Load cold cache → start at Quiet → run wave 1 to completion.
- Confirm:
  - No slot is unreachable (every empty slot accepts a tower placement).
  - No path segment of length ≥6u is uncovered by any T1 tower placement.
  - `validate()` returns `ok: true` after a Cartographer paste-import round-trip.

### 5.3 H-rule self-check (manual, per remapped map)

For each remapped map, the implementer runs the H1–H12 + H8a checklist by hand. A map passes only if all 13 rules return true (or one explicit H11-ceiling exception is documented per Task 2.3).

---

## 6. Observability

### 6.1 `first-map-render-complete` performance mark

Existing (from prior Phase 5). No spec change; relied on by §5.1 cold-cache test:
`scene.paintTerrain` emits `performance.mark('first-map-render-complete')` once per `startMap` call.

### 6.2 `validate()` return inspection

The Cartographer's status pill (`[data-bind="canvas-pill"]`) displays the `reason` field from `validate()` when `ok === false`. The H6 violation surface used to verify Task 1.2 is the pill text.

### 6.3 `__editorHistory.depth()` (existing)

Used during paste-import testing to confirm the import push fires exactly once (per Phase 6 conventions).

---

## 7. Rollback

### 7.1 Per-commit rollback

- Commit 1 (`docs+editor:`): `git revert <sha>` removes `docs/level-design.md`, the maps.js comment, and the validate() extension. No data state to migrate. Cartographer reverts to behavior before commit 1.
- Commit 2 (`maps:`): `git revert <sha>` restores the prior maps.js content. No data state to migrate (player scores are keyed by map.id; they remain valid).

### 7.2 Independence

Commit 2 depends on Commit 1 only for the validate() check that catches H6 violations. Revert order if both must be undone: commit 2 first, then commit 1.

### 7.3 Persistent-state impact

None. No localStorage keys touched. No asset files modified. Player scores in `SharedStorage` are unaffected.

---

## 8. Out of scope

- Adding new tower archetypes, enemy types, or wave compositions.
- Difficulty curve tuning (HP/speed/wave counts).
- Castle Kit (`kenney.nl/assets/castle-kit`) asset swap.
- UFO enemy aesthetic.
- New maps beyond the existing 6.
- Frontend-design critique of the title screen (user-requested side-task; tracked outside this spec).
- Automating H1–H12 enforcement beyond H6 (manual checklist suffices).
