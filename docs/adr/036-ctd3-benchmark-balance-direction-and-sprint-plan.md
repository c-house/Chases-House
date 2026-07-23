# ADR-036: CTD3 Sprint Cycle — WC3-Benchmark Balance Direction & Chunked Sprint Plan

**Date:** 2026-07-22
**Status:** Accepted
**Relates to:** ADR-028 (CTD3 core), ADR-030/031 (tiles + WFC), ADR-034 (UI/UX remediation — closeout tracked here)
**Benchmark source (read-only):** `C:\Users\chase\Projects\Warcraft\docs\td-comparison\` — design reference mined from two shipped WC3 TDs (Cube Defense 5.2, Element TD 4.3b), with extracted curves in `data/*.csv` and the grading rubric in `METHODOLOGY.md`. The analytical/verification rubrics transfer to CTD directly; the WC3 extraction machinery (MPQ crypto, w3u parsing) does not apply — CTD's data is readable JS and was read directly.

This ADR is Prompt 1 (Retrospect & Plan) of a sprint-cadence chain. Sections 1–5 are the evidence; §6 is the decision set; §7 is the sprint plan as **independently dispatchable chunks** for orchestrator+worker pairs (Prompts 2+). No implementation ships with this ADR.

---

## 1. Retrospective — last 30 commits (repo-wide, HEAD `ce6ceaf`)

12 of 30 commits are `ctd3:`-scoped; the rest belong to other site workstreams. Grouped:

### Group R1 — ADR-034 UI/UX remediation series (8 commits, ctd3)
`e092f65` (Group 1 root token bridge) → `e98b619` (Group 2 atmospheric reframe) → `fc5bce1` (Group 3 per-effect tokenisation) → `32e1bca` + `5f5e7a4` (Group 4a radii/SMALLCAPS/card-borders + gold-discipline) → `be70b97` (Group 6 partial: T11, T13, T16, T17) → `32387c7` (Group 4b chrome hero + motes) → `d61bd9b` (Group 4c hover-lift).
**Benefit:** closed the "two games wearing different skins" headline — the cabin token ladder now runs from `/styles.css` through the gameplay scene (TOKENS block in scene.js, AgX tone mapping, warmed lighting presets, fireflies) to the chrome. **Arc:** this was the polish half of CTD3's maturation; the play loop itself was untouched since Phase 5.

**ADR-034 ledger as of this ADR** (verified against source, not just commit messages):

| Group | Status | Evidence |
|---|---|---|
| 1, 2, 3, 4a, 4b, 4c | **SHIPPED** | commits above; `scene.js` TOKENS block present, `WARDEN_AURA: 0x8fc6cf` |
| 5 (Warden ratification) | **SHIPPED (effectively)** | constant at `0x8fc6cf` with Group 2/3 comments; residual = one ADR-ref comment line |
| 6 (TIER 2 a11y) | **PARTIAL — further along than the commit message says** | Shipped: T10 (`env(safe-area-inset-*)` at index.html:380-413), T11, T12 (restart-confirm actions in game.js:304-306), T13, T16 (lives `aria-live="assertive"` index.html:743), T17, T18 (wave counter seeded, ui.js:238-241), most of T8 (inline `uiSfx('click'/'error')` wiring). **Residual: T14 (no `inert` anywhere in index.html), T9 screen-reader denial announcement ("Not enough gold" aria-live), T15 verification (quiet/spirited map-card distinction).** |
| 7 (Cartographer editor) | **NOT-STARTED** | XL; nothing landed |

### Group R2 — Crawler control + documentation honesty (9 commits, site-wide)
`f5380f8` robots.txt/noindex/AI-bot blocking, then a notable correction chain (`61de0fe` → `b2fb9e7` → `ef89672` → `b8a3b34` → `4c79991` → `7b607b4` → `b28c58a`) repeatedly reverting a false "COMPLETE" claim to honest "PARTIAL" until curl-verified, plus the ADR-033 number-collision rename (`071db3b`). **Benefit:** deindexing shipped and verified; the correction chain is a process lesson this plan inherits — completion claims need machine-checkable acceptance (that discipline shapes every chunk's completion condition in §7).

### Group R3 — Site nav workstreams (6 commits, non-CTD)
Counting House entry (`ce6ceaf`, ADR-035), Shopping tab (`6b1a16b`, `bff3891`, ADR-032), Music nav-probe move to thewiseguy.ai apex (`134bba2`, `0713fce`, `a89e370`). Context only: these share `styles.css`/nav surface with CTD chrome but carry no CTD logic.

### Group R4 — CTD3 gameplay content, pre-remediation (4 commits, ctd3)
`b8b903c` 3 new enemy types data-only (Juggernaut/Slime/Ghost), `bae9bac` Phase 5 visuals (4 GLBs, per-type animations, **armor fix** — `makeEnemy` had never copied `def.armor`, so Shielded/Captain took full physical damage since launch), `39cd0b3` Warden aura visibility, `d93925f` Ranger muzzle-flash bleed fix.
**Benefit:** enemy roster grew 6 → 10 types with real mechanics (split-on-death, spectral charges). **Arc + the finding that matters:** these types are wired into **zero official waves** (grep of maps.js: 0 matches for juggernaut/slime/ghost) — fully-assetized dead content, explicitly deferred by ADR-034's out-of-scope list and never picked back up. The armor bug is also the exact bug class the benchmark's lesson 8 (dead-mode hygiene) exists to catch — it shipped silently and was found by manual audit months later.

### Group R5 — Docs/meta (3 commits)
`378f9ab` ADR-034 synthesis + atmospheric spec + design-system snapshot; `9004061`, `6c31242` CLAUDE.md hygiene.

**Big picture:** CTD3's arc is 2D→3D rebuild (ADR-028) → editor (029) → tile renderer (030) → WFC procgen (031) → content Phase 5 → a two-month brand/UX remediation (034). The **game's balance/economy was never deliberately designed** — it accreted. The benchmark below supplies that missing discipline, and this cycle pivots effort from chrome back to the core loop.

---

## 2. Benchmark grading — CTD's actual curves vs the reference

Extracted directly from `entities.js` / `maps.js` / `engine.js` (no build step; data is plain JS). Method mirrors METHODOLOGY.md §3: identity profile, spine curves, difficulty knobs.

### 2.1 Identity profile

| | CTD3 today | Cube Defense 5.2 | Element TD 4.3b |
|---|---|---|---|
| Structure | 6 authored maps × 8 waves (Tidewater: **3** — stub), star-gated unlocks | 30 waves × 10/lane, 8-player co-op | 60 levels × 30 spawns, 8-player race |
| Waves | Fixed order, hand-authored composition groups | Fixed schedule | Middle shuffled (6–59), anchors pinned |
| Lives | Bare counter (quiet 18 / spirited 12; boss leak −5) | 1 life, +1 purchasable @100g | No lives; leaks loop back |
| Economy | Per-type bounty table + authored wave rewards; no interest | Bounty table; near-flat income | Kill gold = `floor(growth^(level−1))` + **2%/15s interest** |
| Difficulty | Scalar set: hpMult 0.85/1.15, startGold 220/**180**, startLives 18/12 (+ per-map overrides) | 5 parallel HP tables (2 of 6 modes shipped broken) | Scalar pair: hp_mult 0.5–1.0, bounty growth 1.0925–1.1 — **harder pays more** |
| Signature | 3D browser, WFC procgen editor, map sharing | Team lanes | Element combos |

### 2.2 Spine curves (computed from source; base hpMult 1.0)

Per-wave HP and income (bounty+reward), geometric-mean growth per wave (w2 onward, excluding tutorial-scale wave 1):

| Map | HP/wave | HP growth | Income growth | Attrition ratio trend (quiet) |
|---|---|---|---|---|
| Plains | 28→848 | ×1.31 | ×1.41 | 0.59 → 0.84 with mid-run **decline** to 0.49 |
| Forest | 224→968 | ×1.20 | ×1.28 | 0.87 → 0.64 — **declines** |
| Mountain | 280→2812 | ×1.33 | ×1.36 | 1.08 → 0.49 then boss spike 1.59 |
| Snowfall | 280→1590 | ×1.28 | ×1.31 | 1.08 → 0.48 then 0.88 |
| Riverbend | 224→1626 | ×1.28 | ×1.36 | 0.87 → 0.56 then 0.84 |
| Tidewater | 168→498 (3 waves) | — | — | content stub |

**Reference comparison:** Cube *tightens* ~7.5× over its run; ETD compounds a deliberate ~7%/level gap countered by efficiency tiers + interest. **CTD's income growth matches or outruns its HP growth on every map** — the attrition ratio *falls* through the midgame and only boss waves pull it back up. Difficulty comes almost entirely from the wave-1..3 opening (before the first tower bank builds) and the finale spike; waves 4–7 get progressively easier relative to bank. There is no compounding pressure and consequently nothing for skilled economic play to push against.

### 2.3 Affordable DPS (DPS per cumulative gold invested)

| Tower | T1 | T2 | T3 | Shape |
|---|---|---|---|---|
| Ranger | 11.2/50g = **0.224** | 19.2/110g = 0.175 | 57.6/200g = **0.288** | dip then best-in-game (volley 2) |
| Catapult | 15.4/120g = 0.128 | 22.8/240g = 0.095 | 32.5/420g = 0.077 | **declines** (splash compensates vs packs) |
| Mage | 24.2/200g = 0.121 | 33.6/380g = 0.088 | 46.8/630g = 0.074 | **declines** (chains @×0.85 partially compensate) |
| Warden | — | — | — | aura utility, no DPS |

**Reference comparison:** ETD's ladder *rises* ~7× top-to-bottom (upgrades buy efficiency — the counter-curve); Cube's is flat (upgrades buy concentration only, which is why its difficulty dial had to rewrite HP tables). **CTD is Cube-shaped, with one anomaly: Ranger T3 (0.288 single-target DPS/gold) strictly dominates every other tower's every tier** — 200g of Rangers out-DPSes 630g of Mage against anything not flying-immune or pack-shaped. Tower choice mid-game collapses toward "more Rangers + one Warden."

### 2.4 Difficulty knobs

CTD already has the *structurally correct* design (scalar multipliers, single wave table, data-driven `mergedDifficulty()` merge — no Cube-style parallel-content rot). Two defects:

1. **Coupling is inverted.** Spirited = +35% HP *and* −18% start gold *and* identical bounties. The reference (ETD) couples the pair the other way: harder settings pay **more** per kill so the reward tracks the risk. CTD's harder mode compounds punishment on both axes.
2. **No automated selection→effect check.** Nothing would catch a future `mergedDifficulty` regression — the same silent-drift class as Cube's dead UltraSuperGodly mode and CTD's own shipped armor bug.

---

## 3. Adjudication of the nine transferable lessons

Staleness guard applied per lesson: git log AND current source checked before proposing anything.

| # | Lesson | Verdict | Grounding in CTD's actual state |
|---|---|---|---|
| 1 | HP curve from formula, exceptions authored | **DEFER (to endless mode); campaign already structurally sound** | CTD scales HP with ONE scalar (`hpMult`) — already ETD-style; per-wave drama comes from composition authoring, which at 8 waves × 6 maps is the design, not rot (Cube's rot was 5 parallel 30-entry tables). A generated `hp(wave)` formula becomes necessary exactly when wave count is unbounded — i.e., the endless mode in §6 D5. |
| 2 | Difficulty as coupled multiplier pair, harder pays more | **BUILD-NOW (fix the inversion)** | Structure already correct (`DIFFICULTY` scalars, `mergedDifficulty()`); coupling inverted — spirited gets +35% HP with less gold and equal bounty (entities.js:88-91). Add `bountyMult` to the pair so harder pays more per kill. → Chunk CH-2. |
| 3 | Decide the attrition slope on purpose + ship a counter-curve | **BUILD-NOW (the headline gap)** | §2.2: attrition currently *declines* through midgame on every map — undecided by anyone, emergent from authored rewards. Decision D2 (§6) picks the slope; Chunk CH-3 retunes maps to it; Chunks CH-2/CH-4 supply the counter-curves (tier efficiency shaping + early-call bonus). |
| 4 | Interest on banked gold, visible countdown | **ADAPT-NOW / DEFER pure form** | Pure interest is exploitable in CTD: `prepWave` is untimed (`sendNextWave` is manual, engine.js:152-160) — banked gold could tick forever at zero risk. The campaign-correct adaptation is an **early-call bonus** (bounty for sending the next wave before a countdown lapses — same tension, inverse mechanism, no idle exploit). Pure interest lands with auto-send endless mode (D5). → Chunk CH-4. |
| 5 | Leak-forgiveness model (loop-back or buy-a-life) | **DEFER, with reason recorded** | CTD's lives are already generous (18/12 vs Cube's 1) and the star system (engine.js `computeStars` = lives ratio) *is* the tone: lives are the score, not just survival. Loop-back would corrupt star semantics; buy-a-life is an economy sink worth revisiting inside endless mode where stars don't apply. |
| 6 | Shuffle middle waves, pin anchors | **DEFER (to endless); DROP for campaign** | The 8-wave campaign is deliberately authored (tutorial wave 1, boss wave 8 — anchors already pinned by construction); permuting 5 middle waves adds noise, breaks the difficulty ramp players learn, and the determinism benefit is trivial at n=8. Fisher-Yates over a formula-generated pool is the endless-mode design. |
| 7 | Per-kill bounty from formula, not per-enemy data | **BUILD-NOW (partial: centralize payout)** | 10 per-type bounty entries are an authored input, not rot — but the payout site (`killEnemy`, engine.js:463-466) reads `def.bounty` raw and can't see difficulty. Centralize into one `bountyFor(def, state)` that applies `bountyMult` (and any future curve) at runtime — one place to tune, per the lesson's actual point. → Chunk CH-2. |
| 8 | Dead-mode hygiene: automated path from selection → effect | **BUILD-NOW (highest-leverage item)** | CTD has live precedents of exactly this bug class: the armor field that silently never applied (fixed `bae9bac`), 4 enemy types shipped to zero waves, Tidewater's 3-wave stub, and zero automated checks on `mergedDifficulty`/map completability. engine.js is a pure sim (no DOM/Three) — a headless harness is cheap and unlocks safe retuning for every other chunk. → Chunk CH-1. |
| 9 | Player-friendly failure (auto-sell damaged towers) | **DROP** | CTD towers have no HP and no damage-to-tower path anywhere in engine.js; enemies only run the path. Inapplicable by construction. (CTD already has the adjacent courtesy: 75% sell refund, entities.js:115-117.) |

### Gaps beyond the nine (tie-things-together list)

- **Ranger T3 dominance** (§2.3) flattens the tower-choice puzzle — needs tier-efficiency shaping (CH-2).
- **Tidewater stub**: a shipping official map with 3 waves and no unlock gate (unlockRequirement 0) — half a game visible to every new player (CH-3).
- **Dead content**: Juggernaut/Slime/Mini Slime/Ghost fully assetized, wired to nothing (CH-3).
- **No balance observability**: curves in this ADR were hand-extracted; the harness (CH-1) makes them reproducible artifacts (`tools/` output) so the next retune doesn't start from archaeology.
- **ADR-034 closeout debt**: Group 6 residuals (T14/T9-SR/T15-verify) + Group 5 comment formality (CH-5); Group 7 editor (CH-6/CH-7).
- **Editor↔balance loop is open**: user-made maps get no wave-difficulty feedback; once CH-1 exists, a "simulate this map" affordance in the Cartographer becomes possible (roadmap Later).

---

## 4. PM-lens syntheses (brainstorm → stakeholder → competitive)

**Brainstorm — converged direction.** The identity question resolves the lesson list: CTD is an *authored campaign* today, and its differentiator (WFC procgen + pure-sim engine) makes an *endless/survival mode* the natural future home for the formula-driven mechanics (formula HP, interest, shuffle, buy-a-life). This cycle therefore: (a) fixes the campaign's economy defects in place, (b) makes shipped content reachable, (c) builds the sim harness that de-risks both, and (d) records endless mode as a decided direction rather than scope-creeping into it. Riskiest assumption: retunes won't invalidate existing player star scores or map completability — which is precisely what the harness converts from risk to regression check.

**Stakeholder update (sprint-open, solo operator).** Status: **Yellow.** The brand/UX program is nearly closed (Groups 1–4c + most of 6 shipped; only editor Group 7 is large and open) — but the benchmark audit found the core loop shallower than it looks: no deliberate attrition, inverted difficulty coupling, one dominant tower build, 4 dead enemy types, one stub map. None are visible in a screenshot; all are visible in ten minutes of play. This sprint pivots to the play loop with an automated harness as the safety net. Risks: retune churn without the harness (mitigated: harness is P0 and first); editor Group 7 slipping again (accepted: explicitly stretch/next-sprint).

**Competitive brief — vs Cube Defense & Element TD.**

| Capability | CTD3 | Cube | ETD |
|---|---|---|---|
| Economy depth (interest/efficiency ladder/attrition) | **Weak** | Adequate | **Strong** |
| Difficulty engineering | Adequate (scalar, but inverted coupling) | Weak (parallel tables, 2 broken modes) | **Strong** |
| Replay structure (shuffle/scale/race) | Weak (fixed 8-wave) | Adequate | **Strong** |
| Presentation | **Strong** (3D, tokened brand, a11y) | Weak | Weak |
| Reach / friction | **Strong** (URL, iOS, zero install) | Weak (WC3 required) | Weak |
| Authoring / UGC | **Strong & unique** (WFC editor, share links, community import) | Absent | Absent |
| Tower-choice depth | Weak (Ranger dominance) | Adequate | **Strong** (element combos) |

Where CTD genuinely differentiates: the editor/procgen/sharing loop and zero-friction 3D presentation — neither reference has any authoring story at all. Where it lags: everything the references learned about economies over years of ladder play. Strategic implication: **achieve economy parity with the cheap mechanisms (coupling, counter-curves, hygiene), differentiate on the procgen+endless combination** — "infinite fair maps" is a claim neither competitor can make, and it's one WFC + a formula HP curve away.

---

## 5. Roadmap (Now / Next / Later)

| Horizon | Item | Why here |
|---|---|---|
| **Now** (this sprint) | CH-1 sim harness; CH-2 economy coupling + tier shaping; CH-3 content wiring + attrition retune; CH-4 early-call bonus; CH-5 ADR-034 Group 6/5 closeout | Core-loop gap is the bottleneck; all verified by CH-1 |
| **Next** (following sprint) | CH-6 editor Group 7a (status/validation/JSON/shortcuts); CH-7 Group 7b (responsive shell + theme wiring); editor "simulate this map" spike using CH-1 | Closes ADR-034; converts harness into a player-facing editor feature |
| **Later** | Endless mode ADR + build (formula HP ×~1.18/wave, interest, shuffle-with-anchors, buy-a-life, WFC map-per-run); per-map leaderboards; Warden cyan legibility re-check (ADR-034 follow-up) | The differentiation bet (§4); each Later item gets its own ADR before build |

**Cut/won't-do this cycle:** mobile-first editor rebuild (ADR-034 out-of-scope stands); tower GLB/material changes (ADR-034 Decision C stands); pure interest in campaign (D4 below).

---

## 6. Decisions

- **D1 — Sprint pivot: balance backbone before ADR-034 Group 7.** The remediation program's remaining XL item (editor) waits one sprint; the play-loop gaps are player-facing every session and cheaper to fix. Group 6 residuals (small) ride along now so ADR-034 needs only Group 7 to close.
- **D2 — Attrition slope, decided on purpose:** campaign target is a **gently tightening band** — attrition ratio (wave HP ÷ cumulative gold, quiet baseline) should sit ~0.6–0.8 through waves 2–5 and **rise monotonically to ~1.0–1.2 by wave 7**, with the wave-8 spike (~1.3–1.6 on boss maps) preserved. No mid-run decline. Tuning levers: late-wave rewards down / late-wave composition up; per-type HP and bounty stay fixed (they're cross-map globals).
- **D3 — Counter-curve pair:** (a) tier-efficiency shaping — upgrading should buy modest efficiency (T3 ≈ 1.1–1.3× the type's T1 DPS/gold, ETD-lite), and no tower's tier may strictly dominate another type's role; specifically Ranger T3 volley comes down and/or cost up until it no longer beats Catapult/Mage at their own jobs. (b) The early-call bonus (D4) rewards banked *tempo* rather than banked gold.
- **D4 — Interest adapted, not adopted:** campaign gets an **early-call bonus** (visible countdown in prepWave; calling the wave early pays the remaining seconds × a rate scaled by difficulty), because pure interest is degenerate while `prepWave` is untimed. Pure 2%/15s interest is reserved for endless mode where waves auto-send.
- **D5 — Endless mode is the decided home** for formula HP, pure interest, wave shuffle, and buy-a-life — recorded as direction now, specced in its own ADR before any build (Later horizon). Campaign keeps authored waves, bare-lives + stars, fixed order.
- **D6 — Every selectable mode/map keeps an automated selection→effect path** (lesson 8): the CH-1 harness becomes a required gate for future balance/content commits (run before commit, same discipline as `extract.py` in the sibling repo).

---

## 7. Sprint plan — dispatchable chunks

Sprint goal (one sentence): **give CTD a deliberately-designed economy verified by an automated harness, and make every piece of shipped content reachable.**
Capacity: solo, evening cadence, ~2–3 weeks; P0 chunks ≈ 60–70% of that; CH-6 is stretch. Effort yardstick = ADR-034's (S ≤2h, M ≤4h, L ≤8h, XL multi-day). Every chunk: commit style `ctd3: <scope> — <description> (ADR-036)`, stage only files the chunk touches by explicit path (never `git add -A`), cabin design tokens only (no ad-hoc colors) on any UI surface.

### CH-1 — Headless balance harness + hygiene smoke tests  `P0 · size M · deps: none`
**Brief:** In the Chases House repo, `games/castle-tower-defense/engine.js`, `entities.js`, and `maps.js` are window-global IIFE modules with no DOM/Three dependencies — a Node script can load them by stubbing `global.window = {}` (plus the tiny `SharedStorage` safeGet/safeSet no-op the maps module expects), following the existing precedent of `games/castle-tower-defense/tools/wfc-test.cjs`. Build `games/castle-tower-defense/tools/sim-harness.cjs`: it must (1) for every official map × both difficulties, run scripted baseline builds (at minimum: greedy-cheapest and ranger-heavy) through the full wave list by stepping `CTD3Engine.step()` at fixed 16.67ms ticks with auto-`sendNextWave`, and report win/loss, lives remaining, and final gold; (2) emit per-wave curve rows (wave HP, income, attrition ratio, cumulative gold) as CSV to `games/castle-tower-defense/tools/curves/` so balance state is a reproducible artifact; (3) assert hygiene invariants — every entry in `ENEMIES` is spawnable and killable in sim (including split/spectral behavior), both `DIFFICULTY` modes measurably change enemy HP and starting resources (selection→effect), every official map is completable by at least one scripted build on quiet, and every enemy type referenced by any map's waves exists. Output one PASS/FAIL line per check ending `ACCEPTANCE: ALL PASS` with a non-zero exit code on failure. Document the run command in a short header comment.
**Files:** new `games/castle-tower-defense/tools/sim-harness.cjs`, new `games/castle-tower-defense/tools/curves/*.csv` (generated, committed); no changes to game modules (if a module genuinely can't load headless, the minimal export shim is allowed but must not change browser behavior).
**Completion:** harness runs green via `node tools/sim-harness.cjs` from the CTD directory; CSVs committed; commit landed as `ctd3: sim harness — headless balance + hygiene acceptance (ADR-036)`.

### CH-2 — Economy backbone: coupling fix, bounty centralization, tier-efficiency shaping  `P0 · size M · deps: CH-1 preferred first (verification), not blocking`
**Brief:** In `games/castle-tower-defense/entities.js` and `engine.js`, implement ADR-036 decisions D3(a) and the coupling fix: (1) add `bountyMult` to the `DIFFICULTY` table (quiet 1.0, spirited 1.25) and thread it through `mergedDifficulty()` so harder difficulty pays more per kill — do NOT remove the existing hpMult/startGold/startLives fields, and keep per-map `difficultyOverrides` working (the editor's live preview consumes `mergedDifficulty` too); (2) centralize bounty payout in one `CTD3Entities.bountyFor(enemyDef, state)` helper and make `engine.js killEnemy()` use it (currently reads `def.bounty` raw at engine.js:465) — one place where future bounty curves/multipliers apply; the gold popup text must show the actual paid amount; (3) reshape tower tier stats in the `TOWERS` table so DPS-per-cumulative-gold rises modestly with tier (target T3 ≈ 1.1–1.3× that type's T1) and Ranger T3 no longer strictly dominates (current values: Ranger 0.224/0.175/0.288 — the T3 volley doubling is the anomaly; Catapult 0.128→0.077 and Mage 0.121→0.074 both decline). Preserve each tower's role identity (Ranger = cheap single-target, Catapult = splash anti-pack, Mage = chains/anti-air premium). Re-run the CH-1 harness if present and update its committed CSVs; all maps must remain completable on both difficulties.
**Files:** `games/castle-tower-defense/entities.js`, `games/castle-tower-defense/engine.js`, regenerate `tools/curves/*.csv` if CH-1 landed.
**Completion:** spirited run pays visibly more per kill than quiet in-game; harness (if present) green including the new "spirited total gold ≥ quiet" coupling assertion; commit `ctd3: economy backbone — bounty coupling + tier efficiency (ADR-036)`.

### CH-3 — Content wiring: 4 dead enemy types + Tidewater completion + attrition retune  `P0 · size M-L · deps: CH-1 strongly preferred first; CH-2 values helpful but not blocking`
**Brief:** In `games/castle-tower-defense/maps.js` (data-only chunk — no engine changes): (1) extend Tidewater Bend from its 3-wave stub to a full 8-wave list matching its sibling maps' shape (waves built from the `g(type, count, spacingMs, delayMs)`/`wave(groups, reward)` helpers already in the file); (2) wire the four shipped-but-unused enemy types into official waves — Juggernaut as a mid-late mini-boss beat (Mountain/Snowfall/Riverbend), Slime (splits into 2 Mini Slimes on damage-kill) as a mid-wave swarm texture (Tidewater/Forest), Ghost (flying, first 2 projectile hits negated) as a late-wave anti-turtle check on maps with anti-air coverage — each of the 4 types must appear in at least one official map; (3) retune per-wave `reward` values (and composition where needed) toward ADR-036 D2: attrition ratio (wave HP ÷ cumulative quiet gold, start 220) holding ~0.6–0.8 through waves 2–5 and rising monotonically to ~1.0–1.2 by wave 7, boss-wave spike preserved, **no mid-run decline** — current curves decline (e.g. Forest 0.87→0.44, Mountain mid 0.49). Per-type HP/bounty in entities.js are off-limits here. Respect docs/level-design.md rules (H6: no slot on path) — composition changes only, no path/slot edits.
**Files:** `games/castle-tower-defense/maps.js`; regenerate `tools/curves/*.csv`.
**Completion:** grep confirms juggernaut/slime/ghost each in ≥1 official map's waves and Tidewater has 8 waves; harness green (all maps completable both difficulties; attrition CSV shows monotone non-declining ratio waves 2→7 per map); commit `ctd3: content wiring — Phase-5 enemies + Tidewater + attrition retune (ADR-036)`.

### CH-4 — Early-call bonus (interest, adapted for campaign)  `P1 · size M · deps: CH-2 (payout path) should land first`
**Brief:** Implement ADR-036 D4 in `games/castle-tower-defense/`: during `prepWave` (engine.js FSM), start a visible countdown (suggest 20s; skip for wave 1 and the tutorial); if the player sends the next wave before it lapses, pay `floor(secondsRemaining × rate)` bonus gold through the centralized bounty/payment path (CH-2's helper family), with `rate` scaled by difficulty (spirited > quiet, consistent with D3's harder-pays-more coupling). When the countdown lapses nothing bad happens — the wave simply waits (campaign stays self-paced; this is a bonus, not a penalty). Engine: countdown state in `createState`/`step` + bonus payment in `sendNextWave`; UI: countdown readout next to the Send Wave control in the HUD (index.html/ui.js), SMALLCAPS label, `--accent-gold` family tokens only, `aria-live="polite"` on the bonus award, respecting `prefers-reduced-motion` for any pulse animation. Since this adds a UI surface: run `/frontend-design` for the countdown/bonus presentation and `/find-adjacencies` to sweep adjacent UX (fast-forward interaction, pause behavior, tutorial suppression, game-over edge) before finalizing; stay on the cabin design tokens throughout.
**Files:** `games/castle-tower-defense/engine.js`, `game.js`, `ui.js`, `index.html`; harness gains an assertion that an early-calling scripted build banks more gold than a slow one.
**Completion:** in-browser: countdown visible in prep phase, early send pays and announces bonus; harness green with the new assertion; commit `ctd3: early-call bonus — prep-phase tempo counter-curve (ADR-036)`.

### CH-5 — ADR-034 closeout: Group 6 residuals + Group 5 formality  `P1 · size S · deps: none`
**Brief:** Close the last small items of ADR-034 (docs/adr/034-ctd3-ui-ux-remediation-v2.md) in `games/castle-tower-defense/`: (1) T14 — apply the `inert` attribute to non-active screen containers in the `setScreen()` path (ui.js) and to the play-screen while a modal is open, so Tab cannot reach the cog through an open modal; (2) T9 — on the 'unaffordable' placement/upgrade result (game.js handles it at the `setGoldFlash` call sites), announce "Not enough gold" via an `aria-live` region (the gold counter already has `aria-live="polite"`; add atomic announcement text rather than relying on the number change); (3) T15 — verify quiet vs spirited are visually distinct on map-select cards (Group 4's map-card system may already cover it; if not, differentiate with existing tokens — e.g. difficulty pip color `--sage` vs `--accent-ember`); (4) Group 5 formality — add the inline comment at scene.js's `WARDEN_AURA_COLOR` constant referencing ADR-034 Deliberate Decision A. Acceptance mirrors ADR-034's: Tab with modal open never reaches the cog; NVDA/VoiceOver announces the denial; screenshot shows distinct difficulty affordances. UI surface → use `/frontend-design` for the T15 treatment if new styling is needed and `/find-adjacencies` for focus-order edge cases; cabin tokens only. After landing, update ADR-034's status line: Groups 1–6 SHIPPED, Group 7 remaining.
**Files:** `games/castle-tower-defense/ui.js`, `game.js`, `index.html`, `scene.js` (comment), `docs/adr/034-ctd3-ui-ux-remediation-v2.md` (status note).
**Completion:** the three behaviors verified in-browser (chrome-devtools-mcp or manual); commit `ctd3: ADR-034 closeout — T14 inert, T9 SR denial, T15 verify, Warden comment (ADR-034)`.

### CH-6 — Cartographer Group 7a: status, validation voice, JSON, shortcuts  `P2/stretch · size L · deps: none`
**Brief:** Implement the non-responsive half of ADR-034 Group 7 in `games/castle-tower-defense/tools/map-editor.html` exactly per the Group 7 table in docs/adr/034-ctd3-ui-ux-remediation-v2.md (read it first — it carries file:line anchors and acceptance): author-voice validator messages with faint rule codes; right-rail progress checklist replacing "NOT READY"; JSON preview + Import in closed `<details>`; action-row reorder (Save gold-primary, Share/Publish ember-outline); topbar brand treatment; tool-badge KEY treatment; Decor Size two-segment pill (the editor's sole gold-filled active state); canvas pill single-issue simplification; keyboard shortcuts (history ring cap 30, Ctrl+Z/Ctrl+Shift+Z/Ctrl+S/Delete/Esc) + `?` shortcut sheet. Explicitly OUT of this chunk: the responsive bottom-sheet shell, the 900/1100px breakpoints, and theme→WFC/3D-preview wiring (those are the sibling chunk). UI surface → `/frontend-design` and `/web-artifacts-builder` for critique passes, `/find-adjacencies` for adjacent editor-UX gaps; cabin tokens only, radii via `var(--radius-*)`.
**Files:** `games/castle-tower-defense/tools/map-editor.html` only.
**Completion:** ADR-034 Group 7 acceptance items that don't involve responsiveness/theme pass in-browser (blank session shows "Lay down a path" in ember; H8a violation reads in author voice; Ctrl+Z restores; `?` sheet lists bindings); commit `ctd3: editor Group 7a — status, validation voice, shortcuts (ADR-034)`.

### CH-7 — Cartographer Group 7b: responsive shell + theme wiring  `next sprint · size XL · deps: CH-6 first`
**Brief:** The remaining ADR-034 Group 7 scope: 900–1100px narrow 3-col layout, sub-900px bottom-sheet shell replacing the current single-column collapse, sub-700px "Editor needs a desktop" banner; `rulesForMap({id, theme})` theme-keyed WFC palettes in `wfc-rules.js` (plains/forest/mountain) with the 3D preview background seeded from `state.meta.theme` (cabin tones: `0x152821`/`0x1f3329`/`0x2a4234`). Same skill directives and token discipline as CH-6. Held to next sprint deliberately (D1) — do not pull forward unless every P0/P1 chunk has landed.
**Files:** `games/castle-tower-defense/tools/map-editor.html`, `wfc-rules.js`.
**Completion:** ADR-034 Group 7 responsive + theme acceptance; ADR-034 status flipped to fully SHIPPED; commit `ctd3: editor Group 7b — responsive shell + theme wiring (ADR-034)`.

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Retune breaks completability or star feel | Players' existing scores devalued / maps unwinnable | CH-1 lands first; CH-2/CH-3 gated on harness green; star thresholds untouched this sprint |
| Headless load of window-IIFE modules fights back | CH-1 stalls | wfc-test.cjs precedent exists; fallback shim is sanctioned in the chunk brief |
| Tier reshaping ripples into feel (projectile pacing, SFX density) | Combat reads worse despite better numbers | CH-2 changes numbers only, never fireRate archetypes; in-browser spot-check part of completion |
| Editor chunks slip again | ADR-034 stays open a third sprint | Explicitly accepted (D1); CH-6 stretch, CH-7 scheduled next sprint |

---

## Out of scope (this ADR)

- Implementing any chunk (Prompts 2+ dispatch them; this ADR is the plan).
- Endless mode design/build (Later; own ADR).
- Tower/enemy/tile GLB or material edits (ADR-034 Decision C stands).
- Star-threshold or unlock-requirement changes.
- Mobile-first editor rebuild beyond Group 7b's responsive shell.
