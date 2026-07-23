# CTD3 Sprint 2 hand-back — ADR-036 (direct single-session execution)

**Date:** 2026-07-23 · **Executor:** Claude (headless single session)
**Base:** `852a2aa` (as dispatched; HEAD matched) · **Head after sprint:** `6b441d3` + this hand-back commit
**Sprint headline:** finish ADR-034 completely and clear the Sprint-1 deferred debts. **Met — ADR-034 is now fully SHIPPED (all 7 groups).**

---

## Progress

All seven chunks LANDED, in dispatch order (W-0 → W-6 → W-1 → W-2 → W-3 → W-4 → W-5).
Final harness state: **58 pass / 0 fail / 0 known-fail — `ACCEPTANCE: ALL PASS`** (exit 0). wfc-test: 7 pass.

| Chunk | Status | Commit | Notes |
|---|---|---|---|
| W-0 default-map fix + D2 note | **LANDED** | `71970e6` | H8a re-verified live before fixing (fresh boot showed the block). Minimal fix: first path leg z 4→5 (middle segment now 3u); castle/path-end untouched; S-bend kept. Fresh boot now "Ready to export" (one pre-existing warn-tier W2 about default wave spacing remains — unrelated to path geometry). level-design.md W7 gains the one-line ADR-036 D2 supersession note. |
| W-6 drawn-grid alignment | **LANDED** | `6e37dc1` | Grid lines moved from even-integer 2u pitch to half-integer 1u pitch — lines are now true tile borders (tile-grid GRID_SIZE=1). Verified numerically + visually: slots at even and odd coords both render centered in a cell; alphas and x=0/z=0 axis lines unchanged; grid stays subtle at ~43px/unit. snapForTool/placement untouched. |
| W-1 Group 7b responsive shell | **LANDED** | `1008d8b` | ≤1100px narrow 3-col (220/1fr/280, topbar wraps); <900px bottom-sheet shell (always-visible topbar, full-bleed canvas, Header/Status/Export tab bar, 38vh sheet — `.meta`/`.side` share the sheet grid cell, `.side` split via sg-status/sg-export classes); <700px terracotta "needs a desktop" banner. Two implementation bugs caught in-browser and fixed pre-commit: responsive block moved to end of stylesheet (source-order cascade), `setStatus` switched to classList so sg-status survives repaint. |
| W-2 Group 7b theme wiring + closeout | **LANDED** | `a97b78b` | `rulesForMap({id, theme})`: FOREST (tree-dense) and MOUNTAIN (rocky, no tree_quad) weight palettes in wfc-rules.js, hasOwnProperty-guarded, snowfall_pass id-keying preserved. THEME_BG retinted to pine `0x152821` / moss `0x1f3329` / sage-stone `0x2a4234`. All three themes verified visually distinct in the 3D preview (fill + bg tone); refresh fires 156ms after the dropdown change — the ~150ms is the ADR-030 §13 sanctioned preview debounce itself. Same commit flips ADR-034 status to **SHIPPED, all 7 groups** and updates ADR-036 §1 ledger. Game side effect (intended per ADR): forest/tidewater/riverbend/mountain maps now regenerate terrain fills with themed weights — visual only, no mechanics. |
| W-3 override round-trip | **LANDED** | `9575bc6` | bountyMult + earlyCallRate fields (blank = inherit) added to both Quiet/Spirited override panels; threaded through buildExportMap (floats, emitted only when set), import `_diffField`, the wave-shape overlay mirror, and (automatically) autosave/history. Round-trip verified in-browser: import → fields populate → re-export emits identical values. Engine already honored both keys (entities.js mergedDifficulty). |
| W-4 sheet-modal completion | **LANDED** | `e574155` | (a) `actions.pause()` now closes sheets before `setScreen('pause')` — covers Esc, Space, and any pause path. (b) Dialog focus management: invoker captured on first open (slot↔tower swaps keep the original), focus moves to first *enabled* button (falls back to close-×), restored on close after inert lifts; defensive teardown calls (startMap/restart) can't steal focus (wasOpen guard). Review caught a MAJOR — disabled first button (unaffordable pick / maxed Upgrade) no-ops focus() — fixed with `:not(:disabled)` chain and re-verified with gold=0 (focus lands on close-×). Sprint-1 inert wiring and teardown-on-restart preserved; harness ALL PASS after. |
| W-5 harness chain-split guard | **LANDED** | `6b441d3` | waveStats now walks the split chain recursively (grandchildren counted) with a cycle guard that throws; hygiene check 2 reachability made transitive. Behavior-preserving today: differential test over all 144 wave evaluations = 0 mismatches, curve CSVs byte-stable, harness numbers unchanged. Synthetic chain (1 big → 2 mid → 6 tiny) counts hp 240 / bounty 24 / count 9; cycles throw. |

**ADR-034 status: fully SHIPPED — all 7 groups.** Status line updated in the ADR; closure noted in ADR-036 §1 ledger (both in `a97b78b`).

### Acceptance results

- **Harness gate:** `node tools/sim-harness.cjs` → 58 pass / 0 fail / `ACCEPTANCE: ALL PASS` (run after W-4 and again after W-5). `tools/wfc-test.cjs` → 7 pass after W-2.
- **W-1 width bands (chrome-devtools, viewport emulation):** 1280 → desktop 3-col unchanged; 1024 → narrow 3-col, no overflow; 860 → bottom-sheet shell, tabs segment correctly (Header=form, Status=status+preview+wave shape, Export=actions+import+raw JSON), decor palette gets its own grid row; 650 → terracotta banner, toolbar wraps, no horizontal overflow.
- **CH-6 regression sweep inside the new shell (at 860, spot-checked 1024/1280):** H8a author-voice message + checklist + canvas pill on a live violation; Ctrl+Z restores; `?` sheet opens in-viewport and Esc closes; Import/View-raw details closed by default; onboarding pill intact. Zero console errors in the editor (one benign favicon 404).
- **W-2:** theme switch latency 156ms to preview refresh (= the designed 150ms debounce); plains/forest/mountain fills and background tones visibly distinct in screenshots.
- **W-4 in-browser:** sheet focus in/out verified (affordable → first pick; all-disabled → close-×; restore to cog); Esc with sheet open → pause screen with both sheets closed; resume returns to play. Game console: only the pre-existing audio-loop/favicon 404s.
- **Reduced-motion:** no new animation introduced anywhere this sprint (tab switching is an instant display toggle); existing pill-fade guards untouched.

### Discrepancies / notes (recorded per bootstrap)

1. **Editor import format vs its own export:** the Import JSON box strict-`JSON.parse`s and rejects the `registerMap({...});` statement the editor's own Copy JSON / raw-JSON preview produce (unquoted keys), despite the textarea placeholder saying "Paste registerMap({...}) payload here". It accepts the combined `{map, decorations}` JSON (the Save-to-My-Maps shape). Pre-existing; surfaced during W-3 verification. Deferred below.
2. **"within ~150ms" theme acceptance** is satisfied *by* the pre-existing ADR-030 debounce (fires at the boundary, not under it). Treated as compliant; noted in case the ADR author meant perceptibly-instant.
3. **Skill directives:** `/frontend-design` was invoked once before W-1 (its direction — rail-material sheet, ember hairline mirror, SMALLCAPS tabs as gold-text-not-fill, author-voice banner copy — governed all editor chunks); `/find-adjacencies` invoked for W-1 (5 adjacencies triaged: aria-controls fixed inline, 4 deferred below). `/web-artifacts-builder` was **not** invoked — same inapplicability as Sprint 1 (React/shadcn patterns don't fit the vanilla single-file editor); the equivalent critique (cabin-token discipline, gold budget — active tab is gold text/underline, not a fill; Save remains the sole gold fill) was performed directly per the bootstrap's fallback clause. For W-0 (2-value data change) and W-6 (one canvas loop) no separate per-chunk skill invocations were made — the W-1 direction and reviews covered them; recording this as a deviation from the letter of step 5.
4. **Bootstrap's "exactly one @media (max-width: 1100px)"** staleness probe: the file also had two `prefers-reduced-motion` queries — matched the probe's intent (one *width* collapse); proceeded.

---

## Deferred items — every one classified

| Item | Classification | Rationale / dependency |
|---|---|---|
| **"Simulate this map" editor affordance** — spike note below | **fold-into-next-sprint** | Design settled (see spike note); implementation is a natural next-sprint S-M chunk now that the harness and Group 7b shell exist. |
| Catapult T1→T2 upgrade (110g) cheaper than T1 placement (120g) reads as pricing bug | fold-into-next-sprint | Carried from Sprint 1; next tuning pass (tooltip or cost reshuffle). |
| Editor Import doesn't accept the `registerMap({...})` statement its own export/clipboard produces (discrepancy §1) | fold-into-next-sprint | Small parser shim (strip wrapper, JSON5-ish key quoting or emit-side change); improves author loop. |
| W-1: ARIA tabs incomplete — Status/Export share `aria-controls="panel-side"`, no `role="tabpanel"`, no arrow-key roving tabindex | fold-into-next-sprint | New surface, operable today (Tab/Enter); full WAI-ARIA tabs pattern is polish. |
| W-1: 3D preview canvas can render at a stale size if left open while switching sheet tabs <900px | fold-into-next-sprint | Needs a resize kick on tab-show; cosmetic, desktop users unaffected. |
| W-1: import/save status lines live in the Export tab — a share-link import at <900px can report into a hidden tab | fold-into-next-sprint | Consider auto-switching to Export tab on import/save feedback. |
| W-2: no wfc-test coverage of themed palettes (tests only pass `{id}`) | fold-into-next-sprint | 2–3 assertions in wfc-test.cjs (forest tree weight, mountain fallback, bogus-theme fallback). |
| entities.js override-shape comment omits `earlyCallRate` (code honors it) | fold-into-next-sprint | One comment line; W-3 was barred from engine edits — ride along with the next engine-touching chunk. |
| W-4: Space on a focused sheet button pauses (input.js play-screen Space binding) instead of activating the button | fold-into-next-sprint | Pre-existing key wiring; now the designed keyboard landing spot, so worth an `if sheet open → ignore Space-pause` guard. Pair with next item. |
| W-4: disabling the focused Upgrade button on post-upgrade repaint drops focus to body inside the open dialog | fold-into-next-sprint | Pre-existing, amplified by focus management; fix = move focus to Sell/close-× when disabling the focused control. |
| W-0: users with a pre-sprint autosave still restore the old H8a-violating default path | drop-with-reason | Autosave preserving in-progress work is by design; self-heals on Clear/New/import; dev-profile-only population. |
| W-6: no drawn line at the world clamp bounds (±14/±9) — an object clamped to the extreme edge sits 0.5u outside the outermost grid line | drop-with-reason | Grid draws *tile borders*; a world-boundary indicator is a different affordance no one has asked for. Revisit only if authors report confusion. |
| W-1: banner background `rgba(176,90,58,0.08)` is a terracotta-alpha literal | drop-with-reason | Matches the file's established `.tool.warn:hover` idiom; border/text use `var(--terracotta)`. |
| W-2: snowfall_pass THEME_BG entry unreachable from the editor theme dropdown (snow map's meta theme is 'mountain') | drop-with-reason | Pre-existing id-vs-theme routing; snow preview bg is now darker sage-stone — acceptable contrast; revisit only if a snow map is authored in-editor. |
| W-5: `splitCount: 0` means 2 (|| 2 convention, harness + engine consistent) | drop-with-reason | Consistent everywhere; no author writes 0 today; schema change is its own decision. |
| W-5: cycle guard throws late in the run (engine spawn checks would surface a cycle first, as sim-cap FAILs) | drop-with-reason | Guard's purpose (waveStats can't hang/undercount) is met; ordering of symptoms is immaterial. |

---

## Stretch spike — "Simulate this map" editor affordance (design note, not implemented)

**Approach.** Run the CH-1 scripted-build sim *in the editor page*, against the editor's live map. The three window-IIFE runtime modules load cleanly in a browser (the harness's only shim is `global.window = {…}` for Node); the editor already loads `entities.js`. The sim core to reuse is sim-harness.cjs's scripted-build runner (greedy-cheapest / ranger-heavy / balanced × quiet/spirited at fixed 16.67ms ticks with auto-send).

**Where the engine loads from.** Extract the scripted builds + run-loop from `tools/sim-harness.cjs` into a shared window-IIFE module (e.g. `tools/sim-core.js` exposing `window.CTD3SimCore.runScripted(map, difficulty, build)`); sim-harness.cjs requires it through the same `global.window` shim so there is exactly one implementation. The editor adds `<script src="../engine.js">` + `<script src="sim-core.js">` (engine.js only defines `CTD3Engine`; auto-boot lives in game.js, which is NOT loaded). The map object fed in is `buildExportMap()` — the identical shape maps.js registers, difficultyOverrides included, so the new W-3 fields feed straight into simulated economy.

**UI placement.** Right rail (sg-status group), below Wave shape: an ember-outline "Simulate" button; results render as a compact monospace box in the same idiom as Wave shape — per build×difficulty: WON/LOST, lives left, final gold — plus the wave-level attrition column. Blocked while validation fails (same gating as Copy JSON). At <900px it rides the Status tab.

**Runtime cost.** The harness runs 36 full sims in a few seconds of Node; one editor map × 2 difficulties × 3 builds is well under a second — synchronous with a "Simulating…" state is acceptable for v1; a Web Worker is the upgrade path if long custom wave lists jank.

**Build cost estimate.** S–M (half-day): sim-core extraction (mechanical), script tags, ~60 lines of UI + wiring, harness re-verified unchanged. Risk: low — extraction is behavior-preserving and the harness gate catches drift.

**Prototype behind a query flag:** not attempted — session budget went to the seven landed chunks and their verification; the note above is the deliverable per the bootstrap.

---

## Known-unknowns

- **Bottom-sheet shell on a real phone** — verified via desktop-Chrome viewport emulation only; real-iOS safe-area interplay (`100dvh`, home indicator vs the tab bar) and touch ergonomics of ~36px tab targets unverified. A 5-minute phone check would settle it.
- **Themed WFC fills in the actual game** — forest/tidewater/riverbend/mountain now generate different terrain-variant distributions. Verified in the editor 3D preview and by rules-level unit checks; not eyeballed in-game per map. Cosmetic only, but a play-screen glance per map would confirm nothing reads worse (e.g. forest tree density vs tower visibility).
- **Sheet focus management with a real screen reader** — DOM-level focus verified via chrome-devtools; NVDA/VoiceOver announcement order for the dialog open/close (and the Space-pause collision) unverified. Carried from Sprint 1: **real NVDA/VoiceOver pass** for all live regions remains the standing operator item.
- **Retune feel** (standing, Sprint 1): ten minutes of human play on Mountain/spirited + Tidewater/quiet.
- **Real-iOS touch/safe-area for the game HUD** (standing, Sprint 1).
- **Editor at 900–1100px with long custom content** — narrow 3-col verified with default content; very long wave JSON / many decorations in a 220px rail unprofiled.

## Operational notes

- Nothing pushed — 8 commits (7 chunks + this hand-back) are local on `main`; deploying is the operator's call.
- `.gitignore` (operator's uncommitted edit) untouched and unstaged throughout; `chrome-mcp-profile/` never staged; the stray untracked `docs/handoffs/2026-05-31-…bootstrap.md` left as found.
- Per-chunk adversarial diff reviews ran per `AI-Hub/prompts/adversarial-diff-review.md` (single-pass form per bootstrap): 1 MAJOR found and fixed pre-commit (W-4 disabled-button focus), 2 pre-commit minor fixes applied (W-6 comment overclaim, W-1 sheet scroll reset), all remaining minors classified above.
- Browser verification used the already-running debug Chrome on :9222 (open-chrome skill probe) + `py -m http.server 3003`; the Chrome window twice minimized mid-run (screenshot timeouts) — recovered via windows-mcp App switch; viewport emulation used thereafter.
