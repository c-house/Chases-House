# ADR-037: CTD3 Cycle 2 — Endless Mode as the Economy Runway, and the Chunked Sprint Plan

**Date:** 2026-07-23
**Status:** Accepted
**Supersedes the planning horizon of:** [ADR-036](036-ctd3-benchmark-balance-direction-and-sprint-plan.md) (its Now/Next columns are drained; its decisions D1–D6 stand and are carried forward unchanged unless explicitly noted)
**Relates to:** ADR-028 (CTD3 core), ADR-029/030/031 (editor, tile renderer, WFC fill), ADR-034 (UI/UX remediation — fully SHIPPED), ADR-017 (Firebase security model)
**Benchmark source (read-only):** `C:\Users\chase\Projects\Warcraft\docs\td-comparison\` — Cube Defense 5.2 and Element TD 4.3b, extracted curves in `data/*.csv`, rubric in `METHODOLOGY.md`.

This ADR is Prompt 1 (Retrospect & Plan) of cycle 2 of the sprint-cadence chain. §1 is the retrospective, §2 the re-graded curves, §3 the docket adjudication, §4 the PM-lens syntheses, §5 the roadmap, §6 the decisions, §7 the dispatchable chunks. **No implementation ships with this ADR.**

---

## 1. Retrospective — cycle 1 in full (`bff1c18` → `ed4fb7d`, 22 commits)

ADR-036 §1 covers everything before `bff1c18` and is not re-tread here. Cycle 1 = 19 work commits + 3 hand-backs across three sprints.

### Group A — Sprint 1: the economy backbone (6 commits, `e943706` → `4e880b6`)

`e943706` sim harness · `bfb2435` economy backbone · `b2c08cc` content wiring + attrition retune · `0053fe8` early-call bonus · `dbbc503` ADR-034 closeout · `4e880b6` editor Group 7a.

**Benefit:** this is the sprint that gave CTD a *deliberately designed* economy, and — more durably — the instrument to keep it designed. The harness opened with 10 documented KNOWN-FAILs (4 dead Phase-5 enemy types, 5 attrition declines, the Tidewater stub) and closed the sprint with all 10 cleared and the registry emptied. Every ADR-036 §2 defect was addressed: coupling inverted → coupled (spirited pays ×1.25), tier efficiency declining → rising, attrition declining → monotone rising, dead content → wired, 3-wave stub → 8 waves.

**Arc:** CTD3's history is 2D→3D rebuild → editor → tile renderer → WFC fill → content Phase 5 → a two-month brand/UX remediation. Sprint 1 is the first time the *play loop* was the deliberate subject of a sprint rather than an accretion.

### Group B — Sprint 2: closing ADR-034 and the deferred-debt sweep (7 commits, `71970e6` → `6b441d3`)

`71970e6` editor default-map H8a fix · `6e37dc1` grid half-integer alignment · `1008d8b` Group 7b responsive shell · `a97b78b` Group 7b theme wiring (**ADR-034 SHIPPED**) · `9575bc6` editor override round-trip · `e574155` sheet-modal focus/pause · `6b441d3` harness recursive split-chain + cycle guard.

**Benefit:** ADR-034 — a two-month, seven-group remediation program — is fully closed. Every one of Sprint 1's `fold-into-next-sprint` items was drained rather than rolled. Note `a97b78b` has a live game side-effect the plan sanctioned: forest/mountain themed WFC palettes changed the *terrain the game renders*, not just the editor preview. That matters in §3(c).

**Arc:** the polish program ends here. From cycle 2 forward, UI work is in service of gameplay rather than a program of its own.

### Group C — Sprint 3: closing the editor↔balance loop (6 commits, `148e744` → `0f7cda2`)

`148e744` Simulate + sim-core extraction · `d0cd4ee` editor shell polish trio · `637406a` import accepts its own export · `f8f0942` game sheet keyboard follow-through · `362e0e4` wfc-test themed-palette assertions · `0f7cda2` catapult pricing readability.

**Benefit:** `148e744` is the structurally important one. Extracting the scripted-build runner into `tools/sim-core.js` (a window-IIFE consumed *both* by `sim-harness.cjs` through its `global.window` shim and by the editor page) means there is exactly one simulation implementation, and it takes a **map object** rather than a map id. That single design choice is what makes every balance gate in §7 possible — including for maps that don't exist yet.

**Arc:** ADR-036's roadmap predicted a "simulate this map" spike as a *Later* possibility. It shipped as a working feature one sprint after the harness it depends on.

### What cycle 1 proves about process

- **19 work chunks dispatched, 19 landed, zero failed out** — including two stretch chunks (Sprint-1 CH-6, and Sprint 3's whole roadmap-drain). Direct dispatch to a fresh worker session, with a self-contained brief and a machine-checkable completion condition, is a validated recipe at this repo's scale. Cycle 2 uses it unchanged.
- **The machine-checkable gate is doing the work.** Every sprint's hand-back reports a specific gate state (`58 pass / ALL PASS`, `wfc-test 12 pass`, `git diff --stat -- tools/curves/` empty) rather than a narrative claim. This is the direct descendant of the ADR-036 §1 Group R2 lesson (the "COMPLETE"→"PARTIAL" correction chain) and it held for three sprints.
- **Adversarial diff review per chunk earned its keep** — 1 MAJOR caught pre-commit in Sprint 2 (W-4's disabled-button focus no-op), 2 fixes applied from review in Sprint 3 (the `'constructor'` prototype-chain assertion; X-6's `→` projection). Keep it.
- **Staleness guards repeatedly fired.** Sprint 1 found the ADR-036 ledger stale on editor Group 7 and on ADR-034 T14 — in both cases the worker implemented the *real* residual rather than the specified one. Sprint 3 found the X-2(c) premise false and took the other correct branch: implemented per the spec's letter and classified the premise gap as a residual. The guard is not ceremony.

### What cycle 1 deliberately did not touch

The ADR-036 §5 **Later** column, in its entirety: endless mode, leaderboards, the Warden cyan re-check. Also untouched by design: campaign wave order (lesson-6 DROP stands), star thresholds, unlock requirements, tower/enemy GLB or material assets (ADR-034 Decision C), and any mobile-first editor rebuild. That Later column is now this cycle's docket.

---

## 2. Re-grade — the curves after cycle 1

ADR-036 §2 was hand-extracted and is now stale by design. Current state is machine-extracted: `node tools/sim-harness.cjs` from `games/castle-tower-defense/` → **58 pass / 0 fail / 0 known-fail / `ACCEPTANCE: ALL PASS`**, writing `tools/curves/*.csv`. Tables below are computed from those committed CSVs.

### 2.1 Spine curves — now vs ADR-036 §2.2

Geometric-mean growth per wave, w2→w8 (w1 excluded as tutorial-scale, matching ADR-036's method):

| Map | HP growth (was) | HP growth **now** | Income growth **now** | **Compounding gap** | Attrition w2→w7 | Boss/finale |
|---|---|---|---|---|---|---|
| Plains | ×1.31 | **×1.446** | ×1.396 | **+3.6 %/wave** | 0.60 → 1.08 ▲ | 1.27 |
| Forest | ×1.20 | **×1.454** | ×1.392 | **+4.4 %/wave** | 0.64 → 1.07 ▲ | 1.37 |
| Mountain | ×1.33 | **×1.477** | ×1.449 | **+1.9 %/wave** | 0.67 → 1.16 ▲ | 1.58 |
| Snowfall | ×1.28 | **×1.482** | ×1.404 | **+5.6 %/wave** | 0.60 → 1.10 ▲ | 1.34 |
| Riverbend | ×1.28 | **×1.467** | ×1.414 | **+3.8 %/wave** | 0.68 → 1.12 ▲ | 1.28 |
| Tidewater | *(3-wave stub)* | **×1.409** | ×1.320 | **+6.7 %/wave** | 0.62 → 1.11 ▲ | 1.27 |

**Deltas vs ADR-036 §2.2, stated plainly:**

1. **The attrition slope inverted, on every map.** ADR-036 found the ratio *declining* through the midgame on all six ("0.87 → 0.64", "1.08 → 0.49"). It now rises monotonically w2→w7 on all six, landing 1.07–1.16 — inside D2's ~1.0–1.2 target — with the finale spike preserved at 1.27–1.58. The harness enforces this as six `attrition-monotone:<map>` checks, so it cannot silently regress.
2. **The compounding gap is now positive everywhere.** ADR-036: *"CTD's income growth matches or outruns its HP growth on every map."* Now HP outruns income by **+1.9 % to +6.7 % per wave** — the same *shape* as ETD's deliberate ~7 %/level gap, at the top of the range on Tidewater and Snowfall and lightest on Mountain.
3. **Tier efficiency rises, and the harness asserts it.** All three DPS towers now buy modest efficiency with tier, within D3(a)'s 1.1–1.3× target: Ranger 0.224→0.233→0.268 (**1.20×**), Catapult 0.128→0.136→0.154 (**1.20×**), Mage 0.121→0.130→0.148 (**1.23×**). ADR-036's Catapult (0.128→0.077) and Mage (0.121→0.074) *declines* are gone.
4. **Harder-pays-more is live and asserted.** Six `bounty-coupling-total:<map>` checks; e.g. Riverbend quiet 2142 g vs spirited 2753 g earned.
5. **Ranger T3 dominance is CLOSED — by role separation, not by nerf-to-parity.** Ranger T3 still has the highest raw single-target DPS/gold (0.268 vs Catapult 0.154, Mage 0.148), and that is now correct rather than degenerate, because `applyDamage` reduces **physical only** by armor (`entities.js`) — so vs Shielded (armor 0.65) Ranger T3's effective 0.094 loses to Mage T3's 0.148, and vs packs Catapult's 3.5-radius splash and Mage's 2 chains multiply their per-gold output several-fold. Each tower now wins at its own job. D3(a)'s "no tower's tier may strictly dominate another type's role" is satisfied.

### 2.2 Two deviations carried forward honestly

- **The w5 mid-band overshoot.** D2 asked for ~0.6–0.8 through waves 2–5; w5 lands 0.853–0.893 on all six maps (Forest 0.853, Mountain 0.856, Riverbend 0.872, Plains 0.877, Snowfall 0.886, Tidewater 0.893). Sprint 1 signed this off (hand-back discrepancy #3): a smooth monotone rise cannot hold 0.8 at w5 *and* reach 1.0–1.2 by w7. The hard requirements (monotone, w7 band, boss spike, no decline) all hold. **Unchanged in cycle 2. Revisit only if the G-1 playtest reads the midgame as too hot.** Any tool that visualizes the band (C-6) must treat this overshoot as sanctioned, not as a violation.
- **The wave-1 shoulder.** On five of six maps attrition *falls* from w1 to w2 (Snowfall 1.091 → 0.600; Mountain 1.091 → 0.669; Forest and Riverbend 0.873 → 0.638/0.676; Tidewater 0.655 → 0.620). Plains is the exception and rises (0.109 → 0.598) because its wave 1 is deliberately tutorial-scale. This is a construction artifact — start gold is a flat 220 against whatever wave 1 is — and D2's band governs w2→w7 only. Not a defect; recorded so a future reader doesn't "fix" it.

### 2.3 The finding that sets this cycle's direction

**CTD's economy is now well-shaped and has almost nowhere to express itself.**

The compounding gap is the right shape, but 8 waves gives it six compounding steps: +3.6 %/wave over six steps is ~24 % total drift. ETD's ~7 %/level over 54 levels compounds ~38×. The same applies to every counter-curve cycle 1 built — a 1.20× tier-efficiency ladder and a 20-second early-call bonus change the outcome of an 8-wave run by a few percent. A player who banks perfectly and a player who does not finish within a rounding error of each other.

The mechanisms are in place. The *runway* is not. That is the argument for §3(a), and it is an argument about using work already paid for rather than about adding content.

### 2.4 Re-reading the benchmark's deferred lessons

Read-only re-check of `docs/td-comparison/README.md` §4 and `METHODOLOGY.md`. Cycle 1 shipped lessons 2, 3, 7, 8 and adapted 4. The four deferred lessons were **all deferred to endless mode**, and their reference parameters are the starting points for §6:

| Lesson | Reference parameter | Status entering cycle 2 |
|---|---|---|
| 1 — formula HP, authored exceptions | ETD `hp = base × 1.178^level`, flat multiplier | Deferred to endless (ADR-036 lesson table). Campaign's single-`hpMult` scaling remains structurally correct at n=8. |
| 4-pure — interest on banked gold | ETD 2 %/15 s, visible countdown | D4 does not merely tolerate pure interest in endless — it **assigns** it there: *"Pure 2%/15s interest is reserved for endless mode where waves auto-send."* The deferral was conditional on `prepWave` being untimed; endless auto-send is the stated condition. |
| 5 — leak forgiveness | ETD loop-back; Cube buy-a-life @ 100 g | Deferred by ADR-036 §3 **lesson 5**, whose recorded reason is that loop-back would corrupt star semantics and buy-a-life is "an economy sink worth revisiting inside endless mode where stars don't apply." D5 names buy-a-life as endless-homed but is silent on stars. |
| 6 — shuffle middle, pin anchors | ETD Fisher–Yates over levels 6–59 | DROP for campaign (stands); endless is the home. |

---

## 3. Cycle-2 docket — adjudication

**Staleness guard applied to every item**: checked against `git log bff1c18..HEAD` *and* current source before proposing. Grep for `endless|survival|leaderboard|highscore` across `games/castle-tower-defense/**` returns **zero matches** — none of §3(a)/(b) has shipped in any form.

### (a) Endless / survival mode — **BUILD NOW**, in the shape decided in §6

The decided direction from D5, never specced. §2.3 supplies the reason it is the headline: it is the runway that makes cycle 1's economy matter, not new content. **Shape, and one significant re-scope, in D8–D10 below.**

**The re-scope, with its evidence.** ADR-036 §4 asserted "infinite fair maps" is "one WFC + a formula HP curve away." That is **wrong**, and cycle 2 must not be planned on it. `games/castle-tower-defense/wfc.js` generates the **decorative non-path field only** — its own header reads *"Compact Wave Function Collapse for the 2D non-path field… populate the open green expanse with kit ambient terrain variants"*, and path cells plus hand-authored decorations arrive as `preSeed` constraints. Both callers (`scene.js:308`, `map-editor.html:2719`) use it exactly that way. Generating a *map* means generating a path polyline, build slots and a castle — a different algorithm that does not exist.

What *does* exist is the **fairness oracle**, in two halves: the editor's 9 machine-checked blockers (`PATH_MIN`, `AXIS`, `ZERO_LEN`, `H8a`, `H9`, `H6`, `SLOT_INT`, `NO_SLOTS`, `WAVES_PARSE`) and `CTD3SimCore.runScripted(mapObject, difficulty, build)` completability. Generate-and-reject is therefore credible — but it is an XL with its own ADR, not a rider. See D10 and §3(f).

**The cheap substitute that ships this cycle:** endless runs on **any map object**, which — because sim-core already proved map-object-driven runs work — means endless × the existing official + My Maps + Community library. Variety-per-run arrives via the authoring differentiator that already exists, and a generator later becomes an *upgrade* rather than a prerequisite.

### (b) Per-map / endless leaderboards — **DEFER to cycle 3**, with a named unblock

Firebase is genuinely wired: `games/shared/firebase.js` (anonymous auth, RTDB), consumed at `ctd3-community/<CODE>` by `game.js:333` and `ui.js:451` (Community tab) and by `map-editor.html:1642` (publish). Adding `ctd3-scores/…` is a small client change — but two things block it:

1. **RTDB rules are console-managed, not in the repo** (ADR-017). A score path needs a rules block published by the operator in the Firebase console before any client write can succeed. That is an out-of-repo dependency a worker session cannot satisfy.
2. **There is no score worth posting yet.** Campaign scoring is stars (3 tiers, ceiling-bound); the natural leaderboard metric is *waves survived in endless*, which §3(a) creates.

Honest caveat to carry into cycle 3: with anonymous auth and no server-side validation, a leaderboard is forgeable by anyone who opens devtools. ADR-017 already ratified "personal-site scale of trust" for `ctd3-community` (no ownership rules). A leaderboard inherits that stance — worth building, worth being honest that it is an ornament rather than a competitive ladder.

**Unblock condition:** endless scoring shipped (C-1) **and** the operator has published the `ctd3-scores` rules block.

### (c) Warden cyan legibility re-check — **BUILD NOW** (chunk C-4, size S)

Reversible single-constant decision, as the bootstrap notes. But it has acquired a *new reason to re-check* that did not exist when ADR-034 Deliberate Decision A ratified `WARDEN_AURA_COLOR = 0x8fc6cf`: **Sprint 2's `a97b78b` changed the ground the aura sits on.** `rulesForMap()` gained theme-keyed WFC palettes (forest tree-dense, mountain rocky/no `tile_tree_quad`), and because `scene.js:295` passes the map through `rulesForMap(map)`, forest/tidewater/riverbend/mountain now **generate different terrain-variant distributions in the game itself**, not only in the editor preview.

**Correction to an earlier draft of this section, kept as a caution:** the *background tint* retint (`THEME_BG` pine `0x152821` / moss `0x1f3329` / sage-stone `0x2a4234`) is **editor-preview-only** — `THEME_BG` exists solely in `tools/map-editor.html`, and `git show --stat a97b78b` confirms `scene.js` was untouched. The game's `0x152821`/`0x1f3329` are `TOKENS.BG_MAIN`/`BG_SURFACE` (`scene.js:17-18`), which predate the Warden ratification. So the re-check's grounds are **changed terrain fill density and composition, not a changed background color** — which still materially alters what the cyan ring is read against, but is a weaker premise than a full retint. The Sprint-3 in-game sweep also flagged an adjacent contrast observation (snow path vs white ground) worth checking at the same time. Verified stale-free: `scene.js:44` still reads `0x8fc6cf`.

### (d) Sprint-3 fold-forwards — **BUILD NOW, bundled** (chunk C-6)

- **Attrition-band coloring in the Simulate results box.** Deferred by Sprint 3 because a monospace `textContent` box can't carry per-row spans; wants a small DOM-table render. Its value rises with endless — an author reading where their map's curve sits against the D2 band is exactly the editor↔balance loop cycle 1 opened.
- **Activating the X-2(c) auto-switch observer.** The bootstrap's condition ("only if an editor chunk is planned anyway") is met by the bullet above, so it rides along. Framed honestly: the *justification* is not "activate a dormant observer" — it is that at <900 px the Export tab is hidden and the editor has no visible Save outside it, so a topbar Save is a genuine bottom-sheet-shell ergonomic gap (`.topbar .tools` at `map-editor.html:133` is the natural home). Activating the observer is the free consequence.

### (e) Audio — **BUILD NOW as honesty, not as sourcing** (chunk C-5, size S)

Verified: `assets/audio/` contains 13 `.ogg` files; `bgm_loop.ogg` and `ambient_loop.ogg` are **genuinely absent**, while `audio.js:26-27` still preloads them. Three sprints of hand-backs have had to write "only the pre-existing audio/favicon 404s" — the noise has become a filter every reviewer must apply, which is exactly how a real error gets missed.

Worse, and newly surfaced by this re-grade: **Settings ships two dead volume sliders, not one.** The Music slider (`index.html:832`, wired `game.js:252` → `setMusicVolume`) controls nothing because `bgm_loop` is missing; the **Ambient slider** (`index.html:841-843`, wired `game.js:254` → `setAmbientVolume`) is exactly as dead, because its gain node is fed only by `startAmbient()` playing the equally-missing `ambient_loop`. Two shipped selectable controls with no path to effect — the same class as ADR-036 lesson 8 / Cube's dead difficulty modes, on the UI side rather than the data side.

**Adjudication:** cycle 2 **ships silence, deliberately and cleanly** — drop both absent entries from the preload manifest and gate **both** sliders on their respective buffers existing, so each control returns automatically if audio is ever sourced. Music *sourcing* is a content-acquisition task, not a code task; it stays an operator item (cycle 1 dropped it for the same reason and that call stands).

### (f) Surfaced by the retrospective / re-grade

- **Deploy backlog — 23 unpushed commits. OPERATOR GATE G-0, highest leverage item in this document.** `git log origin/main..HEAD` = 23. Hosting is GitHub Pages on push-to-`main` (repo CLAUDE.md), behind a Cloudflare cache needing a manual purge. **Every quality claim in §1 and §2 is true of the repo and false of chases.house.** Not a chunk — an operator action, and a gate on cycle-2 build starting (D7).
- **Run-length vs economy mismatch** (§2.3) — folded into (a) as its central argument.
- **Coverage rules are not machine-checked.** The editor automates 9 blockers + 6 warns (W1, W2, W4, W5, W6, W8). **Not** automated: H1–H5, H7, H8, H10–H12, W3, W7 — i.e. every *coverage and fairness* rule (inside-corner slots, slot-to-path proximity, straight-away coverage, synergy pairs, anchor slots, slot diversity, path/turn budget, spawn telegraph, slot-count ratio, coverage redundancy). A generated layout could pass all 9 blockers and still be unfair. **Build-now as stretch (chunk C-7)**: promoting them to code is independently useful to hand-authors *today* and is the hard prerequisite for the layout generator, de-risking a cycle-3 XL at S/M cost now.
- **Browser matrix.** Three sprints verified in the debug Chrome only. Firefox/Safari untested since before cycle 1. Standing operator item; not a chunk.

### Adjudication summary

| # | Item | Verdict |
|---|---|---|
| a | Endless / survival mode | **BUILD NOW** — C-1, C-2, C-3; re-scoped per D10 (generated maps are *not* in this cycle) |
| b | Per-map / endless leaderboards | **DEFER to cycle 3** — needs an endless score (C-1) + an operator RTDB-rules publish |
| c | Warden cyan re-check | **BUILD NOW** — C-4 (S); new grounds: Sprint-2 retinted the backgrounds it was ratified against |
| d | Attrition-band coloring + X-2(c) activation | **BUILD NOW, bundled** — C-6; the editor chunk the bootstrap's condition requires |
| e | Audio 404s / dead Music slider | **BUILD NOW as honesty** — C-5 (S); ship silence cleanly, sourcing stays an operator item |
| f1 | 23-commit deploy backlog | **OPERATOR GATE G-0** — not a chunk; gates cycle-2 build start (D7) |
| f2 | Coverage rules unautomated | **BUILD NOW (stretch)** — C-7; prerequisite for the cycle-3 generator, useful standalone |
| f3 | Browser matrix | Standing operator item |
| — | Layout generator / map-per-run | **DEFER to cycle 3, own ADR** — D10; `wfc.js` is fill-only, generator does not exist |
| — | Co-op / multiplayer | **DROP** — RTDB exists but real-time 3D sync is XL and CTD is single-player-shaped |
| — | Tower-roster depth / combination mechanic | **DEFER** — ETD's real differentiator; competes with endless for the same cycle |
| — | Campaign wave shuffle, star/unlock changes, GLB edits | **DROP** — ADR-036 lesson-6 and ADR-034 Decision C stand |

---

## 4. PM-lens syntheses

**Brainstorm — converged.** The reframe that carried the session: an 8-wave run gives the cycle-1 economy six compounding steps, so none of it — gap, tier ladder, early-call tempo — can express itself. CTD's skill ceiling is low because the run is short, not because the mechanics are missing. Endless is therefore *runway*, not content. The session's sharpest challenge — *depth work on an undeployed game is speculative* — promoted deploy from footnote to gate (D7). Directions explicitly generated and rejected: co-op (XL sync, wrong shape), more authored content (CTD's historical failure mode is content-without-wiring), tower combination mechanics (strong, but competes with endless for one cycle — parked to cycle 3). Parked as the prize the Next column combines into: a **daily seeded challenge** (generated map + shared seed + leaderboard), which is the one thing neither reference could ever do.

**Stakeholder update (ad-hoc, operator audience). Status: Yellow — execution green, delivery blocked.** Cycle 1 did everything it promised and none of it is live. 22 commits, 19 chunks, zero failed out; every ADR-036 §2 defect closed and machine-verified; ADR-034 fully closed; three durable new assets (harness, sim-core, in-editor Simulate). Risks: (1) **23 commits unpushed** — Owned, unmitigated; ask is authorize push + CF purge before cycle-2 build (G-0). (2) **Retune feel unverified** — Owned; the harness proves completable-and-correctly-shaped, not fun, and cycle 2 stacks endless economy on top; ask is 10 minutes of play as a gate (G-1). (3) **A shipped control wired to nothing** (Music slider) — Accepted, fixed by C-5.

**Competitive brief — delta grade vs Cube Defense 5.2 and Element TD 4.3b.** (These are design benchmarks, not market competitors; the useful output is capability parity.)

| Capability | CTD @ ADR-036 | **CTD now** | Cube 5.2 | ETD 4.3b | Δ |
|---|---|---|---|---|---|
| Economy depth | Weak | **Adequate** | Adequate | **Strong** | ▲ |
| Difficulty engineering | Adequate | **Strong** | Weak | Strong | ▲ |
| Tower-choice depth | Weak | **Adequate** | Adequate | **Strong** | ▲ |
| **Replay structure** | **Weak** | **Weak** | Adequate | **Strong** | **— the remaining gap** |
| Presentation | Strong | Strong | Weak | Weak | — |
| Reach / friction | Strong | Strong | Weak | Weak | — |
| Authoring / UGC | Strong & unique | Strong & unique | Absent | Absent | — |
| **Balance observability** | *(unrated)* | **Strong & unique** | Absent | Absent | **new** |

Three of four lagging capabilities moved in one cycle; **the one that remains is the one endless mode answers.** Grading notes: economy depth is Adequate not Strong because there is still no interest and no runway to compound on; difficulty engineering is now arguably co-leading ETD because CTD has the coupled scalar pair *plus* an automated selection→effect gate that neither reference has (Cube's two dead difficulty modes are precisely what the 58 checks now prevent); tower-choice is Adequate not Strong because four towers with genuine role separation is not ETD's element lattice. **Balance observability is a capability cycle 1 created and it changes the strategic math** — both references were balanced by years of ladder play, where CTD re-grades its full curve set in seconds. That is the asset that makes procgen *fairness* checkable rather than aspirational, and it is why the cycle-3 generator is credible even though §3(a) shows the generator itself doesn't exist yet.

**Roadmap + sprint planning** — §5 and §7.

---

## 5. Roadmap (Now / Next / Later)

| Horizon | Item | Why here |
|---|---|---|
| **Now** (this cycle) | **G-0 deploy gate** (operator) | Depth work on an undeployed game is speculative; 23 commits of quality are invisible |
| | **G-1 retune playtest gate** (operator) | The only non-harness verification of the cycle-1 economy that endless builds on |
| | **C-1/C-2/C-3 endless mode** — engine+economy, UI, calibration | §2.3: the runway cycle-1's economy has no room to express in 8 waves; fully harness-verifiable |
| | **C-4 Warden re-check · C-5 audio honesty · C-6 editor Simulate/Save** | Each closes a named, grounded debt at S/M cost |
| | **C-7 fairness oracle** *(stretch)* | Useful to hand-authors now; hard prerequisite for the cycle-3 XL |
| **Next** (cycle 3) | Layout generator — path + slots + castle, generate-and-reject against C-7 + sim-core | The actual differentiator; own ADR (D10) |
| | Endless leaderboard | Unblocked by C-1's score + an operator RTDB-rules publish |
| **Later** | Daily seeded challenge (generated map + shared seed + leaderboard) | The three Next items combine into something neither reference can do |
| | Tower-roster depth / combination mechanic | ETD's real differentiator; deliberately not competing with endless for this cycle |
| | Firefox/Safari matrix, real-device iOS, NVDA/VoiceOver | Standing operator items, carried since Sprint 1 |

**Cut / won't-do this cycle:** co-op multiplayer; mobile-first editor rebuild (ADR-034 out-of-scope stands); tower/enemy GLB or material edits (ADR-034 Decision C stands); campaign wave shuffle (ADR-036 lesson-6 DROP stands); star-threshold or unlock changes; ETD-style loop-back leaks (considered and rejected — D9).

---

## 6. Decisions

ADR-036 **D1–D6 stand unchanged.** D1 is spent (the pivot happened). D2's band, including the signed-off w5 overshoot, is untouched by this cycle. D6 is *load-bearing here*: endless is a new selectable mode, so D6 makes harness coverage of it **mandatory, not optional** — that is why every endless chunk below carries a harness gate.

**On D5's "own ADR before any build" clause.** D5 records endless as a decided direction "specced in its own ADR before any build." §6 D8–D11 plus the C-1/C-2/C-3 briefs *are* that spec — mechanics, parameters, rejected alternatives and gates — and no build predates them. This ADR discharges D5's clause rather than waiving it; a separate document would duplicate §6 with no added constraint. If the cycle-3 layout generator proceeds it gets its own ADR (D10), because that scope is genuinely unspecced here.

- **D7 — Deploy is a gate, not a footnote.** The 23-commit backlog is pushed and cache-purged before cycle-2 build chunks are dispatched. Rationale: three sprints of verified quality that no player can reach is not shipped work, and it makes every subsequent quality claim unfalsifiable in the only environment that matters.

- **D8 — Endless mode is a parallel mode on the existing engine, not a fork.** It is entered via `createState(mapId, difficulty, { endless: true })`; the campaign path is untouched. Four cycle-1 facts make this cheap and are the reason the shape is what it is:
  1. `makeEnemy(type, hpMult)` already takes a multiplier, so **formula HP is a one-argument change**: `hpMult = diff.hpMult × ENDLESS_GROWTH^(wave−1)`. Lesson 1, satisfied without a new HP system.
  2. `prepCountdownMs` already ticks down in `step()`, so **auto-send is a small addition to existing machinery rather than a new timer**. One caveat that must not be glossed: `0` is currently the *"no countdown armed"* sentinel — `createState` initialises it to 0 and only `checkWaveClear` arms it, so endless wave 1 has no zero-crossing to act on. Endless needs an explicit armed flag (or an explicit wave-1 arm); a naive `if (prepCountdownMs <= 0) sendNextWave()` would send endless wave 1 instantly with zero build time.
  3. `mergedDifficulty()` is the single scalar merge point, so endless scalars layer there and keep the D6 selection→effect path intact.
  4. `sim-core.runScripted` takes a **map object**, so every endless balance property is machine-checkable before a human plays.

- **D9 — Endless mechanics, decided.** Formula HP per D8.1 (start `ENDLESS_GROWTH ≈ 1.15`, calibrated by C-3). **Growth goes into per-enemy HP, not spawn counts** — both because that is ETD's shape (constant 30 spawns/level, all growth in HP) and because a 3D browser game cannot spawn 200 entities at wave 50. Per-wave spawn counts stay bounded by level-design rule **W8, whose stated ceiling is 35 concurrent** ("approximate guard against the engine's ~30–40 entity comfort zone"; the editor implements it as `peak > 35`). Bounty scales alongside at `ENDLESS_GROWTH / 1.07`, reproducing ETD's deliberate ~7 %/level compounding gap. **Pure interest at 2 %/15 s** — this is not a departure from D4 but its execution: D4 says verbatim *"Pure 2%/15s interest is reserved for endless mode where waves auto-send,"* having deferred it from the campaign only because `prepWave` was untimed and banked gold could tick forever at zero risk. Endless auto-send is precisely the condition D4 names. The early-call bonus is *kept* in endless and opposes interest (call early → more bonus, less accrued interest); C-3 must check that tension for degeneracy in either direction. **Shuffle-with-anchors:** waves 1–5 fixed (learnable opening, ETD's pattern), boss anchors every 10th wave, Fisher–Yates over each 10-block's middle, all from a seeded RNG so a run is reproducible and harness-checkable. **Leak model: buy-a-life** (Cube's mechanism, escalating cost), **not ETD loop-back** — loop-back re-inserts enemies mid-`stepEnemies`, a hot path that also interacts with split and spectral behaviour, for a self-pacing benefit CTD's generous lives already provide; buy-a-life is a pure economy sink that pairs with interest to create the bank-vs-safety decision. Loop-back recorded as the considered alternative. **Scoring: waves survived**, gold/lives as tiebreak; stars do not apply (D5).

- **D10 — Generated maps are NOT in this cycle; endless ships on authored maps.** `wfc.js` is decorative-fill-only (§3a evidence), so map-per-run needs a layout generator that does not exist and is an XL. Stacking an unbuilt generator on an unbuilt mode risks both. **Endless instead runs on any map object** — official, My Maps, and Community — so run variety arrives from the authoring differentiator CTD already has, and the generator becomes an upgrade in cycle 3 rather than a prerequisite now. ADR-036 §4's "one WFC away" claim is corrected by this decision.

- **D11 — Endless balance is harness-gated, and its *feel* calibration is playtest-gated.** Per the cycle-1 constraint that the retune's feel is unverified, unverified feel is not stacked on unverified feel: C-1's and C-2's gates are pure harness properties (determinism, unboundedness, selection→effect, non-degeneracy) that hold regardless of how the campaign *feels*; **C-3, which sets the numbers a human will feel, is gated on operator playtest G-1.** C-3 is the only chunk in §7 with a human gate, and it is deliberately the last one.

- **D12 — Cycle 2 does not touch campaign balance.** No edits to `maps.js` wave compositions or rewards, no `ENEMIES` hp/bounty changes, no `TOWERS` tier changes, no star thresholds or unlock requirements. The signed-off D2 curves and the six `attrition-monotone` checks must be byte-stable across the entire cycle: `git diff --stat -- tools/curves/` empty at every chunk boundary except where a chunk explicitly adds endless CSVs.

---

## 7. Sprint plan — dispatchable chunks

Sprint goal, one sentence: **give CTD's economy a run long enough to matter — an endless mode on any map, machine-verified before a human plays it — and clear the last four named debts.**

Capacity: solo, evening cadence, ~2–3 weeks. Cycle 1 landed 19 chunks across three sprints (~6/sprint), so seven chunks is roughly a sprint and a half with C-7 as the shed-able stretch. Effort yardstick unchanged: **S ≤2h, M ≤4h, L ≤8h, XL multi-day.**

**Standing rules for every chunk** (repeated so each brief stays self-contained): commit style `ctd3: <scope> — <description> (ADR-037)`; stage only that chunk's files by explicit path, **never `git add -A`** (the repo carries an uncommitted `.gitignore` edit that must stay untouched, plus unrelated untracked files); cabin design tokens from `/styles.css` only, no ad-hoc colors, radii via `var(--radius-*)`; run `node tools/sim-harness.cjs` from `games/castle-tower-defense/` before committing any chunk that touches `engine.js`/`entities.js`/`maps.js`/`tools/`, and `node tools/wfc-test.cjs` for any `wfc-rules.js` touch; do not push.

### Operator gates (not chunks — no worker session can do these)

**G-0 — Deploy the cycle-1 backlog.** `git push origin main` (23 commits), then purge the changed asset URLs in the Cloudflare dashboard (repo CLAUDE.md: static assets cache up to ~4h; no CF API token on this box, so the purge is manual via Custom Purge). Then `curl`-verify a cycle-1 artifact is live rather than trusting the dashboard. **Blocks:** dispatch of C-1 (D7).

**G-1 — Retune feel playtest.** ~10 minutes of human play: Mountain/spirited and Tidewater/quiet, post-retune. Looking for: does the midgame read as too hot (the §2.2 w5 overshoot), does the wave-8 spike land as a climax or a wall, does the early-call countdown create tempo or nag. **Blocks:** C-3 only (D11). Standing item since Sprint 1.

---

### C-1 — Endless mode: engine + economy, headless `P0 · size L · deps: none (dispatch after G-0)`

**Brief.** In `games/castle-tower-defense/` (browser 3D tower defense, vanilla JS, no build step; `engine.js` and `entities.js` are window-global IIFE modules that are pure sim — no DOM, no Three.js), add an endless/survival mode entirely below the UI layer. `CTD3Engine.createState(mapId, difficulty, opts)` already accepts an options object (it carries `opts.tutorial`); add `opts.endless` plus a run seed. In endless: (1) **waves never run out** — `checkWaveClear()` currently sets `fsm = 'wonRun'` when `waveIndex >= waveTotal - 1`; in endless it must increment unbounded and pull the next wave from a generator instead of `map.waves[waveIndex]`, so `wonRun` is unreachable and only `lostRun` ends a run; (2) **formula HP** — `E().makeEnemy(type, hpMult)` already takes a multiplier at `engine.js` `stepWave()`, so pass `diff.hpMult × ENDLESS_GROWTH^(waveIndex)` with `ENDLESS_GROWTH = 1.15` as the starting constant (a later chunk calibrates it; expose it as a named constant, not a literal); (3) **wave generator** — deterministic from the run seed, built on the same group/wave shapes `maps.js` uses (`{type, count, spacing, delay}` groups); waves 1–5 fixed for a learnable opening, a boss-flagged anchor wave every 10th, and Fisher–Yates over the middle of each 10-block; **spawn counts stay bounded — all difficulty growth goes into per-enemy HP, not entity count**, because a browser 3D scene cannot carry 200 entities and because that is the reference shape (Element TD holds 30 spawns/level constant and puts all growth in HP). The binding ceiling is `docs/level-design.md` rule **W8: peak concurrent on-screen enemies must not exceed 35** (the editor already implements this as `peak > 35`); design to comfortably under it; (4) **auto-send** — `state.prepCountdownMs` already ticks down inside `step()`, so endless acts on it reaching zero by calling the existing `sendNextWave()` path. **Beware the sentinel:** `0` currently means *"no countdown armed"* (`createState` initialises it to 0; only `checkWaveClear` arms it to `PREP_COUNTDOWN_MS`), so a naive `if (prepCountdownMs <= 0) sendNextWave()` fires instantly on endless wave 1 and gives the player zero build time — add an explicit armed flag, or arm wave 1 explicitly; (5) **pure interest** — 2 % of banked gold every 15 s of unpaused sim time, paid through the centralized payout family in `entities.js` (`bountyFor`/`earlyCallBonus` live there; add a sibling rather than yet another ad-hoc `state.gold +=` site — there are already four in `engine.js`), with an emitted event so UI can announce it later; (6) **buy-a-life** — a new engine action returning the same enum style as `place`/`upgrade`/`sell` (`'ok'|'unaffordable'|'invalid'`), escalating cost (start `100 × 1.5^livesBought`); (7) **endless difficulty scalars** layered through the existing `E().mergedDifficulty()` merge point — do **not** add a parallel scalar table; per-map `difficultyOverrides` must keep working; (8) **endless scoring** — waves survived as the primary metric with gold/lives as tiebreak. **The early-call bonus is kept in endless** and deliberately opposes interest. **Constraint: campaign behaviour must not change at all** — no `maps.js` wave/reward edits, no `ENEMIES` or `TOWERS` value changes, and after re-running the harness the six existing campaign CSVs (`plains.csv`, `forest.csv`, `mountain.csv`, `riverbend.csv`, `snowfall_pass.csv`, `tidewater.csv` under `tools/curves/`) must be byte-identical to their committed state. Extend `tools/sim-harness.cjs` (which loads these modules under a `global.window` shim and requires `tools/sim-core.js`, the single shared simulation implementation) with endless checks: **determinism** (same seed → identical wave sequence across two runs), **unboundedness** (an endless run passes the campaign's 8-wave ceiling and reaches at least wave 20 for a competent scripted build), **termination** (every naive scripted build eventually *loses* — an endless mode where a dumb build survives forever is broken; assert max wave reached is below a sim cap), **build separation** (the three scripted builds' survival depths differ by at least 3 waves, proving build choice matters), **selection→effect** (spirited endless measurably differs from quiet — ADR-036 D6 makes an automated selection→effect path mandatory for any new selectable mode), and **interest non-degeneracy** (cumulative interest income stays below **35 %** of cumulative total income over a full run). Those two numeric thresholds are starting values chosen so the checks have teeth on day one; a later calibration chunk may move them, but do not weaken a threshold in the same commit that first fails it. Read `docs/adr/037-ctd3-endless-mode-direction-and-cycle-2-sprint-plan.md` §6 D8/D9 first — it carries the reasoning behind each parameter and the record of the rejected loop-back alternative.
**Files:** `games/castle-tower-defense/engine.js`, `entities.js`, new endless wave-generator module under `games/castle-tower-defense/` (or `tools/sim-core.js` if the generator is genuinely shared — keep exactly one implementation either way), `tools/sim-harness.cjs`, new `tools/curves/endless-*.csv` if the harness emits them.
**Completion (machine-checkable):** `node tools/sim-harness.cjs` exits 0, its last line reads `ACCEPTANCE: ALL PASS`, and its count line reports **more than 58** passing checks (58 / 0 fail / 0 known-fail is the pre-chunk baseline), including named endless checks for determinism, unboundedness, termination, build separation, selection→effect, and the interest bound. **Campaign-CSV stability, checked correctly:** after the harness run and *before* committing, `git status --porcelain -- tools/curves/` (run from `games/castle-tower-defense/`) must list only new `endless-*.csv` files and none of the six campaign CSVs. Do not use a multi-file `git diff -- a.csv b.csv` form — bare filenames there resolve against the current directory, silently match nothing, and exit 0 regardless of content. Commit `ctd3: endless mode — engine, formula HP, interest, buy-a-life (ADR-037)`.
**Size:** L. **Deps:** none (dispatch after operator gate G-0).

### C-2 — Endless mode: player-facing surface `P0 · size M · deps: C-1`

**Brief.** With the endless engine mode landed (`CTD3Engine.createState(mapId, difficulty, {endless:true, seed})` and its interest / buy-a-life / endless-score API), build its UI in `games/castle-tower-defense/` — a browser 3D tower defense using vanilla JS, window-IIFE modules, and cabin design tokens from the site-wide `/styles.css`. Scope: (1) **mode entry** from the map-select screen (`ui.js` renders official / My Maps / Community tabs; `game.js` dispatches `data-action="start-map"` with `data-map-id` + `data-difficulty`) — endless must be selectable **on any map in all three tabs**, because the engine takes a map object and running endless on user and community maps is this cycle's substitute for generated maps (ADR-037 D10); (2) **HUD** — the wave counter must read as unbounded rather than "wave 3 / 8", a visible interest readout with its next-tick countdown (Element TD, the design benchmark this mechanic is drawn from, puts its interest countdown in the multiboard title; here it belongs beside the gold counter, `--accent-gold` family, SMALLCAPS label, `aria-live="polite"` on the award), and a buy-a-life control showing its escalating price and disabled-with-reason when unaffordable; (3) **auto-send legibility** — prep now sends itself, so the existing early-call chip must read as "sending in Ns — call early for +Ng" rather than an idle timer; (4) **game-over** — endless has no stars (they do not apply in endless), so the results screen shows waves survived plus a personal best, persisted under a storage key **distinct from `KEYS.scores` in `game.js`** — `totalStars()` walks every difficulty key under each non-`user:` map in `ctd3:scores` summing `d.stars`, and that total drives campaign map-unlock gating (`unlockRequirement`), so any endless record written there risks corrupting unlocks; use a separate key (e.g. `ctd3:endless`) and do not extend the `ctd3:scores` shape; (5) restart/pause/return paths must work identically to campaign. Respect `prefers-reduced-motion` for any pulse (the codebase already gates existing pulses). **Because this is a UI/UX surface:** run `/frontend-design` for the HUD/mode-entry/results treatments and `/find-adjacencies` to surface adjacent and orthogonal UI/UX considerations, gaps and needs (fast-forward interaction with auto-send, pause during an interest tick, buy-a-life during a wave, tutorial suppression, the endless-vs-campaign affordance on a map card, small-viewport HUD density). Do **not** invoke `/web-artifacts-builder` — its React/shadcn component patterns do not apply to this vanilla single-file surface; perform the equivalent token-discipline and gold-budget critique directly (this fallback was taken and recorded in all three cycle-1 hand-backs). Gold is the scarce accent: do not add a second gold fill to the HUD.
**Files:** `games/castle-tower-defense/index.html`, `ui.js`, `game.js`, `input.js` (only if a binding is needed).
**Completion (machine-checkable + observable):** in-browser (serve the repo root over http and open `games/castle-tower-defense/`) — an endless run is startable from an official map, from a My Maps entry, and from a Community entry (the Community tab reads live from Firebase and **may be empty**; if so, publish one map from `tools/map-editor.html` first, or import a share link, so the path is genuinely exercised); the wave counter passes 8 without a victory screen; the interest readout ticks and pays; buy-a-life debits gold and adds a life; game-over shows waves survived and a persisted best; **`localStorage['ctd3:scores']` is byte-identical before and after a full endless run** (capture it in the console both times and compare); zero new console errors. `node tools/sim-harness.cjs` still exits 0 with `ACCEPTANCE: ALL PASS`. Commit `ctd3: endless mode — mode entry, HUD, buy-a-life, results (ADR-037)`.
**Size:** M. **Deps:** C-1 (needs the engine API).

### C-3 — Endless balance calibration `P1 · size M · deps: C-1; GATED on operator playtest G-1`

**Brief.** Constants-only tuning pass over the endless mode in `games/castle-tower-defense/` (a browser tower defense whose balance is machine-checked by `tools/sim-harness.cjs`, 58+ checks). **Do not dispatch this chunk until the operator has played ~10 minutes of the current campaign** (Mountain/spirited and Tidewater/quiet) and reported whether the midgame reads too hot — endless numbers are the first thing a human will *feel*, and they sit on a campaign retune whose feel is otherwise unverified. Tune, in the endless constants only: the HP growth constant (`ENDLESS_GROWTH`, starting 1.15), the bounty growth relationship (start `ENDLESS_GROWTH / 1.07`, reproducing Element TD's deliberate ~7 %/level compounding gap), the interest rate and any per-tick cap (starting 2 %/15 s), the buy-a-life cost curve (starting `100 × 1.5^n`), the boss-anchor cadence, and the endless starting gold/lives scalars. Targets, stated numerically so the gates have teeth: naive scripted builds die between **wave 15 and wave 35** (long enough that compounding and banking decisions matter, short enough that a run is one sitting); the three scripted builds' survival depths stay separated by **at least 3 waves**; **neither banking nor early-calling strictly dominates** — the early-call bonus and interest are deliberately opposed, so add two extra scripted policies (always-bank / always-call-early) and assert neither reaches more than **15 %** deeper than the balanced policy. If a threshold turns out to be the wrong target, change it in a commit that says so — do not weaken one in the same commit that first fails it. Add a harness assertion for each target so the calibration is regression-locked, and emit endless curve CSVs to `tools/curves/` so the next tuning pass starts from data rather than archaeology (this is the same discipline that let cycle 2 re-grade the campaign in one command). **Absolutely off-limits:** campaign wave compositions or rewards in `maps.js`, `ENEMIES` hp/bounty, `TOWERS` tier stats, star thresholds, unlock requirements — the campaign's signed-off attrition band is not this chunk's business and the six campaign CSVs must stay byte-identical.
**Files:** the endless constants module from C-1, `tools/sim-harness.cjs`, `tools/curves/endless-*.csv`.
**Completion (machine-checkable):** `node tools/sim-harness.cjs` exits 0 with `ACCEPTANCE: ALL PASS`, including named checks asserting the 15–35 survival band, the ≥3-wave build separation, and the ≤15 % no-dominant-strategy margin. Campaign isolation, checked correctly: run from `games/castle-tower-defense/`, `git status --porcelain -- tools/curves/` lists only `endless-*.csv`, and `git status --porcelain -- maps.js entities.js engine.js` is **empty** (this chunk is endless-constants-only and must not touch those files at all). Commit `ctd3: endless balance — growth, interest, life-cost calibration (ADR-037)`.
**Size:** M. **Deps:** C-1; **human gate G-1.**

### C-4 — Warden aura legibility re-check `P1 · size S · deps: none`

**Brief.** In `games/castle-tower-defense/scene.js`, `WARDEN_AURA_COLOR = 0x8fc6cf` (line ~44, with a mirrored `TOKENS.WARDEN_AURA` entry near line 28) is a cyan that was deliberately ratified as an off-palette exception — it is the one non-cabin hue in the scene, justified because a slow-aura must read instantly as "not a warm gameplay element." **That ratification predates a change to the terrain it was judged against.** `scene.js` (~line 295) passes each map through `CTD3WFCRules.rulesForMap(map)`, which since a later commit carries theme-keyed palettes — forest weights trees up, mountain excludes the dense tree-quad tile — so forest / tidewater / riverbend / mountain now generate visibly different ground-fill density and composition *in the game itself* than when the cyan was chosen. (Precision, because an earlier draft of this plan got it wrong: the *background tint* retint is editor-preview-only — `THEME_BG` exists solely in `tools/map-editor.html` and `scene.js` was untouched by that commit. The premise here is changed fill, not changed background color.) Re-check the aura's legibility in-browser against **all six official maps** (plains, forest, mountain, snowfall_pass, tidewater, riverbend), on the aura ring and its fill, at both a normal and a zoomed-out camera.

**Getting to the locked maps.** Three of the six are gated behind star totals (`maps.js`: mountain `unlockRequirement: 5`, riverbend `13`, snowfall_pass `14`) and the `?test=1` dev surface exposes no unlock bypass. To reach them, temporarily seed `localStorage['ctd3:scores']` with enough 3-star campaign records to clear 14 stars, then **restore the original value (or clear the key) when finished** — capture it first. This is a deliberate dev action and is unrelated to the separate rule that endless *runs* must never write to that key. This is a **verification chunk with a reversible single-constant outcome**: if the aura reads clearly everywhere, change nothing and record the verdict; if it fails on a specific theme, adjust the single constant (keeping both the `TOKENS` mirror and `WARDEN_AURA_COLOR` in sync — they are duplicated by design) toward a value that holds on the worst background, and re-verify on all six. Do not restructure the aura's opacity/pulse constants; do not touch tower or enemy materials (asset edits are out of scope by standing decision). Note the adjacent observation from the last in-game sweep: the snowfall path reads with less contrast against white ground than dirt paths do against green — if the aura check surfaces the same white-ground problem, record it rather than expanding scope. **UI surface →** use `/frontend-design` to judge the treatment and `/find-adjacencies` for adjacent legibility considerations (aura vs selection ring vs range indicator vs slot highlight overlap). Cabin tokens elsewhere; this constant is the sanctioned exception.
**Files:** `games/castle-tower-defense/scene.js` (constant only, or no change), plus a verdict line appended to `docs/adr/034-ctd3-ui-ux-remediation-v2.md` recording the re-check outcome against Deliberate Decision A.
**Completion (observable + committed):** screenshots of the Warden aura captured on all six official maps (locked ones reached via the seeding note above, with the storage key restored afterward) and judged; ADR-034 carries a dated verdict line either ratifying `0x8fc6cf` against the current themed fills or recording the new value with its reason; commit `ctd3: Warden aura — legibility re-check against themed fills (ADR-037)`. **A no-code-change outcome is a valid pass** — the deliverable is the dated verdict either way.
**Size:** S. **Deps:** none.

### C-5 — Audio honesty: no phantom preloads, no dead control `P1 · size S · deps: none`

**Brief.** In `games/castle-tower-defense/`, `audio.js` declares a `SAMPLES` manifest of 15 `.ogg` files and preloads all of them via `loadAll()`; `assets/audio/` contains only 13 — **`bgm_loop.ogg` and `ambient_loop.ogg` do not exist and never have.** Two consequences ship today: every page load emits two failed fetches plus two `console.warn` lines (three sprints of QA notes have had to say "only the pre-existing audio 404s", which is exactly how a real error gets missed), and Settings ships **two** volume sliders that control nothing: **Music** (`index.html` ~line 832, wired in `game.js` ~line 252 to `CTD3Audio.setMusicVolume`) and **Ambient** (`index.html` ~lines 841-843, wired ~line 254 to `setAmbientVolume`) — the ambient gain node is fed only by `startAmbient()` playing the equally-absent `ambient_loop`, so it is exactly as dead as Music. Two selectable controls with no path to effect, which is the same defect class an automated selection→effect gate exists to prevent; a fix that closes only one of them reproduces the very defect it is meant to remove. Music *sourcing* is a content-acquisition task and is explicitly **not** in scope. Instead ship silence cleanly and self-healingly: remove both absent entries from the preload path so no request is made and no warning is logged (keep `startBGM`/`startAmbient` and the gain-node graph intact and no-op-safe — do not rip out the music bus), and **gate each slider's visibility on its own buffer actually being available** (Music on `bgm_loop`, Ambient on `ambient_loop`), so that if either file is ever sourced into `assets/audio/`, its control reappears with no further code change. Leave the SFX path and all persisted settings keys untouched — stored `musicVolume` and `ambientVolume` must survive and reapply. **UI surface (the Settings panel) →** run `/frontend-design` on the settings-row treatment with both rows absent, and `/find-adjacencies` for adjacent considerations (settings-panel layout and spacing with two fewer rows, what a mute-all control means when nothing can play, whether the SFX row should be relabelled once it is the only audio control). Do not invoke `/web-artifacts-builder` — React/shadcn patterns do not apply to this vanilla surface; perform the token-discipline critique directly. Cabin tokens only.
**Files:** `games/castle-tower-defense/audio.js`, `index.html`, `game.js`.
**Completion (machine-checkable):** loading `games/castle-tower-defense/` over http produces **zero** audio-related network failures and **zero** `[ctd3-audio] missing sample` warnings in the console (verifiable by listing console messages and network requests); SFX still play on click/place/sell; **both** the Music and Ambient rows are absent while their buffers do not exist; stored `musicVolume` and `ambientVolume` in `ctd3:settings` are preserved across the change. Commit `ctd3: audio — drop phantom preloads, gate the dead Music/Ambient controls (ADR-037)`.
**Size:** S. **Deps:** none.

### C-6 — Cartographer: attrition-band coloring + topbar Save `P2 · size M · deps: none`

**Brief.** Two related improvements to `games/castle-tower-defense/tools/map-editor.html` — a single-file vanilla-JS map editor ("the Cartographer") for a browser 3D tower defense, styled on cabin design tokens from `/styles.css`, with a desktop 3-column layout, a ≤1100px narrow 3-col, and a <900px bottom-sheet shell whose right rail is split into Status and Export tabs. (1) **Attrition-band coloring.** The editor has a "Simulate" affordance (ember-outline button in the Status group, gated on validation like Copy JSON) that runs scripted builds against the live map via `tools/sim-core.js` and renders results into a monospace box, including a per-wave attrition column. That box is written as plain `textContent`, so it cannot carry per-row emphasis; re-render it as a small DOM table so each wave row can be marked against the project's decided attrition target.

**The marking rule, stated mechanically so it is not a judgement call.** The decided target (ADR-036 D2) is: attrition ratio rises **monotonically** from wave 2 to wave *n−1*, reaching ~1.0–1.2 by wave *n−1*, with the final/boss wave spiking to ~1.3–1.6, and **no mid-run decline**. Mark a row **only** when `ratio[w] < ratio[w−1]` for `2 ≤ w ≤ n−1` — the decline is the hard, unambiguous violation and the one the project's harness already gates on. Additionally tint (do not flag) the *soft* band `0.6–0.8` for waves 2–5 and `1.0–1.2` for wave *n−1*, as orientation only. **Do not treat a soft-band overshoot as a violation:** every one of the six shipped official maps deliberately lands wave 5 at 0.85–0.89, a documented and signed-off exception (a smooth monotone rise cannot hold 0.8 at wave 5 and still reach 1.0+ by wave 7), so a validator that flags it would paint every shipped map as broken and would be wrong.

Use existing semantic tokens for the marking (the file already carries an ember/terracotta warn idiom and a sage/positive idiom — reuse them; introduce no new hues and no new gold fill). Keep the existing stale-result dimming behaviour when the map is edited after a run. (2) **Topbar Save.** The editor's Save action lives only inside the right rail's Export panel, which at <900px is a *hidden tab* — so on a phone-width shell there is no visible way to save without first switching tabs. Add a Save control to the topbar tool row (`.topbar .tools`, which already hosts tool buttons and wraps responsively) that triggers the same save path as the existing control. **On gold discipline, precisely:** the editor's gold-fill budget is already contested in source — `.tool.active` fills the active topbar tool *and* the active decor swatch *and* the rail's `Save to My Maps`, while `.seg .seg-btn.active` fills the Decor Size pill, and a CSS comment calls that pill "the editor's sole gold-filled active state" while the project's hand-backs call Save the sole gold fill. Do not try to reconcile that history in this chunk. The binding constraint is narrower and checkable: **the topbar Save must reuse the existing Save's treatment exactly and must not introduce any new gold-filled affordance beyond that mirror** — the count of distinct gold-filled *kinds* of control stays the same. Note the contradictory comment in the commit body so a future pass can settle it.

A useful free consequence: the editor already carries a `MutationObserver` that auto-switches the rail to the Export tab when save/import feedback appears while another tab is showing — currently unreachable because every feedback-producing button lives inside Export. A topbar Save makes it live. Note that the observer deliberately returns early when the tablist is `display:none`, so **it can only fire below the 900px bottom-sheet breakpoint** — verify it there, not on desktop.

**UI surface →** run `/frontend-design` for both treatments and `/find-adjacencies` to surface adjacent and orthogonal editor-UX considerations, gaps and needs (keyboard parity — note the editor's existing Ctrl+S is bound to *Copy export JSON*, **not** Save, so a Save shortcut is an open question rather than a given; focus order through the topbar; the results table at 220px rail width and inside the bottom sheet; screen-reader semantics for a data table; whether Simulate deserves the same promotion). Do **not** invoke `/web-artifacts-builder` — its React/shadcn component patterns do not apply to this vanilla single-file editor; perform the equivalent token-discipline and gold-budget critique directly (the fallback recorded in all three cycle-1 hand-backs). Radii via `var(--radius-*)`.
**Files:** `games/castle-tower-defense/tools/map-editor.html` only.
**Completion (observable):** in-browser at 1280px and 860px — Simulate renders a table in which a *declining* wave row is visibly marked and non-declining rows are not (verify against a deliberately-declining custom wave list, and confirm all six official maps produce **zero** decline marks); the topbar Save saves from both widths; **at 860px with the Status tab showing, a topbar Save auto-switches the rail to Export** to show its confirmation (this cannot be verified at 1280px — the observer returns early when the tablist is hidden); no new gold-filled control kind beyond the mirrored Save; no horizontal overflow at 860px or 1024px; zero new console errors. Commit `ctd3: editor — attrition-band coloring in Simulate, topbar Save (ADR-037)`.
**Size:** M. **Deps:** none.

### C-7 — Fairness oracle: promote the coverage rules to code `P2 / stretch · size L · deps: none`

**Brief.** `docs/level-design.md` (repo-root relative) is a rulebook of 13 layout heuristics (H1–H12 plus H8a) and 8 wave heuristics (W1–W8) for this browser tower defense's maps. The single-file editor `games/castle-tower-defense/tools/map-editor.html` currently machine-checks **9 blockers** (`PATH_MIN`, `AXIS`, `ZERO_LEN`, `H8a`, `H9`, `H6`, `SLOT_INT`, `NO_SLOTS`, `WAVES_PARSE`) and **6 warns** (`W1`, `W2`, `W4`, `W5`, `W6`, `W8`) — which means every *structural* rule is automated and every *coverage and fairness* rule is not: H1 (inside-corner slot), H2 (slot-to-path proximity ceiling), H3 (straight-away coverage), H4 (synergy pair shares a segment), H5 (anchor slots at spawn and castle), H7 (slot diversity by role), H8 (path length + turn-count budget), H10 (spawn telegraph), H11 (slot count vs path length), H12 (coverage redundancy). Promote as many of those as are objectively computable from a map object (`{path: [{x,z}…], buildSlots: [{id,x,z}…], castle: {x,y,z}}`) into **warn-tier** validator checks with the editor's established faint rule-code chip and author-voice message style — read the existing warn implementations first and match their voice exactly; a rule that cannot be stated as an unambiguous computation should be skipped and listed in the commit body rather than approximated. **Structure the implementation so the checks are callable outside the editor**: extract them as a small pure function over a map object (no DOM), in the same window-IIFE style as `tools/sim-core.js`, and have the editor call it. That is the point of the chunk — the next cycle's map generator needs a *fairness oracle* it can call in a generate-and-reject loop, and the editor's validator is the only place these rules exist as anything but prose; today a generated layout could pass all 9 structural blockers and still be unplayable. Do not promote anything to blocker tier: the six official maps were hand-authored before these rules were written and several already violate warn-tier heuristics, so a new blocker would break the shipped content. Verify against all six official maps in `maps.js` and record which rules each violates in the commit body — that record is the baseline the generator will be tuned against.

**Two traps in the existing validator a fresh worker will otherwise hit.** (1) `validate()` **early-returns at the first blocker**, before the warn block runs — so a map carrying any blocker shows *no* warns at all, and a "deliberately bad map" built by breaking the path will demonstrate nothing. Construct the test map so it is blocker-clean but coverage-poor. (2) The editor's default boot map already trips a pre-existing warn (W2, wave spacing), so "silent on a compliant map" must be demonstrated on a purpose-built compliant map, not on the default. **UI surface (validator output) →** `/frontend-design` for the density of a longer warn list and `/find-adjacencies` for adjacent authoring-UX considerations (warn fatigue, ordering, the right-rail checklist's capacity, whether warns belong in the canvas pill).
**Files:** new `games/castle-tower-defense/tools/map-rules.js` (or similar, window-IIFE, pure), `games/castle-tower-defense/tools/map-editor.html`, optionally `tools/wfc-test.cjs` or a new small test harness for the pure module.
**Completion (machine-checkable):** a Node-runnable test exercises the extracted rule module and **asserts**, not merely prints — it must be able to fail. Minimum assertions: each promoted rule fires on at least one purpose-built violating map object *and* stays silent on at least one purpose-built compliant one (a positive and a negative control per rule, matching the discipline the project's existing wfc-test uses); and the six official maps produce exactly the violation set recorded in the commit body, pinned as a baseline so a future rule edit that silently changes official-map verdicts fails the test. Non-zero exit on any failure. In-browser: the editor surfaces the new warns in author voice with faint rule-code chips on the blocker-clean-but-coverage-poor test map, and stays silent on the purpose-built compliant map; no new blockers; all six official maps still validate to a non-blocked state. `node tools/sim-harness.cjs` still exits 0 with `ACCEPTANCE: ALL PASS`. Commit `ctd3: level rules — coverage heuristics as a callable fairness oracle (ADR-037)`.
**Size:** L — up to ten heuristics into a new pure module, plus editor wiring, positive/negative controls per rule, and a six-map baseline; H1, H4 and H12 alone require path-sampling geometry. If it must be cut, ship a subset of rules with full controls rather than all rules with weak ones, and list what was skipped.
**Deps:** none.

### Chunk summary

| Chunk | Scope | Size | Deps | Priority |
|---|---|---|---|---|
| **G-0** | Operator: push 23 commits + CF purge + curl-verify | — | — | **gate on C-1** |
| **G-1** | Operator: 10-min retune playtest | — | — | **gate on C-3** |
| **C-1** | Endless engine + economy, headless | L | none (after G-0) | P0 |
| **C-2** | Endless UI: entry, HUD, buy-a-life, results | M | C-1 | P0 |
| **C-3** | Endless balance calibration | M | C-1 + G-1 | P1 |
| **C-4** | Warden aura legibility re-check | S | none | P1 |
| **C-5** | Audio honesty | S | none | P1 |
| **C-6** | Editor: attrition coloring + topbar Save | M | none | P2 |
| **C-7** | Fairness oracle (stretch) | L | none | P2 |

Four of seven chunks have **no dependencies at all** and can be dispatched in any order or in parallel. The only chain is the endless one (C-1 → C-2, C-1 → C-3), which is irreducible: the UI cannot render state that doesn't exist and the calibration cannot tune constants that don't exist.

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Endless mode ships correct-but-boring | Cycle's headline lands flat | C-3's gates are *separation* and *no-dominant-strategy* checks, not just survival — they measure whether decisions matter, which is the machine-checkable proxy for interesting. G-1 + a post-C-2 play session are the human read. |
| C-1's engine changes regress the campaign | Signed-off D2 curves break | D12: campaign CSV byte-stability is an explicit completion condition on C-1 and C-3; the six `attrition-monotone` checks already fail loudly. |
| Endless scoring corrupts campaign unlocks | Hard bug — maps unlock wrongly | Called out in C-2's brief with the mechanism (`totalStars()` sums `stars` across every difficulty key under each non-`user:` map in `ctd3:scores`, and that total drives `unlockRequirement`) and a separate storage key mandated; verified by byte-comparing `localStorage` before/after a run. |
| Interest turns into "bank everything, win" | Degenerate strategy | Interest deliberately opposed by the retained early-call bonus; C-3 carries a no-dominant-strategy margin check and an interest-fraction bound. |
| Cycle-3 generator proves harder than C-7 assumes | Differentiator slips again | C-7 is scoped as *independently useful today* (hand-authors get coverage warns) so its value does not depend on the generator landing. |
| G-0 keeps slipping | A fourth cycle of invisible work | D7 makes it a hard gate on C-1 dispatch rather than a recommendation. |

### Adversarial review — what it caught, and what is noted rather than fixed

A fresh-context subagent reviewed this ADR against ADR-036, the three hand-backs, current source and a live harness run. It confirmed the plan's load-bearing facts — most importantly **D10's central re-scoping argument** (`wfc.js` is fill-only; no path/slot/castle generation exists anywhere), the 9-blocker/6-warn validator split, the 23-commit backlog, the §2 curve arithmetic (spot-checked to 3 decimal places on Plains, Mountain and Tidewater, plus all nine tier-efficiency values), and that **nothing** in §3(a)–(f) has already shipped.

Eight MAJOR findings were fixed in this text before commit: a false claim that `THEME_BG` shipped to the game (§3c/C-4 — it is editor-only; the real premise is changed *fill*, and the correction is left visible as a caution); C-4's completion being unexecutable because three of six maps are star-locked; C-1/C-3's campaign-CSV gate using a multi-file `git diff` pathspec form that silently matches nothing and always exits 0 (empirically confirmed by the reviewer — replaced with `git status --porcelain -- tools/curves/`); C-6 asserting "exactly one gold-filled control" when the editor renders at least four at boot; C-6's band rule contradicting D2's signed-off wave-5 overshoot and thereby flagging every shipped map; a W8 threshold cited as 20 when the rule says 35; only one of *two* dead volume sliders being closed by C-5; and D8/C-1's "auto-send is just the zero-crossing" glossing that `0` is the *"no countdown armed"* sentinel, which would have shipped endless wave 1 with zero build time. Material minors were also folded in: §2.2's wave-1 shoulder numbers, §1's overstated process claim about X-2(c), the lesson-5-vs-D5 mis-citation, D5's "own ADR" clause (now explicitly discharged in §6), C-6's Ctrl+S referent and the observer's sub-900px-only firing, C-7's malformed path / rule count / early-return trap / unfailable Node gate / size, C-2's Community-tab external dependency and unnamed benchmark reference, and self-selected thresholds replaced with stated numbers.

Noted rather than fixed:

- The endless wave generator's module home (standalone file vs inside `sim-core.js`) is left to the C-1 worker; the binding constraint is *exactly one implementation shared by the harness and the browser*, which is what cycle 1's sim-core extraction established.
- C-4 may legitimately end in **no code change**. That is a success, not a no-op — the deliverable is a dated verdict in ADR-034 either way.
- C-7 explicitly permits skipping rules that resist unambiguous computation. The commit body, not the code, is where that judgement is recorded.
- `ENDLESS_GROWTH = 1.15` and the 1.07 gap divisor are *starting* constants taken from the Element TD reference (×1.178/level HP against 1.0925–1.1 bounty growth), not derived from CTD play. C-3 exists to replace them with measured values. The same is true of C-1's ≥3-wave separation and 35 % interest bound and C-3's 15–35 band and 15 % dominance margin — they are chosen to have teeth on day one, not to be final.
- The editor's gold-fill budget is genuinely contradicted in source (a CSS comment names the Decor Size pill "the editor's sole gold-filled active state"; the hand-backs name Save). C-6 is scoped to *not* widen it rather than to settle it; settling it is a future pass.

---

## Out of scope (this ADR)

- Implementing any chunk (later turns dispatch them; this ADR is the plan).
- The layout generator / map-per-run (D10 — cycle 3, own ADR).
- Leaderboards (§3b — cycle 3, gated on an operator RTDB-rules publish).
- Any campaign balance change (D12).
- Music sourcing (§3e — operator content task).
- Tower/enemy GLB or material edits (ADR-034 Decision C stands); star-threshold or unlock changes; mobile-first editor rebuild.
