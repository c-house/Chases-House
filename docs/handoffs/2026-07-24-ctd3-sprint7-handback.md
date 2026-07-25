# CTD3 Sprint 7 hand-back — the monster-suite import (ADR-039)

**Date:** 2026-07-24
**Dispatched at:** `abbeeb1` · **Ends at:** `c562919` + this hand-back · **5 commits** (4 chunks + this doc)
**Sprint shape:** the first chunk of the operator's re-sequenced cycle 3 — CC0 monster assets land first, the campaign wave re-imagining follows in the next dispatch. One new ADR, one asset import, one infrastructure chunk, one visual-gate chunk.

**Headline: the enemies are animated, and two defects that would have been the first things you noticed were caught before they shipped.** The roster is nine CC0 Quaternius models covering all ten enemy types, skinned and skeletally animated, with a disposal contract measured live — every one of ~119 per-instance bone textures is freed on wave-clear, and `renderer.info.memory.geometries` holds flat at delta 0 across 320 rendered frames. Along the way: the creeps were walking **sideways** (a forward-axis mismatch between Quaternius's +Z and Kenney's −X, measured at exactly 90° and now 0°), and my own skeleton-sharing optimization would have rendered the footman's sword at 2.5×, the boss's mushroom at 2.57×, and the slime's **body** at 0.37× with full-size eyes. **Zero data changes: ADR-038 D18 is intact.**

---

## Progress

### Per chunk

| Chunk | State | Hash |
|---|---|---|
| **M-0** — ADR-039: CC0 asset expansion policy + monster suite (S–M) | **LANDED** | `025429f` |
| **M-1** — import pipeline + provenance ledger (M) | **LANDED** | `8bebcd4` |
| **M-2** — skinned-enemy animation infrastructure with disposal (M–L) | **LANDED-WITH-RESIDUAL** (fps half of the gate unverified — environment) | `4e95e6a` |
| **M-3** — roster visual swap / `?test=roster` gate (M) | **LANDED** | `c562919` |
| **M-4** — Plains s1 slot pass (S) | **NOT AUTHORIZED** — the dispatch required the operator to append "include M-4"; it was not appended. Not attempted, consumes nothing. | — |

No chunk reached FAILED-OUT. The ladder never engaged: both MAJOR-bearing reviews were resolved in one fix round each.

### Staleness checks (all verified live at `abbeeb1`)

- **M-0** — no `docs/adr/039-*`; 039 was the next free number. Implemented fresh.
- **M-1** — no Quaternius entries in `assets/LICENSE.txt`; no `enemy_*2.glb` on disk. Fresh.
- **M-2** — no `SkeletonUtils` or `AnimationMixer` anywhere in `assets.js`/`scene.js`; enemies were `cache.get(id).clone(true)` with a procedural sine bob. Fresh.
- **M-3** — enemy factory still resolved `enemy_${en.type}` to the old static GLBs. Fresh.
- **M-4** — not probed beyond confirming authorization was absent.

### Asset ledger summary

| | |
|---|---|
| Models imported | **9**, covering **10** enemy types (slime + mini_slime share one model at two scales) |
| Total bytes added | **1,987,932 B (1.90 MB)** against ADR-039 D25's ~12 MB ceiling |
| Per-model budget | 8 of 9 under the ~300 KB soft budget; **`enemy_footman2` at 313 KB (+4.35%)**, recorded not hidden — 10 materials, each staying its own primitive because materials are untouched |
| Bytes *removed* from the download path | **760,528 B** — the ten superseded manifest entries were dropped, since `preload()` background-fetches every manifest mesh and the page was fetching both rosters |
| Net page-weight change | **+1.23 MB** |
| Source route used | **the poly.pizza CC0 mirror — the sanctioned FALLBACK.** The primary route failed: Quaternius' download button resolves to a Google Drive folder that returned "Quota exceeded" on every per-file endpoint (`drive.google.com/uc`, `drive.usercontent.google.com/download`, with and without a browser UA). The folder *structure* did enumerate via `embeddedfolderview` (`Big/ Blob/ Flying/`, each with `glTF/`), so pack contents and the CC0 grant were read off the source of record even though the bytes came from the mirror. Per-file `publicID` + `ResourceID` + SHA-256 (source and output) are in the ledger so a re-import is reproducible. |
| Licence verification | CC0 confirmed two ways per model — the pack page, and each model's own page `Licence` field. The ledger states plainly that this is *corroboration, not a byte-level chain* to the Drive copy, since the Drive bytes were never obtainable. |
| Selection method | mapped by role/silhouette, then **fingerprinted** (armature name, clip set, node count, mesh names) to confirm Ultimate Monsters membership rather than trusting the title. That check **rejected** one superficially-matching "Demon" belonging to a different Quaternius pack. |
| Provenance debt cleared | the four previously-unmapped GLBs are now ledgered as **Hyper3D Rodin generations, NOT CC0** — evidenced from the bytes (generator `Khronos glTF Blender I/O v5.1.19`, mesh names `RODIN_Juggernaut` / `RODIN_Slime` / `RODIN_Slime.002` / `RODIN_Ghost`) versus `UnityGLTF` + `enemy-ufo-*` for the six Kenney ones. `LICENSE.txt`'s false blanket-CC0 opening line is corrected. |

**Security scan (operator-requested mid-sprint):** every downloaded binary was scanned with Windows Defender in the scratchpad **before** entering the repo, and again after optimization rewrote the bytes — 15 raw downloads + 9 optimized files, **no threats**, exit 0, signature age 0 days. Separately, all nine were run through the official **glTF-Validator**: it caught a real spec violation my pruning had introduced (`SKIN_SKELETON_INVALID` — `skin.skeleton` left pointing at a node that was no longer a common root), which is fixed by unsetting the field (an optional hint; three.js builds its Skeleton from `joints`). **All nine now validate at 0 errors.**

### M-2 leak-gate numbers

In-browser, debug Chrome on `:9222`, no-store server on **`:3031`** (`:3030` was not serving; `Cache-Control: no-store` verified by `curl`), hard reload before every verdict.

| Metric | Idle baseline | With wave live | After clear, 320 rendered frames |
|---|---|---|---|
| `memory.geometries` | 44 | 49–68 | **min = max = 61, delta 0 — FLAT** |
| `programs.length` | 8 | 9–10 | **constant 10** (r0.170 exposes no materials counter) |
| `memory.textures` | **19** | 55–138 | **min = max = 19, delta 0 — returned exactly to baseline** |

The textures row is the substantive evidence: three.js allocates a **bone texture per Skeleton**, so a live wave stood at up to 138 and every one of the ~119 per-instance textures was freed on despawn. Geometries settling at 61 rather than 44 is **correct, not a leak** — those are the shared, cache-owned primitives of the enemy types that appeared; they are bounded by the asset set (measured plateau: 194 after visiting all six maps) and must never be disposed, since clones share them by reference.

**Skeleton cost, before and after the review fix:** `SkeletonUtils.clone` creates one Skeleton *per SkinnedMesh*, so the roster was allocating **54** skeletons (11 for the footman alone). Deduping to one per **source skin** brings that to **12** — a ~4.5× cut in per-frame bone-texture uploads — while keeping every mesh's own bind matrices (verified: bind-matrix delta 0 vs source, and each model retains both of its distinct bind scales).

**fps sanity: UNVERIFIED — environment. Saying this loudly, per the dispatch's degrade path.** Idle fps with **zero enemies and zero mixers** measured **52.6** early and **25 → 16** later on identical code, and the renderer's own auto-low-power became stuck on. The debug Chrome has ~34 tabs open including several playing video. Because the degradation reproduces with no skinned meshes present at all, it **cannot be attributed to this change** — but no controlled A/B was possible on this box, so no fps claim is made. Two further facts worth carrying: the `?test=roster` screen (no gameplay load) runs with low power **off**, and **~35 concurrent is not reachable by any legitimate spawn path** — endless wave 45 yields ~6, campaign W8 peaks at 17, and ADR-038 D13 itself records `SPAWN_CEILING = 35` with **measured peak 22**. A direct-injection attempt to force 35 was unsound (duplicate ids collapsed 35 pushes to 10 live nodes) and its numbers are discarded rather than reported.

### Six-map + endless verdicts

| Map | Result |
|---|---|
| plains | runner · 7 skinned meshes · **0 placeholders** |
| forest | slime · 3 · 0 |
| mountain | runner ×2 · 14 · 0 |
| tidewater | slime · 3 · 0 |
| riverbend | skirmisher · 5 · 0 |
| snowfall_pass | shielded · 6 · 0 |

**All six official maps: zero magenta placeholders, zero console errors** (errors + warnings, across the whole pass). Endless was entered on plains and driven to wave 45 — it spawns and renders the new models correctly, but its concurrency is low (~6), so it is not a load test.

**Visual verdict — attribution split by what each source can actually show.** The M-3 review caught me conflating these, and the distinction matters for anyone citing this section later.

*From `?test=roster`* (all ten side by side, labelled, animated, low power off — but every Kenney asset cleared from the frame and models at 3× scale):
- ✅ All ten types render, animated — mixer time confirmed advancing, not merely present.
- ✅ **Silhouettes are distinct from one another** — orc / yeti / ninja / dino / bee / mushroom-king / demon / blob / small blob / ghost. Choosing Dino for `shielded` instead of a fifth humanoid was worth it.
- ✅ **Relative scale hierarchy reads correctly** — captain tallest at 1.60 world units, juggernaut bulkiest, mini_slime smallest.
- ✅ **The bind fix is visually confirmed, not just numerically** — the footman's weapon, the captain's cap and the slime's body are all proportionate.

*From live-match screenshots* (plains W8, creeps on the path among WFC decoration, low power engaged):
- ⚠️ **Figure-ground risk on two types:** the ghost is near-black and both slimes are olive-green, sitting close to the dark-green field in value. The outgoing Kenney meshes were light grey and popped. The likely collision is enemy-vs-*decoration* — the field is dense with dark-green trees and rocks — rather than enemy-vs-tower, since organic monsters are *more* distinguishable from stone towers than UFO discs were.
- ⚠️ A **purple** mushroom-king hat entered a palette that ADR-034 excludes purple from (bar the ratified Warden cyan and the tolerated kit cones).

**Neither source settles the two risks ADR-039 itself defers to "the visual gate"** — coherence with the Kenney kit, and readability at true gameplay camera distance. The roster screen structurally cannot (it removes the kit and magnifies); the live screenshots were taken with low power forcibly engaged, which disables shadows and reduces DPR. `?test=roster`'s header comment now states this non-coverage explicitly so it is not cited as a warrant. **Both remain open, and both want an operator playtest on a machine that isn't pinned into low power.**

**A dispatch premise that turned out not to hold:** the brief asked to confirm "health bars / hit flashes / slow tint still attach". **There are no health bars and no slow-tint visuals in this codebase** — `slowMs`/`slowMult` exist in `engine.js` only, with no renderer counterpart. Hit flash does exist (a 1.1× scale pop) and still composes correctly on top of the new per-type base scale. So that item is verified for one of three, and the other two are non-existent rather than broken.

### Guards added

`tools/sim-harness.cjs` **73 → 83 pass**, ten new `enemy-*` source-level checks, **every one mutation-tested to fail loudly**. Beyond the leak shape they now cover the *feature* — which the review correctly pointed out the first five did not:

- `enemy-dispose-complete` / `enemy-dispose-both-sites` — the mixer is uncached, the skeletons and cloned materials are freed, at **both** teardown sites.
- `enemy-no-shared-dispose` — the **inverse** guard: the disposal path must *never* dispose geometry or a source material, because clones share them with the assets cache. This is the trap that would look like fixing a leak while corrupting every future spawn.
- `enemy-skinned-clone` / `enemy-clips-cached` — skinned assets route through `SkeletonUtils`; `gltf.animations` survives loading (GLTFLoader returns clips on `gltf`, not `gltf.scene`).
- `enemy-mixers-advanced` / `enemy-lowpower-releases-mixers` — mixers are actually advanced from a param-derived dt, and low power actually sheds them. Both regressions were previously silent.
- `enemy-skeleton-share-key` — skeleton sharing must key on `boneInverses`, never on bone identity. This is the MAJOR below, frozen into a test.
- `enemy-vis-covers-roster` / `enemy-vis-clips-resolve` — every `ENEMIES` type has a manifest-declared model on disk, and every `moveClip` name resolves in that model's shipped clips.

### What the adversarial reviews caught

One fresh read-only general-purpose subagent per chunk, one round each. Reviews found **five MAJORs across four chunks; all five fixed before commit.** Worth recording because two were mine and neither was a judgement call:

- **M-2, the serious one.** My `shareSkeletons` optimization keyed on bone identity. A `Skeleton` is `(bones, boneInverses)` — and three shipped models carry **two skins with byte-identical joint lists but deliberately different inverse bind matrices**, because the `KHR_mesh_quantization` pass folds each mesh's de-quantization into its IBMs and must split the skin when one skin serves meshes with different quantization volumes. I confirmed it against the bytes: footman `Orc`/`Orc_Weapon` IBM ratio **0.399**, captain `MushroomKing`/`Mushroom` **0.389**, slime eyes/body **2.713**. The key collided and rebound the second skin onto the first's matrices — certain, on 4 of 10 types, and it would have read as a bad `ENEMY_VIS.scale`, sending the next debugger to the wrong table. Now keyed on `boneInverses` array identity, which within a cloned root is exactly "same source skin".
- **M-2, second.** The staged index was a stale snapshot missing the facing fix; the reviewer also proved algebraically that the old yaw expression was a *reflection* rather than a rotation-to-heading, aligning no axis with travel.
- **M-1.** The ledger's `STATUS:` line asserted the four Rodin models were "unreferenced and superseded" — a future state written in the present tense, in the one file ADR-039 designates as the auditable record of a non-CC0 exception. Also an unlabelled tris column carrying a third-party page statistic that understates shipped geometry by up to 1.7× (aggregate +31%).
- **M-0.** An unbounded non-CC0 exception (now an enumerated grandfather clause with an exit condition); a rule scope so loose it would have forbidden the operator's own 7.4 MB hero painting (now an explicit first-party carve-out naming it); and a total-budget number that permitted the very 50-monster import its own rejection forbade.

A guard I wrote was also demonstrated **comment-foolable**: `/ownedMaterials/` passed against a bare `// TODO: ownedMaterials cleanup moved elsewhere`. It now asserts the dispose call, and the comment trick FAILs.

---

## Deferred items — every one classified

### schedule-now (operator-only; nothing here can be unblocked by a worker session)

- **Deploy.** `main` is **5 commits ahead of `origin/main`** and nothing was pushed (the dispatch forbade it). Per ADR-038 D19 this is a ritual, not a gate: `git push origin main`, purge the changed asset URLs via the Cloudflare dashboard's Custom Purge, then `curl`-verify one changed byte before writing any "deployed" claim. **Note this deploy changes served binaries** — nine new GLBs plus `MANIFEST.json` — so the purge list is larger than usual.
- **Play the new roster (~10 min).** This is now the highest-value operator action, and it does double duty: it is the **exit condition for ADR-039 D22's grandfather clause**. Once the roster survives one playtest without a model-loading regression, the four non-CC0 Rodin GLBs can be deleted and D22 has no exceptions left. Judge specifically: does the ghost read against dark ground; do the slimes; does the captain read as the boss; does anything walk oddly.
- **Publish the `ctd3-scores` RTDB rules + one community map.** Carried unchanged from sprints 5 and 6. One Firebase-console visit unblocks both the live-Community endless verification and the cycle-3 leaderboard.

### fold-into-next-sprint

- **fps at real concurrency on an uncontended machine.** The half of M-2's gate that could not run. Cheapest honest version: close the video tabs, or use a clean profile, and re-run the campaign W8 measurement against a pre-change baseline.
- **Figure-ground readability for the ghost and the two slimes.** The sanctioned lever is the **surround, not the assets** — ADR-034 Decision C as extended by ADR-039 D23 forbids retinting the models. Candidates: a rim/fresnel light, a contact-shadow blob under each creep, or a small ground-palette value shift. Not a per-model fix.
- **Air-vs-ground legibility for flying units.** Flyers sit at `baseY 1.2` and cast an offset shadow — a real depth cue that **vanishes in low power**, exactly when it is most needed. A small ground disc under each flyer solves depth and air/ground identity at once, and reuses the already-harness-guarded `makeDisc` + `GROUND_DECAL_Y` primitive.
- **Death animation.** The clips are already shipped (`Death` in all nine), so this is code-only — but it needs a **despawn-*reason* channel from engine to scene** first, which does not exist: the `seen`-set diff knows "gone", not "why", and a creep that leaks into the castle must not play a death animation. Two further design problems: a dying-node registry becomes teardown site **#3** (the leak-surface multiplication sprint 6 warns about), and slime splits would burst from a still-dying parent. Deferring this was correct; the prerequisite is now named.
- **Low-power degradation curve.** Currently all-or-nothing and **one-way**: `setLowPowerShadows` releases mixers but nothing re-attaches when low power clears, so a long endless run accumulates frozen creeps beside animated ones. Better: update mixers every 2nd/3rd frame, or cap to the N largest/nearest. Animation at 20 fps still reads as animation; none reads as broken.
- **Per-type `animSpeed` tuning against the eye**, and the related open-loop risk: `animSpeed` is a hand-tuned constant, so **if endless scaling ever touches enemy *speed*** (it scales hp/bounty today — worth confirming), walk cycles desync from travel at depth. Deriving `timeScale` from effective speed closes it permanently.
- **The asset-load race is ~7× wider.** The roster is not in `CRITICAL_IDS`, so it background-loads, and `getMesh` caches a **magenta placeholder that never heals** (nodes are built once). Outgoing footman was 42 KB; incoming is 313 KB. Either add the roster to `CRITICAL_IDS` or heal placeholders on a later frame. Not observed in six maps, but the window is real.
- **Draw calls: 3–11 per enemy** (footman 11) versus 1 for the single-primitive meshes replaced — a direct consequence of leaving materials untouched, which D23 requires. `BatchedMesh` or baked vertex-animation textures is the known scaling path **if** wave sizes grow; not needed at ~20 concurrent.
- **The 3-clip prune bounded future expressiveness.** Import kept Walk/Run/Death and discarded Idle, Jump, HitReact, Punch, Duck, Wave. A hit-reaction or an attack-at-castle animation now needs a **re-import**, not just code. Deliberate size trade, recorded so it is not rediscovered.
- **Ghost transparency sorting.** `depthWrite = false` at opacity 0.55 now applies across **3** skinned meshes instead of 1, so its own body parts render in arbitrary order and inner geometry can show through.
- **Ratify or swap the purple mushroom-king hat** against ADR-034's palette exclusion.
- **Enemy icons**, if any HUD surface previews upcoming types — those would still depict the retired UFO meshes. `tools/bake-icons.html` is the existing precedent for towers.
- **Footstep audio synced to the walk cycle** — newly possible from mixer time, and newly *expected* now that creeps visibly have legs.
- Carried unchanged from sprint 6: the three `decal-*` guard-robustness minors; **promote the ring probe to `?test=decal-audit`** (this sprint shipped its sibling, `?test=roster`, which is the same idea and the same pattern); a transient-decal geometry/material pool; proportional ring thickness at zoom extremes; no selection feedback for Wardens; C-7's H12 boundary probe; the editor gold-budget contradiction; `Ctrl+S` meaning "Copy JSON".

### drop-with-reason

- **Retinting the new models** to fix the dark-value problem — forbidden by ADR-034 Decision C as extended by ADR-039 D23, which deliberately extends immutability to newly imported third-party art precisely so this debate does not reopen. The surround is the lever.
- **Importing the other ~40 monsters** — ADR-039 D25's scope rule: import only what the roster references. The budget would permit it; the ADR does not.
- **Health-bar anchoring work** — there are no health bars.
- **A slow-tint material-bleed fix** — no slow-tint visual exists. The hazard is real but latent: enemies (unlike towers) do *not* clone materials per instance, so any future per-enemy material mutation would tint every enemy of that type. Worth knowing before someone adds one.
- **M-4, the Plains s1 slot fix** — not authorized. It remains a one-line `maps.js buildSlots` edit plus a sanctioned re-pin of the six-map baseline in `tools/map-rules-test.cjs`; re-offer it with the next dispatch.

---

## Known-unknowns

- **Real-device and uncontended-desktop perf with skinned meshes.** The single largest gap. What *is* known: the disposal is correct and measured; skeletons are down to one per source skin; draw calls are 3–11 per enemy. What is not: any trustworthy frame time, because this box could not produce a stable idle baseline (52.6 → 16 fps at rest, no code change).
- **Whether ~35 concurrent is even reachable.** Nothing in campaign or endless produced more than 17 live enemies. If the 35 ceiling matters, it needs a deliberate stress hook rather than a wave.
- **A long endless run with animated enemies.** The gate covers 320 frames and six map loads; a multi-minute session at wave 27+ is unobserved. The mechanism guarantees it (allocations are matched by disposals every despawn), but the wall-clock run has not happened.
- **Browser matrix.** Chrome only. `renderer.info` is a three.js counter rather than a browser API, so cross-browser risk on the *measurements* is low; the visual result is unverified elsewhere.
- **Whether any Quaternius bind pose is a T-pose.** `?test=roster` shows all ten posed naturally, which largely answers it — but low-power enemies freeze mid-stride rather than at bind pose, so this only matters for a model that fails to get a mixer at all.
- **Standing operator items, carried:** real-phone bottom-sheet/tabs, real NVDA/VoiceOver, real-iOS HUD, Firefox/Safari — all still reasoned-about or Chrome-only. Snowfall ground palette still open, and now joined by the roster's figure-ground question, which is the same class of problem (map palette, not per-object).

**One housekeeping note:** my test runs wrote a bogus `bestScore` (and 3★ seeds, needed to reach the star-gated maps) into `ctd3:scores` in the **debug `chrome-mcp-profile`**. I removed `ctd3:scores` and `ctd3:endless` from that profile at the end of the pass. Your normal browser profile was never touched.

---

## Note for the next session

**Next dispatch: the campaign wave re-imagining, on the new roster.** It is the phase that **amends ADR-038 D18** — deliberately, with a sanctioned CSV re-baseline of the six campaign curves — and it now has what it was waiting for: a visually settled roster whose types are distinguishable at a glance, so a wave that "feels wrong" afterwards has exactly one candidate cause instead of two. That separation was the whole point of the operator's re-sequencing, and it held.

Queued behind it: **ADR-038 T-1..T-10** (endless calibration, leaderboard, layout generator, polish cluster), untouched by this sprint; and **tower-roster depth**, still behind the D20 decision that cycle 4 adjudicates with T-1's measured wave index in hand. ADR-039 also leaves one operator-gated cleanup: delete the four Rodin GLBs once a playtest confirms the roster, which spends D22's grandfather clause and leaves the CC0 policy exception-free.
