# ADR-039: CTD3 CC0 Asset Expansion Policy, and the Monster Suite Import

**Date:** 2026-07-24
**Status:** Accepted
**Amends:** [ADR-034](034-ctd3-ui-ux-remediation-v2.md) **Decision C**, **its Out-of-Scope bullet *"Editing enemy GLBs (`enemy_*.glb`)"*, and its Files-Affected row for `enemy_*.glb` ("DO NOT EDIT")** (scope clarification — see D23; the freeze is retained, its reach is bounded). Note that Decision C's own text covers *towers and landscape* only; the enemy-GLB freeze lives in ADR-034's ADR-level Out-of-Scope list, which is the clause D23 actually bounds.
**Explicitly does NOT amend:** [ADR-038](038-ctd3-layout-generator-direction-and-cycle-3-sprint-plan.md) **D18** (campaign-balance freeze) — see D26
**Relates to:** ADR-028 (CTD3 core, §4/§10 asset loading), ADR-030 (tile renderer / decorations), ADR-034 (kit-asset constraint), ADR-038 (cycle-3 plan)

This ADR is the design record for **Sprint 7 — the monster-suite import**, the first chunk of the operator's re-sequenced cycle 3. It exists because the sprint does two things that must not be re-litigated by a future session: it **adds** third-party art to a repo whose last art decision was a *freeze*, and it establishes **which sources may ever be shipped**. The campaign wave re-imagining that consumes this roster is the next dispatch and is out of scope here.

**No balance, wave, or entity data changes ship with this ADR or its sprint.** This is a visual swap and the infrastructure to support it.

---

## Context

### The repo's art position before this sprint

CTD3 ships ~70 GLB models under `games/castle-tower-defense/assets/models/`. Their license story is documented in `assets/LICENSE.txt` and is clean **for the kit assets**: Kenney "Tower Defense Kit" 2.1, CC0 1.0, with a complete per-file `target filename → original kit filename` mapping covering towers, tiles, decorations, spawn markers, the keep, and six enemies.

ADR-034 Decision C then froze that art. Its reasoning was specific and still correct: the Cabin-in-the-Woods palette excludes the purple/kelly-green the kits ship, and the two ways to fix that at the asset level — forking the kit in Blender, or post-load material retinting — were both rejected as brittle and kit-upgrade-hostile. Brand cohesion was achieved through the *surround* instead (background, fog, lights, tone mapping, fireflies, CSS overlay). ADR-034's out-of-scope list names the enemy GLBs directly: *"Editing enemy GLBs (`enemy_*.glb`). Kenney + Hyper3D Rodin assets are immutable."* **Attribution matters here:** Decision C's own decision text is scoped to *"Tower and landscape appearance"* and never mentions enemies. The enemy freeze is a separate bullet in ADR-034's ADR-level `Out of Scope` section — notably the one bullet of the four that does *not* say "per Decision C" — backed by a `Files Affected` row marking `enemy_*.glb` **DO NOT EDIT**. D23 bounds all three clauses, not just Decision C.

That freeze has held and should keep holding. But it was written to stop **material and geometry edits to existing assets**, and its text is loose enough that a careful reader could take it to forbid **adding new assets at all**. That reading would block this sprint, so it is settled here rather than left to interpretation (D23).

### Two problems this sprint's asset work actually solves

**1. The enemies are static clones, and always have been.** Every enemy in the game is `cache.get(id).clone(true)` of a rest-pose mesh. There is no skeleton, no `AnimationMixer`, and no animation clip anywhere in the enemy path. The apparent "movement" is procedural: a sine bob in `scene.js` `syncEnemies`, plus per-type personality added later (slime squash-and-stretch, juggernaut lurch, ghost float). That is a real craft ceiling — a tower-defense game whose creeps slide along a spline without a walk cycle reads as unfinished no matter how good the surround looks.

**2. Four of the ten enemy models have no recorded provenance, and are not CC0.** `assets/LICENSE.txt` maps six enemies to Kenney originals and stops. The other four — `enemy_juggernaut`, `enemy_slime`, `enemy_mini_slime`, `enemy_ghost` — appear in `MANIFEST.json` and on disk but in no ledger. This was surfaced as a finding during the operator's first real playtest session.

Their provenance is now established from the files themselves, not from memory:

| File | glTF `asset.generator` | Mesh name | Reading |
|---|---|---|---|
| `enemy_juggernaut.glb` | `Khronos glTF Blender I/O v5.1.19` | `RODIN_Juggernaut` | Hyper3D Rodin generation, Blender-exported |
| `enemy_slime.glb` | `Khronos glTF Blender I/O v5.1.19` | `RODIN_Slime` | same |
| `enemy_mini_slime.glb` | `Khronos glTF Blender I/O v5.1.19` | `RODIN_Slime.002` | same — a Blender **duplicate of the Slime mesh**, i.e. already "one creature at two scales" |
| `enemy_ghost.glb` | `Khronos glTF Blender I/O v5.1.19` | `RODIN_Ghost` | same |
| the other six | `UnityGLTF` | `enemy-ufo-a/b/c/d`, `-weapon` | Kenney kit, matching `LICENSE.txt` exactly |

The `RODIN_` mesh-name prefix is decisive and corroborates ADR-034's "Hyper3D Rodin" aside. These are **text-to-3D generations**, not CC0 kit art. Rodin's output terms are a per-account commercial grant, not a public-domain dedication — which means the repo has been publicly serving four models it cannot describe as CC0, under a `LICENSE.txt` whose opening line reads *"All assets in this directory are Creative Commons Zero (CC0)."* That statement is currently false. Fixing it is part of this sprint's ledger work (D24), and replacing the four with CC0 art is a side benefit of the roster swap that is worth naming as a reason rather than a coincidence.

### Why Quaternius Ultimate Monsters

Fifty CC0 monsters, rigged and animated, glTF included, from a source the repo already trusts in spirit (same CC0-kit tradition as Kenney). Spot-checked before adoption: a representative model is a valid glTF-2.0 binary, **skinned** (one skin), carries **eight named animation clips** (`Death`, `Fast_Flying`, `Flying_Idle`, `Headbutt`, `HitReact`, `No`, `Punch`, `Yes`), ships **zero embedded textures** — its materials are flat palette colors — and weighs 232 KB. Zero textures matters twice: it keeps every model inside the size budget without a texture-compression step, and it means the models inherit scene lighting cleanly rather than fighting the ADR-034 atmospheric reframe with baked-in kit colors.

---

## Decision

Adopt a **CC0-only shipping policy** for CTD3 art, with a ratified source allowlist and a ratified exclusion list; bound ADR-034 Decision C to *editing* rather than *adding*; require a per-file provenance ledger for every shipped binary; set an asset budget for this sprint; and import a Quaternius monster suite that replaces all ten enemy visuals — **with zero changes to enemy data**.

---

## D22 — CC0-only is the shipping policy for third-party CTD3 art. The source allowlist and the exclusions are ratified here.

**What this rule governs, stated first, because an unscoped version of it would be false the day it lands.** D22 binds **third-party art licensed *into* the project and shipped under `games/castle-tower-defense/assets/`** — models, textures, icons, and audio that someone else authored and we redistribute. It does **not** govern:

- **First-party art the operator owns or authored.** Ownership is not a license grant to negotiate; there is nothing to verify. This explicitly and by name includes `/assets/forest-house-landscape.png` — the Cabin-in-the-Woods hero painting, which the CTD3 title screen renders at `games/castle-tower-defense/index.html:800` and the site uses as its background — plus `.design-system/assets/*`. A future compliance sweep must **not** flag these, and adding new operator-authored art needs no D22 ceremony. They are out of scope, not exceptions.
- **Derivatives of already-conformant assets generated by repo tooling** — e.g. the twelve tower icons baked from CC0 tower meshes by `tools/bake-icons.html`, which `LICENSE.txt` already records as CC0-derivative.

**The rule.** Any *third-party* binary art asset committed to this repo and served to browsers must be **CC0** (or an equally unconditional public-domain dedication), with its provenance recorded in the ledger (D24). "Free to download" is not a license. "Free for personal use" is not CC0. "Royalty-free" is not CC0. If the license cannot be named and linked, the asset does not ship.

**The one grandfathered exception, closed and dated.** Four files predate this policy and are **not** CC0: `enemy_juggernaut.glb`, `enemy_slime.glb`, `enemy_mini_slime.glb`, `enemy_ghost.glb` (Hyper3D Rodin generations — see Context and D24). They are grandfathered on exactly these terms:

- The exception is **enumerated, not general.** It covers those four filenames and nothing else. It is **not a precedent**: no future asset may cite it. A non-CC0 asset arriving after this ADR is refused by D22 outright, and "we can ledger it honestly and delete it later" is specifically not an argument — that reasoning is available only to these four files, only because they were already shipped when the policy was written.
- They survive only as the **rollback path** for the roster swap, and only while unreferenced by `MANIFEST.json`.
- **Exit condition:** they are deleted once the imported roster has survived one operator playtest without a model-loading regression. That deletion is an operator action (D24), and once taken, this clause is spent and D22 has no exceptions.

Any *further* exception requires amending D22 by name in a new ADR. Reading D24's decision to keep the four files on disk as a general licence to ship non-CC0 art and tidy up later is a misreading, and this paragraph exists to foreclose it.

The reason the bar is *CC0 specifically*, rather than "any permissive license": this repo is a **public static site**. Every GLB under `games/` is fetched by URL and is therefore redistributed in raw, extractable form to anyone who visits. Licenses that permit *use* while restricting *redistribution* or *extraction* are structurally incompatible with that delivery model, regardless of intent. CC0 is the only class that is unambiguously safe here. Attribution-required licenses (CC-BY) are not forbidden in principle but are **not currently on the allowlist** — adding one requires amending this decision and committing to a visible in-product attribution surface, which does not exist today.

**APPROVED SOURCES (operator-ratified, license-verified during cycle 3 — CC0 only):**

- **Quaternius Ultimate Monsters** — <https://quaternius.com/packs/ultimatemonsters.html> — CC0, 50 animated monsters, glTF included. **PRIMARY source for this sprint.**
- **Kenney kits** — <https://kenney.nl> — Castle Kit, Tower Defense Kit, Fantasy Town Kit. CC0. (Already the repo's incumbent source.)
- **poly.pizza, restricted to CC0 results only** — search with `lic=1`; e.g. the Quaternius Ultimate Monsters Bundle mirror and the Ultimate Stylized Nature Pack, both Quaternius CC0. **poly.pizza is an aggregator, not a publisher**, and it hosts CC-BY work alongside CC0 — so the `lic=1` filter is a search convenience and **never the license determination**. The per-asset license must be read off that asset's own page (its metadata carries an explicit `Licence` field) and recorded per file in the ledger. If a model's own page does not say CC0, it does not ship, whatever the search filter returned.

**EXCLUDED, ratified with reason:**

- **ALL Unity Asset Store items.** Verified as "Extension Asset" under the Standard Unity Asset Store EULA — **not CC0**. The EULA requires the licensee to protect assets from extraction; this repo publicly serves raw GLBs, which *is* redistribution. The exclusion is categorical and is not to be re-argued per-asset: no Unity Asset Store item ships from this repo, whatever its price, rating, or apparent permissiveness.
- **WC3-extracted assets** (`C:\Users\chase\Projects\Warcraft\`, including everything under `docs/td-comparison/assets/`) — **reference-only, never shipped.** Blizzard game assets extracted from CASC are usable as *design reference* for curves, silhouettes, and pacing — that is exactly what the td-comparison benchmark is for — and are never committed to or served from this repo. This is a standing rule, not a sprint-scoped one.

**Not a rejection of quality, a rejection of ambiguity.** The excluded sources contain better art than the allowlist in places. The policy trades peak asset quality for a license story that a future maintainer can verify in one file read.

## D23 — AMENDS ADR-034 Decision C by bounding it: the freeze is on EDITING kit assets, not on ADDING new CC0 assets.

ADR-034 Decision C ("Tower + landscape appearance — kit-immutable") and ADR-034's related out-of-scope entries — *"Editing tower GLBs"*, *"Editing landscape GLBs"*, *"Editing enemy GLBs"*, *"Post-load material retinting"* — are **retained in full**. Every existing kit asset stays byte-identical.

**Immutability extends to newly imported third-party art, not just incumbent kit art.** Decision C says "kit-immutable" and its clauses say "existing"; read narrowly, a later session could argue the Quaternius monsters are neither kit nor existing and are therefore fair game for a retint or a Blender re-author. They are not. **Every shipped third-party asset is immutable in the same way and for the same reasons** — brittleness, upgrade hostility, and rendered-color/source-color divergence apply identically to a Quaternius model. Import-time optimization (D25) is the sole sanctioned transformation, and it is explicitly not restyling. If the mixed-house palette is later judged off-brand (a risk this ADR names in Consequences), the remedy is the ADR-034 reversal trigger — surround changes first, and an explicit operator-authorized experiment second — not a quiet retint of the new models. No material retint, no HSL clamp, no per-mesh color override, no Blender re-author of a kit mesh. The reasoning that produced Decision C (kit-upgrade hostility, brittleness, rendered-color/GLB-color divergence) is undamaged by this sprint and continues to bind.

**What is clarified:** Decision C answered the question *"may we change how the kit assets look?"* with a definitive no. It was never asked, and did not answer, *"may we add new assets from a different CC0 source?"* This ADR answers that: **yes, under D22.** Adding a new CC0 model beside an existing one is not an edit to the existing one, does not fork the kit, and does not break kit upgrades — the three costs Decision C was defending against are all absent.

**Recorded as an amendment rather than an interpretation** because Decision C's out-of-scope line *"Editing enemy GLBs (`enemy_*.glb`)"* is close enough to this sprint's subject that a future reader deserves an explicit ruling instead of an inference. The distinction that governs:

- **Forbidden (Decision C, unchanged):** mutating `enemy_footman.glb`, retinting its material, re-exporting it from Blender, or overwriting it in place.
- **Sanctioned (D22 + D23):** adding `enemy_footman2.glb` from an approved CC0 source and pointing the manifest at it.

**Corollary — new filenames, never overwrites.** Imported models take new filenames; no existing GLB is overwritten. This keeps Decision C mechanically enforceable (an unchanged file cannot have been edited), preserves an instant rollback path, and keeps the old models available as fallbacks while the new path is proven.

## D24 — Every shipped binary carries a provenance-ledger entry. The four unledgered enemy GLBs are resolved as part of this sprint.

`assets/LICENSE.txt` is the provenance ledger and is authoritative. Its per-file mapping table is not decorative — it is the artifact that makes D22 auditable. **A third-party binary art asset with no ledger entry is a defect** (scope per D22 — first-party art is not ledgered because there is no license to record).

**Required fields, and what they bind.** A ledger entry records: **source URL, pack name, author, license (with link), and download date**, plus the original filename where a rename occurred. Three scoping rules, stated so the requirement is actually auditable rather than aspirational:

- **This field list binds entries created from this ADR forward.** The ~60 incumbent Kenney entries record source URL, pack, author, and license per *pack* rather than per *file*, and carry **no download date** — the kit predates the requirement. Those entries are **conformant as-is and are not a backlog**; pack-level attribution for a single-pack import is materially complete. Do not open a cycle to backfill dates that were never recorded.
- **Where a field is genuinely unrecoverable, the entry records it as unknown.** It does not omit the field silently, and it does not invent a plausible value. This is what makes the four Rodin entries below satisfiable: they have no source URL, pack, or download date, and the honest entry says exactly that.
- **A missing field is not a licence to ship.** An asset whose *license* cannot be named still fails D22 regardless of how complete the rest of its entry is.

**Required entries this sprint:**

1. **Every newly imported monster** — full entry, including the download route actually used (see D25's note on route honesty).
2. **The four pre-existing unmapped GLBs** — `enemy_juggernaut`, `enemy_slime`, `enemy_mini_slime`, `enemy_ghost` — get **best-effort provenance entries** recording what the file metadata establishes: Hyper3D Rodin text-to-3D generations, Blender-exported (`Khronos glTF Blender I/O v5.1.19`), mesh names `RODIN_*`, generated during the ADR-034 era, **license: Hyper3D Rodin generation terms — NOT CC0**. Best-effort is the honest standard here: the generating session left no prompt record, so the entry states what is verifiable from the bytes and explicitly marks the rest unknown rather than inventing a clean story.
3. **The ledger's opening claim must be corrected.** `LICENSE.txt` currently opens *"All assets in this directory are Creative Commons Zero (CC0)."* That is false while the four Rodin models are present. The file must state the exception plainly.

**On the four Rodin models' continued presence.** After the roster swap they are unreferenced by the manifest but **remain on disk and remain publicly served by URL**. This ADR deliberately does **not** delete them: deletion is a separate, harder-to-reverse call, they are the rollback path if an imported model regresses, and the sprint's guard is "never overwrite existing GLBs." Their removal is recorded as a **follow-up for the operator**, not a silent side effect of this sprint. The ledger tells the truth about them in the meantime.

**This is the D22 grandfather clause in operation, not a general exception.** Read the two together: D22 enumerates these four filenames, forbids any other asset from citing them as precedent, and sets the exit condition (deletion once the imported roster survives one operator playtest without a model-loading regression). *"Ship it now, ledger it honestly, delete it later"* is **not** a reusable pattern — it is a one-time accommodation for files that were already live when the policy was written. A future session proposing a non-CC0 asset on this reasoning is misreading both decisions.

## D25 — Asset budget for this sprint: ≤ ~300 KB per optimized model, ≤ ~12 MB added in total.

A tower-defense page that already loads ~70 GLBs cannot absorb an unbounded art import. The budget:

- **Per model: ≤ ~300 KB** after optimization. The spot-checked Quaternius model is 232 KB unoptimized, so this is a comfortable rather than aggressive ceiling; it exists to catch an accidental import of a high-poly or texture-heavy outlier.
- **Total added this sprint: ≤ ~12 MB**, with an expected import **well under 3 MB**.

  **The total is a ceiling, not the scope guard — do not mistake one for the other.** At ~230 KB per model the full 50-monster pack is ≈ 11.6 MB, which *fits inside* 12 MB. So a future session cannot cite this budget as authority to import the whole pack: the budget would permit it and **this ADR does not**. The actual scope rule is narrower and is the binding one: **import only the models the roster references, and no more.** Nine models cover ten enemy types this sprint. Any later import states its own count, its own byte total, and the surface that consumes it — and a wholesale pack import needs a fresh budget line in the ADR that authorizes it, not a residual reading of this one.
- **Optimization keeps Quaternius' palette materials.** No texture atlas is introduced; the models' flat-color materials are the point (they light cleanly under the ADR-034 surround). Optimization means geometry/accessor packing, not restyling.
- The `~` is deliberate. These are budgets to notice violations against, not thresholds to fail a build on. A 310 KB model is a conversation; a 3 MB model is a defect.

**Route honesty.** The download route actually used must be recorded in the ledger, because the primary and fallback routes yield the same art through different intermediaries and a future re-import needs to know which one worked. **For this sprint the primary route failed:** the Quaternius site's download button resolves to a Google Drive folder (`18m4KpzpEzhC9wl7jzr6dUc0N8Jozr79C`) whose per-file endpoints all returned **"Google Drive — Quota exceeded"** (`drive.google.com/uc`, `drive.usercontent.google.com/download`, with and without a browser user-agent). The folder's *structure* enumerated fine via `embeddedfolderview` — `Big/`, `Blob/`, `Flying/`, each with `glTF/` — so the pack contents and the CC0 license link were verified from the source of record even though the bytes came from elsewhere. **The sanctioned poly.pizza CC0 mirror supplied the actual bytes**, and the ledger says so per file.

## D26 — NON-DECISION, stated explicitly: ADR-038 D18 is NOT amended. This sprint changes visuals only.

ADR-038 **D18** freezes campaign balance through cycle 3. Quoted exactly, so this restatement cannot drift from the decision it defers to: *"No edits to `maps.js` wave compositions or rewards, no `ENEMIES` hp/bounty, no `TOWERS` tier stats, no star thresholds, no `unlockRequirement`. The six campaign CSVs must show **no content change** at every chunk boundary."*

(D18's enumerated `ENEMIES` fields are **hp/bounty**; it does not name `speed` or `armor`. This sprint touches none of them either way — it does not edit `entities.js` at all — so nothing here turns on the difference. Flagged only because silently widening a quoted freeze is the failure mode ADR-038 §6 opens by warning against.)

**D18 stands, entirely and unamended.** This sprint touches `assets/`, `assets.js`, `scene.js`, and `MANIFEST.json`. It does not touch `entities.js`, `maps.js`, or `tools/curves/`. The ten enemy types keep their exact `hp`, `speed`, `armor`, `bounty`, `isFlying`, `sizeWorld`, `splitsInto`, `splitCount`, and `spectralCharges` values. A Quaternius model that *looks* twice as heavy as the Rodin one it replaces has identical HP.

This is recorded as a decision because the temptation is real and specific: importing a visibly larger, more menacing Juggernaut invites "…and it should hit harder." **It should not, not this sprint.** Per-type visual scale is a presentation config (D27) and is not permitted to leak into `sizeWorld` or any simulated quantity.

**Where the amendment does belong.** The **campaign wave re-imagining** — the next dispatch — is the phase that amends D18, deliberately, with a sanctioned CSV re-baseline, using this sprint's roster as its input. Splitting it this way is the point of the operator's re-sequencing: land the art with zero balance risk, then change balance against a roster that is already visually settled, so that a wave that "feels wrong" afterwards has exactly one candidate cause instead of two.

## D27 — Per-type presentation config is a table, not scattered literals; and animation lifecycle carries a disposal contract.

**Config shape.** The roster swap needs per-type scale, ground offset, and animation speed. These live in **one keyed config table** alongside the existing per-type presentation constants in `scene.js`, not as literals sprinkled through `syncEnemies`. The existing per-type movement personality (slime squash-and-stretch, juggernaut lurch, ghost float, flying bob) is presentation and stays presentation. **No presentation value is ever read from, or written to, an engine entity** — ADR-030 C-1's rule, restated because animated models make it easier to violate.

**Disposal contract.** Skinned, animated models change the lifecycle in ways plain clones did not, and Sprint 6's decal leak is the standing lesson: *allocations must be matched by disposals at every teardown site, and the guard belongs in the harness, not in a reviewer's memory.* The contract for the enemy path:

- **Clone skinned meshes with `SkeletonUtils.clone`.** `Object3D.clone(true)` does not rebind a skinned mesh's skeleton — every clone would deform from the source's bones. This is a correctness requirement, not an optimization.
- **Do NOT dispose geometry or the source material on enemy despawn.** Enemy nodes come from `CTD3Assets.getMesh`, which clones from a shared cache; geometry and base materials are **shared by reference** with that cache. Disposing them would corrupt every future spawn of that type. This is the exact inverse of the decal case (where every geometry was freshly allocated per call), and conflating the two would reintroduce a worse bug than the one Sprint 6 fixed.
- **DO dispose what is genuinely per-instance:** any per-instance cloned material (the existing ghost-translucency path already clones materials per enemy and currently leaks them), the per-instance `Skeleton` created by `SkeletonUtils.clone`, and the `AnimationMixer` — stopped and uncached from its root, since mixers retain binding caches keyed by the root object.
- **Both teardown sites, not one.** Per-enemy despawn *and* `clearPlayfield`. Sprint 6's decal fix had to patch two sites for the same reason.
- **Low-power mode is respected**, matching the existing `isLowPower` gates.

---

## Consequences

**Good:** enemies animate, which is the single largest craft gap left in the gameplay view. The repo gains a written art policy where it had an unwritten one. `LICENSE.txt` becomes true. The four unverifiable-license models stop being rendered. The enemy path gains a disposal contract and a harness guard, closing a leak class that skinned meshes would otherwise have opened wide.

**Costs and risks, named:**

- **Page weight rises.** Bounded by D25 and small in absolute terms, but real.
- **Skinned meshes cost more per frame than static clones** — one mixer update per live enemy, plus skinning. The W8 ceiling is ~35 concurrent enemies; this must be measured under load, not assumed, and low-power mode must degrade.
- **Art coherence is now a mix of two CC0 houses** (Kenney kit + Quaternius monsters) rather than one. Both are flat-shaded, low-poly, palette-colored, and read compatibly — but this is a judgement, and it is checked at the visual gate rather than asserted here.
- **The four Rodin models linger on disk**, unreferenced and publicly fetchable, until the operator decides to remove them.
- **Silhouette readability at zoom-out** is a new risk: Quaternius monsters are more detailed than the kit's UFO blobs, and detail can *reduce* readability at gameplay camera distance. Checked at the visual gate.

**Rejected alternatives:**

- **Retint or re-author the existing models to add animation.** Directly forbidden by ADR-034 Decision C, and Rodin static meshes have no rig to animate.
- **Procedural skeletal animation on the static meshes.** More code, worse result, and no rig to drive.
- **Keep the sine-bob and skip animation entirely.** This is the status quo whose ceiling the sprint exists to break.
- **Import all 50 monsters.** Rejected on **scope, not on the byte budget** — at ~230 KB each the pack would be ≈ 11.6 MB and would technically fit under D25's 12 MB ceiling, which is exactly why D25 says the total is not the scope guard. The reason to refuse is that it ships ~40 models no wave references, adds 40 files of ledger surface, and defers the real decision (which creature reads as which role) to whoever next opens `scene.js`. The wave re-imagining can import more when it has a wave that needs them, under its own budget line.
- **Delete the Rodin models in this sprint.** Deletion is hard to reverse, removes the rollback path, and is the operator's call — D24 records it as a follow-up instead.

---

## Out of scope

- **Campaign wave re-imagining** — the next dispatch. It amends D18 and re-baselines the CSVs deliberately (D26).
- **ADR-038 T-1..T-10** (endless calibration, leaderboard, layout generator, polish cluster) — queued behind the operator's re-sequencing.
- **Tower-roster depth / combination mechanic** — waits on the D20 tower-depth decision, which cycle 4 adjudicates using T-1's measured wave index. (ADR-038 refers to this as §3(e) and D20; its chunk list runs **T-1..T-10 only**, so the "T-15" label some dispatches use corresponds to no ADR-038 chunk — cite §3(e)/D20 instead.)
- **Any Unity Asset Store or WC3-extracted asset** — excluded by D22, permanently.
- **Music/ambient sourcing** — content acquisition, unchanged from prior cycles.
- **Deleting the four Rodin GLBs** — follow-up per D24.
- **Tower, tile, and decoration visuals** — untouched; Decision C governs them and D23 does not disturb it.
