# Sprint 10 (resumed) — the endless calibration, the roster remnants, and a three-sprint blocker retired

**Date:** 2026-07-31
**Scope:** the four chunks the earlier dispatch never delivered — X-0, X-1, X-2, X-4. X-3 (`15bec99`) and X-6 (`d4a3ce9`) landed in the prior session and were not re-attempted.
**Headline:** the endless calibration ran. **Its result is that Element TD's reference constants survived CTD measurement** — no numeric tunable moved — and the deliverable is that they are now measured, widened to a 6-map × 3-seed × 2-difficulty matrix, banded, and pinned. The second, larger finding is one the calibration was not looking for: **endless has about nine waves of economy followed by up to seventeen of watching.**

---

## Gate states, first

| Gate | State |
|---|---|
| **X-5 / Plains s1 rider** | **NOT AUTHORIZED.** The dispatch contained neither "include s1" nor "drop s1", so the opt-in gate was not met. X-5 is **NOT-ATTEMPTED (unauthorized)** and is still being carried — this was its fifth offer. |
| **Unpushed commits** | **22** at hand-back (18 at session start; +4 from this run). Nothing was pushed, per the brief. |
| Working tree | Clean apart from the operator's uncommitted ` M .gitignore`, which was left untouched throughout. |
| Suites at hand-back | `sim-harness` **114 pass / 0 fail / ACCEPTANCE: ALL PASS** · `wfc-test` 12 · `map-rules-test` 44 |

---

## Progress

| # | Chunk | Status | Hash |
|---|---|---|---|
| X-0 | ADR-042 — roster remnants + endless-inclusion criteria | **LANDED** | `cba1d1d` |
| X-1 | **T-1 the endless calibration** (the main event) | **LANDED** | `e91f99b` |
| X-2 | Reduced-motion recovery + roster remnants | **LANDED** | `65c80ce` |
| X-4 | T-2 — the five-sprint-old Firebase blocker | **LANDED** (verification chunk, no code change — a valid pass) | `40a6637` |
| X-5 | Plains s1 rider | **NOT-ATTEMPTED** — opt-in gate not met | — |
| X-3 / X-6 | prior session | already shipped, not re-attempted | `15bec99` / `d4a3ce9` |

Harness trajectory: **108 → 111 (X-1) → 114 (X-2)**. Bar was "more than 108".

**Review note.** X-0 is a docs-only chunk whose entire diff is one new file, so its adversarial *diff* review and its mandated *design* review would have read identical content. They were run as one design review rather than two rounds over the same text; recorded here rather than claimed as two.

### X-0 — ADR-042 (`cba1d1d`)

Four decisions, D42–D45. The fresh-context design review returned three MAJORs, all fixed before commit; the load-bearing one killed a comfortable claim:

- **D42 — `mini_slime`'s tidewater shortfall is ACCEPTED**, with the exposure stated at full size. An earlier draft claimed the shortfall was "bounded by the anchor rule". **That was false.** `ANCHOR_RULE` covers slots 1 and 8 only; tidewater **w7** is a non-anchor wave where `slime ×7` splits into **14 mini_slime of 28 bodies (50 %**, slime family 75 %) — and it is the exact wave ADR-041 D35 took the failing reading on. The decision accepts that anyway, for reasons that survive knowing it.
- **The "second measured axis" framing is retired.** Rendered motion = skeletal × scale, and the slime *model's* skeletal amplitude (0.585) is a quarter of the rest of the roster's. The parent `slime` renders 0.236 — also below the legible band — and is a clean PASS on both its maps. A scale sized to fix contrast (≈0.313–0.326 by interpolation) does **not** fix motion; a scale that fixes motion (≈0.68) exceeds every creep in the roster. One property, two instruments, no single lever.
- **D43** conditionally restored the slimes' procedural hop, gated on a two-limb measurement — settled by X-2 below.
- **D44** named the reduced-motion recovery channel; **D45** set the drake-in-endless criteria without deciding inclusion.

### X-1 — the endless calibration (`e91f99b`)

**Coverage:** 6 official maps × 3 seeds (7 / 101 / 2029) × 2 difficulties × 3 builds = **108 scripted runs**, plus 144 dominance-arm runs. Was: one map, one seed, one difficulty.

**The calibration table — every constant, before → after, and the evidence:**

| Constant | Before | After | Evidence that moved it |
|---|---|---|---|
| `ENDLESS_GROWTH` | 1.15 | **1.15** | balanced survival 22–26 (quiet) / 19–21 (spirited) — mid-band inside 15–35 |
| `BOUNTY_GAP` | 1.07 | **1.07** | same; the compounding gap produces run depths inside band on every cell |
| `INTEREST_RATE` | 0.02 | **0.02** | knob decision below |
| `INTEREST_PERIOD_MS` | 15000 | **15000** | unchanged with the rate |
| `INTEREST_CAP` | 50 | **50** | the cap wins — measured, below |
| `BUY_LIFE_BASE` / `_GROWTH` | 100 / 1.5 | **100 / 1.5** | a greedy always-buy arm gains at most **+13.0 %** depth — inside the same 15 % margin. **The curve's *shape* is unmeasured** (no policy models when a purchase is correct); recorded as a limitation, not a verification |
| `BOSS_CADENCE` | 10 | **10** | runs reach 19–26, so every run meets exactly two bosses |
| `SCALARS` | 1.25 / 1.0 | **1.25 / 1.0** | start gold 275 keeps the build phase at 8–10 waves |

**Nothing moved. That is the finding, not an omission** — and the honest framing is that the numbers' *standing* changed, not their values. The T-1 brief anticipated a modified `endless-plains-quiet.csv` as the success signal; because no constant moved, that file is **byte-identical and unmodified**, which is the correct outcome for this result rather than a missing signal. `git status --porcelain -- tools/curves/` listed only the six new `endless-seed*-{quiet,spirited}.csv`; `git diff --stat -- tools/curves/` showed no campaign-CSV stat lines; `git status --porcelain -- maps.js entities.js engine.js` was empty. (The `forest.csv` EOL phantom did not appear at all this session.)

**Which interest knob won, and why.** The **cap**, on measurement — worst interest share of total income against the 35 % ceiling:

| configuration | worst share | verdict |
|---|---|---|
| rate 0.02 **+ cap 50** | **17.9 %** (51 % of ceiling) | **shipped** |
| rate 0.02, uncapped | **45.7 %** | breaches the ceiling |
| rate 0.01, uncapped | **25.0 %** | passes, at 71 % of ceiling |

The 45.7 % and 25.0 % counterfactuals reproduce the historical figures exactly, which is what validated the instrument. A lower rate clears the ceiling but halves the incentive *everywhere*, including early where choosing between banking 200 g and placing a tower is the decision interest exists to create; the cap is fully proportional below the 2500 g saturation bank and flat only above it.

**And a correction to what that degeneracy is.** 45.7 % has been described as the "bank everything, win" failure. It is an **income-composition** degeneracy, not a strategic one — interest swamps bounty and the early-call bonus. The stronger claim ("banking doesn't out-run building either") is one this repo **cannot** make; see the saturation finding.

**New named assertions:** `endless-survival-band` (15–35 waves), `endless-duration-band` (600–1800 sim-seconds), `endless-dominance-margin` (≤15 %), plus `endless-build-saturation` and `endless-constants-pinned`. **Widened, not duplicated:** `endless-build-separation`, `endless-interest-bound`, `endless-selection-effect`.

Both bands are **scoped to the balanced build**, and the scoping is load-bearing in both cases: across the matrix the naive arms run 10–19 waves and 375–744 s, so **30 of 72** naive runs fall below the survival floor and **38 of 72** below the duration floor. An unscoped band would fail on arms it was never chosen to describe.

**`sim-core.js` gained `opts.bank`** — a run *option*, deliberately not a fourth `POLICIES` entry, since `BUILDS` drives the campaign matrix and the editor's Simulate panel. Specified non-vacuously: the naive "skip the policy under a floor" construction builds nothing and dies at wave 2 whenever the floor exceeds endless start gold (measured: every floor ≥ 300 collapsed to 2 waves), so the arm runs the composition policy unchanged until the board is full and only then hoards. The dominance check requires the arm to have placed towers and cleared 10 waves before its depth counts.

**Two numbers this pass should be read for:**

1. **Build separation now ships at ZERO headroom** — worst pair 3 against a `≥3` bar (mountain/spirited/seed 101, depths 17/17/20). The pre-widening single-cell figure was 8. The widening is what found it; nothing was weakened to accommodate it.
2. **ADR-038 D20's scope input, which T-1 owed cycle 4.** The balanced build **stops spending at wave 8–10** and then plays **9–17 further waves** with a full board and maxed tiers, having spent only **11.2–21.3 %** of lifetime income. Endless has roughly nine waves of economy and seventeen of watching. This is the strongest evidence this project has produced for tower-roster depth.

**And it is why `endless-dominance-margin` has no power over the interest constants, which is stated at the check rather than hidden.** After saturation there is nothing to buy, so depth is a function of the HP curve against a frozen board. Patched to `INTEREST_RATE 0.20` uncapped, the banking arm accrues ~263 million gold and still measures **+0.0 %**. Adding the game's only late gold sink does not rescue it either — an arm that converts its hoard into purchased lives also measures +0.0 %, because at wave-26 HP a maxed board leaks whole waves and a dozen bought lives buy well under one extra wave. **A pass there means "no dominance was observable", never "no dominance exists."** The live guard against the interest degeneracy is `endless-interest-bound`, which does fire (45.7 % uncapped, 40.5 % at a 5 s period — both red).

**CSV set.** Six new `endless-seed{7,101,2029}-{quiet,spirited}.csv`, per seed × difficulty rather than per map — because `waveFor(i, seed)` takes no map and no official map defines `difficultyOverrides` (verified: zero occurrences), so a per-map set would be six copies of one file under different names. The legacy `endless-plains-quiet.csv` is kept under its historical name and column set so its git history stays a continuous series.

**Drake-in-endless verdict** — appended to ADR-042 as a dated addendum:

- **All three criteria PASS. There is no mandatory-Mage wall**, and the direction *inverts* the hypothesis: with drakes in the templates the gap between the physical-only arms and `balanced` **narrows** from 7.11 to 6.28 waves. Per-arm: physical −0.16, balanced −1.00. The cause is the confound D45 named in advance — `balanced` carries 2 of 7 slots as ground-only catapults, which lose a flyer entirely, while pure-ranger boards take only the 0.55× armor hit.
- A first attempt at `minBlock: 2` was **discarded before it produced a verdict**: the physical-only arms die at 17–19 and never met a drake (0 kills). Re-run at `minBlock: 1` — 118 kills.
- C2 post-inclusion 0.0 %/0.0 %; C3 peak 14 effective spawns *on drake-bearing waves* against the 35 ceiling.
- **Inclusion DECLINED this pass**, with reasons: it would invalidate every number the chunk just measured inside its own commit (a template edit re-shuffles every seed), and the only measured effect runs against ADR-040 D29's design rationale. Named unblock — a pass that **owns endless content**, which should also settle the second finding below.

**Also found:** at the calibrated curve the deepest run anywhere is wave 26, so block 3 is never entered and the templates **`bulwark` and `stormfront` are unreachable** — 10 of 12 templates are live content. Recorded in `endless.js`, deliberately not acted on (this was a constants-only pass; `minBlock` is content).

### X-2 — reduced-motion recovery, and D43 settled by measurement (`65c80ce`)

**D44 shipped.** `CTD3Ui.onMotionChange` publishes, `game.js` subscribes beside the existing `onLowPowerChange` line, `CTD3Scene.setMotionAllowed` does the release/re-attach pair. Publishing from the state's owner rather than exporting a scene helper is what makes it cover **every** caller of `setReducedMotion`, including the settings-restore at boot. The OS media query feeds the same channel, since `motionAllowed()` is the conjunction of class **and** query.

**Verified in the browser** (no-store `:3031`, hard reload, zero console errors or warnings). The gate was intended to be four steps and came back as a full state matrix, because low power auto-tripped on the debug profile mid-run and turned out to demonstrate the composition claim:

| state | mixers on the *same* node objects |
|---|---|
| spawned under reduced motion | **0** — skeletal drift 0.0000 across 43 bones |
| reduced motion OFF, low power still holding | **0** — the two gates compose; re-attach correctly refused |
| low power cleared | **1** |
| reduced motion ON again | **0** |
| reduced motion OFF again | **1** |

In the clean run, three runners spawned frozen re-attached on toggle and their skeletal drift went **0 → 0.69–1.32 world units** over 600 ms. Leak gate: geometries flat at 62, textures delta 0, `programs.length` constant at 10 across **320** rendered frames after clear. `ctd3:scores` was captured before seeding the unlock and restored to its original `null`.

**D43 — the slime hop is MEASURED AND NOT SHIPPED.** Both limbs of its gate failed on a live `slime` at forest/quiet w3, 150 rAF frames:

| limb | bar | measured |
|---|---|---|
| clip-only vertical body travel | < 0.055 world units | **0.0922** (42 % of the procedural hop's 0.22) |
| clip-only body-height oscillation | < 8 % | **12.57 %** (38 % of the procedural squash's +33 %) |

Controls confirm the reading is clip-only: `node.position.y` p-p **0.0000**, `node.scale.y` p-p **0.0000** at a constant 0.394. **The `enemy_slime2` Walk clip already hops and already squashes**, so declaring the flag would produce exactly the double-hop `scene.js`'s own short-circuit comment names as its hazard. This vindicates X-3's judgement by measurement rather than preference — and the distinction is now recorded: the ghost's clip supplied *no* float, which made restoring it addition; the slime's supplies both channels, which makes the same edit duplication.

**D42's `mini_slime` instrument is NOT-ATTEMPTED BY DESIGN** — X-0 chose accept-with-reason, so there was no S-sized instrument for X-2 to implement. Consequently `mini_slime`'s 0.153 rendered motion and its 26.13 ΔE are both **unchanged** by this sprint, exactly as D42 anticipated.

**New guard `enemy-reducedmotion-recovers`** — a second named check rather than a widening of `enemy-lowpower-recovers` (different function, no shadow half). **Mutation-tested 9/9 red.**

### X-4 — the Firebase blocker (`40a6637`)

**Branch (a): THE BLOCKER WAS A PHANTOM.** Community publishing has worked the whole time. Executed for real from `localhost:3030`:

1. **`signInAnonymously()` RESOLVED** — uid `tmcCc8O0ToNBkeO9zuyH3dKN1F52`, `isAnonymous: true`, 364 ms, **no** `auth/requests-from-referer` block. This is the load-bearing evidence T-2 demanded, and it is why the earlier `PERMISSION_DENIED` was a misdiagnosis rather than a finding: the failing sessions served on `:3004`, which is not allowlisted, so anonymous auth failed, `auth == null`, and the RTDB **correctly** refused. The denial was real; its attribution was not.
2. The editor's own Publish control returned **"Published as TWBZ."**
3. Reading `ctd3-community/TWBZ` back returns `{map, meta, updatedAt}`, "The New Field" — the write is really in the database.
4. The game's **COMMUNITY tab lists it** through the live read path.
5. An endless run started from that entry via the real **"Import & play · Quiet"** button reached **wave 5** with 16 lives on `user:community-TWBZ`. Zero console errors or warnings.
6. **`ctd3:scores` byte-identical** across the whole exercise (`null` → `null`), while the endless result correctly landed under `ctd3:endless` at `user:community-TWBZ:quiet`.

No rules change needed or made. **The only remaining operator Firebase dependency is the `ctd3-scores` leaderboard path** (T-3 / D17). Verdict recorded as a dated addendum to ADR-017.

---

## Verify-only cold re-read

Run after the last chunk, over the union of every fix diff in this session (three review rounds: one design review on X-0, one adversarial diff review each on X-1 and X-2 — 18 individual fixes). One fresh read-only agent, no fixes applied to its report.

**17 of 18 fixes: ACHIEVES INTENT · NO NEW DEFECT.** Every corrected figure was re-derived independently and matches to the digit, including the 50 %/75 % tidewater arithmetic, the 0.313/0.326 interpolation, the 38-of-72 and 30-of-72 band counts, and the 1-based `lastSpendWave`. The comment-stripping and brace-matching fixes to the X-2 guard were re-mutated: all four commented-out-wiring mutations are green without the fix and red with it.

**No landed commit breaks one of its own named gates**, so no chunk is downgraded to LANDED-WITH-RESIDUAL.

**One defect found (documentation only, no assertion affected)** — carried to Deferred as schedule-now: see D-1.

---

## Deferred items

| # | Item | Class |
|---|---|---|
| **D-1** | **A stale `16.7%` survives in a comment `e91f99b` itself added** — `tools/sim-harness.cjs:~901` says "measured worst share is 16.7% with the cap", 22 lines above the check that prints **17.9%**, and points the reader at `endless.js` where the figure is now correct. The fix round corrected the figure in `endless.js` and missed the copy in its sibling file. Documentation only. | **schedule-now** |
| **D-2** | `endless.js`'s header claims "every figure here is the harness's own printed output"; two of six rows (the per-difficulty splits) come from harness *comments*, not printed output. Both are empirically correct — over-claimed provenance, not a wrong number. | schedule-now |
| **D-3** | **`enemy-lowpower-recovers` has the same commented-out-code hole** X-2 fixed for its sibling: it still reads unstripped source, and `//`-prefixing `else attachAllEnemyMixers();` leaves it **green**. Pre-existing (`ec3aa8d`), untouched by this sprint, one file-scope from the fix. | schedule-now |
| **D-4** | `setMotionAllowed`'s release half makes a motion off→on toggle snap every live creep to a random walk-cycle phase (`attachEnemyMixer` desyncs with `Math.random()`), and reduced motion has **no per-frame cost motive for releasing at all**, unlike low power. Dropping the `else` would fix both. Noted at the call site; not changed late because the browser gate was measured against the current form. | schedule-now |
| **D-5** | `initFireflies` remains a **one-way** reduced-motion creation gate with no recovery path, so an OS flip mid-session now restores animation but leaves fireflies absent. Pre-existing; named in `scene.js` so "two-way" is scoped to mixers. | fold-into-next-sprint |
| **D-6** | **`mini_slime`'s tidewater shortfall (26.13 vs T1 28.49 / T2 28.0)** — accepted by D42, unchanged. Re-opens when a sprint takes a silhouette/outline treatment as its own subject. The second trigger (measure it on the four unmeasured maps) is **not executable**: slime appears only in forest and tidewater, and plains/mountain have no cohort denominator. | fold-into-next-sprint |
| **D-7** | **`bulwark` and `stormfront` are unreachable** (minBlock 3, waves 31+; deepest run 26) — 10 of 12 endless templates are live content. Pairs with the drake decision: same edit class, same re-baseline. | schedule-now, with D-8 |
| **D-8** | **Drake-in-endless: criteria measured and PASSED, inclusion declined.** Belongs to a pass that owns endless content, together with D-7 — one re-baseline instead of two. | schedule-now |
| **D-9** | **The D36 ghost residual — does the ghost read as SPECTRAL at 0.78 alpha, or merely as a dark solid?** Still unanswered, and now *fresher*: X-3 restored its 0.468 float, so it moves differently than when the operator last played. Only an operator's eye can close it. | **operator** |
| **D-10** | **The operator's "some things might need a little polish"** — still unspecified and still deliberately never guessed at. | **operator** |
| **D-11** | Whether the ghost was in fact the creep the operator saw. X-3 proved the roster's motion floor conclusively but *inferred* the identification. | fold-into-next-sprint |
| **D-12** | **Buy-a-life curve shape is unmeasured.** Bounded (+13.0 % from a greedy always-buy arm) but unverified, because no scripted policy models when a purchase is correct. Needs an arm that can decline a bad buy. | fold-into-next-sprint |
| **D-13** | **`endless-build-separation` at zero headroom** (worst 3 vs `≥3`). Not a defect; a landmine for the next content nudge. Flagged in `endless.js`. | schedule-now |
| **D-14** | `SPAWN_CEILING` is not pinned by value (only bounded ≤35). Inert today. | drop-with-reason — it is referenced by nothing but its own assertion |
| **D-15** | **X-5 / Plains s1 (oracle H2)** — never authorized, fifth offer. Its X-1 interaction is now *cheaper* to reason about: plains is one of six matrix maps, not the only one, so a slot move perturbs 6 of 36 cells rather than the whole basis. | **operator** |
| **D-16** | ADR-038 **T-3** (leaderboard) and **T-4/T-5/T-6** (layout generator), plus T-7…T-10. Untouched. | fold-into-next-sprint |
| **D-17** | **Tower-roster depth (D20)** — no longer instinct. The number it was waiting for is here: the board saturates at wave 8–10 with 9–17 idle waves after it. | fold-into-next-sprint |
| **D-18** | Minors from reviews, recorded not fixed: the dominance sweep's third floor reads two values from the module under test (a probe point, not a threshold); `fnBody` is a naive brace counter with no string/regex awareness (unreachable for both functions it is used on, and it fails toward false-PASS if it ever became reachable); two guard predicates pin identifier names and would false-*fail* an equivalent refactor. | drop-with-reason (each bounded and documented at its site) |
| **D-19** | **Live litter: community map code `TWBZ` ("The New Field")** is real and visible to anyone opening the COMMUNITY tab. Publishing it was authorised by T-2; it was left rather than deleted unilaterally. Removal one-liner is in the ADR-017 addendum. | **operator** |

---

## Known-unknowns

- **What the calibration cannot prove: endless *feel* at these numbers.** Every band it asserts is a machine proxy. G-2 (ADR-038 D16) is the non-blocking check that would settle it, and it now has a sharper question to answer than "does this feel right": **does the back half of a run feel empty?** The economy stops at wave 8–10 and runs continue to 26.
- Whether the saturation finding is a *defect* or a *genre norm* — the harness measures it; nothing here judges it.
- The buy-a-life curve's shape (D-12), and the two unreachable templates' effect on late-run variety (D-7).
- **Standing operator items, carried unchanged:** deploy (push + Cloudflare purge + `curl`-verify — this run adds **22** unpushed commits and touches `endless.js`, `scene.js`, `ui.js`, `game.js`, `tools/*`); real-phone; NVDA/VoiceOver; iOS; Firefox/Safari.
- **The Firebase dependency's status after X-4:** community publishing is **retired as a blocker**. The only remaining console action is the `ctd3-scores` leaderboard rules paste (T-3 / O-1).
- **No fps claim is made anywhere in this hand-back.** The debug Chrome auto-tripped low power mid-run — that is the profile, as prior sprints recorded, and this session used it as a test input rather than a measurement.
- Two local static servers were started for verification and are still listening: **:3031** (no-store, X-0–X-2) and **:3030** (cached, X-4). Stop them when convenient.

---

## The natural next dispatch

**ADR-038 T-4/T-5/T-6 — the layout-generator spine.** It is the last large untouched block, it is cycle 3's stated differentiator, and its prerequisites were built for it (the fairness oracle is a pure callable module with a pinned six-map baseline; `runScripted` takes a map object). It is also the one chunk in this cycle that is plausibly **both hostile and unprecedented** — a generate-and-reject loop with a convergence risk that no prior chunk has faced — which is the bar the saved `/agentic-feature-runner` pipeline was reserved for, one mode at a time with a hand-back between modes.

**But this sprint surfaced a rival with a stronger claim on the *next* dispatch specifically**, and it should be weighed rather than assumed away: the endless economy is decorative after wave 9. That is ADR-038 D20's unblock arriving exactly as scheduled, and it means endless's headline weakness is no longer content variety — the generator's pitch — but decision surface. A generator makes the maps infinite for a mode whose interesting decisions end at wave 10.

The recommendation is still the generator, for one reason: tower depth is an XL design problem (D20 calls it that, and ADR-037 refused to stack two unbuilt XLs), and it now has data where it previously had none — so it can afford to wait one more cycle and be adjudicated properly. The generator cannot get cheaper by waiting. **Dispatch T-4 next; carry the saturation number into cycle 4's tower-depth decision as its opening evidence.**
