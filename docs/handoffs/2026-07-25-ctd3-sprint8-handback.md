# CTD3 Sprint 8 — hand-back

**Date:** 2026-07-25
**Dispatch:** Sprint 8 of the CTD3 cadence — the campaign wave re-imagining on the new monster roster
**Design record:** [ADR-040](../adr/040-ctd3-campaign-wave-re-imagining.md)
**HEAD at dispatch:** `e7d6d24` (sprint-7 hand-back) — matched the brief's expectation exactly

---

## Gate states, first

| Gate | State | Why |
|---|---|---|
| **W8-3 — Plains s1 slot rider** | **NOT-ATTEMPTED** | The dispatch gates this on the operator appending **"include s1"** below the paste. It was not appended. `maps.js` `buildSlots` untouched; the `map-rules-test` six-map baseline is **not** re-pinned. |
| **W8-4 — Rodin GLB retirement** | **NOT-ATTEMPTED** | Eligible only if a `docs/handoffs/*roster-playtest*` (or `*playtest*` dated after 2026-07-24) note exists **and** reports no model-loading regression. `docs/handoffs/` contains no playtest note at all — the newest file before this one is `2026-07-24-ctd3-sprint7-handback.md`. ADR-039 D22's exit condition is therefore unmet and the four Rodin GLBs remain on disk, ledgered honestly as the non-CC0 exception. |
| **Unpushed** | **9 commits** (`git rev-list --count origin/main..main`) | 5 were already queued at dispatch; this sprint added 4. **Nothing was pushed**, per the brief. |

---

## Progress

### Chunks

| # | Chunk | State | Commit |
|---|---|---|---|
| W8-0 | ADR-040 — the wave re-imagining decision record | **LANDED** | `0c649c7` |
| W8-1 | New enemy type import (`drake`) | **LANDED** | `bee55f2` |
| W8-2 | The re-imagining + the sanctioned re-baseline | **LANDED** | `5887d9c` |
| W8-3 | Plains s1 slot rider | NOT-ATTEMPTED | — |
| W8-4 | Retire the Rodin GLBs | NOT-ATTEMPTED | — |
| — | This hand-back | **LANDED** | *(this commit)* |

### Harness trajectory

| Point | Checks | Notes |
|---|---|---|
| At dispatch (`e7d6d24`) | **83 pass / 0 fail / 0 known-fail** | baseline, re-verified twice for determinism |
| After W8-1 | **84 pass / 0 fail / 1 known-fail** | `+spawn-and-kill:drake`, `+content-reachable:drake` (registered red — see below) |
| After W8-2 | **97 pass / 0 fail / 0 known-fail** | `+6 campaign-spawn-bound:<map>`, `+6 campaign-rebuild-gap:<map>`; the drake known-fail cleared by its owning chunk |

No `WARN` lines in the final run. Both new guards were mutation-tested to fail loudly.

`node tools/map-rules-test.cjs`: **44 pass / 0 fail**, unchanged throughout — layout was never touched.

**The deliberate harness-red window worked as designed.** A new `ENEMIES` type is unreachable from any official wave until the maps land, so `content-reachable:drake` cannot pass between W8-1 and W8-2. It was registered in `KNOWN_FAILS` with its owning chunk named, and W8-2 removed it. No stale-KNOWN_FAILS warning fired.

### Curve re-baseline — before → after, per map

The single sanctioned re-baseline ADR-038 D18's amendment authorises. All six campaign CSVs changed in W8-2's commit and nowhere else; `endless-plains-quiet.csv` is **byte-identical**.

| Map | HP growth | Income growth | w7 attrition | Finale spike |
|---|---|---|---|---|
| Plains | ×1.445 → **×1.469** | ×1.396 → **×1.425** | 1.085 → **1.102** | 1.268 → **1.310** |
| Forest | ×1.453 → **×1.486** | ×1.392 → **×1.386** | 1.069 → **1.096** | 1.367 → **1.308** |
| Mountain | ×1.476 → **×1.505** | ×1.449 → **×1.478** | 1.159 → **1.188** | 1.577 → **1.573** |
| Tidewater | ×1.408 → **×1.444** | ×1.320 → **×1.401** | 1.107 → **1.108** | 1.267 → **1.298** |
| Snowfall | ×1.481 → **×1.505** | ×1.404 → **×1.416** | 1.105 → **1.096** | 1.337 → **1.308** |
| Riverbend | ×1.465 → **×1.532** | ×1.414 → **×1.472** | 1.119 → **1.086** | 1.282 → **1.312** |

Every wave on all six maps was rewritten, and the largest movement in any tracked statistic is **income growth +0.081** (Tidewater) and **HP growth +0.067** (Riverbend). The two *attrition* statistics — the ones D2 governs — move by at most ±0.06. That is the evidence for ADR-040 D31's "compositional, not magnitudinal", and it is why amending a freeze was a proportionate instrument.

All six maps hold `attrition-monotone` at the harness's own 0.02 tolerance; no map trips the w7 warn band (0.9–1.3).

### The wave-identity table

Each of the 48 waves now has a name and an archetype. Names live in `maps.js` comments; the player does not see them yet (see the adjacency assessment below).

**Plains — the teaching field** (no slime/ghost/juggernaut/drake; one new idea per wave)

| w | Name | Archetype |
|---|---|---|
| 1 | First Light | Rabble |
| 2 | The Marching Line | Rabble |
| 3 | Outriders | Swarm |
| 4 | The Iron Few | Tank line |
| 5 | First Wings | Air raid |
| 6 | The Shield Wall | Shield wall |
| 7 | Open-Field Muster | Mixed arms |
| 8 | The Long Muster | Mixed arms |

**The Whispering Wood — swarm**

| w | Name | Archetype |
|---|---|---|
| 1 | Under the Boughs | Rabble |
| 2 | Wolves at the Trail | Swarm |
| 3 | The Ooze | Split mass |
| 4 | Fleet of Foot | Swarm |
| 5 | Thicket Guard | Shield wall |
| 6 | Cold Lanterns | Spectral |
| 7 | The Running Tide | Swarm |
| 8 | The Wood Wakes | Mixed arms |

**Tidewater Bend — split mass**

| w | Name | Archetype |
|---|---|---|
| 1 | Slack Water | Rabble |
| 2 | The First Bloom | Split mass |
| 3 | Driftwood | Tank line |
| 4 | The Second Bloom | Split mass |
| 5 | Bank and Bar | Shield wall |
| 6 | Reedwing | Air raid |
| 7 | The Tide Comes In | Split mass |
| 8 | The Tide Divides | Mixed arms |

**The Stone Gate — siege, then the campaign's only boss** (juggernaut is exclusive to this map)

| w | Name | Archetype |
|---|---|---|
| 1 | At the Gate | Rabble |
| 2 | Stone and Bone | Tank line |
| 3 | The Narrow Watch | Shield wall |
| 4 | Hammerfall | Tank line |
| 5 | The Warband | Mixed arms |
| 6 | First Siege | Siege |
| 7 | Second Siege | Siege |
| 8 | **The Captain Walks** | **Boss** |

**Riverbend — air raid** (home of the drake)

| w | Name | Archetype |
|---|---|---|
| 1 | Low Water | Rabble |
| 2 | The Ford | Swarm |
| 3 | Wings over the Bend | Air raid |
| 4 | Bridgework | Tank line |
| 5 | The Second Flight | Air raid |
| 6 | Ironwing | Air raid |
| 7 | Nothing Uses the Bridge | Air raid |
| 8 | The Sky Falls | Mixed arms |

**Snowfall Pass — spectral**

| w | Name | Archetype |
|---|---|---|
| 1 | First Snow | Rabble |
| 2 | The Cold Road | Swarm |
| 3 | Pale Company | Spectral |
| 4 | Frostbacks | Shield wall |
| 5 | The Long Cold | Mixed arms |
| 6 | Rimeguard | Shield wall |
| 7 | What the Crystals Keep | Spectral |
| 8 | The Pass Remembers | Mixed arms |

### Wave-warns — per map, re-checked against live `maps.js`

These live **only** in `tools/map-editor.html`'s `validate()` and are not runnable from the harness. Re-checked with a faithful node port of the six estimators (W1/W2/W4/W5/W6/W8), transcribed from that source.

| Map | Before | After | All remaining are… |
|---|---|---|---|
| Plains | 11 | **6** | W1 |
| Forest | 10 | **6** | W1 |
| Mountain | 10 | **4** | W1 |
| Tidewater | 13 | **5** | W1 |
| Snowfall | 12 | **5** | W1 |
| Riverbend | 10 | **5** | W1 |
| **Total** | **66** | **31** | — |

**The arithmetic stated exactly, so the improvement is not overstated:** 66 → 31 is **37 W2 warns cleared and 2 W1 warns added** (37 − 2 = 35 net). It is *not* "entirely by clearing W2".

- **W2 ("leave ≥3s of rebuild room") is now clean on all 48 waves**, where 37 of 48 failed before. Every group boundary leaves ≥3.5s. This is why wave 2 on most maps is authored as two ranks of the same creature — and it is visible in play: the wave arrives, pauses, then arrives again.
- **W1 ("wave HP ramps 1.10–1.40×") rose 29 → 31.** ADR-037 §2.1 measured and ratified the current campaign at ×1.409–1.482; this design runs ×1.444–1.532. Satisfying W1 would mean cutting late HP ~25% and late income with it — trading a hard gate (completability) against an advisory one. Refused for the same reason §2.1 refused, and recorded rather than hidden.
- **W4, W5, W6, W8: zero warns on all six maps.**

**The rebuild gap has a cost the ADR initially claimed it didn't.** Inserting 96 gaps of 3.5s lengthens every wave: total campaign spawn-window time goes **417s → 633s (+52%)** — Riverbend +68%, Snowfall +53%, Plains +57%, Forest +56%, Tidewater +46%, Mountain +28%. Minimum wall-clock per map rises about a third before any prep countdown. Named in the ADR and the commit body rather than left as a silent pacing change, and it feeds directly into known-unknown #1.

**And it ships at zero margin, so it is now guarded.** Delays are hand-written literals laid out as *(previous group's tail + 3500)*, so all 96 boundaries sit at **exactly** 3500ms. `campaign-rebuild-gap:<map>` asserts the rule **per boundary** — strictly stronger than the editor's W2, which warns only when a wave has *no* ≥3000ms gap anywhere and therefore tolerates one closed boundary on a three-group wave. Mutation-tested: `shielded 5→6` on Plains w6 drops a boundary to 2350ms, satisfies W2, and fails this check.

### Spawn ceiling — a finding, not just a check

ADR-038 D13 sets `SPAWN_CEILING = 35`. Measuring total effective spawns per wave (split children walked — the same measure `endless-spawn-bound` uses):

- **Before: Forest w8 stood at 38** — `shielded ×6 + runner ×10 + skirmisher ×6 + heavy ×4 + slime ×4 → 12 bodies`. The campaign was **above its own ceiling** and had been since ADR-036 CH-3.
- **After: 30** (Forest w8), with every other map at 12–28.

An earlier draft of ADR-040 reported the old maximum as 31 by failing to walk the slime split — the exact arithmetic the new check performs. Both the ADR and this note say 38.

The new `campaign-spawn-bound:<map>` check therefore **could not have landed before the wave rewrite** — it fails on shipped content. That sequencing is stated in the ADR rather than glossed.

Separately measured through the real engine with an undefended board: **peak concurrency 16**, worst case across all six maps — 46% of the ceiling. Total spawns is the tighter of the two measures (30/35 = 14% margin) and is the one guarded.

### The new enemy type

`drake` — armored flyer, `hp 240, speed 1.6, armor 0.45, bounty 50, sizeWorld 0.75`. Fills the one interesting empty cell of the (mobility × mitigation) matrix.

- **Asset:** Quaternius "Dragon" (Ultimate Monsters, Flying sub-pack), CC0 1.0, via the poly.pizza mirror ADR-039 sanctioned — the Quaternius Drive folder still quota-blocks. 251,540 → **119,756 B**, glTF-Validator **0 errors**, Defender clean before and after optimization, fingerprinted to the Flying sub-pack before adoption, ledgered per D24 with hashes and route.
- **Where it appears:** Riverbend w6/w7/w8 (owner) and Snowfall w6/w8.
- **What it changes:** Ranger T3's 0.268 DPS/gold falls to **0.147** behind 0.45 armor against Mage T3's **0.148**. Stated precisely in the ADR: this is *parity before chains*, not "Mage becomes mandatory". The stronger argument is economic — at 4.8 raw HP per bounty gold it is 2.3× denser than a skirmisher's 2.1, which is what lets an air-signature map hold the D2 band instead of funding the player past its own threat.

### In-browser verification — **PASSED**, with the environment noted

Dev server was not on :3030, so a no-store server was started on **:3031** (`Cache-Control: no-store` verified on every response). Hard reload before every verdict.

- **Full campaign run on Plains: PASSED.** Reached and played the wave-8 finale; the run resolved to the game-over screen ("The Gate Has Fallen", Lives 0/18, Score 4,318). *The loss is mine, not the balance's* — I built 3 towers on a 6-slot map; the harness's three scripted builds, which fill every slot, win all 36 map × difficulty × build runs. Waves 1–4 cleared with zero leaks.
- **Spot-loads: all six maps PASSED** — plains, forest, tidewater, mountain, riverbend, snowfall_pass each loaded and spawned wave 1 correctly.
- **Mountain's finale: PASSED.** The Captain renders and walks with its escort.
- **Compositions match their archetype names: PASSED.** All 48 wave definitions were read back out of the live browser module and match the ADR-040 tables exactly. Visually confirmed for a sample: w2 arrives as two ranks with a real pause; "Outriders" leads with dark ninja runners ahead of orc footmen; "The Shield Wall" is a file of armored dinos; "The Long Muster" puts heavies, shielded and flying skirmishers on screen at once; Snowfall's finale shows the drake airborne with a correct ground shadow.
- **Zero console errors and zero warnings** across every load and the full run.

**Environment note, carried forward honestly:** the debug Chrome initially reported **4–6 fps with zero enemies and no gameplay running** on a profile with ~38 tabs including several playing video — reproducing the Sprint-7 finding. After that profile freed up it returned to a steady **60 fps · 16.7 ms**, and the full run above was done at 60 fps. **No fps or performance claim is made by this sprint**; the 35-spawn budget was verified analytically and by engine measurement, not by frame timing.

Star-gated maps (Mountain 5★, Riverbend 13★, Snowfall 14★) required seeding `ctd3:scores` in the debug profile to reach. That seed and the run's own score were **removed** at the end of the pass; the profile is left as found.

### Reviews

Three fresh-context adversarial reviews ran, one per chunk, plus the design review ADR-040's row additionally required.

- **W8-0 design review** — 11 majors. Four were already fixed by corrections I had made independently. The rest were real and all addressed.
- **W8-0 diff review** — 5 further majors on the corrected document.
- **W8-1 diff review** — 2 majors, 5 minors, all addressed.
- **W8-2 diff review** — 1 major, 4 minors. It independently reloaded the shipped `maps.js` through the real modules and reproduced *everything*: all 48 compositions, all 48 attrition values to 3 dp, the six CSVs byte-identical, all 12 anchors, the 38→FAIL replay against HEAD, and the predicted 29→31 W1 count. **The data was correct; the findings were risk- and documentation-grade.** All five addressed.

The reviews earned their keep. What they caught, kept because it is the useful part of this record:

1. **The spawn-ceiling baseline was wrong** (31 vs 38) and the error concealed that shipped content already breached D13.
2. **The drake's "arithmetically impossible" justification was false as stated** — an air-*led* finale *is* constructible without it (`ghost ×26 + shielded ×4 + heavy ×5` = 2,300 HP in exactly 35 spawns). The honest objection is an identity one: 26 ghosts read as Snowfall's signature, not Riverbend's. Restated.
3. **The archetype vocabulary claimed to partition "tower answers"** — impossible with four towers, three of which deal damage. Redefined around the pressure a wave applies, with overlaps stated.
4. **The anchor rule was violated by the first wave it was applied to** (Snowfall w8 ran 14 ghosts, the largest group by both HP and count). It is now a measured ratio (≤30% of bodies, never the HP lead) and three finales were re-cut. All 12 anchors pass.
5. **A "±0.06 envelope" claim falsified by the table directly above it.**
6. **Three misattributed citations**, two of them load-bearing.
7. **The sprint's own headline playability invariant shipped unguarded at zero margin.** All 96 group boundaries sit at exactly 3500ms, and the only enforcement was a browser-only editor rule — so the "mid-wave breath on all 48 waves" claim could revert silently with a fully green harness. Guarded (`campaign-rebuild-gap`), and the guard is stricter than the editor rule it replaces.
8. **"A playability gain that costs nothing" was false** — it costs +52% campaign spawn-window time.
9. **Snowfall w6 "Rimeguard" was mislabelled Air raid** at 2 of 8 bodies flying, against 56–100% for every other Air raid. Relabelled Shield wall — which also tightens signature ownership, since Riverbend now owns Air raid outright.
10. **`ENEMY_VIS.yOffset` had the wrong sign** — I claimed the drake hung 1.000 *below* its origin; it sits +0.771 *above*, like both other flyers. My −1.000 was the raw quantized `POSITION.min[0]` — the **X** axis before dequantization. Re-measured with proper bind-pose skinning (a method validated by reproducing skirmisher's +0.787, ghost's +0.245 and the captain's 1.60 height exactly). The drake would have flown 0.61 units above the other flyers.

---

## Two defects the harness could not have caught

Both were found by reading the browser console, and both are recorded because the *class* matters more than the instances.

**1. A clip-name mismatch that a harness check passed.** The first optimized drake GLB kept Quaternius's `CharacterArmature|` clip prefix, while all nine shipped models use bare names. `scene.js` resolves `ENEMY_VIS.moveClip` with `THREE.AnimationClip.findByName` — an **exact** match — so the drake missed, fell through to the "first non-death clip" fallback, and played the right animation **only by ordering luck**, warning on every spawn. Had the clip order differed it would have hovered in `Flying_Idle` while travelling.

`enemy-vis-clips-resolve` **passed that build**, because it stripped the same prefix before comparing and was therefore strictly more permissive than the runtime. The asset was fixed (clips renamed in the import pipeline) **and the check was corrected** to compare raw names — then mutation-tested: it now fails loudly on a prefixed `moveClip`.

That correction makes **two** harness-source changes this sprint, deviating from ADR-040 D33's "only one". The ADR was corrected in the same commit rather than left inaccurate. Shipping a knowingly-permissive acceptance check to protect a sentence would have been the wrong trade.

**2. A hand-maintained list with no test.** `ui.js`'s in-game enemy legend is a hardcoded array, not enumerated from `ENEMIES`, so no check covers it. A new wave-facing type would have shipped with no legend card — precisely the `flying · armored` information the drake's counterplay depends on. `drake` was added, and the array now carries a comment saying why it is hand-ordered and what that costs.

---

## Wave-legibility adjacency assessment (assessed, not built)

The dispatch asked whether the HUD needs a wave-identity label, whether the early-call chip's copy still fits, and to note enemy-icon fit. Assessed; **nothing built**.

- **Recommendation: do not ship a HUD wave-identity label this cycle.** ADR-040 produced *two* naming layers — the **wave name** ("The Running Tide"), which is voice-correct but mechanically silent, and the **archetype** ("Swarm"), which is mechanically useful but is design vocabulary that would read as a spreadsheet in a game that says *A TALE OF TOWERS & SIEGES*. Neither alone does the job the ADR describes; a third, fiction-voiced archetype layer is unauthored work.
- **The early-call chip fits and has a redundant slot** — `.ec-label` says "Early call", which duplicates the chip's own affordance. But the chip is gated on `prepCountdownMs > 0`, so the name would vanish exactly when a player deliberates. Wrong host.
- **Enemy icons are substitutes, not complements.** An archetype *is* a set of enemy types; with icons, "Air raid" renders as a drake and a skirmisher, and icons are voice-neutral, dissolving the register conflict. A text label is plausibly work that icons delete. **Do not build both.**
- **Endless already set the precedent** — `updateWaveCounter` repurposes the second HUD span for "boss in 8" with dedicated `.anchor` classes. If a label ever ships it goes there, not in new markup.
- **Showing the *next* wave's name during prep is a balance change wearing a UI costume** — it converts the early-call bonus (ADR-036 D4) from a blind tempo gamble into an informed one. Needs its own decision.
- **Best first use of the names is the game-over screen** — "You fell at *The Running Tide*" is retrospective, so it leaks no preview information, has zero balance impact, and uses the layer that actually works.
- **Community maps would become visibly second-class** if official waves gain names and Cartographer-authored ones do not.
- Surfaced in passing: **tidewater and riverbend both ship `chip: 'River Pass'`** — a pre-existing duplication that signature ownership makes newly conspicuous.

---

## Deferred items

### Schedule now

| Item | Why now |
|---|---|
| **Operator playtest of the re-imagined campaign** | The only thing that can settle whether the design *feels* right. Also discharges ADR-039 D22's exit condition and unblocks W8-4. |
| **Deploy the 5→9 commit queue** | Players still see the pre-Sprint-7 roster. Now a larger purge list: nine GLBs + `enemy_drake2.glb` + `MANIFEST.json` + game JS + the six CSVs. |

### Fold into next sprint

| Item | Note |
|---|---|
| **The roster-polish cluster** | Figure-ground surround (rim light / contact shadow / ground-palette shift), flyer ground discs, death animations, low-power curve, enemy icons, footsteps. **This is now load-bearing:** ADR-040's anchor rule exists *because* ghost reads near-black and slime olive, and its named unblock is exactly this work. Snowfall w7 now fields 17 ghosts — more than any wave before — so the design intensifies the general readability risk while protecting only the anchors. |
| **Promote ADR-040's anchor ratio to a harness check** | It is hand-measured prose today; a later composition edit pushing Tidewater w8 past 30% would fail nothing. Cheap. |
| **Make a stale `KNOWN_FAILS` entry FAIL, not warn** | Today `staleKnown` only prints `WARN` and the exit gate keys on `failed.length`, so a forgotten entry stays green forever. The W8-1 → W8-2 window relied on discipline, not enforcement. **Also recorded in ADR-040's out-of-scope list**, so it survives in the repo rather than only here. |
| **ADR-038 T-1 (endless calibration)** | Also owns the drake-in-endless question. ADR-040 D32 excluded the drake from endless deliberately and names T-1 as the decision point, with measured wave-index data in hand. |
| **ADR-038 T-2..T-10** | Leaderboard, layout generator (T-4/5/6), range affordances, snowfall palette, Cartographer gold budget, `?test=decal-audit`. Untouched. |
| **Tower-depth D20 (ADR-038 §3(e))** | Cycle 4. **New evidence for it from this sprint:** the archetype exercise found that **Warden is the best answer to no archetype at all** — the campaign contains no wave shape for which a slow aura is the primary answer. That is a fact about the tower roster the D20 decision needs. |

### Drop with reason

| Item | Reason |
|---|---|
| **Chasing the editor's W1 wave-ramp warn to zero** | Would require cutting late HP ~25% and late income with it, trading a hard gate (completability) against an advisory one. ADR-037 §2.1 already measured and ratified a ramp above W1's band. Recorded in the ADR so it is not rediscovered as a defect. |
| **A HUD wave-identity label this cycle** | See the adjacency assessment — register conflict unresolved, icons likely supersede it, prep-phase display is a balance change needing its own decision. |
| **Unfreezing existing `ENEMIES` hp/bounty** | Tempting (the table's HP-per-gold spread runs 2.1 to 6.9) and refused: cross-map global, and it would make the re-baseline un-attributable. The distortion is now documented for whoever takes it on deliberately. |

### Review minors accepted rather than fixed

- ADR-040's anchor-ratio table is honest that **six of twelve anchors are 0% by construction** (footman-only wave 1s) and only two waves genuinely exercise the 30% threshold.
- The peak-concurrency figure (16) is measured by a stated, reproducible procedure but is **not guarded** by any check; the editor's W8 concurrency estimator remains browser-only.
- Tidewater w3 lands attrition 0.752 against a 0.72 target — heavy's 110-HP granularity leaves no composition between it and 0.60. Monotonicity holds.
- D2's 0.6–0.8 nominally governs waves 2–5, but wave 4 already exceeded 0.8 on three shipped maps before this sprint and does again here (Tidewater 0.824, Forest 0.802). Named in the ADR as an inherited third excursion so it is not mistaken for something this sprint introduced.

---

## Known-unknowns

1. **The re-imagined campaign's FEEL is unverified, and that is the headline.** Every number here is harness-measured; the design is carried by a curve and an argument. Whether "The Running Tide" (18 runners) is thrilling or exhausting, whether Mountain's two-siege build-up lands, whether Riverbend's drake finale reads as a climax or a wall — **the operator playtest is the settle.** This is the same risk ADR-038 D16 accepted knowingly for endless, taken again with open eyes.
2. **The drake's anti-physical check is untested against a human.** All three scripted builds win every map on both difficulties with gold to spare, so the sim confirms only that it makes nothing unwinnable. Whether it actually moves a player toward Mage is a claim about human play.
3. **Juggernaut exclusivity narrows exposure** — a player who never reaches 5★ never meets one. Judged correct (a signature that appears everywhere is not a signature) but it is a real reduction in variety on two maps.
4. **Two finales are led by types they do not thematically own** (Tidewater, Snowfall) pending the surround work. Their identities are slightly muted at their loudest moment, on purpose.
5. **The `forest.csv` phantom is resolved — confirmed, not predicted.** It had shown as modified with an empty `git diff` since before this sprint; `cmp` proved it byte-identical to its committed blob, i.e. a stale index-stat entry rather than content. The fresh CSV write in W8-2 cleared it: forest.csv now carries a real content change like its five siblings, and `git status` after the commit is clean.
6. **Standing:** the Firebase visit (ctd3-scores rules + one community map), carried a fourth sprint. Untouched again.

---

## Next dispatch

**The roster-polish sprint** — figure-ground surround first, since ADR-040's anchor rule is written against it by name, Snowfall w7's seventeen ghosts raise the stakes on it, and its completion is the named unblock for re-leading two finales with their own signature types. Run it *after* the operator playtest, which is cheap, discharges ADR-039 D22, and would let the same sprint retire the four Rodin GLBs (W8-4) on the way past.
