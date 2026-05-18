# Castle Tower Defense 3D — UX/UI Audit

**Date:** 2026-05-18
**Branch:** `refactor/castle-tower-defense-3d`
**Audit head:** commit `2c63dbc` (TIER 1 fixes shipped)

## 1. Methodology

Three parallel fresh-context subagents covered the surface in one pass, then a fourth `iterative-deepening-audit` subagent verified findings against the live code and hunted for second-order defects across phase seams.

| Subagent | Scope | Findings |
|---|---|---|
| A. Game routes | Title, map-select, play (incl. modals: pause, game-over, help, tutorial) | 21 |
| B. Cartographer editor | `tools/map-editor.html` toolbar, palettes, WFC controls, 3D preview, export | 28 |
| C. Cross-cutting | Accessibility (WCAG AA), mobile responsiveness, visual consistency, audio hygiene, loading UX | 33 |
| **Total raw findings** | | **82** |
| D. Iterative-deepening | Verified prior claims; gap-searched 15 additional dimensions (async asset race, drag-vs-tap, theme/WFC desync, etc.) | 4 refuted, 19 confirmed/extended |

After verification: **25 actionable items**, 4 false-positive claims refuted, 2 mis-stated mechanisms corrected.

## 2. Refuted by verification (NOT defects)

| Claim | Verdict | Why |
|---|---|---|
| "Path tool moves castle invisibly every click" (B M-3) | REFUTED | `map-editor.html:792` guards on `if (hit) { state.drag = hit; return; }`. Castle auto-follows path-end ONLY when no element was hit at the click point. Behavior is intentional and correct — the audit mis-read the control flow. |
| "Pause audio sliders don't apply live; require resume cycle" (C J) | REFUTED | `game.js:207-214` `input` listener calls `apply(v/100)` immediately, which writes directly to `musicGain.gain.value`. Sliders DO apply live. |
| "Keyboard 1-5 collision between editor and game" (N#11) | REFUTED | Different documents, different focus contexts. Not a real defect. |
| "Game-over `commitResult` skipped → Best shows just-finished losing score" (A #3) | REFUTED-AS-STATED, RETAINED | The MECHANISM was mis-stated (the issue isn't that `commitResult` is skipped — it's that the loss path doesn't read the persisted best). Real bug retained as T1. |

## 3. Verified actionable items (25)

### TIER 1 — functional regressions / a11y baseline (SHIPPED 2c63dbc)

| # | Defect | File:line | Severity | Status |
|---|---|---|---|---|
| T1 | Game-over modal shows wrong "Best" on loss — `commitResult` skipped, loss path doesn't read persisted best, so a 50,000-point all-time best is hidden when the next attempt scores 800. | `game.js:451` | CRITICAL | ✅ FIXED |
| T2 | Tutorial deadlock — canvas raycast gated on `data-screen==='play'`, but tutorial prompt instructs "tap a plinth". User can't act on the prompt; must click "Begin the watch" button first. | `input.js:113, 147` | CRITICAL | ✅ FIXED |
| T3 | Sub-threshold drag mis-places towers — `pointerup` raycasts at release point, not press point. 1–7px microdrift between tap-on-slot-A and release-over-slot-B places tower at B. | `input.js:147-155` | MAJOR | ✅ FIXED |
| T4 | No `:focus-visible` styles anywhere — keyboard users have no focus indicator on any button across title, map-select, pause, game-over, help, editor. WCAG 2.4.7 violation. | `index.html` CSS + `tools/map-editor.html` CSS | CRITICAL (a11y) | ✅ FIXED |
| T5 | Editor has no localStorage persistence — refresh / browser-crash / accidental Clear (after dismissing confirm) wipes all work. No recovery, no import flow. | `tools/map-editor.html` IIFE | CRITICAL | ✅ FIXED |
| T6 | `<meta viewport maximum-scale=1.0>` blocks pinch zoom across all UI (help modal, pause menu). WCAG 1.4.4 violation for low-vision users. | `index.html:5` | MAJOR (a11y) | ✅ FIXED |
| T7 | Cold-start placeholder meshes — `assets.preload()` critical-path is the first 10 manifest entries (towers); path tiles and decorations background-load. Page-load → BEGIN → map within ~1s on cold cache shows magenta cubes for path/decor briefly. | `assets.js:107`, `scene.paintTerrain` | MAJOR | DEFERRED to TIER 2 |

### TIER 2 — UX polish / discoverability

| # | Defect | File:line | Severity |
|---|---|---|---|
| T8 | Only `selectTower` plays `ui_click` — sheet open/close, pause, sell, upgrade, map-select, sheet-pick are all silent. `ui_back.ogg` loaded but never played. | `game.js` action dispatch | MAJOR |
| T9 | Unaffordable placement has visual `goldFlash` but no audio sting. Screen-reader users get nothing. | `game.js:288, 315, 328` | MAJOR |
| T10 | iPhone notch + home-indicator clipping — `viewport-fit=cover` set, but no `env(safe-area-inset-*)` consumers. `hud-top` clipped by status bar; `hud-bottom` overlaps home indicator. | `index.html:529-547, 590-597` | MAJOR |
| T11 | Help modal GOT IT button not sticky — entire `.help-modal` scrolls on short viewports; GOT IT goes below the fold. | `index.html:122` | MINOR |
| T12 | Pause-Restart silently wipes mid-wave progress — same visual weight as Resume, no confirm. Accidental tap loses ~all tower placements + wave progress. | `game.js:350-358` | MAJOR |
| T13 | Reduced-motion toggle only kills wave-clear wipe. Aura pulse, enemy bob, gold-flash, button :active transform, sheet slide-up, loading bar growth all ignore it. | `ui.js:326`, scene.js animations | MAJOR (a11y) |
| T14 | Pause cog button reachable via Tab through open help / pause modal (no `inert` on inactive screens) — keyboard focus can leak behind the overlay. | `index.html` screen containers | MINOR (a11y) |
| T15 | Map-select Quiet vs Spirited buttons are visually identical — only the label differs. New players can't tell Spirited is harder. | `ui.js:285-301` | MINOR |
| T16 | Gold / Wave / Lives counters have no `aria-live` — screen-reader users not notified when gold drops or lives are lost. | `index.html:530-540` | MAJOR (a11y) |
| T17 | Icon-only buttons (cog ⚙, ▶ send-wave, × close, ◂ return-link) and range sliders lack `aria-label`. Star strings `★★☆` read as "black-star black-star white-star". | `index.html` + `ui.js:290, 299, 318` | MAJOR (a11y) |
| T18 | Wave counter shows phantom "Wave 0 of 0" between `startMap` and first tick. | `index.html:535`, `ui.js:230-236` | MINOR |

### TIER 3 — editor authoring workflow

| # | Defect | File:line | Severity |
|---|---|---|---|
| T19 | Editor is one-way — `Copy JSON` exports but no import. Modifying an existing map requires hand-rebuilding every waypoint/slot/decoration from scratch. | entire `map-editor.html` | MAJOR |
| T20 | Editor has no undo/redo, no Ctrl+S → Copy, no Delete → remove selected, no Esc → cancel drag. Every misclick is permanent. | `map-editor.html:879-887` | MAJOR |
| T21 | Editor layout shatters below ~1024px — `grid-template-columns: 280px 1fr 360px` collapses; no media query. | `map-editor.html:67-75` | MAJOR |
| T22 | Canvas pill (yellow path-invalid overlay) only fires on diagonal/duplicate path failures — "castle far from path end", "slot non-integer coords", "no slots placed", "invalid waves JSON" silently fail in the sidebar. | `map-editor.html:1085-1094` | MAJOR |
| T23 | Decor Size toggle is invisible-state — single button reading "Size: normal" / "Size: large", no segmented control, no active fill. | `map-editor.html:417` | MINOR |
| T24 | Theme dropdown (plains/forest/mountain) doesn't change WFC palette — `rulesForMap` only branches on `map.id === 'snowfall_pass'`. Forest and mountain themes produce visually identical procedural fill. | `wfc-rules.js:127` | MINOR |
| T25 | Editor 3D preview hardcodes `scene.background = 0x6a8447` (plains green) — forest/mountain themes show green ground in preview regardless of canvas theme tint. | `map-editor.html:1198` | MINOR |

## 4. TIER 1 fix detail (shipped 2c63dbc)

| Fix | Implementation |
|---|---|
| **T1** | `showGameOver`: on loss path, `loadScores()[mapId][difficulty].bestScore` is read instead of letting `best` default to current score. |
| **T2** | New `isPlayLikeScreen()` helper that accepts `'play'` OR `'tutorial'`; `consumeEngineEvents` listens for `'place'` events and calls `setScreen('play') + markTutorialSeen()` when `tutorialActive` cleared. |
| **T3** | `onPointerDown` raycasts the press point and caches the hit on the `touches` map record; `onPointerUp` uses `rec.downHit` instead of re-raycasting at release coords. |
| **T4** | Shared `:focus-visible` rules in `index.html` (aged-gold outline, warm-stone for form controls) and `tools/map-editor.html` (aged-gold outline on buttons + tabindex elements). |
| **T5** | `scheduleAutosave()` debounces 400ms after every `refresh()` call; writes a snapshot `{ path, castle, slots, decorations, slotCounter, meta, wavesJson }` to `localStorage['ctd3:cartographer:v1']`. `restoreFromAutosave()` runs at editor boot before first render. Clear action wipes the key. |
| **T6** | Drop `maximum-scale=1.0` from `<meta viewport>`. Canvas keeps `touch-action: none` for its own gestures; the rest of the page is now pinch-zoomable. |

## 5. Confidence summary (post-verification)

- **Subagent A** (game routes) — useful but imprecise; A#3 named the right region with wrong mechanism. Trust with verification.
- **Subagent B** (editor) — sound except for one inflated severity (M-3 wrong about castle auto-follow). Otherwise the most actionable surface.
- **Subagent C** (cross-cutting) — most accurate of the three; A6/AU1 verified bit-for-bit. One inflated finding (J).
- **Subagent D** (iterative-deepening) — caught two false-positive claims, surfaced the actual mechanism behind T1, added 6 new findings the others missed (cold-start mesh race, sub-threshold drag bug, help-modal scroll trap, theme/WFC palette desync, cog tab-leak, backToMapSelect no resetPan).

## 6. Out-of-audit follow-ups (not in the 25 actionable list)

- Performance feel — wave-start camera/visual swell, wave-clear flash beyond the 4px gold-bar wipe, tower-placement scale-from-zero motion. Subjective; deferred until a dedicated motion-design pass.
- Audio palette breadth — victory/defeat reuse `wave_clear` (rate 0.85) and `castle_hit` (rate 0.7). Distinguishable but lazy. Deferred to a CC0-audio sourcing pass.
- `?test=1` "+10 lives" inflates `state.lives` past `startingLives`, so `computeStars` reads ratio >1. Test-only; not user-facing.
- `backToMapSelect` doesn't `resetPan` — title-screen background renders with stale camera offset. Cosmetic; next `startMap` resets so no leak.

---

**Total work**: 1 commit shipped (`2c63dbc`, 4 files, 127 insertions, 7 deletions) for TIER 1. TIER 2 = 11 items, TIER 3 = 7 items remaining.
