# Castle Tower Defense — Level Design Rulebook (H1–H12)

This document defines the heuristics every CTD3 map should satisfy. All H-rules are map-independent — they apply to every map's path and build-slot layout regardless of theme or wave content.

New maps must pass `tools/map-editor.html validate()`, which now enforces **every H-rule automatically**:

- **Blocker tier** (in the editor): H6, H8a, H9, plus the structural checks PATH_MIN, AXIS, ZERO_LEN, SLOT_INT, NO_SLOTS, WAVES_PARSE.
- **Warn tier** (`tools/map-rules.js`, ADR-037 C-7): H1, H2, H3, H4, H5, H7, H8, H10, H11, H12. That module is a **pure function over a map object** with no DOM — the editor calls it, and so can a layout generator in a generate-and-reject loop. `tools/map-rules-test.cjs` carries a positive and a negative control per rule, boundary probes on the thresholds, and a pinned baseline of the six official maps.
- **Still manual:** W3 and W7 only. Both are judgement calls about feel rather than computations over a map object, and are marked "(manual)" below.

The six official maps predate these rules and several violate the warn-tier ones; that is pinned as a baseline, not treated as a regression. **Nothing here may be promoted to blocker tier** without first fixing the shipped maps.

---

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

---

## Wave-shape heuristics (W1–W8)

These rules cover the wave/enemy/timing dimensions that H1–H12 leave alone. Auto-enforced rules surface in `validate()`'s `issues` array; severity is **block** (gates export/save) or **warn** (advisory only). Manual rules are checklist-only — they depend on engine pacing or gold-curve simulation that's expensive to compute live.

### W1 — Wave HP scaling
Rule: total enemy HP per wave should scale 1.10–1.40× the prior wave. Compute `Σ enemies[].count × ENEMIES[type].hp` per wave; flag waves where the ratio to the prior wave is outside [1.10, 1.40]. Wave 1 is exempt.
Severity: **warn (Auto)**. Players can intentionally author easy-then-hard pacing; the rule just nudges.

### W2 — Spacing pacing
Rule: within a wave, the spawn timing should produce ≥3s gaps where the player can rebuild. Compute the longest contiguous interval without a spawn event across all groups; flag if <3000ms.
Severity: **warn (Auto)**.

### W3 — Pre-wave prep duration (manual)
Rule: pre-wave prep (the time between "wave cleared" and "next wave starts") should be ≥8s on Quiet, ≥5s on Spirited. This lives in engine timing, not map data; manual checklist only.

### W4 — Flying-enemy gating
Rule: flying enemies (`ENEMIES[type].isFlying === true`) should not appear before `waveIndex >= 2` (i.e., the third wave when displayed 1-indexed to players). New players need 1–2 waves of pure ground before learning anti-air is a constraint.
Severity: **warn (Auto, single-tier)**. Not split per source — Community import lifecycle (Phase 4b) makes a block-for-user / warn-for-official rule unworkable since the `source` field is derived at hydrate from id-prefix, not stored on the map record.

### W5 — Boss cadence
Rule: waves flagged `isBoss: true` should be ≥6 regular waves apart. Avoids back-to-back boss fatigue and keeps the boss feeling like a finale.
Severity: **warn (Auto)**.

### W6 — Late-game diversity
Rule: waves at `waveIndex >= 5` should include at least 2 distinct enemy types. A pure-footman wave 6 onwards is rarely interesting — towers that counter one type carry the whole map.
Severity: **warn (Auto)**.

### W7 — Reward economy (manual)
Rule: a wave's `reward` should cover 50–90% of the cheapest next-tier upgrade cost (Ranger T1→T2 = 60g, etc.). Too low and the player can't keep up; too high and the gold floor trivializes the build choice. Gold-curve simulation is non-trivial across difficulty + per-map overrides; manual. Note: ADR-036 D2 (bounty-coupled economy) deliberately supersedes this rule for late waves — trimmed late-wave rewards are the sanctioned D2 lever, not a violation.

### W8 — Concurrent on-screen ceiling
Rule: the max concurrent enemies on-screen at any wave step (computed by walking each group's spawn schedule against expected kill-time at the canonical T1 Ranger DPS) should not exceed 35. Approximate guard against the engine's ~30–40 entity comfort zone.
Severity: **warn (Auto)**.

---

## Severity tiers

`validate()` returns `{ ok, issues, badSegment?, totalLength?, cellCount? }` where `issues` is an array of `{ severity: 'block' | 'warn', code: 'H1' | 'W4' | ..., message }`. The top-level `ok` is `issues.every(i => i.severity !== 'block')` — backward-compatible with callers that only read `.ok`.

| Severity | Effect on export/save | UI cue |
|---|---|---|
| **block** | Gates Copy JSON / Save to My Maps / Publish to Community. | Red icon in canvas pill. |
| **warn** | Allows export/save. Advisory only. | Amber icon in canvas pill. |

H6 (no slot on path), H8a (min segment ≥3u), the axis-aligned check, the "≥2 waypoints", and the castle-distance check are **block**. All W-rules are **warn**.

The canvas pill (`[data-bind="canvas-pill"]`) renders the full `issues` list as a `<ul>`. The status panel (`[data-bind="status"]`) renders the OK/NOT READY label plus the issues. `setCopyButtonEnabled` reads `.ok` only — unchanged.
