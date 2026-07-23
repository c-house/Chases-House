# CTD3 Sprint 1 hand-back — ADR-036 (Prompt 2, direct single-session execution)

**Date:** 2026-07-23 · **Executor:** Claude (headless single session)
**Base:** `bff1c18` (as dispatched) · **Head after sprint:** `4e880b6`
**Sprint goal (ADR-036 §7):** give CTD a deliberately-designed economy verified by an
automated harness, and make every piece of shipped content reachable. **Met.**

---

## Progress

All six chunks LANDED, including the CH-6 stretch. Final harness state:
**58 pass, 0 fail, 0 known-fail — `ACCEPTANCE: ALL PASS`** (exit 0).

| Chunk | Status | Commit | Notes |
|---|---|---|---|
| CH-1 sim harness | **LANDED** | `e943706` | 3 scripted builds (greedy-cheapest / ranger-heavy / balanced) × 6 maps × 2 difficulties; per-wave curve CSVs committed under `tools/curves/`; hygiene checks incl. spawn-and-kill for all 10 enemy types with split AND spectral asserted; opened with 10 documented KNOWN-FAILs (4 dead Phase-5 types, 5 attrition declines, Tidewater stub) |
| CH-2 economy backbone | **LANDED** | `bfb2435` | `bountyMult` (quiet 1.0 / spirited 1.25) threaded through `mergedDifficulty`; single payout site `CTD3Entities.bountyFor()`; tier efficiency reshaped to monotone rising — ranger .224→.233→.268 (T3/T1 1.20×), catapult .128→.136→.154 (1.20×), mage .121→.130→.148 (1.23×); damage/cost only, archetypes untouched |
| CH-3 content wiring + retune | **LANDED** | `b2c08cc` | Tidewater 3→8 waves; Juggernaut on Mountain/Snowfall/Riverbend, Slime (+Mini Slime via split) on Forest/Tidewater, Ghost on Forest/Snowfall; all six maps monotone non-declining attrition w2→w7 (~0.62→~1.1), Mountain boss spike 1.58; all 10 KNOWN-FAILs cleared and registry emptied |
| CH-4 early-call bonus | **LANDED** | `0053fe8` | 20s prep countdown (armed on wave clear; never wave 1/tutorial); `earlyCallBonus()` pays floor(sec × rate), rate quiet 1.5 / spirited 2.5 g/s; EARLY CALL HUD chip + role=status award announcement; FF gated to in-wave; harness `early-call-banks-more` (1423g > 1213g) |
| CH-5 ADR-034 closeout | **LANDED** | `dbbc503` | T14 sheet-modal inert (+ teardown closes sheets so a stale sheet can't lock the next run); T9 "Not enough gold" SR announcement at all 3 unaffordable sites; T15 **verified, no change needed** (ember + ★ prefix, not color-alone); Group 5 Warden comment **already present** at scene.js:41-44 (shipped with Group 2 `e98b619`); ADR-034 status → Groups 1–6 SHIPPED |
| CH-6 editor Group 7a (stretch) | **LANDED** | `4e880b6` | Author-voice validator (collect-all-blockers rewrite), progress checklist, canvas re-ground, single-issue fading pill, rail reorder + closed `<details>`, topbar brand, KEY badges, Decor Size segmented pill, `?` sheet + first-visit tip, history cap 30 |

### Acceptance results

- **Harness (CH-1..CH-4 gate):** `node tools/sim-harness.cjs` — 58 pass / 0 fail / 0
  known-fail. All 36 map×difficulty×build runs WON; spirited strictly out-earns quiet on
  every map; tier-efficiency, coupling, early-call, attrition-monotone checks all green.
- **In-browser (CH-4):** chip ticks in prep, +11g paid and announced on early send, pulse
  suppressed under reduced-motion (this profile has it ON — gate verified live), fires
  when motion allowed. Zero new console errors.
- **In-browser (CH-5):** play HUD inert while sheet open (cog unfocusable), released on
  close and across restart; "Not enough gold" announced from a region outside the
  inert-able subtree; quiet/spirited card distinction screenshot-verified.
- **In-browser (CH-6):** blank session shows "Lay down a path" in ember (no terracotta);
  H8a reads the exact ADR acceptance string with faint `H8a` chip in both pill and
  checklist; multi-violation display verified (AXIS+WAVES_PARSE, H8a+H6); details closed
  by default and rebound on expand; Ctrl+Z restores; `?` opens/Esc closes the sheet
  (including from form fields); zero console errors (one benign favicon 404).
- **Sprint-opening findings → cleared:** the 10 CH-1 KNOWN-FAILs were all cleared by
  CH-3 as planned; the stale-KNOWN_FAILS warning mechanism confirms none linger.

### Discrepancies vs the ADR (recorded per bootstrap)

1. **ADR ledger vs source, Group 7:** ADR-036 §1 says Group 7 "NOT-STARTED; nothing
   landed", but map-editor.html already had undo/redo history, full keyboard bindings,
   import, and autosave (shipped earlier as audit T19/T20). CH-6 skipped those per the
   staleness guard and implemented only what was genuinely missing.
2. **ADR-034 T14 ledger:** "no inert anywhere" was stale — `setScreen()` inter-screen
   inert existed (Group 6 partial `be70b97`); the real residual was the sheet-modal case,
   which is what CH-5 shipped.
3. **D2 band vs monotone rise:** wave-5 attrition lands at 0.85–0.89 on all six maps,
   above the "~0.6–0.8 through waves 2–5" soft band. A smooth rise can't hold 0.8 at w5
   AND reach ~1.0–1.2 by w7 without a spike; the hard requirements (monotone, w7 band,
   boss spike, no decline) are all met. Conscious sign-off; revisit only if playtests
   read the mid-game as too hot.
4. **CH-2 completion "spirited pays visibly more per kill than quiet in-game":** verified
   at the engine/payout level (bountyFor 6g→8g; popup shows paid amount) and by harness
   totals, not by playing a full spirited run in-browser.

---

## Deferred items — every one classified

| Item | Classification | Rationale / dependency |
|---|---|---|
| **CH-7 editor Group 7b** (responsive bottom-sheet shell, 900/1100px breakpoints, theme→WFC + 3D-preview wiring) | **fold-into-next-sprint** | ADR-036 default; depends on CH-6 (landed). The `--canvas-*` theme tokens and `canvasWrap.dataset.theme` writes were deliberately left in place as its hooks. |
| Editor "simulate this map" affordance using the CH-1 harness | fold-into-next-sprint | ADR-036 roadmap "Next"; harness now exists |
| Editor override panel doesn't round-trip `bountyMult`/`earlyCallRate` per-map overrides (CH-2 review minor) | fold-into-next-sprint | Engine honors them; only the editor's authoring surface lags. Natural CH-7-adjacent form work. |
| Catapult T1→T2 upgrade (110g) now costs less than T1 placement (120g) — may read as a pricing bug (CH-2 review minor) | fold-into-next-sprint | Cosmetic/copy concern; consider a tooltip or cost re-shuffle next tuning pass. Mage already had this shape pre-sprint. |
| Harness `waveStats` handles only single-level splits; a future chain-split would silently undercount curves (CH-1 review minor) | fold-into-next-sprint | Add a recursive expansion or an assert when/if a chain-split type is authored. No such type exists. |
| Sheet-as-modal is Tab-only: Esc with a sheet open pauses the game and the sheet stays interactive above the pause screen (CH-5 review minor, pre-existing) | fold-into-next-sprint | Undercuts the modal story T14 formalizes; fix is closeSheets-on-pause or z-order rethink. Not introduced by this sprint. |
| No focus management into/out of the sheet `role="dialog"` (CH-5 review minor) | fold-into-next-sprint | Tab confinement works via inert; focus-move + restore is the remaining a11y polish. |
| Editor default boot map violates H8a (2u segment) so a fresh visit opens on a violation | fold-into-next-sprint | Pre-existing (H8a was promoted to block after the default was authored). One-line default-path fix; good first item for CH-7. |
| Plains wave-7 reward (15g) reads as a late-run payout regression in any UI that surfaces per-wave rewards (CH-3 review minor) | drop-with-reason | The reward trim is the sanctioned D2 lever; no UI currently surfaces per-wave rewards mid-run. Reconsider only if one is added. |
| Level-design W-rule "reward covers 50–90% of cheapest upgrade" now further violated by trimmed mid-run rewards | drop-with-reason | It's a warn-tier manual rule that pre-sprint maps already violated; D2 (an Accepted ADR decision) deliberately supersedes it for late waves. |
| Audio 404s (`bgm_loop.ogg`, `ambient_loop.ogg`) in console on static serve | drop-with-reason | Pre-existing, graceful fallback in audio.js; unrelated to this sprint. |
| `?test=1` `jumpToWave`/`test-jump-last` leave a live prep countdown attached to the jumped-to wave (CH-4 review minor) | drop-with-reason | Test-only surface; zero player-facing impact. |

Nothing is classified schedule-now: the sprint completed its own scope and the next
turn's natural entry point is the CH-7 dispatch.

---

## Known-unknowns

- **Screen-reader announcements are structurally correct but not NVDA/VoiceOver-verified.**
  T9 denial, T16 lives, and the early-call award were verified as DOM live-region state
  via chrome-devtools, not with a real screen reader. The 50ms clear-then-set pattern for
  repeated identical denials follows convention but SR coalescing behavior varies; an
  NVDA pass would settle it.
- **Real-device iOS behavior** (safe-area, touch targets for the new chip/pill/segmented
  control) — desktop Chrome emulation only this sprint.
- **Feel of the retunes.** The harness proves completability and curve shape, not fun:
  catapult now lands 90-damage T3 hits, waves 5–8 are substantially larger, and spirited
  pays 25% more — ten minutes of human play on Mountain/spirited and Tidewater/quiet is
  the missing verification.
- **Balanced-build margins on spirited** dipped as low as 6–11 lives pre-CH-3-retune and
  sit at 11–12 now; the scripted builds are naive, so human-difficulty headroom is
  unmeasured beyond "dumb builds still win".
- **Browser matrix:** verified in the debug Chrome only (Firefox/Safari untested this
  sprint; `inert`, `structuredClone`, CompressionStream were already in use pre-sprint).

## Operational notes

- Nothing was pushed — all 7 commits (6 chunks + this hand-back) are local on `main`;
  deployment remains the operator's call.
- `.gitignore` carries the operator's uncommitted edit, untouched and unstaged throughout.
- `/web-artifacts-builder` was not invoked for CH-6: its React/shadcn component patterns
  don't apply to the vanilla single-file editor; the equivalent critique (token
  discipline, gold budget, state legibility) was performed directly per the bootstrap's
  fallback clause. `/frontend-design` and `/find-adjacencies` were invoked as directed.
