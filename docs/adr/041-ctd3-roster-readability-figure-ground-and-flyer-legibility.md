# ADR-041 — CTD3 roster readability: figure-ground, flyer legibility, low-power recovery

**Date:** 2026-07-26
**Status:** Accepted
**Amends:** [ADR-034](034-ctd3-ui-ux-remediation-v2.md) **Group 2** acceptance — the `lighting.js` `PRESETS` exact-hex assertion and the DirectionalLight-delta assertion, both superseded by **D36** below. No other Group-2-owned value moves.
**Explicitly does NOT amend:** ADR-034 **Decision C** (kit-asset immutability) as extended by [ADR-039](039-ctd3-cc0-asset-expansion-policy-and-monster-suite.md) **D23**. The models are not touched, and that constraint is the premise of this ADR rather than an obstacle it routes around.
**Relates to:** ADR-030 (decal layering), ADR-037 (decal disposal contract), ADR-039 (D27 skinned-enemy lifecycle), [ADR-040](040-ctd3-campaign-wave-re-imagining.md) (D28 figure-ground anchor rule — **D41** states what retires it)

Design record for **Sprint 9 — the roster-polish sprint**. The monster roster is animated and correct; this ADR is about whether a player can *read* it.

**Chunk identifiers used below.** This ADR gates a four-chunk sprint and names the chunks, so the identifiers are defined here rather than living only in a dispatch brief:
**P-0** this ADR · **P-1** the figure-ground surround (implements D36, gated on D37) · **P-2** flyer discs + low-power recovery (implements D38, D39) · **P-3** harness hygiene (encodes ADR-040 D28 as a check, per D41).

---

## Context

The Sprint-7 hand-back closed with an open caveat, restated by ADR-040 D28 as a real constraint: the **ghost is near-black** and **both slimes are olive-green**, sitting close in value to the dark-green decorated field, and the outgoing Kenney meshes were light grey and popped. ADR-040 wrote its anchor rule against that caveat *by name* and intensified the underlying risk — Snowfall w7 now fields **17 ghosts**, more than any wave carried before ADR-040's rewrite.

The sanctioned lever is the **surround**, not the assets: ADR-034 Decision C as extended by ADR-039 D23 forbids retinting the models, deliberately, so this debate does not reopen. That is not negotiated here.

**What was missing was a number.** "Reads better" is unfalsifiable, and this cadence does not ship unfalsifiable claims. But a method that has never produced a number must not be frozen into an ADR that gates implementation either. So this ADR was written *after* running its own measurement against the current build, and the baselines below are real readings.

---

## D34 — The measurement. Perceptual colour difference (CIE Lab ΔE) between a creep's matted pixels and the surround immediately behind it.

### Why the obvious route fails silently

`renderer.js` constructs its `WebGLRenderer` **without `preserveDrawingBuffer`**. An `evaluate_script` call that reads pixels outside the rAF callback therefore reads a composited-away buffer: `toDataURL()` and `gl.readPixels()` return transparent black, **do not throw**, and yield plausible-looking scalars. Confirmed empirically before anything was built on it — a naive read returned an all-zero 10×10 patch (channel sum 0) while the working idiom returned real pixels (sum 31,660) on the identical frame.

**The working idiom:** ONE synchronous `evaluate_script` that calls
`window.CTD3Renderer.renderFrame(window.CTD3Scene.getScene())` and reads pixels in the **same task**, computes all statistics in-page, and returns **scalars only**. World→pixel projection is against `canvas.width/height` — the DPR-scaled dimensions `setSize` writes — not `clientWidth/Height`.

### The statistic, and the four rejected versions that got it there

| Version | Statistic | Why rejected |
|---|---|---|
| v1 | WCAG contrast ratio, body centre-disc vs wide surround median | Did not discriminate. Forest: ghost 1.57, runner 1.74, footman 1.72 — and **slime 2.51, better than every legible type**. |
| v2 | Low percentiles of per-surround-pixel contrast | Worse: ghost 1.241 vs runner 1.241, identical to three decimals. |
| v3 | Silhouette-weighted luminance contrast (p75 per figure pixel) | Ranked a *legible* type worst: ghost 2.06, runner 2.20, heavy 1.76. |
| v4 | CIE Lab ΔE76, ellipse-sampled body vs surround | Right axis, broken sampler — see below. |
| **v5** | **CIE Lab ΔE76, matte-sampled body vs surround** | **Adopted.** |

**Why luminance was the wrong axis.** *Every* creep in this roster renders darker than the field, and the at-risk types are not unusually dark. The axis that separates them is **hue**. The ghost renders **green** — `scene.js` draws it at `opacity 0.55`, so the green field blends *through* its body. Footman, runner, shielded, skirmisher and drake render warm against green ground and separate by hue at similar lightness. In Lab terms the discriminator is **a\*** (green↔red): on forest the ghost sits at Δa\* **+4.9** where the reference cohort sits at **+15.2 to +21.5**.

**Why v4's sampler was wrong, which mattered as much as the axis.** v4 approximated a creep by an ellipse inscribed in its projected AABB. The pixels reported the problem: the same creep gave ΔE_body ≈ 8 and ΔE_p75 ≈ 23, only possible if most of the "figure" sample was **background showing through the ellipse**. Contamination was worst on irregular silhouettes, and it produced a false conclusion — under v4 the flying types scored 6–7 and looked like the worst rows in the table. That **reversed** for skirmisher (6.5→32.4) and drake (7.3→34.4) once the sampler was fixed; ghost remained the worst row on its own merits. Had it not been caught, this ADR would have specified a flyer fix for a sampler artifact.

**v5 removes the approximation.** Render the frame **twice in one synchronous task** — once normally (A), once with every enemy node `visible = false` (B) — and difference them. Pixels that changed *are* the creeps, exactly. The measured `fill` (matte ÷ ellipse) runs **0.20–0.43**, quantifying v4's contamination. The ellipse survives only as a spatial gate keeping a creep's own drop-shadow out of its figure sample; the surround band additionally excludes every matte pixel, so neighbouring creeps and cast shadows never enter the ground term.

### Definition of record

Per live enemy, per rendered frame:

- **Figure** = matte pixels (A≠B beyond 6/255 per channel) inside an ellipse of semi-axes 0.50·w, 0.50·h on its projected AABB.
- **Surround** = non-matte pixels in the elliptical band 0.62→1.05 of the same AABB.
- Both averaged in **linear RGB**, converted once to **CIE Lab (D65)**.
- **ΔE_body = ΔE76(Lab_figure, Lab_surround)** — the metric of record.
- Reported per type as the **median of ΔE_body over the creep's whole transit**, collected by an rAF-driven collector so the number describes the route, not one frame.

**Mandatory reporting alongside ΔE:** `n`, **`fill`**, and **Lab_surround**. See the bias note in D37.

**Once D38's flyer discs exist, the surround sample must additionally exclude disc pixels** — a third render pass with `decalsGroup` hidden, differenced the same way. A disc is a `decalsGroup` child, so it appears in *both* A and B and would otherwise be classified as surround directly beneath the flyer it belongs to, moving the very term it sits under. **P-1's measurements predate the discs** (P-2 adds them), so P-1 is unaffected; **D41's re-measurement is not**, and must use the three-pass form.

**Sampling constraints and their limitations.**

- Samples restricted to a **centre band** (240 px inset from every canvas edge).
- **The readback is structurally pre-vignette.** `#vignette` is a CSS layer at `z-index: 1` *above* the canvas; it is never in the WebGL drawing buffer, so no readPixels method can include it. It darkens figure and ground together toward the frame edges, compressing ΔE there. **This measurement describes the most favourable region of the frame**; edge-of-frame readability is not covered. Recorded as a known-unknown, not assumed away.
- Default camera, default zoom, `?test=1` (normal gameplay — the roster and tile-debug branches key on the *value*, only the overlay keys on presence). **Not `?test=roster`**: Sprint 7 established that screen structurally cannot answer this, since it removes every Kenney asset and magnifies 3×.

**Honest note on the ADR-034 precedent.** ADR-034's Group 2 acceptance specified a 9-point HSL grid sample of a *screenshot*. That is precedent for the **shape** of the check, cited as such — **not** for in-page pixel readback, which this sprint establishes for itself, including the `preserveDrawingBuffer` trap a screenshot method never encounters.

**The analytic substitute is inadmissible for the levers chosen here.** It is admissible only when the lever is a ground-plane or lighting-preset *value* change, where both terms are analytically evaluable. D36(a)'s rim light contributes only at grazing silhouette angles and D36(b) is a per-pixel compositing change; an analytic gate would report ≈0 delta for both and fail P-1 on a measurement artifact. **The rendered-pixel method is mandatory.**

---

## D35 — BEFORE baselines, measured. And what they say that the sprint's premise did not.

Method D34 (v5), current build at `78fca64`, `?test=1`, no-store server, hard reload.

| Map | Type | n | **ΔE_body median** | ΔL\* | **Δa\*** | Δb\* | fill |
|---|---|---|---|---|---|---|---|
| forest | **ghost** | 4,500 | **24.37** | −20.5 | **+4.9** | −11.2 | 0.250 |
| forest | **slime** | 1,370 | **39.33** | −32.6 | +13.6 | −16.8 | 0.434 |
| forest | footman *(ref)* | 1,386 | 28.51 | −23.4 | +15.2 | −4.8 | 0.266 |
| forest | runner *(ref)* | 713 | 37.68 | −28.1 | +21.5 | −13.0 | 0.219 |
| tidewater | **slime** | 259 | **31.95** | −27.7 | +11.8 | −11.6 | 0.377 |
| tidewater | **mini_slime** | 209 | **28.32** | −25.6 | **+6.1** | −10.3 | 0.329 |
| tidewater | shielded *(ref)* | 310 | 37.36 | −24.5 | +26.9 | −7.3 | 0.211 |
| tidewater | skirmisher *(n<100, excluded)* | 16 | *32.43* | −21.5 | +22.2 | −8.5 | 0.204 |
| snowfall_pass | **ghost** | 6,350 | **26.54** | −26.1 | **+0.6** | −4.3 | 0.262 |
| snowfall_pass | skirmisher *(ref)* | 984 | 36.46 | −36.0 | +3.4 | −2.0 | 0.206 |
| riverbend | **ghost** | 1,748 | **22.83** | −19.5 | **+3.5** | −10.8 | 0.259 |
| riverbend | skirmisher *(ref)* | 3,155 | 33.67 | −26.1 | +17.2 | −12.2 | 0.205 |
| riverbend | drake *(ref)* | 404 | 34.35 | −20.4 | +27.3 | −5.0 | 0.213 |

Δ columns are **means** of the per-frame deltas while ΔE is a **median**, so `ΔE ≈ √(ΔL²+Δa²+Δb²)` holds only approximately (and the median exceeds the norm-of-means in 11 of 13 rows, as `E‖X‖ ≥ ‖EX‖` predicts).

*mini_slime is measured, not proxied.* It exists only as slime's `splitsInto` child and cannot be spawned directly, so it was reached the honest way — Tidewater w7 (7 slimes) played with a full board of maxed Rangers so the slimes actually died and split.

**Reference cohort — membership rule, stated because the first draft did not have one.** A type qualifies on a map when it (a) is not one of the three at-risk types, (b) appears in the measured wave, and (c) carries **n ≥ 100** samples. Rule (c) excludes tidewater's skirmisher at n=16, which would otherwise have contributed half of a two-member median. `heavy` was on screen in forest w6 but did not clear n≥100 in the v5 pass and is likewise absent; `captain` and `juggernaut` were not fielded in any measured wave. **Two of the four cohorts are consequently single-member** (tidewater, snowfall_pass) — a real weakness of the parity clause, recorded rather than smoothed over.

**Frozen cohort medians:** forest **33.10**, tidewater **37.36**, snowfall_pass **36.46**, riverbend **34.01**.

### Three findings, one of which contradicts the sprint's own premise

1. **The ghost is the real defect, and its cause is nameable.** It is the only type failing to separate on a\* (Δa\* +0.6 to +4.9 against a cohort of +15 to +27), on all three maps it appears on. The cause is not the model: it is `scene.js`'s own `opacity 0.55`, which blends the green field through the body.
2. **`mini_slime` is marginal**, sharing the ghost's signature (Δa\* +6.1), and is the smallest creep on screen (26×34 px).
3. **`slime` measures FINE — the Sprint-7 caveat is not reproduced for it.** At 31.95 and 39.33 it is level with or better than types nobody has complained about. **The "both slimes are olive-green" half of the original observation does not survive measurement at true gameplay camera.** What survives is the ghost, plus a weaker mini_slime case. ADR-040 D28's anchor rule was written over the *unmeasured* version of the caveat — one more reason D41 requires fresh measurement before relaxing it.

---

## D36 — The lever: a warm rim light in the surround, plus the ghost's own alpha. Both are presentation; the models are untouched.

### Rejected

- **A per-creep contact-shadow blob — REJECTED for this purpose, and the data say why.** Every creep already renders *darker* than its surround (ΔL\* −19 to −36 in every row). Darkening the ground around a creep moves the surround **toward** the figure and **reduces** ΔE. A contact shadow is the right instrument for *grounding and depth* — which is what D38 uses it for under flyers — and the wrong one for figure-ground separation here.
- **A ground-palette value shift — REJECTED as unreachable.** The base ground plane (`0x3c5a38`) is Group-2-owned and *invisible during gameplay*: `paintTerrain` sets `ground.visible = false` because the kit-immutable Kenney tile `InstancedMesh` renders on top; the AO disc at y=0.02 is likewise under the tiles. "Ground palette" is reachable only through lighting and fog.
- **A fresnel term via `onBeforeCompile` — REJECTED as too close to the freeze.** Enemy clones share source materials by reference (documented at length in `disposeEnemyNode`), so a material-level shader injection mutates the cached asset for every instance and every future spawn — materially a post-load material edit.

### Decided

**(a) A warm rim/kicker `DirectionalLight`** in `lighting.js`, `castShadow = false`, colour and intensity per phase in `PRESETS`. It rakes across creep silhouettes while contributing only `cos θ` at a grazing angle to flat ground and path tiles, raising the figure term more than the surround term.

*Pinned starting values, so the implementation is not "turn it up until it passes":* azimuth opposite the sun (sun sits at `(8, 14, 6)`; rim at `(-9, 3.5, -7)`), colour `ACCENT_EMBER 0xa06828` family, intensity **prepWave 0.55 / inWave 0.70** (higher in combat, when the sun drops and legibility matters most). Permitted tuning range **0.35–0.95**; anything outside it is a fresh decision, not a tune. The rim **participates in the prepWave→inWave tween** — `applyPreset`/`lerpPreset` enumerate their fields explicitly, so a non-tweened rim would pop, against the Group-2 feature that revived that tween.

**No new hue and no second gold *surface*:** the colour comes from the existing cabin ladder, and this is light, not a material — but see the tower-cone risk below, which is the real cost.

**(b) The ghost's translucency, raised from `opacity 0.55` to a pinned `0.78`** (permitted range 0.70–0.85; at 1.0 the spectral read is lost and the change would no longer be a readability fix). Not a Decision-C violation, for reasons recorded so a future audit does not re-flag it:

- `0.55` is not a property of `enemy_ghost2.glb`. `scene.js` writes it, onto materials `scene.js` **clones per instance** and already owns (`userData.ownedMaterials`) — verified: the clone is unconditional and per-node, so there is **no material-sharing bleed hazard**.
- ADR-034's exclusion reads *"post-load material retinting (HSL clamps or any per-mesh color override **on kit meshes**)"*. Alpha is not colour; no hue, saturation or lightness of the asset's material is overridden.
- The change moves *toward* the model's authored appearance: the ghost's measured green is the **field** showing through, not the ghost.

**`depthWrite` stays `false`.** The same line sets `transparent`, `opacity` and `depthWrite: false`; only opacity changes. At 0.78 the body is still transparent, so `depthWrite: true` would clip the parts behind it and introduce sorting artifacts against the ground disc D38 adds under the same creep. Holding it false keeps the existing (already-accepted) intra-body sort behaviour rather than trading a readability fix for a new sorting bug.

**Scope guard:** `lighting.js` and `scene.js` only. No `ENEMY_VIS` change, no GLB touched, no `entities.js` change, no campaign balance change.

### Risk this lever carries, named with a rollback trigger

A warm low-elevation kicker is precisely the instrument that can **re-add rim energy to the Mage/Warden cone tops** — the "dim plum, not neon" read ADR-034 Group 2 achieved with AgX plus a de-blued hemisphere, and which it asserts as a *manual visual* acceptance criterion. Towers stand further out of the field than any creep and a `DirectionalLight` has no per-object mask.

**Therefore P-1's exit criteria include ADR-034 Group 2's cone-read check**, and **tower re-neon is a named rollback trigger for D36(a)**: if the cones read neon at any intensity that passes D37, the rim light is withdrawn and D36(b) plus a fresh decision carry the sprint.

**P-1 additionally requires a human visual confirmation that is allowed to fail a numerically-passing build** (screenshots at true gameplay camera on all six maps, plus the `/frontend-design` treatment critique the sprint mandates). A numeric gate with a tunable free parameter is satisfiable by tuning; the visual check is what stops that.

### The ADR-034 Group 2 amendment, made deliberately rather than by drift

Adding a light and per-phase preset keys moves **Group-2-owned values**. Superseded by name:

- *"`PRESETS.prepWave` + `PRESETS.inWave` hex codes match spec §B verbatim"* — **superseded.** The six §B values are **unchanged**; the presets gain rim keys alongside them, so the assertion must read "the §B keys match verbatim" rather than "the preset objects contain exactly these keys."
- *"DirectionalLight intensity differs by ≥0.20 between prepWave and inWave"* — **superseded in wording only.** There are now two DirectionalLights; the assertion binds to the **sun**, whose 1.18→0.95 delta is unchanged.

**Everything else Group 2 owns is untouched and stays exact-hex:** `scene.background` `0x1a2a20`, `scene.fog` linear `(0x1a2a20, 26, 58)`, base ground plane `0x3c5a38`, the radial AO disc, the firefly module, `renderer.toneMapping` AgX @ 1.06, `WARDEN_AURA_COLOR` `0x8fc6cf`, **and the `#grounding` / `#vignette` CSS overlay** (named for completeness — the lever does not touch it, and D34 depends on `#vignette` existing).

The ghost's opacity is in `scene.js` but is **not** Group-2-owned — Group 2's list is background, fog, ground plane, AO disc, lighting presets, fireflies, tone mapping, Warden colour and the CSS overlay. It is Sprint-7 presentation.

---

## D37 — The threshold. Parity against a FROZEN baseline cohort, plus an absolute floor derived from it.

An at-risk type **passes** on a map when **both** hold:

- **T1 — parity:** `ΔE_body_median(type, map) ≥ 0.80 × cohort_median_BASELINE(map)`, where the cohort median is the **frozen D35 value**, not a figure re-measured in the build under test.
- **T2 — absolute floor:** `ΔE_body_median(type, map) ≥ 28.0`.

**Why the denominator is frozen — the defect that a review caught in the first draft.** With the cohort re-measured in the same build, T1 becomes a *ratio* between two quantities the lever moves together, and it chases its own tail: a scene-wide rim light lifts the cohort with the at-risk type, so a purely multiplicative lift leaves T1 exactly invariant, and a uniform additive lift Δ would require **Δ ≥ 8.9 ΔE units** before `mini_slime` could pass. The one row T1 actually decides was therefore unreachable by any lever this ADR proposes — while D41 named that row's passing as the sprint's payoff. Freezing the denominator at D35 turns T1 into a fixed per-map target that a surround lever can actually move.

**Non-regression clause, which is what the re-measured cohort is for instead:** in P-1's after-measurement, **no reference-cohort type may fall below 90% of its own D35 baseline**. This is what stops a lever from "passing" by degrading everything else, and it is the correct use of a same-build cohort reading.

**Why two clauses.** A pure absolute floor ignores that map palettes differ legitimately. A pure parity rule is satisfiable by a cohort that is itself bad: if a future map's cohort fell to 10, parity would bless an at-risk type at 8.5. Each covers the other's failure mode. **Honest correction to the first draft's rationale:** snowfall_pass was cited there as the map parity exists to accommodate, and that was backwards — snowfall's cohort is the *highest* of the four (36.46), so parity is *stricter* there, not laxer. **No map measured in D35 exhibits the cohort compression T1 was written to handle**; T1 is a forward-looking guard against a future map or palette change, and is recorded as such rather than as a response to present data.

**Why 0.80, stated as the taste-bounded-by-data that it is.** With the frozen denominators, the six measured ratios are 0.671, 0.728, 0.736, 0.758, 0.855, 1.188. **Any coefficient in (0.758, 0.855] produces the identical verdict table**, so the data constrain the choice only to that band. 0.80 is chosen as **mid-band**, for robustness to per-session noise — 0.85 sits at the band's top edge and would pass `slime`/tidewater by only 0.19 ΔE. T2 is the binding clause on every ghost row; **T1 changes exactly one verdict** (`mini_slime`/tidewater), and that is stated rather than presented as a broadly-discriminating rule.

**Why 28.0.** It is the **weakest measured reference type anywhere** (footman on forest, 28.51) rounded down — *no at-risk type may be less separable than the least separable type nobody has complained about.* Noted honestly: that reference type clears its own map's T1 (26.48) by only 2.03, so the floor rests on a near-miss measurement. **If a cohort member ever fails T2 on its own map, the floor is re-derived in a fresh decision rather than silently lowered.**

**Applied to the baselines — this is the P-1 gate:**

| Type | Map | ΔE now | T1 (0.80×frozen) | T2 | Verdict now | P-1 must gain |
|---|---|---|---|---|---|---|
| ghost | riverbend | 22.83 | ≥ 27.21 | ≥ 28.0 | **FAIL both** | **+5.17** |
| ghost | forest | 24.37 | ≥ 26.48 | ≥ 28.0 | **FAIL both** | **+3.63** |
| ghost | snowfall_pass | 26.54 | ≥ 29.17 | ≥ 28.0 | **FAIL both** | **+2.63** |
| mini_slime | tidewater | 28.32 | ≥ 29.89 | ≥ 28.0 | **FAIL T1** | **+1.57** |
| slime | tidewater | 31.95 | ≥ 29.89 | ≥ 28.0 | PASS | — |
| slime | forest | 39.33 | ≥ 26.48 | ≥ 28.0 | PASS | — |

**Worst map per type:** ghost **riverbend**, mini_slime **tidewater**, slime **tidewater**.

**A measurement bias P-1 must report rather than bank.** D36(b) raises the ghost's alpha, and v5's matte gate (6/255) is **not invariant under that change**: at 0.55 the ghost's thin and edge pixels fall below the gate and are counted as *surround*, pulling the ground term toward the figure. Raising alpha mechanically enlarges the matte and removes those pixels from the surround, so **part of any ghost ΔE gain is a change in which pixels are sampled, not in what a player sees.** P-1 therefore reports `fill` and `Lab_surround` for every type: a ghost `Lab_surround` shift materially larger than the cohort's is recorded as measurement bias, not as gain. The effect is real but bounded, and naming it is the difference between a measured result and a flattering one.

---

## D38 — Flyer ground discs: air/ground legibility that survives low power.

Flyers sit at `baseY 1.2` and their only depth cue is an offset cast shadow — which **vanishes in low power**, precisely when it is most needed. A small filled disc beneath each flying type restores depth and air/ground identity in a layer low power does not shed.

**Applies to all three flying `ENEMIES` types: `skirmisher`, `ghost`, `drake`.**

**Disc elevation — explicitly NOT `GROUND_DECAL_Y`.** `scene.js` records that path **corner** tiles reach **0.296**, above the 0.24 constant, and that the resulting 2–5% clipping is accepted *for a static ring*. That is not acceptable for a filled disc travelling under a flyer, because every campaign path bends repeatedly. The disc is pinned at **`FLYER_DISC_Y = 0.32`** — clearing 0.296 by 0.024, the same order of margin `GROUND_DECAL_Y` takes over the 0.22-tall slot slab.

**It is a named constant, not a call-site literal.** `GROUND_DECAL_Y` exists as a named constant precisely so a buried literal cannot return, and `decal-no-buried-literals` only rejects `y` *below* the clearance — 0.32 would be unguarded in both directions as a bare number. P-2 adds the constant and a harness check that binds the disc to it.

**Radius, colour and opacity:** radius `0.42 × sizeWorld / 0.55` (so the disc scales with the type — skirmisher/ghost 0.55, drake 0.75), colour `TOKENS.BG_DEEP 0x0d1410` at opacity 0.30. A **dark, desaturated** disc, not a coloured one: it must read as a shadow, and the palette discipline D36 argues for would be hollow if this shipped as a new tinted ground surface.

**Layering consequence, stated because it inverts an existing order.** At 0.32 the disc renders **above** the Warden aura (0.24), the slot ring (0.24) and the place-here disc (0.25). Deliberate — the disc must read as attached to the flyer — and the occlusion is transient. Whether it collides with the range circle, slot ring or Warden aura is a **/find-adjacencies** question for P-2: Sprint 5 proved those three mutually exclusive, and a disc under a *moving* enemy is a new participant.

**Correction to a terrain claim the first draft overstated.** `paintTerrain`'s reserved 1-cell halo forces WFC *ground variants* to the flat fallback tile near the path — it does **not** constrain `paintDecorations`, which places hand-authored decorations at their authored coordinates with no halo test on every `augment`/`off` map. The disc's safety does not depend on that claim: at 0.32 the disc clears every **path** surface it travels over, and a decoration tall enough to intersect it (hills 0.57, rocks 0.75, trees 0.96+) would *occlude* the disc rather than submerge it — the same accepted behaviour as every other ground decal.

**Owner — the per-frame `decalsGroup` rebuild in `syncDecals`.** Chosen over a separate registry because it **adds no teardown site**: `syncDecals` already disposes every child before `clear()`, and `decal-dispose-present` guards that path. Sprint 6's leak history is why a third teardown site is a cost.

**Recorded cost of that choice:** `syncDecals` frees and re-allocates a `CircleGeometry` + `MeshBasicMaterial` per decal per frame. Snowfall w7 fields 17 ghosts plus skirmishers, so the discs add up to ~23 alloc/dispose pairs per frame — in the mode entered *because* frames already exceed 33 ms. The ownership choice is right on teardown grounds; the churn is a real cost and a pooled rebuild is the named follow-up.

**It must NOT be disposed inside `disposeEnemyNode`.** Precisely stated: `enemy-no-shared-dispose` fails on `geometry.dispose(` or `.material.dispose(` **inside that function** — it is a *shared-resource* guard, not a blanket one (the function already contains passing `sk.dispose()` and `m.dispose()` calls on per-instance resources). If the disc ever appears to need disposal there, that is evidence the ownership choice was wrong, not that the guard is.

**`syncDecals` runs every frame regardless of low power** — verified: the call chain from `game.js`'s tick is gated on `data-screen` only, with no low-power branch. That is the entire point of the feature and is a named P-2 gate.

---

## D39 — Low-power recovery: TWO one-way defects, both verified in source.

**(i) Mixers are released and never re-attached.** `setLowPowerShadows(on)` calls `releaseAllEnemyMixers()` under `if (on)`; nothing re-attaches on clear. `mixersAllowed()` independently blocks *new* spawns from getting a mixer while low power holds — so **both** the wave alive at the trip **and** everything spawned during low power stay permanently frozen, animated creeps beside frozen ones.

**(ii) `castShadow` is disabled and never restored.** The traversal reads `if (on) o.castShadow = false;` — **no else branch**. `renderer.shadowMap.enabled` *is* restored symmetrically in `renderer.js` `setLowPower` (`= !lowPower`, on both edges), and new enemies get `castShadow = true` in `syncEnemies`, so after recovery only *fresh* creeps cast shadows while every mesh that existed at the trip silently never casts again.

**Decided: restore both, symmetrically.**

- **Shadows restore per-mesh, and only where a value was recorded.** A blanket `o.castShadow = true` on clear would newly enable casting on meshes that never cast (flat decals, AO disc, label planes, fireflies), turning a fix into a regression. The trip traversal records each mesh's prior value in `userData`; the clear traversal restores exactly that and clears the record. **Meshes created *while* low power holds have no recorded value and are left untouched** — towers, upgrades, enemies, decorations, castle and slot slabs can all be created mid-low-power, and `game.js` calls `setLowPower(true)` from saved settings *before* `paintTerrain` ever runs, so on a forced-low-power boot the whole playfield is in that class. Restoring an unrecorded `undefined` would reintroduce the bug being fixed. This is safe because **`renderer.shadowMap.enabled = false` already suppresses all shadow rendering while low power holds** — the per-mesh pass is a cost optimisation, not the visual gate — so a mesh created during low power keeping `castShadow = true` costs nothing until shadows return, which is exactly when it should cast.
- **Mixers re-attach on clear** for every live enemy node lacking one, reusing the *same* clip-resolution logic `syncEnemies` uses. That logic is extracted to one helper and called from **all three** sites — `syncEnemies`, the new re-attach, and `paintRosterDebug`, whose own comment already says *"Mirror `syncEnemies`' fallback EXACTLY"* (repo CLAUDE.md, DRY, highest priority). A second copy of the "never fall back blindly to `clips[0]`, it is `Death` in every model" rule is exactly the divergence that ships a death animation on a walking creep.

**A graded per-Nth-frame mixer curve was considered and rejected as out of scope** — a performance tune, where this is a correctness bug; mixing them makes the fix un-attributable. Carried forward.

**`enemy-lowpower-releases-mixers` is NOT amended.** The dispatch sanctioned re-specifying it if the decision dropped the outright release. It does not: release on trip is retained, re-attachment is added on clear, so the check remains exactly true. The sanction is noted as **unused, not spent**.

---

## D40 — Deliberately out of scope, with reasons.

- **Death animations.** Clips ship in all ten models, so this is code-only — but its prerequisite does not exist: a **despawn-*reason* channel from engine to scene**. The `seen`-set diff knows "gone", not "why", and a creep that leaks into the castle must not play a death animation. It would also require a dying-node registry — **teardown site #3**, against the leak history Sprint 6 exists to close — and slime splits would burst from a still-dying parent.
- **Enemy icons.** Assessed in the Sprint-8 hand-back as a *substitute* for wave-identity labels, not a complement; a HUD decision, not a scene one.
- **Footstep audio.** Newly possible from mixer time, but an audio-palette addition with no readability content.
- **Snowfall_pass's map palette.** Its cohort separates almost entirely on lightness (Δa\* +3.4 against +15 to +27 elsewhere): on that map nothing separates by hue. A map-palette question carried since Sprint 6.
- **A pooled decal rebuild.** Named in D38 as the follow-up to the churn cost that ADR-037 H-1 also declined to take.

---

## D41 — What retires ADR-040's anchor rule.

ADR-040 D28 constrains wave 1 and wave 8 compositions (`ghost`, `slime`, `mini_slime` summed ≤30% of bodies, never the HP lead) and names the surround work as its unblock — but deliberately does **not** pre-authorise relaxation. This ADR supplies the missing number without granting it either.

**The anchor rule may be proposed for relaxation when, and only when:**

> `ghost`, `slime` and `mini_slime` each satisfy **both** T1 and T2 (D37) on **every** map that fields them, measured by D34's method **in its three-pass form** (flyer discs excluded from the surround), in a build **later than** the one that lands the lever.

**Two coverage gaps this ADR does not paper over:**

- **`mini_slime` has no forest baseline.** Forest fields `slime` on w3/w4/w7, so it fields `mini_slime` by splitting; D35 measures it on tidewater only. That baseline must be taken before relaxation.
- **D36's levers are expected to close `ghost`, and `mini_slime` is not certain to follow.** `mini_slime` needs +1.57 and is the smallest creep on screen; if a scene-wide rim light does not carry it, the remaining instrument is a size- or outline-based one, which is **not** decided here. **Relaxation may therefore outlive this sprint**, and saying so now is better than discovering it at the gate.

Relaxation still requires **its own ADR amendment**, and the harness constant P-3 introduces cites this clause as the owner of its threshold, so a future session changes a documented constant rather than fighting an unattributed check.

---

## Consequences

- The threshold is falsifiable and derived from measured data; its parity denominator is frozen so a scene-wide lever cannot chase its own tail, and the coefficient's admissible band is recorded rather than presented as uniquely determined.
- Four failed metric versions and one broken sampler are recorded so they are not re-derived.
- One ADR-034 Group-2 acceptance clause is amended by name, in wording, with every other Group-2 value left exact-hex — and the lever's main risk (tower cone re-neon) carries a named rollback trigger and a visual check that can fail a numerically-passing build.
- **This ADR records that one third of its own premise did not survive measurement** (`slime`), that its metric carries a known bias in favour of the ghost fix, and that the anchor-rule retirement it exists to enable may not complete this sprint.
