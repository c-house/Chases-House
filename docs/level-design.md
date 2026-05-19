# Castle Tower Defense — Level Design Rulebook (H1–H12)

This document defines the heuristics every CTD3 map should satisfy. All H-rules are map-independent — they apply to every map's path and build-slot layout regardless of theme or wave content.

New maps must pass `tools/map-editor.html validate()` (which enforces H6 automatically). The remaining rules (H1–H5, H7–H12, H8a) are a manual checklist.

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
