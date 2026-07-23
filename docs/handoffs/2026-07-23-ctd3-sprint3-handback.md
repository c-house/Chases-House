# CTD3 Sprint 3 hand-back — ADR-036 (direct single-session execution)

**Date:** 2026-07-23 · **Executor:** Claude (headless single session)
**Base:** `484f603` (as dispatched; HEAD matched) · **Head after sprint:** `0f7cda2` + this hand-back commit
**Sprint headline:** ship the "Simulate this map" editor affordance and clear the Sprint-2 deferred polish debts. **Met — all six chunks LANDED.**

This sprint drains the ADR-036 roadmap's **Now** and **Next** columns entirely (see the closing note): the next turn should open a new planning cycle, not dispatch another chunk.

---

## Progress

All six chunks LANDED, in dispatch order (X-1 → X-2 → X-3 → X-4 → X-5 → X-6).
Final gates: **`node tools/sim-harness.cjs` → 58 pass / 0 fail / ACCEPTANCE: ALL PASS** (exit 0); **`node tools/wfc-test.cjs` → 12 pass** (was 7). Curve CSVs byte-stable across the X-1 extraction.

| Chunk | Status | Commit | Notes |
|---|---|---|---|
| X-1 "Simulate this map" | **LANDED** | `148e744` | Extracted the scripted-build runner + static curve computation from `sim-harness.cjs` into `tools/sim-core.js` (window-IIFE, `window.CTD3SimCore`). Harness requires it through its `global.window` shim → one implementation. `runScripted` takes the map OBJECT and installs a single-map `CTD3Maps` facade `{ byId }` around each run, restoring afterward (the map-resolution bridge). **Differential gate: identical 58 pass / ALL PASS, `git diff --stat` on `tools/curves/` empty.** Editor loads `../engine.js` + `sim-core.js`; ember-outline Simulate button in the sg-status group below Wave shape, gated on validation like Copy JSON; monospace results box (3 builds × quiet/spirited: WON/lives/gold, LOST/T-O with wave reached, per-wave attrition column). Rides the Status tab at <900px. Two `/find-adjacencies` folds shipped: loss-wave diagnosis + stale-result dimming on edit. |
| X-2 editor shell polish trio | **LANDED-WITH-RESIDUAL** | `d0cd4ee` | (a) Full WAI-ARIA tabs: Status/Export wrapped in distinct `role="tabpanel"` divs (`#panel-status`/`#panel-export`), `role=tabpanel` on `#panel-meta`, roving tabindex + Arrow/Home/End with focus-follows-selection; fixed the one `.side>` direct-child selector (wave-shape) to descendant. (b) `window.__cartographerPreviewResize` re-fits renderer+ortho frustum, kicked on Status-tab-show and pane expand. (c) MutationObserver auto-switches to Export on import/save feedback while another tab shows. **Residual:** (c)'s observer is correct + unit-verified (feedback text off-Export → switches) but **no current editor UI path exercises it** — all feedback-producing buttons live inside the Export panel, and the editor has no boot/hash import (that's the *game's* boot, not the editor). It's future-proofing, not a live-bug fix. See Deferred + Discrepancy §1. |
| X-3 import accepts its own export | **LANDED** | `637406a` | Added `_coerceImportText`: strips the `registerMap(...)` call wrapper and quotes only the two unquoted wrapper keys, anchored on a real newline (JSON escapes newlines inside strings, so a value reading `..., map: ...` can't be corrupted). Non-wrapper text passes through, so combined `{map,decorations}` and bare-map paths are untouched. Verified: editor's own raw-JSON preview round-trips; plain JSON still imports; a displayName `A, map: B { decorations: yes }` survives intact. Chose the "accept the wrapper" branch (option B — strict-JSON emit — would break Copy JSON's maps.js-paste purpose). |
| X-4 game sheet keyboard | **LANDED** | `f8f0942` | (a) `input.js`: Space no longer pauses while a `.sheet.open` modal is up — returns without `preventDefault` so Space natively activates the focused sheet button; still pauses on the play screen otherwise. (b) `ui.js paintTowerSheet`: when a repaint disables the focused control, move focus to the nearest enabled control (Sell, else close-×) instead of dropping to `<body>`, guarded on focus having been inside the sheet (open flow untouched). (c) `entities.js` override-shape comment gains `earlyCallRate` (comment only). Verified in-browser: Space activates without pausing while a sheet is open, pauses otherwise; focus re-lands on Sell on both unaffordable and maxed disable paths. Harness ALL PASS. |
| X-5 themed-fill test + in-game verify | **LANDED** | `362e0e4` | `wfc-test.cjs` gains 5 assertions (7→12): forest raises tree weight, mountain excludes `tile_tree_quad` (pinned against a positive control), unknown theme falls back to STANDARD, **prototype-chain theme key (`'constructor'`) falls back** (the case the `hasOwnProperty` guard exists for — added per adversarial review), and forest fills generate denser tree cover than plains at the same seed. In-game verification of all six themed maps below (verification-only, no game-code change). |
| X-6 catapult pricing readability | **LANDED** | `0f7cda2` | Copy/presentation fix: the tower sheet gains an "Invested" row showing cumulative gold-in-tower and — when upgradeable — where the upgrade lands the total (`120g → 230g`), so the sub-placement upgrade price reads as growing investment, not a bug; also makes the Sell refund legible as 75% of invested. Maxed towers show the flat total. **No economy change** — harness stays 58/ALL PASS, D2/attrition untouched. The numeric reshuffle option was considered and deferred (copy fix resolves the reading without perturbing the signed-off economy). Post-review strengthening (the `→` projection) applied per the reviewer's own suggestion. |

### Acceptance results

- **Harness (X-1 differential + X-4/X-6 game-touch gate):** `node tools/sim-harness.cjs` → **58 pass / 0 fail / ALL PASS** at baseline and after every touching chunk; X-1 curve CSVs byte-stable (`git diff --stat -- tools/curves/` empty).
- **wfc-test (X-5 + any wfc-rules touch):** `node tools/wfc-test.cjs` → **12 pass / 0 fail** (was 7; +5 themed assertions). No wfc-rules.js edit this sprint.
- **Browser (debug Chrome :9222 via /open-chrome + `py -m http.server 3003`):** X-1 — Simulate blocked on invalid map (button `.disabled`, "Fix path first"), default valid map yields 6 rows (3 builds × 2 difficulties) all WON with plausible lives/gold, rides Status tab at 860px. X-2 — distinct `role=tabpanel` targets + roving tabindex + ArrowRight activates, resize kick fires on Status-show, auto-switch on feedback; 900–1100 narrow 3-col holds 8 heavy waves with **no horizontal overflow** (~909px), desktop 3-col unregressed. X-3 — round-trip + plain + tricky-string all pass. X-4 — Space behavior + focus re-land verified live. X-6 — Invested row `120g → 230g` / maxed `380g`, renders for aura towers. Console across all touched screens: only the pre-existing audio/favicon 404s, zero new errors.
- **In-game themed-fill verdicts (X-5b), quiet difficulty, screenshotted each:**
  | Map | Theme | Verdict |
  |---|---|---|
  | plains | plains (standard) | **Reads well** — path/slots clear, moderate patchy fill. |
  | forest | forest | **Reads well** — visibly denser trees (theme works); path corridor + slot pads stay clear (trees fill only non-path cells), so creep/tower legibility holds. |
  | tidewater | plains (standard) | **Reads well** — double S-bend path + slots clear. |
  | riverbend | forest | **Reads well** — matches forest density, path clearly cut. |
  | mountain | mountain | **Reads well (best legibility)** — rock/hill dominant, sparse trees, no dense quad clusters; low-profile rocks keep path + slots very legible. |
  | snowfall_pass | mountain (id-keyed snow palette) | **Reads well** — snow path visible, slots clear, green peek-through adds variety. Minor: the snow path has slightly lower contrast against white ground than the dirt paths do against green; path edges still read clearly. |

### Discrepancies / notes (recorded per bootstrap)

1. **X-2(c) premise vs. editor reality:** the bootstrap says "share-link import at <900px currently reports into a hidden tab." Verified false *for the editor*: `importJson` is only reachable from the Export-panel button, and the editor has no boot/hash import — the `#map=` decode is the *game's* boot handler, not the editor's. The auto-switch observer is the correct, unit-verified mechanism but is future-proofing rather than a live-bug fix. Implemented per the spec's letter; residual classified below.
2. **X-6 reading vs. numeric fix:** shipped the copy fix (Invested-context row + `→` projection) and deferred the numeric reshuffle, exactly as the bootstrap's fallback clause directs. The reshuffle was never attempted (copy fix suffices; the economy is signed off).
3. **Skill directives:** `/frontend-design` invoked once (consolidated) covering all UI surfaces this sprint — X-1 Simulate box/button, X-2 tabs (behavior-only, no new visuals), X-3 import feedback, X-4 game sheet, X-6 Invested row; token discipline held throughout (Simulate is `tool ember` ember-outline; Save stays the editor's sole gold fill; the Simulate/results box mirrors the established wave-shape rgba idiom rather than inventing colors; the Invested row reuses the stat-row idiom). `/find-adjacencies` invoked for the X-1 Simulate surface (5 angles triaged: 2 folded in — loss diagnosis + stale-dim; 3 deferred below). `/web-artifacts-builder` **not** invoked — same inapplicability as Sprints 1–2 (React/shadcn patterns don't fit the vanilla single-file codebase); the equivalent token/gold-budget critique was performed directly per the bootstrap's fallback clause.
4. **Adversarial diff review** ran once per chunk (fresh general-purpose subagent per `AI-Hub/prompts/adversarial-diff-review.md`, Pass-1 shape). Findings: X-1/X-3/X-4 clean; X-2 surfaced the (c)-inert observation (§1, recorded not fixed — it's a spec-premise gap, not a defect); X-5 surfaced the `hasOwnProperty`-vs-`in` coverage gap (**fixed** — added the `'constructor'` assertion); X-6 surfaced the current-vs-post-upgrade reframe weakness (**fixed** — added the `→` projection). No majors left unaddressed.

---

## Deferred items — every one classified

| Item | Classification | Rationale / dependency |
|---|---|---|
| **X-2(c) export auto-switch observer is inert in the current editor** (no UI path produces feedback while off the Export tab) | **fold-into-next-sprint** | The mechanism is correct + unit-verified and future-proofs the exact bug class. It becomes live the moment a save/share trigger is surfaced outside the Export panel (e.g. a topbar Save, or an editor-side share-link/hash import). Cheap follow-up if/when that lands; harmless meanwhile. |
| X-1 attrition-band coloring (highlight waves outside the D2 target band) in the sim results box | fold-into-next-sprint | Hard in a monospace `textContent` box (no per-char spans); wants a small DOM-table render. Nice-to-have author feedback, not blocking. |
| X-1 Simulate keyboard shortcut (Copy JSON has Ctrl+S; Simulate has none) | drop-with-reason | The shortcut sheet would need updating and the affordance is one click away; no author has asked. Revisit only if the sim becomes a frequent inner-loop action. |
| X-6 catapult tier-cost numeric reshuffle (make T1→T2 ≥ T1 placement) | drop-with-reason | The copy fix resolves the *reading*; a reshuffle perturbs the signed-off D2/economy and tier-efficiency monotonicity for a cosmetic concern. The Invested-context row is the sanctioned lever. Reconsider only if playtesters still read it as a bug *after* the copy fix. |
| X-4 Escape while a sheet is open pauses the game rather than closing the sheet (pre-existing; adversarial-review observation) | drop-with-reason | Out of X-4's Space-only scope; `actions.pause()` already closes sheets on the way to the pause screen (Sprint-2 W-4), so it's coherent, just not full modal-Escape containment. Bundle with a future modal-keyboard pass if one is scoped. |
| X-4 `u`/`s`/`n`/`f` shortcuts still fire through an open sheet (pre-existing; adversarial-review observation) | drop-with-reason | `u`/`s` acting on the open tower sheet's tower is coherent with the sheet being open; the modal guard was deliberately Space-only per spec. No reported confusion. |

**Nothing is classified schedule-now.** This sprint completed its own scope; the next turn's natural entry point is a **new ADR-036-successor planning cycle** (see below), not another chunk.

### Roadmap drain (explicit, per bootstrap)

ADR-036 §5 roadmap: **Now** (CH-1..CH-5) shipped in Sprints 1–2; **Next** (CH-6/CH-7 editor Group 7a/7b + the "simulate this map" spike) is now fully shipped — CH-6/CH-7 in Sprint 2, the Simulate affordance in this sprint's X-1. **Both the Now and Next columns are drained.** The remaining **Later** column is endless-mode (its own ADR before build, per D5), per-map leaderboards, and the Warden-cyan legibility re-check — none of which are dispatchable chunks without a fresh planning pass. The next turn should open a new planning cycle (a strategic review / successor ADR), not dispatch another CTD chunk.

---

## Known-unknowns

- **Bottom-sheet shell + new tab semantics on a real phone** — the WAI-ARIA tabs, roving tabindex, and 38vh sheet were verified via desktop-Chrome viewport emulation only; real-iOS safe-area (`100dvh`, home indicator vs the tab bar) and ~36px tab-target touch ergonomics unverified. *(standing operator item)*
- **Real NVDA/VoiceOver pass** — the new tabpanel/roving-tabindex wiring, the X-4 sheet focus re-land, and the Space-activation collision were verified as DOM-level focus/ARIA state via chrome-devtools, not with a real screen reader. Announcement order for tab switches and the focus re-land is unverified. *(standing operator item)*
- **Retune feel** — the harness proves completability + curve shape, not fun; ten minutes of human play on Mountain/spirited + Tidewater/quiet remains the missing verification. *(standing operator item)*
- **Real-iOS game HUD touch/safe-area** — the tower-sheet Invested row and the Space/focus follow-through on a physical device untested. *(standing operator item)*
- **X-1 sim fidelity vs. human play** — the three scripted builds are naive; a WON verdict proves completability, not balance. The results box is an author sanity check, not a balance oracle (documented behavior; the naive-build caveat is why a per-build breakdown is shown rather than a single verdict).
- **Snowfall path contrast** (new) — the snow path reads, but with less punch than dirt-on-green; whether it's a problem is a play-feel judgment a human glance would settle. Cosmetic; no one has reported it.

## Operational notes

- Nothing pushed — 7 commits (6 chunks + this hand-back) are local on `main`; deploying is the operator's call.
- `.gitignore` (operator's uncommitted edit) untouched and unstaged throughout; `chrome-mcp-profile/` never staged; the stray untracked `docs/handoffs/2026-05-31-…bootstrap.md` left as found.
- Each chunk staged only its own files by explicit path (never `git add -A`). X-4's `entities.js` comment rode in X-4's commit, as directed.
- Browser bring-up used the pre-authorized debug Chrome on :9222 (already attached; no relaunch needed) + `py -m http.server 3003`. chrome-devtools tools available throughout; no degrade-path fallback needed. Note: the game tab initially served a cached `input.js`/`ui.js` from a prior session — hard-reload (`ignoreCache`) was required to pick up game-code edits before in-browser verification.
