# ADR-042 — CTD3 roster remnants, and the criteria for admitting a type to endless

**Date:** 2026-07-31
**Status:** Accepted
**Amends:** nothing. Every prior decision it touches is left standing; where it decides something a prior ADR left open, it says which clause owned the opening.
**Relates to:** [ADR-039](039-ctd3-cc0-asset-expansion-policy-and-monster-suite.md) D23/D27 (asset immutability, skinned-enemy lifecycle) · [ADR-040](040-ctd3-campaign-wave-re-imagining.md) **D28** (figure-ground anchor rule) and **D32** (endless untouched, naming T-1 as the decision point) · [ADR-041](041-ctd3-roster-readability-figure-ground-and-flyer-legibility.md) **D34** (the instrument), **D37** (thresholds, the bias rule, and the no-lever-at-a-gate rule), **D41** and its dated **Addendum — 2026-07-26** (the baselines of record) · [ADR-038](038-ctd3-layout-generator-direction-and-cycle-3-sprint-plan.md) **T-1** (the endless calibration), **D18** (campaign freeze)

This is a **short** ADR closing three remnants of the Sprint-9/Sprint-10 roster work. It is deliberately not a second ADR-041: it introduces no instrument, re-derives no threshold, and produces no new measurement. It carries **four** decisions — D42 and D43 are executed by **X-2**, D44 by **X-2**, and D45 is settled by **X-1**.

**Sprint-10 chunk identifiers.** **X-0** this ADR · **X-1** ADR-038 T-1, the endless calibration · **X-2** implements D44 and, conditionally, D43 · **X-3** (`15bec99`) and **X-6** (`d4a3ce9`) already landed.

---

## Context

Sprint 9 shipped the ghost's alpha lever and closed the ghost on all three of its maps. Sprint 10's X-3 found and fixed a second, unrelated defect on the same creep — a procedural-motion layer the mixer short-circuit was silently subtracting. Between them they left exactly three things unresolved, and none is large:

1. `mini_slime` fails ADR-041 D37 on **one map**, tidewater, and X-3 added a second measured number about it whose evidential weight has not been stated.
2. Reduced motion still carries the one-way mixer defect that low power shed in `ec3aa8d`.
3. ADR-040 D32 excluded `drake` from endless and named ADR-038 T-1 as the decision point, without saying what T-1 should decide *on*.

---

## D42 — `mini_slime`'s tidewater shortfall is ACCEPTED with a stated reason. No instrument is adopted.

### What is actually failing, stated exactly

From ADR-041's **2026-07-26 addendum, A4** — the baselines of record. The pre-hardening figures (28.32 against ≥29.89, in **D37's applied table**) do not reproduce and are not used:

| Type | Map | ΔE_body | T1 (0.80 × lever-off cohort) | T2 | Verdict |
|---|---|---|---|---|---|
| mini_slime | **tidewater** | **26.13** | ≥ **28.49** ✗ | ≥ 28.0 ✗ | **FAIL both** |
| mini_slime | forest | 37.10 | ≥ 26.93 ✓ | ✓ | PASS |
| slime | tidewater | 30.98 | ≥ 28.49 ✓ | ✓ | PASS |
| slime | forest | 39.18 | ≥ 26.93 ✓ | ✓ | PASS |

**One row, on one map.** ADR-041's own diagnosis is that the gap is **size**: `slime` and `mini_slime` are the same model and the same material, differing only in `ENEMY_VIS.scale` (0.394 vs 0.262 → 38×52 px vs 26×34 px), and they measure 30.98 vs 26.13.

### The motion number corroborates smallness. It is NOT a second axis.

X-3 measured `mini_slime`'s rendered motion at **0.153**, the roster's second-lowest, and its hand-back recorded that as "a second measured axis" pointing at the same instrument. **That framing is wrong and is corrected here**, because reading it as two independent failures would make a scale lever look doubly justified when it is not.

Rendered motion is **skeletal amplitude × scale**. The slime *model's* skeletal amplitude is **0.585** — against **1.19–3.12** for every other type in X-3's table except the ghost (0.372) — so the low figure is a property of the shared model, not of the child:

- the parent `slime` renders **0.236**, also far below the ~0.4 band where the roster's legible types start (skirmisher 0.406), **and is nonetheless a legible PASS on both of its maps**;
- raising `mini_slime` to the parent's full 0.394 moves its motion only to ≈**0.230** — still below the band, i.e. a scale lever sized to fix contrast does *not* fix motion;
- reaching ≈0.4 would need scale ≈**0.68**, larger than any creep in the roster (`juggernaut`, the largest, is 0.491).

So the two numbers are not two failures with one cure. They are one property — this creep is small, on a model whose clip barely moves — read through two instruments, and **no single instrument closes both**. The motion half is addressed separately and on its own merits in **D43**; it is not counted toward D42.

### The four candidate instruments, weighed

| Candidate | Verdict |
|---|---|
| **Scale increase** | Rejected. The decisive argument is design, not arithmetic: at the size that would work, the split child stops reading as smaller than its parent, and that size difference is *gameplay* information — it is how a player knows a weaker body just spawned. The arithmetic only sizes the problem. Linear **interpolation** between the two measured points (0.262→26.13, 0.394→30.98; both target scales lie **inside** that interval, which makes the estimate stronger than an extrapolation would be, though it is still a straight line through a perceptual quantity) puts T2's 28.0 at scale ≈**0.313** and T1's 28.49 at ≈**0.326** — **79–83 % of the parent's**. The ≈2.4 ΔE it must buy is set against a parent that itself clears T1 by only 2.49. Choosing a number off that line at a gate is what D37 forbids. |
| **Outline / silhouette treatment** | Rejected *here*, not forever. It is a new rendering feature applying roster-wide, M-sized at least, with its own palette and gold-budget questions — an ADR's worth of decision, not a remnant's. |
| **Size-aware ground disc** | Rejected on two grounds, neither of which is "it moves the surround": D34's three-pass form already hides `decalsGroup` and excludes disc pixels from the surround, so that hazard is handled. The real ones are that a disc **depletes the surround sample** directly beneath the creep whose surround is being measured, and — decisively — D38's discs are the **flyer** air/ground affordance, so putting one under a ground creep makes a shipped visual language mean two things. |
| **`proceduralMotion: true` for the slimes** | **Not an instrument against this defect at all.** A hop and a squash change position and shape; they do not change hue, and ΔE_body is a colour statistic. Weighed under D43 as a motion restoration, and explicitly **not** credited here. |
| **Accept with a stated reason** | **Adopted.** |

### Why accepting is the honest verdict rather than the cheap one

Acceptance is a real option in this cadence, and the case for it is stated on its own terms rather than as the residue left after rejecting the rest.

**First, the exposure, stated at full size rather than at a comfortable one.** An earlier draft of this decision claimed the shortfall was "bounded by the anchor rule" — that `mini_slime` cannot lead a wave, so nothing regresses by waiting. **That is false and the review caught it.** `sim-core.js`'s `ANCHOR_RULE` constrains **slots 1 and 8 only**. Tidewater **w7** — `slime ×7, skirmisher ×4, shielded ×3` — is not an anchor slot, and its seven slimes split into **14 `mini_slime`**: **14 of the wave's 28 bodies (50 %)** are the failing type, and the slime family is 21 of 28 (75 %). It is also the exact wave ADR-041 D35 took the failing reading on. So the honest statement is: **the type that fails sits at half the bodies of a shipped wave the anchor rule does not reach, and this ADR accepts that anyway.**

It accepts it for reasons that survive knowing the real number:

- **There is no decided instrument, and no sanctioned way to decide one here.** Every candidate above is either roster-wide, a new visual language, or a number picked off a line at a gate. D37 exists precisely to stop the last of these, and it was written after a sprint in which a lever was very nearly shipped for a sampler artifact.
- **The defect is one type on one map, against a threshold with four of six maps unmeasured.** An instrument with a wider blast radius than the defect, sized against a partially-measured threshold, is how a readability pass becomes a rendering rewrite.
- **The consequence of accepting is already priced and already shipped.** D41's retirement condition stays unmet, so ADR-040 D28's anchor rule stands and keeps constraining waves 1 and 8. That is a live, harness-enforced constraint, not a promise.
- **The failure mode is legibility on one wave, not correctness.** 26.13 against a 28.49 target is a 8 % shortfall on a perceptual statistic whose own run-to-run spread D41's addendum measured at ±1–7 % depending on type. It is a real miss and it is a small one.

### Re-open condition, named so this is a decision and not a park

D42 is revisited when a sprint takes a **silhouette / outline treatment** as its own subject, with its own ADR and its own threshold — at which point `mini_slime` is a beneficiary of that work rather than its justification. That is the operative trigger, and it is owned by whoever schedules that sprint.

A second trigger was considered and is recorded as **not yet executable**, rather than listed as though it were: *"measure `mini_slime` on the maps it has no reading for."* `slime` appears only in **forest and tidewater** (`maps.js`), and `mini_slime` exists only as its split child, so the other four maps cannot field it in the campaign at all — and two of them (plains, mountain) have no cohort denominator in A4 either. Making that trigger real means authoring baselines that do not exist. Named here so a future session knows the cost instead of discovering it.

**What this decision does not do:** it does not lower T2, re-derive T1, or grant D41's relaxation. ADR-041's A4 already recorded that `drake` on riverbend (23.77) sits below T2 and that re-deriving the floor downward from it would pass `mini_slime` by arithmetic; that door stays shut.

---

## D43 — The slimes' procedural hop is RESTORED, on X-3's precedent, gated on a two-axis doubling check. It is a motion fix and is not credited against D42.

`scene.js` carries a slime hop — `bobY = hop × 0.22` plus squash-and-stretch (`squash = 1 − hop × 0.25`, so `scaleY` swings up to **+33 %** and `scaleX/Z` down to **−25 %**) — written for `slime` and `mini_slime` before the ADR-039 model swap. Since the swap it has been **unreachable in normal play**: both types get a mixer, neither declares `proceduralMotion`, so `syncEnemies`' short-circuit takes the branch above it. That is the same silent subtraction X-3 diagnosed and fixed for the ghost (0.11 → 0.58 total motion), on the two types sitting immediately above the ghost in X-3's rendered-motion table.

Declaring the flag is therefore a **restoration of authored behaviour the swap dropped** — the distinction X-3's own scope turned on — not a lever invented at a gate.

**X-3's stated reason for not taking it is answered, not overridden.** X-3 kept the slimes clip-owned so the pair "diverge only on size," which is what makes D41's size diagnosis clean. The flag preserves that: it is declared on **both** slimes identically, so the pair still differ only in `scale`. One asymmetry is recorded rather than hidden — `bobY` is a world-space position offset and is *not* multiplied by `ENEMY_VIS.scale` (`scene.js` applies scale to `node.scale` only), so an identical hop is proportionally larger on the smaller body. That is a legibility gain for `mini_slime`, and it is **not** a contrast gain.

### The gate, because the hazard is real and `scene.js` names this exact case

The short-circuit's own comment cites *"a squash-and-stretch hop applied to a model that is already hopping"* as its motivating example. A slime's `Walk` clip is the clip in this roster most likely to carry bounce. So the flag ships **only if** the clip does not already supply that motion, measured on **both** axes the procedural layer writes:

> **X-2 measures the `enemy_slime2` `Walk` clip's contribution with the procedural layer OFF**, in **world units at the shipped scale** — not in model-local bone space, and not via `node.position.y`.
>
> **Instrument, stated because the obvious one is wrong.** X-3's `bodyFloatY` reads `node.position.y`, which the *procedural* layer writes; a clip animates bones underneath the node and is invisible to it. The measurement that can see the clip is X-3's other one — **bone world-space travel** (the "skeletal" column), taking its **vertical** component and multiplying by `ENEMY_VIS.scale`, which is what makes it comparable to `bobY`'s world-space 0.22.
>
> **Two limbs, both must clear:**
> - **(i) vertical travel** — clip-only rendered peak-to-peak vertical body travel **< 0.055 world units** (one quarter of the procedural hop's 0.22 peak).
> - **(ii) deformation** — clip-only rendered body-height oscillation **< 8 %** (one quarter of the procedural squash's +33 % `scaleY` swing). This limb exists because a clip with near-zero root translation and strong squash-based bounce would pass a vertical-travel-only gate and ship a **double squash** — the precise hazard the comment names.
>
> One quarter is the stated bar on both limbs: below it the procedural layer adds motion rather than doubling it. **If either limb fails, the flag is not shipped**, X-2 records both measurements and the non-ship, and D43 is closed as measured-and-declined.

**Report requirement if it ships.** Before/after rendered-motion figures for both slimes, **and** one post-hop tidewater ΔE reading for `mini_slime` by D34's three-pass method. The squash rewrites `node.scale` every frame, which moves the projected AABB that D34's ellipse gate and `fill` are computed on — so A4's 26.13 would no longer describe the shipped build. This ADR asserts the hop is not a contrast change; that reading is what makes the assertion checked rather than believed, and it costs one collection on a map X-2 is already instrumenting. **A movement in that reading does not reopen D42** — D42 is a decision about instruments, not about a number — but it must be recorded.

Either outcome is a pass for X-2. A non-ship is a measured finding, not a failure.

---

## D44 — Reduced-motion recovery gets its own channel, symmetric with low power's, and its own named harness check.

### The defect, verified in source

`mixersAllowed()` (`scene.js:740`) denies a mixer when **either** `CTD3Ui.motionAllowed()` is false **or** the renderer is in low power. Low power's half is two-way since `ec3aa8d`: `CTD3Renderer.onLowPowerChange` publishes, `game.js:127` subscribes, and `setLowPowerShadows` calls `releaseAllEnemyMixers()` on the trip and `attachAllEnemyMixers()` on the clear (`scene.js:1352`).

Reduced motion's half is **one-way**. `CTD3Ui.setReducedMotion` (`ui.js:273`) only toggles a body class; there is no change event. `attachAllEnemyMixers` exists (`scene.js:867`) but is **not on the `window.CTD3Scene` export surface** (`scene.js:1558`), so no external caller can reach it. Consequence: anything spawned while reduced motion holds is permanently static, and turning the setting back off never repairs it.

### The channel: a `CTD3Ui` change-listener, not a bare scene export

Both options were considered. **A `CTD3Ui.onMotionChange(cb)` listener, mirroring `renderer.onLowPowerChange`, is adopted**, for one reason that decides it: the state's *owner* publishes. `CTD3Ui` owns `motionAllowed()`; the renderer owns `isLowPower()`. Wiring the listener in `game.js` beside the existing `onLowPowerChange` line makes the two channels literally symmetric and — the load-bearing part — covers **every** caller of `setReducedMotion`, including the settings-restore call at `game.js:139` and any future one. Exporting `attachAllEnemyMixers` and calling it from the one toggle handler fixes only the call site someone remembered to edit, which is the shape of the bug being fixed.

**The scene handler is the same pair low power uses**: motion off → `releaseAllEnemyMixers()`; motion on → `attachAllEnemyMixers()`, which re-checks `mixersAllowed()` and therefore correctly stays denied while low power still holds. The two gates compose without a combined-state matrix.

**Second half of the same defect, included because it is the same function.** `motionAllowed()` is the conjunction of the body class **and** `matchMedia('(prefers-reduced-motion: reduce)')`. A channel fed only by the class leaves an OS-level toggle mid-session as an uncovered one-way path. The listener is fed by both sources.

### The harness guard: a SECOND named check, not a generalised one

`enemy-lowpower-recovers` asserts against the **body of `setLowPowerShadows`** — `_castShadowPreLowPower` recorded and restored, plus `attachAllEnemyMixers` reached from an `else`. Reduced motion's fix lives in a different function with no shadow half, so widening that check would either weaken its shadow assertions or make one check's failure ambiguous across two unrelated channels.

**X-2 adds `enemy-reducedmotion-recovers`**, asserting on the principle D39's guard established — on the **assignments and the wiring**, never on token presence, since `bodyOf()` returns explanatory comments that necessarily name the identifiers. It must fail on: the listener removed from `CTD3Ui`; the `game.js` subscription removed; the re-attach half deleted while the release half remains; and the media-query source dropped. Mutation-tested, all red.

**Implementation note, so it is not discovered at the keyboard:** `sim-harness.cjs` today reads `scene.js`, `assets.js`, `entities.js` and `MANIFEST.json` — it has **never opened `ui.js` or `game.js`**. Two of the four mutations above live in those files, so this check adds two new source readers. That is expected and is part of the chunk, not scope creep.

---

## D45 — The criteria that decide `drake`-in-endless. This ADR does NOT decide inclusion; X-1 does, and records the verdict here.

ADR-040 D32 excluded `drake` from endless as the zero-work default and named ADR-038 T-1 as the decision point, with a "named unblock" requiring its own decision. This is that decision's **criteria**, written before the sweep so the sweep cannot be read backwards into a justification.

### The mechanism, stated for what it does and does not prove

Armor is multiplicative mitigation (`entities.js` reduces **physical only**, by `1 − armor`) and `ENDLESS_GROWTH` is multiplicative HP growth, so the ranger-vs-mage efficiency *ratio* against a drake is **invariant in wave index**: Ranger T3's 0.268 DPS/gold falls to 0.147 behind 0.45 armor against Mage T3's 0.148, and both sides scale identically with `hpScale(i)`. Targeting is not a wall either — `ranger` and `mage` are both `targets: 'all'`, only `catapult` is ground-only, and all three scripted policies build rangers.

**What that rules out is narrow, and overstating it would be the error.** It rules out a *discontinuity* — a wave index where physical damage abruptly stops working. It does **not** rule out a wall: a constant 0.55× handicap under exponential HP growth is a **constant offset in wave index** of `log 0.55 / log 1.15 ≈ 4.3 waves`, and a physical-only arm dying ~4 waves earlier is exactly what C1 is measuring. The lemma is recorded so C1 is read as measuring depth, not hunting for a cliff.

**Two facts that bound the novelty claim**, recorded so a YES is not oversold: `shielded` at armor **0.65** is already in the endless pool and is a *harder* physical wall than the drake's 0.45; and the drake's genuinely new property against that pool is **flying + armored**, which is the axis `catapult` cannot answer.

### C1 — mandatory-Mage wall

Compare endless run depth for the physical-only arms (`greedy-cheapest`, `ranger-heavy`) against the magic-carrying arm (`balanced`), **with drakes in the templates versus without**, over the same seeds and maps. **Fails inclusion if** the drake widens the depth gap between the physical-only arms and `balanced` beyond the gap measured without it, by more than the run-to-run spread across seeds. A composition that makes Mage *better* is the intent (ADR-040 D29); one that makes Mage *required* is the wall.

**A confound X-1 must report rather than average away.** `balanced`'s composition is `['ranger','catapult','ranger','warden','mage','ranger','catapult']` — **2 of its 7 slots are catapults**, which cannot acquire a flyer at all. So drakes simultaneously *reward* `balanced`'s mage and *penalise* two of its seven towers, while the physical-only arms take a clean 0.55× hit. The two effects push the gap statistic in **opposite** directions, and the direction of the error is the unsafe one: a genuine wall can cancel to a null result and read as a pass. **C1 therefore requires per-arm depth deltas to be reported, not only the gap**, so a cancellation is visible as two large opposite movements rather than as a small number.

**Ordering, stated because it is backwards if left implicit.** C1 needs a *paired* sweep, so a candidate drake template must exist **before** the verdict. X-1 authors it as a **local, uncommitted experiment**, measures both arms, and commits the template **only** on a YES. On a NO, `endless.js` sees no template edit and T-1 stays the constants-only pass ADR-038 §7 briefs. ADR-040 D32's named unblock already sanctions "an `endless.js` template edit plus an endless-CSV re-baseline" for a YES, so neither outcome needs a further amendment.

### C2 — the dominance margin

Inclusion must leave X-1's calibrated **≤15 % dominance margin** holding, **measured after inclusion** rather than assumed from before it. Stated precisely, because the margin is defined on a different axis from C1's: ADR-038 §7 T-1 defines it over the **banking / early-call** policies against `balanced` — *"neither an always-bank nor an always-call-early policy may run more than 15 % deeper than the balanced one"* — not over the build arms C1 ranges across. If admitting the drake moves either of those policy poles outside the margin, the type's admission is what moved it and inclusion fails.

### C3 — the ceiling

`endless-spawn-bound` (≤35 effective spawns) stays green on the post-inclusion templates. **Recorded as a floor, not a test.** That check runs a single seed (`SEED = 7`) against a shuffled-bag template selection, so a new drake template need never be drawn into a measured wave; and `drake` has no `splitsInto`, so the "split children walked" arithmetic the check exists for is inert on it. To make C3 discriminating rather than ceremonial, X-1 evaluates the ceiling **on waves that actually contain the drake**, across the seeds C1 already sweeps.

### Consequences either way

**A YES** costs an `endless.js` template-list edit **plus** an endless-CSV re-baseline — D32 verified the CSVs are byte-identical only *because* the drake is unreferenced. Both land inside X-1's own commit.

**A NO** leaves `endless.js` untouched on this axis, and D32's exclusion stands with a measured reason instead of a zero-work default — strictly better than today regardless of direction.

**X-1 appends its verdict, with the measured figures, as a dated `## Addendum` to THIS ADR.**

---

## Consequences

- One readability row stays open, deliberately, with its real exposure stated (half the bodies of tidewater w7) and the option that closes it named and costed rather than improvised at a gate.
- The claim that `mini_slime` had two independent failing axes is retired; the record now says one property measured twice.
- Reduced motion and low power become the same shape, which is the property that makes the next gate on either of them meaningful.
- `drake`-in-endless stops being a question nobody owns and becomes a verdict X-1 must record either way.

## What this ADR deliberately leaves alone

- **The models.** ADR-034 Decision C as extended by ADR-039 D23 — untouched, and not routed around.
- **The instrument.** No change to D34's three-pass method or to D37's thresholds, in either direction.
- **Campaign balance.** ADR-038 D18 is absolute for the whole of this sprint. Nothing above edits a wave, a reward, an `ENEMIES` stat or a star threshold.
- **The ghost's D36 residual** — whether it reads as *spectral* at 0.78 rather than as a dark solid. It is an operator-eye question, made fresher by X-3 restoring the float, and no machine measurement in this repo can answer it.
