# CTD3 Sprint 6 hand-back — decal-leak hotfix + burial-class guard (ADR-037)

**Date:** 2026-07-24
**Dispatched at:** `86b7b8d` · **Ends at:** `33a0b0d` + this hand-back · **3 commits** (2 chunks + this hand-back)
**Sprint shape:** a hotfix sprint for a production defect (the measured transient-decal GPU leak that Sprint 5's adjacency pass surfaced), plus the source-level guard that retires the burial defect class for good. Two always-eligible chunks (both landed), one gate-conditional chunk (blocked, as designed).

**Headline: the decal leak is dead, measured live.** `renderer.info.memory.geometries` — clocked in Sprint 5 at **209,194 and rising exactly 3 per rendered frame, unbounded** — now holds **flat at 49 across 360 rendered frames** with decals rebuilding every frame. And the trap that ate two prior chunks (C-4, then R-1, then this) can no longer be reintroduced silently: the harness now fails loudly if either decal factory's default drops below the clearance or any call site buries a literal.

---

## Progress

### Gates (first, as required)

| Gate | State | Evidence |
|---|---|---|
| **G-1** — retune-feel playtest | **UNMET** | No `docs/handoffs/` file whose name contains "g1" or "playtest"; no operator addendum in the dispatch. Blocks **C-3 only**, exactly as ADR-037 D11 designed. Third sprint running unmet. |
| **Deploy queue** — `git rev-list --count origin/main..main` | **2 at hand-back** (→ **3** after this doc's commit) | 0 at dispatch (origin/main == main; everything Sprint-5-and-prior was deployed). H-1 + H-2 are unpushed. **Pushing + the Cloudflare purge is the operator's action** — the leak fix reaches players only when that happens. |

### Per chunk

| Chunk | State | Hash |
|---|---|---|
| **H-1** — dispose transient decals, stop the geometry leak (S–M) | **LANDED** | `7f06f11` |
| **H-2** — ground-decal clearance guard + makeDisc default settle (S) | **LANDED** | `33a0b0d` |
| **C-3** — endless balance calibration (M) | **BLOCKED** | G-1 unmet. Not attempted, per the dispatch's explicit instruction. Consumes nothing, counts toward nothing. |

No chunk reached FAILED-OUT. No named gate failed; the ladder never engaged. The sprint-stop condition (two FAILED-OUT) never approached.

### Staleness checks (all three, at `86b7b8d`)

- **H-1 — live.** `syncDecals` called `decalsGroup.clear()` with no dispose pass or pool before it. Confirmed by reading source, not just `git log`. Implemented fresh.
- **H-2 — live.** `makeDisc`'s default was still `0.07`; `sim-harness.cjs` contained no `decal-` named checks. Implemented fresh.
- **C-3 — live.** `sim-harness.cjs` still lacks the 15–35 survival-band and ≤15% dominance-margin checks; `tools/curves/` still holds exactly ONE endless CSV (`endless-plains-quiet.csv`) beside the six campaign CSVs. Untouched this sprint (blocked).

### H-1 — what changed and how it was verified

**Change (`scene.js`, one file):** a dispose pass — `for (const o of decalsGroup.children) { o.geometry?.dispose(); o.material?.dispose(); }` — before `decalsGroup.clear()` at **both** clear sites: `syncDecals` (per-frame rebuild, the measured leak) and `clearPlayfield` (map-leave, the identical leak one class over). Chose the dispose pass over a geometry pool: it is the smaller, obviously-correct diff and mirrors the Warden-aura disposal already in the file. A cached-geometry/material pool remains the better long-term shape — recorded as a future optimization, not taken. Decals are visually unchanged (geometry params, tokens, opacities, elevations all untouched).

**In-browser gate (Chrome on :9222, no-store server on :3004, hard-reload).** Plains/quiet, a Ranger placed and **selected** (gold range ring renders every frame) plus a Warden placed (aura group), so `syncDecals` rebuilds decals on every frame:

| Metric | Before (Sprint-5 measurement) | After (this sprint, 360 rendered frames @ 60.1 fps) |
|---|---|---|
| `renderer.info.memory.geometries` | **209,194, rising +3/frame (~180/s), monotonic** | **FLAT — min = max = 49, delta 0** |
| `renderer.info.programs.length` | (not separately recorded) | **CONSTANT at 12** (covers material disposal structurally — no shader-program churn; r0.170 exposes no materials counter) |
| `renderer.info.memory.textures` | — | flat at 23 (bonus) |
| Decal meshes live in scene during sample | — | 6 rings + 1 disc — decals **are** actively rebuilding; counter stayed flat *because* disposals now match allocations |

**Regression probe (idle state, no enemies/combat effects in flight):** traversed the scene graph for every `RingGeometry` → **6 rings, the set of distinct world-Y elevations is exactly `[0.24]`** (5 gold decal/slot rings `#e8b75a` + 1 Warden-aura ring `#8fc6cf`), and rings render on map load. Nothing buried; no stray `y=0.1` splash rings present.

**Harness:** `node tools/sim-harness.cjs` → **70 pass, 0 fail, ALL PASS, exit 0** — unchanged, as expected (scene.js is render-only; no Node harness imports it; the count rises only under H-2).

**Adversarial review:** one fresh-context general-purpose subagent, one round, staged diff + scope, no chat history. **No major findings.** It independently verified the "nothing shared/cached" premise (both factories `new` unique geometry+material per call), confirmed no use-after-free / double-dispose / iterate-then-clear hazard, and confirmed both clear sites share the single-owner-mesh invariant. One MINOR (comment verbosity) — reviewer said no action required; kept, as the in-source ADR traceability is deliberate and now keeps scene.js and the harness honest together.

### H-2 — what changed and how it was verified

**Change (a) `scene.js`:** `makeDisc`'s default `y` settled `0.07 → GROUND_DECAL_Y`. **Provably inert today** — verified `makeDisc` has exactly one caller and it passes `0.25` explicitly (repo-wide grep: makeRing/makeDisc are defined and called only in scene.js). The `GROUND_DECAL_Y` doc comment, which Sprint 5 had scoped to `makeRing` while flagging `makeDisc` as still-trapped, now truthfully covers **both** flat-decal factories and names the harness guard — this doubles as the in-source marker of the guarded region.

**Change (b) `tools/sim-harness.cjs`:** three named source-level checks (TEXT assertions over scene.js's source — scene.js is browser-only ESM importing the bare `three` specifier via the page importmap, genuinely not `require()`-able under Node). Written against the actual function signatures, not brittle whole-line matches:

- **`decal-default-clearance`** — both `makeRing` and `makeDisc` default their y to `GROUND_DECAL_Y`.
- **`decal-no-buried-literals`** — no `makeRing(`/`makeDisc(` call site passes a numeric y literal below the clearance; the constant's value is **parsed from source** (`GROUND_DECAL_Y=0.24`), not hardcoded twice.
- **`decal-dispose-present`** — the `syncDecals` rebuild path contains a `.dispose(` between the function header and its first `decalsGroup.clear()` — anchored on H-1's real shape (a dispose pass; had H-1 landed as a pool the anchor would have asserted the pooled structure instead).

**Gate:** `node tools/sim-harness.cjs` → **73 pass, 0 fail, 0 known-fail, ACCEPTANCE: ALL PASS, exit 0** — MORE than 70, including all three named checks (each PASS). Campaign-CSV content rule **holds**: `git diff -- tools/curves/` (run from `games/castle-tower-defense/`) shows **no content change** to the six campaign CSVs; `git status --porcelain -- tools/curves/` lists only `forest.csv` — the known mixed-EOL phantom, present at dispatch, never staged/committed/checked-out/renormalized. D12 not breached (no maps.js waves, ENEMIES, TOWERS, stars, or unlocks touched).

**Adversarial review:** one fresh-context general-purpose subagent, one round, staged diff + scope, no chat history. **No major findings.** It confirmed the makeDisc change is runtime-inert, that none of the three checks pass vacuously (a reverted default, a NaN'd constant, or a buried `0.05` each FAIL loudly), that `decal-dispose-present` does *not* false-pass on today's `dispose()`-without-leading-dot comment, and that the `__dirname`-relative scene.js read is cwd-independent (works from repo root and the CTD dir). Three MINORs recorded below — all bounded, none blocking.

---

## Deferred items — every one classified

### fold-into-next-sprint (the three H-2 guard-robustness MINORs)

- **`decal-no-buried-literals` parses only simple-token arg lists** (first-`)` + comma-split). A future call that wraps an earlier arg in a nested call or puts the y-literal behind a ternary — e.g. `makeRing(clamp(x), z, r, c, o, 0.05)` — would slip the buried `0.05` past the 6th-arg scan. Bounded: no such call exists today (all four sites are simple tokens), the idiomatic regression (a bare numeric y) is still caught, and `decal-default-clearance` independently guards the defaults. Widen to a paren-aware split only if a nested-arg call site ever appears.
- **`decal-dispose-present` is a text-presence heuristic.** It passes today only because scene.js's leak-explainer comment writes `dispose()` without a leading dot, so the `/\.dispose\s*\(/` anchor matches only the real `o.geometry.dispose()` / `o.material.dispose()`. If the dispose loop were deleted and a comment containing `.dispose(` were left between the header and `clear()`, it would false-pass. Harden by anchoring on `o.geometry.dispose(`/`o.material.dispose(` specifically if this proves fragile.
- **`factoryDefault`'s 600-char window can false-FAIL** (not false-pass) if a factory body grows past 600 chars before its `position.set`. Safe failure direction (noisy, not silent) — widen the window rather than assume a real regression if it ever trips.

### schedule-now (operator-only unblocks, unchanged from Sprint 5)

- **Deploy the leak fix.** `main` is 2 (→3) commits ahead of `origin/main`; nothing was pushed. The GPU leak keeps biting live endless sessions until the operator pushes + purges Cloudflare. **This is the single most valuable operator action this sprint produced.** Unblock: operator only.
- **G-1 playtest.** ~10 min of play (Mountain/spirited, Tidewater/quiet, ideally one endless run) → drop a `docs/handoffs/` file whose name contains "g1" or "playtest". It is the **only** thing standing between the project and C-3. Unblock: operator only.
- **Publish one map + the RTDB rules block.** One Firebase-console visit publishes the `ctd3-scores` RTDB rules AND allows the community write, then publish one map from the editor — this unblocks both the live-Community endless verification and the cycle-3 leaderboard. Unblock: operator + Firebase console.

### fold-into-next-sprint (carried, still queued)

- **C-3 endless balance calibration**, in full, the moment G-1 lands. Carried starting state (re-confirmed by Sprint 5, untouched here): naive builds die **18/18/26** on plains/quiet seed 7 (spread 8 waves, ≥3 required), interest **16.7%** of income against a 35% ceiling. **Settle `INTEREST_CAP = 50` vs a lower rate FIRST** (0.01 measured 25% uncapped; the cap was added against a measured 45.7% degeneracy), then widen `endless-selection-effect` + the survival band beyond single-map/single-seed. D12 campaign guards in full. Its harness assertions (15–35 band, ≤15% dominance margin) and endless CSVs do not exist yet.
- **Promote the ring probe into a `?test=decal-audit` visual gate.** The scene-traversal probe (every `RingGeometry` → world y / radius / colour) is what turned a screenshot into proof for R-1 and H-1; `scene.js`'s `?test=tile-debug` already establishes the pattern.
- **A transient-decal geometry/material pool** — the better long-term shape H-1 deliberately did not take. Would eliminate the per-frame alloc+dispose churn entirely (the counter is flat now, but ~5 geometries+materials are still built and freed each frame).
- **Ring thickness is proportional (3% of radius), not fixed** — slot rings thin disproportionately at the zoom floor; a fixed world-space thickness holds up better at both extremes. Treatment change.
- **Selecting a Warden gives no new visual feedback** (its aura is persistent, so "which tower did I just select?" has an answer for Rangers/Catapults/Mages and none for Wardens).
- Carried unchanged: **C-7's H12 boundary probe** straddles rather than hugs the 30% ceiling; **the editor's gold-fill budget is contradicted in source**; **Ctrl+S still means "Copy JSON", not Save**.

### carried forward from the cycle-3 docket (unchanged, still queued)

- **Layout generator** (path + slots + castle, generate-and-reject) — its own ADR per D10; de-risked by C-7's callable fairness oracle.
- **Endless leaderboard + RTDB publish** — scoring side ready (`ctd3:endless` holds waves/gold/lives per map+difficulty); blocked on the operator publishing the `ctd3-scores` RTDB rules block (same Firebase visit as the community-map unblock above).
- **Tower-roster depth / combination mechanic** — deliberately not competing with endless for a cycle.
- **Daily seeded challenge** — seam laid; every endless run shows a reproducible seed on results.
- **Editor gold-budget + Ctrl+S settle.**

### drop-with-reason

- **"Show all tower ranges" planning toggle** — a real TD affordance, but a feature, not a residual; belongs in cycle-3 planning.
- **Music/ambient sourcing** — content acquisition, not a code task; wiring is one line from returning.
- **Recoloring any decal for the gold-on-gold adjacency** — investigated in Sprint 5, found not a collision (mutual exclusion + 12× radius separation); changing the ratified gold token would be churn.

---

## Known-unknowns

**What this sprint could not settle, and what would:**

- **Endless *feel*** (G-1). Still the single most valuable operator action; still the last gate on C-3. Settled by playing it.
- **Endless on a live Community map.** Never run — the tab is genuinely empty (Sprint 5 verified the read path works). Settled by the operator publishing one map after allowing the RTDB write.
- **The leak fix on a real long run.** The gate proved flat over 360 frames (~6 s) with a rich decal set; a genuine multi-minute endless session (waves 27+, never simulated or seen) would confirm zero growth across the intended play length. The mechanism guarantees it — allocations are now matched by disposals every frame — but the wall-clock long-run is unobserved.
- **Browser matrix.** The H-1 in-browser gate ran in the debug **Chrome** only, against a no-store server on :3004 with an ignore-cache reload. Firefox/Safari `renderer.info` behavior unverified (this is a three.js counter, not a browser API, so cross-browser risk is low).

**Standing operator items, carried:**

- **G-1 retune playtest** — unmet, now blocking C-3 for the third sprint running.
- **Real-phone bottom-sheet/tabs**, **real NVDA/VoiceOver**, **real-iOS HUD**, **Firefox/Safari matrix** — all still reasoned-about / Chrome-only, never on the real targets.
- **Snowfall ground palette** — two independent decal families judged "weakest but legible" on snowfall_pass across C-4 and R-1; treat as a map-palette question, not a per-decal one.

---

## Note for the next session

Two hotfix commits are unpushed — the operator's deploy queue. The leak fix is invisible to players until push + Cloudflare purge.

**Unless C-3 runs and surfaces surprises, the next cadence turn is cycle-3 planning** — both hotfix chunks landed, C-3's brief is written and its inputs measured and waiting on G-1, and the sprint's residual list is now empty of anything a session can land unaided.
