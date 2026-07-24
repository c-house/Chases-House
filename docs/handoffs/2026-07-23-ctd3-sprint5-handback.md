# CTD3 Sprint 5 hand-back — cycle-2 residuals (ADR-037)

**Date:** 2026-07-23
**Dispatched at:** `b6105a7` · **Ends at:** `f45fc1b` + this hand-back · **2 commits** (1 chunk + this hand-back)
**Sprint shape:** a short residuals sprint between cycle 2's build sprint and cycle-3 planning. Three chunks, two of them gate-conditional. Both conditions were unmet, so this was the single-fix session the dispatch anticipated.

**Headline: the range circle renders.** The last decal still buried under the terrain is out. Every `RingGeometry` in the CTD3 scene now sits at `GROUND_DECAL_Y = 0.24` — machine-verified, not eyeballed — and the defect class that ate two chunks (C-4, then R-1) can no longer be inherited by accident from `makeRing`. Both conditional chunks were blocked on operator-side gates and were not attempted.

**The most useful thing in this document is not the chunk.** The adjacency pass found a **confirmed, measured GPU-resource leak** in the transient-decal path — `renderer.info.memory.geometries` climbing ~3 per rendered frame and never released. It is pre-existing and untouched by R-1, but endless mode has just made long sessions the normal case. See Deferred → schedule-now.

---

## Progress

### Gates

| Gate | State | Evidence |
|---|---|---|
| **G-1** — retune feel playtest | **UNMET** | No `docs/handoffs/` file whose name contains "g1" or "playtest"; no operator addendum in the dispatch. Blocks C-3 only, exactly as ADR-037 D11 designed. Unchanged from Sprint 4. |
| **Community-map presence** (R-2's gate) | **VERIFIED EMPTY** — not unverified | Browser was available; the check ran for real. Map select → **COMMUNITY** tab loaded through the live Firebase read path (transient "Loading community maps…" → settled state) and rendered *"No community maps yet. Be the first — publish from the editor."* **Zero console messages of any kind**, so this is an empty list, not a failed fetch. R-2 BLOCKED. |
| **Deploy state** (informational, not a gate this sprint) | `git rev-list --count origin/main..main` = **12** | 11 at dispatch + R-1. Nothing was pushed. No chunk this sprint depended on the live site. |

### Per chunk

| Chunk | State | Hash |
|---|---|---|
| **R-1** un-bury the selected-tower range circle (S) | **LANDED** | `f45fc1b` |
| **R-2** live Community endless verification (S) | **BLOCKED** | Community tab empty. Consumes nothing, counts toward nothing. |
| **C-3** endless balance calibration (M) | **BLOCKED** | G-1 unmet. Not attempted, per the dispatch's explicit instruction. |

No chunk reached FAILED-OUT. No named gate failed, so no fix rounds were spent and the ladder never engaged.

### Staleness checks (all three, at `b6105a7`)

- **R-1 — live.** `scene.js:823` read `makeRing(sel.x, sel.z, sel.range, TOKENS.ACCENT_GOLD, 0.4)` with no `y`; `makeRing`'s default was still `0.05`. Confirmed by reading the source, not just `git log`.
- **R-2 — live.** No live-community verdict in any hand-back. Corroborated in the browser: `localStorage['ctd3:endless']` carries a `user:community-STUB01:quiet` entry — Sprint 4's *stubbed* run, the only community endless record that exists.
- **C-3 — live.** `sim-harness.cjs` still lacks the 15–35 survival band and the ≤15 % dominance-margin checks, and `tools/curves/` still holds exactly one endless CSV (`endless-plains-quiet.csv`) beside the six campaign CSVs.

### R-1 — what changed

Three lines in `games/castle-tower-defense/scene.js`:

1. The range-circle call site now passes `GROUND_DECAL_Y`.
2. `makeRing`'s default `y` is `GROUND_DECAL_Y` instead of `0.05` — **provably inert today**, since the other two callers already passed it explicitly (the adversarial reviewer searched every `.js`/`.html`/`.cjs`/`.mjs` in the repo; `makeRing` is defined and called only in `scene.js`, and the map editor does not import it).
3. The C-4 comment block was rewritten to stop describing `0.05` as current.

The two sibling call sites keep their now-redundant explicit `GROUND_DECAL_Y` arguments — the surrounding style is explicit, and trimming them would have enlarged the diff for no gain.

### Acceptance results

**Harness — `node tools/sim-harness.cjs`: 70 pass, 0 fail, `ACCEPTANCE: ALL PASS`, exit 0.** Unchanged, as expected: `scene.js` is render-only and no node harness imports it. Run before the edit and again before commit.

**Campaign-CSV stability (content-level rule): HOLDS.** `git diff -- tools/curves/`, run from `games/castle-tower-defense/`, showed **no content change** for the six campaign CSVs after every harness run. `git status --porcelain -- tools/curves/` listed only the **pre-existing phantom flag on `forest.csv`** — the mixed-EOL artifact. It was present at dispatch, was never staged, committed, checked out or renormalised, and is still present. D12 not breached: no `maps.js` wave data, `ENEMIES`, `TOWERS`, star threshold or `unlockRequirement` was touched. Nothing but `scene.js` was ever staged; `.gitignore` and `CLAUDE.md` carry their uncommitted operator edits untouched.

**Six-map range-ring verdict — all six PASS, at a normal (zoom 1.0) and a zoomed-out (zoom 0.7, the renderer's floor) camera.** A Ranger was placed and selected on each map through the real input path (pointer taps on the canvas → `selectSlot` → occupied-slot branch → `openTowerSheet`), and each state was screenshotted **and** machine-probed by traversing the scene graph for every `RingGeometry`:

| Map | Range ring | Verdict |
|---|---|---|
| plains | y **0.24**, r 7.5, `0xe8b75a`, α0.4 | clear |
| forest | y **0.24**, r 7.5, `0xe8b75a`, α0.4 | clear; lower contrast over dense canopy, still unambiguous |
| mountain | y **0.24**, r 7.5, `0xe8b75a`, α0.4 | clear |
| tidewater | y **0.24**, r 7.5, `0xe8b75a`, α0.4 | clear; arcs that overhang the playfield edge read *better* against the dark surround |
| snowfall_pass | y **0.24**, r 7.5, `0xe8b75a`, α0.4 | **weakest but legible** — gold α0.4 over the near-white ground, the same verdict C-4 reached for the aura on this map |
| riverbend | y **0.24**, r 7.5, `0xe8b75a`, α0.4 | clear |

No `ctd3:scores` seeding was needed — the stored 18 stars already unlock all six maps. `ctd3:scores` was captured raw before any interaction and re-read after: **byte-identical, 278 chars**, the same value C-4 restored.

**No regression on C-4.** With a Warden placed and a palette selection hovered over an empty slot, both of C-4's sites still render: aura ring `0x8fc6cf` α0.85 at y **0.24**, hover preview `0xa06828` α0.4 at y **0.24**. The probe's strongest single result: **every ring in the scene reports y = 0.24 — the set of distinct ring elevations is exactly `[0.24]`.** Nothing is buried.

**Large-radius check (added in response to the review).** The six-map pass used T1 (r 7.5) while a T3 projectile reaches r 10. A Ranger was upgraded to T2 (r 9.0, funded by selling the Warden — the dev panel's `+500g` is gated and does nothing) and the ring rendered **continuous, with no fragmentation into disconnected arcs**, sweeping well past the playfield onto the dark surround. T3 (r 10) was not reachable without playing waves for gold; verified to 9.0 of a 10.0 maximum.

The ring also **resized instantly on upgrade** (7.5 → 9.0). Worth recording as contrast: the aura needed an explicit geometry-rebuild branch (`scene.js:775-790`) because it lives in a persistent group, whereas `decalsGroup` is cleared and rebuilt every frame — so the range circle is structurally immune to the stale-geometry bug C-4 had to fix.

**Zero console messages** of any kind across the entire verification — six map loads, ~10 map-select transitions, placements, upgrades, sells and a hard reload.

### Adversarial review

One fresh-context general-purpose subagent, one round, on the staged diff plus the chunk scope, with no chat history. It earned its keep again — it returned **one BLOCKING finding that was correct**, and it independently reached the same conclusion as this session's `/find-adjacencies` pass:

- **B-1 (blocking) — the comment made a false claim.** The rewritten block ended *"The default is this constant now, so a new decal cannot inherit the trap."* Five lines below, `makeDisc` still defaults `y` to `0.07` — also inside the 0.2-tall terrain. Inert today (its one caller passes `0.25`), but the sentence tells the next author a hazard is gone when it is not, and this repo has now spent two chunks on exactly that hazard. **Addressed** by scoping the sentence to `makeRing` and naming the `makeDisc` residual in-source, rather than by changing `makeDisc` — which the reviewer itself flagged as the scope-creep option.
- **N-1 — dangling citation.** The comment cited "ADR-037 R-1", but ADR-037 enumerates C-1…C-7 and `R-1` appears nowhere in `docs/`. **Addressed**: reworded to "the ADR-037 sprint-5 residuals pass (R-1)", and this hand-back makes `R-1` greppable.
- **N-2 — pre-existing imprecision, sharpened by the rewrite.** The Warden aura was never a `makeRing` caller — it was a hardcoded `0.05` literal. Calling `0.05` "the previous default" implied otherwise. **Addressed**: "the previous 0.05 clearance", with "last caller still taking `makeRing`'s default" scoped to the range circle alone, which is exactly true.
- **N-3 — the clipping figure was measured on aura radii, not projectile radii.** **Substantially discharged** by the radius-9.0 check above; the residual (r 10) is recorded under Known-unknowns.
- **N-4 — new gold-on-gold adjacency**, previously impossible because the range circle was buried. **Discharged** by the six-map look and by the adjacency pass below.
- **N-5 / N-6 — explicitly not regressions.** Per-frame decal churn is pre-existing and unchanged; `scene.js` is browser-only so no node-harness coverage is possible or missing. Both recorded, no action taken.

Verdict: APPROVE WITH ONE REQUIRED FIX. The fix was applied before commit.

### Adjacency pass (`/find-adjacencies`, decal legibility)

Run because R-1 touches a gameplay affordance. `/frontend-design` was **not** invoked — the overlap check surfaced no treatment question, and the ring's gold token and 0.4 opacity are established and were not to change. `/web-artifacts-builder` does not apply to this vanilla surface.

- **No pair collides, and the two genuinely confusable pairs are structurally impossible.** `engine.js:288-300`: `selectTower` clears `paletteSelection`; `setPaletteSelection` and `selectSlot` clear `selectedTowerId`. So the range ring (gold, α0.4, large) and the hover preview (ember, α0.4, large) — the only pair a player could mistake for each other — **can never co-render**. Same for range ring vs the green place-here disc. When the range ring is up, its only companions are slot rings (12× smaller, 2× the opacity) and Warden auras (different hue, plus a fill). Confirmed on all six maps.
- **Coplanarity is safe here, not risky.** Every decal material sets `depthWrite: false`, so decals depth-test against terrain only and never against each other. No z-fighting is possible between them.
- **Layering holds:** range circle and slot ring 0.24, place-here disc 0.25 — the order the comment block asserts.

---

## Deferred items — every one classified

### schedule-now

- **Confirmed GPU-resource leak in the transient-decal path.** `syncDecals` calls `decalsGroup.clear()`, which removes children **without disposing them**, while `makeRing`/`makeDisc` allocate a fresh `RingGeometry` **and** `MeshBasicMaterial` on every call, every frame. Measured live in the debug Chrome: `renderer.info.memory.geometries` = **209,194 and rising by exactly 540 per 3 s over 360 frames — 3 per rendered frame, ~180/s, monotonic, never released.** That counter only decrements on `dispose()`. **Pre-existing and unchanged by R-1** — the range circle's `makeRing` call already ran every frame while it was buried. It matters *now* because endless mode has made multi-minute runs the normal case. The correct pattern already exists in the same file: the Warden aura group disposes geometry and material explicitly on sell. **Unblock: none.** Fix is either a dispose loop before `clear()` or a cached-geometry pool; measurement instrument is the one-liner above.
- **`makeDisc` still defaults `y` to `0.07`.** The identical trap, inert only because its single caller passes `0.25`. Left unfixed deliberately — changing it was outside R-1's stated scope and the reviewer named it the scope-creep option — but it is now documented in-source. One token to settle whenever a chunk legitimately touches that function.
- **G-1 playtest.** Ten minutes of play (Mountain/spirited, Tidewater/quiet, ideally one endless run). Unchanged from Sprint 4, and it is now the **only** thing standing between the project and C-3. **Unblock: operator only.**
- **Publish one map from the editor.** Blocks R-2 entirely. Sprint 4 recorded that publishing was denied to it by the console-managed RTDB rules (`PERMISSION_DENIED` on write), so this needs an operator-side Firebase rules allowance first. **Unblock: operator + Firebase console.**

### fold-into-next-sprint

- **C-3 endless balance calibration**, in full, the moment G-1 lands. Carry Sprint 4's measurements in unchanged — this sprint did not touch balance and re-confirmed them: naive builds die at **18 / 18 / 26** (spread 8 waves, ≥3 required), interest **16.7 %** of total income against a 35 % ceiling, all on plains/quiet seed 7. `INTEREST_CAP = 50` vs a lower *rate* (0.01 measured 25 % uncapped) remains **the first thing C-3 should settle**, and `endless-selection-effect` plus the survival band are still single-map, single-seed.
- **A static guard so the burial class cannot return a third time.** No automated check exists that a decal clears the terrain, because `scene.js` is browser-only and the node harnesses cannot import it. But the *constant relationship* is checkable without a renderer: assert that `makeRing`/`makeDisc` defaults equal `GROUND_DECAL_Y` and that no call site passes a lower literal — a source-level assertion the existing harness can run. This is what converts "we fixed it twice" into "it cannot come back".
- **Promote the ring probe into a `?test=decal-audit` visual gate.** The scene-traversal probe written for this sprint (every `RingGeometry` → world y, radius, colour, opacity) is what turned a screenshot into proof. `scene.js:915` already establishes the `?test=tile-debug` pattern for exactly this kind of gate.
- **Ring thickness is proportional (3 % of radius), not fixed.** Slot rings (r 0.62 → 0.019 world units) thin out disproportionately at the zoom floor while range rings stay comfortable. A fixed world-space thickness would hold up better at both extremes. Treatment change, deliberately not made here.
- **Selecting a Warden gives no new visual feedback** — its aura is persistent, so "which tower did I just select?" has an answer for Rangers/Catapults/Mages (a ring appears) and none for Wardens.
- Carried unchanged from Sprint 4, still open: **C-7's H12 boundary probe** straddles rather than hugs the 30 % ceiling; **the editor's gold-fill budget is contradicted in source** (CSS comment vs hand-backs); **Ctrl+S still means "Copy JSON", not Save**.

### carried forward from the cycle-3 docket (unchanged, still queued)

- **Layout generator** (path + slots + castle, generate-and-reject) — its own ADR per D10; materially de-risked by C-7's callable fairness oracle.
- **Endless leaderboard + RTDB publish** — scoring side is ready (`ctd3:endless` holds waves/gold/lives per map+difficulty); still blocked on the operator publishing a `ctd3-scores` RTDB rules block (ADR-017, console-managed, out of repo). **Note this is the same operator action that unblocks R-2** — one Firebase visit clears both.
- **Tower-roster depth / combination mechanic** — deliberately not competing with endless for a cycle.
- **Daily seeded challenge** — seam already laid; every endless run has a reproducible seed shown on the results screen.
- **Editor gold-budget + Ctrl+S settle** — see above.

### drop-with-reason

- **A "show all tower ranges" planning toggle.** A real TD affordance and a natural neighbour of R-1, but it is a feature, not a residual, and this sprint's charter explicitly discharged the feature path. Belongs in cycle-3 planning if it belongs anywhere.
- **Music/ambient sourcing.** Unchanged: a content-acquisition task, not a code task. C-5 made silence honest; the wiring is one line from returning.
- **Recoloring any decal to resolve the gold-on-gold adjacency.** The adjacency was investigated and found not to be a collision (mutual exclusion + 12× radius separation). Changing the ratified gold token to fix a non-problem would be churn.

---

## Known-unknowns

**What I could not verify, and what would settle it:**

- **Endless *feel*.** Unchanged and still the single most valuable operator action — it is the last gate on C-3. **Settled by:** playing it.
- **Endless on a live Community map.** Still never run. The tab is genuinely empty, not broken — the read path works. **Settled by:** the operator publishing one map from the editor after allowing the RTDB write.
- **The range circle at T3 radius 10.** Verified to 9.0; the last 10 % of the radius range is unobserved. Would need a run with enough gold to reach T3.
- **The range circle over genuinely tall terrain.** All six official maps are flat-ish with scattered props. The 0.24 clearance accepts 2–5 % clipping on 0.296-tall path corners, but a map with substantial elevation could fragment a large ring into arcs. No such map exists yet — this becomes a real question the moment the **layout generator** starts producing terrain.
- **Long-run endless beyond wave 26** — unchanged; waves 27+ have never been simulated or seen.
- **The C-6 observer above 900 px** — unchanged; asserted-not-to-fire on desktop by design, verified only at 785 px.
- **C-4's two missing camera passes** — plains at 0.7, tidewater/riverbend at 1.0. Note this sprint's six-map pass covered **every map at both cameras**, so for the *range ring* there is no equivalent gap.

**Standing operator items, carried:**

- **G-1 retune playtest** — unmet, now blocking a specific chunk for the second sprint running.
- **Real-phone bottom-sheet and tabs** — verified only in a resized desktop window.
- **Real NVDA / VoiceOver** — reasoned about and DOM-verified, never heard.
- **Real-iOS HUD** — unverified.
- **Snowfall path contrast** — **strengthened this sprint.** Two independent decal families have now been judged "weakest but legible" on snowfall_pass: the Warden aura (C-4) and the gold range ring (R-1). Two independent findings pointing at one map is a signal about **snowfall's ground palette**, not about either decal. Worth treating as a map question rather than continuing to re-judge decals against it.
- **Firefox / Safari matrix** — every verification this sprint ran in the debug Chrome, against a no-store server on `:3003` (probed and confirmed `Cache-Control: no-store` before use), with an ignore-cache reload before every verdict.

---

## Note for the next session

`main` is **12 commits ahead of `origin/main`** and nothing was pushed. Deploying — push plus the Cloudflare purge — remains the operator's action, and endless mode stays invisible to players until it happens.

**The next cadence turn should be cycle-3 planning.** Both blocked chunks are blocked on operator actions rather than on engineering, C-3's brief is written and its inputs are measured and waiting, and cycle 2's residual list is now empty of anything a session can land unaided. If the operator would rather see C-3 done first, the ten-minute playtest is the whole cost of unblocking it.
