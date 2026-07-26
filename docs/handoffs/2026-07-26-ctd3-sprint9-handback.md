# CTD3 Sprint 9 — hand-back

**Date:** 2026-07-26
**Dispatch:** Sprint 9 — the roster-polish sprint. Headline: READABILITY.
**Design record:** [ADR-041](../adr/041-ctd3-roster-readability-figure-ground-and-flyer-legibility.md)
**HEAD at dispatch:** `78fca64` — matched the brief exactly. **Ends at** `ec3aa8d` + this note.

**Headline: the ghost is fixed, measured, on all three maps it appears on — and the lever that fixed it is not the one the ADR designed.** The sprint's own measurement retired a rim light as inert, contradicted a third of its own premise, and caught a regression that never existed.

---

## Gate states, first

| Gate | State | Evidence |
|---|---|---|
| **Playtest note (gates P-5)** | **UNMET** | `docs/handoffs/` and all of `docs/` contain **no file matching `*playtest*`**. ADR-039 D22's exit condition is unmet, so **P-5 is NOT-ATTEMPTED** and the four Rodin GLBs remain on disk, ledgered honestly. Fourth sprint running. |
| **"include s1" (gates P-4)** | **NOT APPENDED** | The dispatch's operator preflight *asked* for it; it was not appended below the paste. **P-4 NOT-ATTEMPTED.** `maps.js buildSlots` untouched; the six-map `map-rules-test` baseline is not re-pinned. Third offer. |
| **Unpushed** | **9 → 13 commits** | 9 were queued at dispatch; this sprint added 4. **Nothing was pushed**, per the brief. |
| **Browser / measurement** | **AVAILABLE** | `:3030` was serving but **without `Cache-Control: no-store`**, so per the dispatch a no-store server was started on **`:3031`** and used throughout. Chrome on `:9222` reachable. The degrade path was not taken. |

---

## Progress

| # | Chunk | State | Commit |
|---|---|---|---|
| P-0 | ADR-041 + the measurement, actually run | **LANDED** | `510bdd8` |
| P-1 | Figure-ground surround | **LANDED-WITH-RESIDUAL** | `bd17345` |
| P-2 | Flyer discs + low-power recovery | **LANDED** | `ec3aa8d` |
| P-3 | Harness hygiene twofer | **LANDED** | `80bd98e` |
| P-4 | Plains s1 rider | NOT-ATTEMPTED (unauthorised) | — |
| P-5 | Rodin GLB retirement | NOT-ATTEMPTED (playtest note absent) | — |
| — | This hand-back | **LANDED** | *(this commit)* |

**P-1's classification is a judgement call and is flagged as such.** A strict reading of the dispatch's gate — *"threshold met for ghost, slime **and** mini_slime"* — makes it FAILED-OUT, because `mini_slime` misses on tidewater. It is recorded as LANDED-WITH-RESIDUAL instead: the change closes the sprint's headline defect with zero regressions, ADR-041 D41 predicted this exact shortfall *in advance*, and the missing type has no sanctioned instrument. **Discarding a verified fix over one type on one map would have been the worse trade — but the operator may disagree, and the numbers to re-decide are all below.**

---

## The measurement — method, and how to re-run it

**The obvious route fails silently, and this was confirmed before anything was built on it.** `renderer.js` builds its `WebGLRenderer` **without `preserveDrawingBuffer`**, so a `readPixels` outside the rAF callback reads a composited-away buffer: it returns transparent black, **does not throw**, and yields plausible scalars. Measured: a naive read gave an all-zero patch (channel sum **0**); the same frame via the working idiom gave **31,660**.

**Working idiom:** ONE synchronous `evaluate_script` that calls `CTD3Renderer.renderFrame(CTD3Scene.getScene())` and reads pixels in the **same task**, computes statistics in-page, returns scalars only. Project against `canvas.width/height` (DPR-scaled), not `clientWidth/Height`.

**Metric of record: CIE Lab ΔE76 between a creep's matted pixels and the surround immediately behind it**, median over the creep's whole transit.

Getting there took five versions, and the failures are the useful part:

- **v1–v3 measured LUMINANCE and did not discriminate.** They scored `slime` *better* than every legible type and ranked `heavy` worst. The axis is **hue**: the ghost renders green because `scene.js` drew it at `opacity 0.55` and the field blends *through* it.
- **v4 got the axis right and the sampler wrong** — an ellipse inscribed in the projected AABB was 57–80% background. It made all three flyers look like the worst rows; that **reversed** for skirmisher (6.5→32.4) and drake (7.3→34.4) once fixed.
- **v5 (adopted):** render twice in one task — normally, then with every enemy `visible = false` — and difference. The changed pixels *are* the creep, exactly, including rim pixels and the ghost's translucent blend.

**Two instrument defects were found and fixed mid-sprint, and both would have corrupted the result:**

1. **The instrument was tripping the game's own auto-low-power.** Two full-canvas readbacks per frame (~15 MB) pushed frame time past `renderer.js`'s 33 ms trigger; low power engaged mid-collection, shedding shadows and mixers, and the aggregator never reported it. Fixed by reading back only the **union rect** of live creeps, forcing low power off, and neutering `trackFrame` during collection.
2. **`fill` and `Lab_surround` had to be reported**, because raising the ghost's alpha could enlarge the matte and inflate ΔE by moving edge pixels from surround into figure. Reported: the ghost's matte is **flat to within 0.006** on all three maps and its surround shift is **smaller than or equal to** its cohort's. The bias did not materialise.

**Reproducibility:** two independent lever-off runs of forest w6 agree to **0.3% (ghost), 0.4% (runner), 1.1% (heavy)**. Riverbend's ghost spreads ~2%. **`drake` is the outlier at ±7%** — riverbend fields only ~6 of them and it is the largest, most irregular silhouette.

**Limitation, stated:** the readback is **structurally pre-vignette** — `#vignette` is a CSS layer *above* the canvas and can never be in the drawing buffer. Samples are also restricted to a 240 px centre band. **This describes the most favourable region of the frame.**

---

## Before / after, by the method above

Hardened instrument; BEFORE = lever off, AFTER = shipped build. **All ΔE_body medians.**

| Map | Type | BEFORE | AFTER | Δ |
|---|---|---|---|---|
| forest | **ghost** | 23.46 | **31.32** | **+7.86 (+33.5%)** |
| snowfall_pass | **ghost** | 24.59 | **33.08** | **+8.49 (+34.5%)** |
| riverbend | **ghost** | 21.97 | **29.40** | **+7.43 (+33.8%)** |
| tidewater | **slime** | 30.92 | 30.98 | +0.2% |
| forest | **slime** | 39.18 | *(unchanged by construction)* | — |
| tidewater | **mini_slime** | 26.37 | 26.13 | −0.9% |
| forest | **mini_slime** | **37.10** | *(unchanged by construction)* | — |
| forest | runner *(ref)* | 33.66 | 32.65 | −3.0% |
| forest | heavy *(ref)* | 30.81 | 30.93 | +0.4% |
| tidewater | shielded *(ref)* | 35.61 | 35.96 | +1.0% |
| snowfall_pass | skirmisher *(ref)* | 30.70 | 30.34 | −1.2% |
| riverbend | skirmisher *(ref)* | 28.52 | 27.61 | −3.2% |
| riverbend | drake *(ref)* | 23.77 | 23.50 | −1.1% |

The shipped build differs from baseline **only** in ghost material opacity, so no non-ghost type *can* move; measured on four maps anyway as a check of that argument, and every reference type came back within ±3.2%.

**Gate verdict** (T2 ≥ 28.0; T1 = 0.80 × lever-off cohort): **ghost PASSES on forest, snowfall_pass and riverbend. slime passes on both its maps. `mini_slime` on tidewater FAILS (26.13 vs T1 28.49).** Non-regression clause passes, worst case 96.8%.

**`mini_slime`'s diagnosis is now sharp: the gap is SIZE, not colour.** It and `slime` are the *same model and material* on the same map, differing only in scale (0.394 vs 0.262 → 38×52 px vs 26×34 px), and they measure 30.98 vs 26.13. **No surround lever can close that.** Inventing one at the gate is the failure mode ADR-041 D37 exists to prevent, so it was not attempted.

### Three findings worth more than the numbers

1. **The rim light was built, measured, and REMOVED.** ADR-041 D36(a)'s warm kicker `DirectionalLight` moved the metric by **~0.25 ΔE** — inside noise and not consistently signed — while the ghost's alpha moved it **~+8**. Shipping a second light that measurably does nothing would have bought a per-frame cost, a tower-cone re-neon risk and an ADR-034 Group 2 amendment for nothing. **Consequence: `lighting.js` is untouched, no Group-2-owned value moved, and ADR-041's `Amends:` header is VOID** — recorded in its addendum rather than by rewriting the body.
2. **A regression that never existed.** The first lever-on riverbend run showed `drake` falling 25.47 → 21.94 (−13.9%), breaching the non-regression clause — with a plausible AgX-desaturation story ready. Two checks killed it: dropping rim intensity 0.55 → 0.36 moved the drake by **0.07** (no dose-response), and a second lever-**off** baseline read **22.07**, bracketing both lever-on readings. **My explanation was wrong and the reading was noise.** Had it been trusted, the sprint would have withdrawn its lever over a phantom.
3. **One third of the sprint's premise did not survive measurement.** The Sprint-7 caveat named the ghost *and both slimes*. `slime` measures at 92–119% of its cohort — level with or better than types nobody has complained about. **The "both slimes are olive-green" half is not reproduced at true gameplay camera**, and no fix was shipped for it.

---

## Leak gate, harness, and Group-2

**Leak gate (the Sprint-6 idiom).** P-1: `memory.geometries` **flat at 176, delta 0 across 320 rendered frames** after clear; `programs.length` constant at 12; `memory.textures` delta 0. P-2 (discs allocating per flyer per frame): geometry tracks live-enemy count (100–104 as enemies went 6→10) and returns **flat at 76, delta 0 across 320 frames** after clear — bounded, not the monotonic +3/frame climb a decal leak produces. Zero console errors and warnings throughout.

**Harness trajectory: 97 → 105 (P-3) → 107 (P-2) pass, 0 fail, 0 known-fail.** `map-rules-test.cjs` 44 pass, unchanged. Every new check mutation-tested to fail loudly — ten mutations across the two chunks, including an **empty else-branch** that an earlier regex false-passed.

**`enemy-lowpower-releases-mixers` was NOT amended.** The dispatch sanctioned re-specifying it if the decision dropped the outright mixer release; it did not — release on trip is retained and re-attachment added on clear. **The sanction is unused, not spent.**

**Did any ADR-034 Group-2 value move?** **No.** The rim light would have moved `lighting.js` `PRESETS`; it was removed, so background, fog, ground plane, AO disc, fireflies, tone mapping, Warden colour and the CSS overlay are all untouched and stay exact-hex. Recorded in ADR-041's addendum §A3.

**Reviews.** Four fresh-context adversarial reviews: one design review on the ADR (**11 majors**, all fixed — the largest being that T1's parity denominator was re-measured in the build under test, so a scene-wide lever chased its own tail and the one row that clause decides was unreachable), and one diff review per chunk (**4 majors** on P-1, **2** on P-3, **0** on P-2). All majors fixed before commit. P-3's majors dissolved a DRY violation: `waveStats` is now derived from `waveStatsByType` — one walk — after the review demonstrated the cross-check guarding the duplicate was worthless.

---

## Deferred items

### schedule-now (operator only)

| Item | Why |
|---|---|
| **Deploy the 13-commit queue** | Players are three sprints behind and still see the UFO roster. Purge list: the ten GLBs incl. `enemy_drake2.glb`, `MANIFEST.json`, and the changed game JS — **plus `assets.js` this sprint**. Not `tools/curves/*.csv` (Node-only). |
| **Playtest (~10 min)** | Still the only settle for feel, still ADR-039 D22's exit condition, still the unblock for P-5. Fourth sprint unmet. **Now also the cheapest way to answer the one question this sprint could not:** does the ghost still read as *spectral* at 0.78, or merely as a dark solid? |
| **Firebase visit** (`ctd3-scores` rules + one community map) | Fifth sprint carried. Untouched again. |
| **Authorise or drop the Plains s1 rider** | Offered three times now. One line in `maps.js buildSlots` + a re-pin. |

### fold-into-next-sprint

- **`mini_slime` on tidewater** — 26.13 vs 28.49. The gap is **size**, so the instruments are a scale change, an outline, or a size-aware disc; **none is decided**, and ADR-041 D41 says so. This is what still blocks retiring ADR-040's anchor rule.
- **D36's human visual confirmation** — partially performed and carried as an open residual (ADR-041 §A6). One screenshot, six clean map loads, zero console errors — but **no six-map screenshot pass and no `/frontend-design` critique**. It is explicitly allowed to fail a numerically-passing build, and the ghost's alpha can still move inside its 0.70–0.85 band.
- **`drake` sits below T2's 28.0 floor** (23.77 baseline). ADR-041 D37 refuses to re-derive the floor downward to absorb it; whether this is a real drake readability finding or an artifact of its ±7% variance is open.
- **Reduced motion has the same one-way defect low power just had** — `mixersAllowed()` denies a mixer to anything spawned while it holds, and toggling it off never re-attaches. **Now a one-line fix**, since `attachAllEnemyMixers()` exists.
- **Disc-on-disc overlap** — accepted and recorded in-source with reasoning; two discs blend 0.30 → ~0.51, three → ~0.66. Snowfall w7's 17 ghosts bunch at corners. Revisit if a wave reads as a dark blob.
- **A pooled decal rebuild** — the discs add ~23 alloc/dispose pairs per frame on snowfall w7, in the mode entered *because* frames are slow. The same follow-up ADR-037 H-1 declined.
- **Death animations** — prerequisite named and still absent: a **despawn-*reason* channel** from engine to scene. Plus a dying-node registry would be teardown site #3.
- **Enemy icons, footstep audio** — unchanged, both recorded out of scope in ADR-041 D40.
- **Snowfall's map palette** — its cohort separates almost entirely on lightness (Δa\* +3.4 vs +15–27 elsewhere). Carried since Sprint 6.
- **ADR-038 T-1..T-10**, **tower-depth D20** — untouched.

### drop-with-reason

- **A fix for `slime`'s figure-ground** — measured fine (92–119% of cohort). Shipping one would be treating an unmeasured caveat as a defect.
- **The warm rim light** — measured inert (~0.25 ΔE). It may still help perceptually in ways a mass statistic cannot see; carried as an idea, not a feature.
- **Re-deriving T2's floor downward** to pass `mini_slime` by arithmetic — ADR-041 D37 forecloses it.

---

## Known-unknowns

1. **Whether the ghost still reads as a GHOST.** The numbers say it separates from the field; nothing verifies it still reads as spectral rather than as a dark solid. This is the residual above and the single best use of ten minutes of play.
2. **Whether the fix holds on a real device and in other browsers.** Chrome only, one machine. `renderer.info` is a three.js counter so measurement risk is low; the *visual* result is unverified elsewhere.
3. **Whether the pre-vignette, centre-band measurement matches what a player sees.** Structural limitation of any readPixels method — the vignette is CSS above the canvas. Edge-of-frame readability is uncovered.
4. **fps.** The debug Chrome ran ~38 tabs including video. It reported 60 fps · 16.7 ms during the final passes, but it also collapsed to ~1 fps mid-session under my own instrument's load. **No fps or performance claim is made by this sprint**, per the dispatch's standing environment note.
5. **`drake`'s ±7% measurement variance** — low individual counts and a wing-shaped silhouette. Any future delta on drake needs repeat runs before it is believed.
6. **Standing operator items:** playtest, Firebase, real-phone, NVDA/VoiceOver, real-iOS HUD, Firefox/Safari.

**Housekeeping:** the debug profile's `localStorage` seeds (`ctd3:scores`, `ctd3:tutorialSeen`, and the instrument source) were **removed** at the end of the pass; the origin was `localhost:3031`, distinct from the `:3030` dev server and from `chases.house`, so no real profile state was ever in scope. The uncommitted `.gitignore` operator edit was left **entirely untouched** and is still the only thing in the working tree.

---

## Next dispatch

**ADR-038 T-1, the endless calibration** — it is the largest untouched block, it owns the drake-in-endless question ADR-040 D32 deferred to it, and it needs no operator gate. The roster-polish cluster is now down to one type on one map with no decided instrument, which is a *decision* to make in an ADR rather than a sprint's worth of work; fold `mini_slime`, the reduced-motion one-way defect and the visual confirmation into that sprint's edges rather than dispatching a Sprint 10 for them.
