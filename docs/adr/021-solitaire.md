# ADR-021: Solitaire (Klondike)

**Status**: Accepted
**Date**: 2026-04-25

## Summary

Add Klondike Solitaire to the games gallery as the first card game and the first short-session zen game on the site. Single-player only, draw-1/draw-3 rules with selectable redeal limit, mahogany-felt-with-lamp-halo visual direction (a deliberate inversion of Microsoft 3.1's bright green table), DOM-rendered cards with mouse / keyboard / touch / gamepad input, and a non-negotiable iconic win cascade. No backend; daily deal is date-seeded; persistence via `localStorage` like Sudoku.

## Canonical reference

"Solitaire" in the Western/PC sense = **Klondike** (the Wes Cherry / Microsoft 3.1 default that became culture). Lineage: 19th-c. Patience → Klondike → FreeCell, Spider, Pyramid, TriPeaks. Core loop: move all 52 cards to four foundation piles A→K by suit, drawing from the stock and arranging the seven tableau columns in alternating-color descending sequences. Iconic moments to deliver: (1) the win cascade — bouncing cards spilling from the foundations; (2) the auto-complete trigger when the board is fully revealed; (3) the moment the last stock card flips. Easy-to-get-wrong rules — three-card vs one-card draw, kings-only on empty columns, foundation→tableau move legality, multi-card move legality (run must itself be a valid sequence and the destination must accept the *top* card of the run), auto-flip of newly exposed face-down cards, redeal-limit interaction with scoring mode — all called out so the engine handles them on day one.

## Decisions

- **Mode**: solo only. Local versus / online multi / spectator-host all dropped — Klondike is a solo form and the existing party-game slot is filled by Jeopardy.
- **Rules toggles**: draw-1 / draw-3, redeal ∞ / 3 / 1, Standard / Vegas / Untimed scoring. Settings exposes a single difficulty radio: **Easy** (draw-1, redeal ∞, Untimed) / **Medium** (draw-1, redeal ∞, Standard) / **Hard** (draw-3, redeal ×3, Vegas) / **Custom** (unlocks the raw toggles). One UI for both audiences — newcomers see a coddled preset, Klondike veterans switch to Custom.
- **Persistence**: `localStorage` keyed `chases-house:solitaire:*` — game state, undo stack, settings, stats. Same precedent as Sudoku (ADR-009).
- **Daily deal**: date-seeded RNG, calendar widget in stats, no leaderboard. v1 ships *random* daily deals (not solvability-checked), labeled "Random — not all are winnable." **Streak rule (v1) = consecutive days with any daily attempt (≥1 move)** — an engagement metric, not a skill metric. Win-rate is tracked separately and is the skill metric. This dodges the "I lost an unwinnable seed and broke my streak" trap. v2 (when an offline solver lands in a Web Worker) introduces a verified-winnable daily and a parallel consecutive-wins streak.
- **Controls**: drag-and-drop and tap-to-select-then-tap-target both work without a mode switch. Keyboard cursor (arrow keys + 1–7 to focus columns, `Space` draw, `U` undo, `H` hint, `N` new, `A` auto-foundation, `Esc` pause). Gamepad via shared `SharedGamepad` (ADR-016) — D-pad navigate, A pick/place, B cancel, X draw, Y hint, L1/R1 undo/redo, Start pause. **Action: extend `SharedGamepad.BUTTONS` additively** with `B (1)`, `X (2)`, `Y (3)`, `L1 (4)`, `R1 (5)`, `START (9)`. Verified that Pac-Man (`games/pacman/input.js`) and Jeopardy (`games/jeopardy/player.js`, `couch.js`) read specific keys and never iterate the map — extension is non-breaking. One source of truth, DRY. (`SELECT`, triggers, stick-clicks all skipped — YAGNI.)
- **Accessibility**: four-color deck toggle (♥ red, ♦ blue, ♣ green, ♠ black) for color-vision differences; `prefers-reduced-motion` short-circuits the cascade to a quick fade; full keyboard cursor parity with mouse; large touch hit-radii on mobile.
- **Visual direction**: mahogany felt + warm overhead lamp halo, dark and considered rather than bright Windows green. Extends site tokens (gold `#c8943e`, ember `#a06828`, text `#f0e6d3`, bg `#0a0a0b`); introduces one new token — oxblood/walnut felt `#2a1a14` — kin to terracotta. Card faces cream with rich-black/oxblood-red suits. **Card back = tessellated Fraunces `&` glyph in gold on oxblood** — the ampersand is Fraunces's showcase character (Fraunces ships ~12 historical & variants), already loaded, distinctive without being a brand mark, scales cleanly. Card-tilt-on-grab is the signature flourish.
- **Typography**: card rank corners use **Bricolage Grotesque** (already loaded body font) — variable-axis grotesque, optimal readability at small rank-corner sizes. Suit symbols are **custom inline SVG** for full visual control and to sidestep the Unicode-emoji-vs-text rendering hazard across platforms. Headings stay Fraunces. **No new font load.**
- **Audio**: synthesized Web Audio SFX bus (`OscillatorNode` + envelopes, ~13 sounds). **Silence by default — no music in v1.** SFX + the lamp halo + the cascade carry the mood. Music gets revisited only if playtesting feels thin. Mute toggle persisted.
- **Tech approach**: DOM rendering (52 nodes is trivial; native drag-drop and a11y come free), CSS animations via the FLIP pattern, no persistent RAF loop except during the cascade physics. Module pattern: IIFEs writing to `window.SolitaireEngine / Deal / Render / Input / Audio / Game` — same site convention as Chess and Pac-Man.
- **File layout** (deferred to `/feature-dev:feature-dev` for the detailed pass): `index.html`, `game.js`, `engine.js` (pure state + rules + undo), `deal.js` (seeded shuffle + daily seed), `render.js` (DOM only), `input.js` (mouse/touch/keyboard/gamepad), `audio.js` (Web Audio synth bus). Six files, each with a single responsibility; no `ui.js` because menus are inline overlays, not a screen graph.

## v1 scope (ship)

- Klondike rules: draw-1 / draw-3, redeal ∞ / 3 / 1, Standard / Vegas / Untimed scoring
- Difficulty radio: Easy / Medium / Hard / Custom
- Daily deal (date-seeded), engagement-streak rule, "Random — not all winnable" disclosure
- Mouse drag-drop, click-tap, keyboard cursor, gamepad via `SharedGamepad`, mobile touch
- Hint button (always available; deducts in Standard scoring)
- Undo (unlimited) and redo
- Four-color deck toggle, `prefers-reduced-motion` respect
- Win cascade animation — iconic moment, must ship
- Auto-complete button surfaces once the board is fully face-up and stock is empty
- Pause / resume / mid-game persistence to `localStorage`
- Stats: plays, wins, win %, best time (Standard), best score (Vegas), engagement streak, longest engagement streak, daily-attempted calendar
- Inline first-run tutorial (3 dismissible arrow steps)
- Konami-code easter egg: 52-card pickup, then auto-redeal
- Synthesized SFX (card pick / drop / flip / stock draw / illegal-flash / foundation-place ascending pitch / cascade bounces / hint pulse / menu confirm), persisted mute toggle
- Mahogany-felt visual direction with Fraunces-`&` tessellated card back
- Game card on `games/index.html` with `solo` tag and a card-fan icon
- `SharedGamepad.BUTTONS` extended (additive) with `B / X / Y / L1 / R1 / START`

## Out of scope (v2 / follow-up ADRs)

- Solvability solver + verified-winnable daily + consecutive-wins streak
- FreeCell, Spider, Pyramid, TriPeaks (each its own engine, each its own ADR)
- Replay viewer (move-list playback)
- Shareable PNG result card / Wordle-style emoji result string
- Achievement set (first win, sub-90s win, 10-win streak, daily ≥7)
- Date/holiday card-back skins
- Photo mode
- Site-wide high-contrast mode (separate accessibility ADR)
- Dynamic favicon that reflects game state
- Background music
- Cross-game "house cup" leaderboard — dropped (no backend, and aggregating skill across genres is meaningless)

## Resolutions on initial open questions

1. **Card display font** → Bricolage Grotesque (already loaded) for rank corners; custom inline SVG for suit symbols. KISS + DRY + zero new payload. The "playing card" feel comes from the suit shapes, not the rank face.
2. **Music** → silence by default. SFX + lamp + cascade carry the mood. Revisit only if playtesting feels thin.
3. **Daily deal solvability** → ship random in v1, labeled. Streak counts engagement (≥1 move), not wins, so unwinnable seeds don't punish players. v2 solver introduces verified-winnable dailies and a parallel consecutive-wins streak.
4. **Difficulty branding** → single radio with Easy / Medium / Hard presets + Custom escape hatch. One UI, both audiences served.
5. **Card-back design** → tessellated Fraunces `&` in gold on oxblood. Showcase glyph of the site's display font; distinctive without being a brand mark. `/frontend-design` chooses density and variant rotation.
6. **`SharedGamepad.BUTTONS` extension** → extend additively. Confirmed Pac-Man and Jeopardy read keys directly and never iterate the map, so non-breaking. One source of truth across all current and future games.

## Architectural decision (DRY · YAGNI · SOLID · KISS)

```
DRY:   Reuse SharedGamepad — extend BUTTONS additively, single source of truth.
       Reuse Fraunces and Bricolage Grotesque — no new font load. Do NOT extract a
       shared high-score store or shared seeded-RNG yet — Sudoku has its own and
       a third consumer hasn't surfaced. Audio init duplicates Web Audio
       boilerplate from Pac-Man; accept it (Pac-Man's audio is sample-coupled).

YAGNI: Drop or park solvability solver, variants (FreeCell/Spider/etc.), replay
       viewer, share-card, achievements, photo mode, holiday skins, music,
       dynamic favicon, SELECT/trigger/stick-click button additions. v1 ships
       only what serves the core loop and the cascade.

SOLID: engine.js = pure state + rules. render.js = DOM only. input.js = events
       only. deal.js = seeded shuffle only. audio.js = sound only. game.js =
       wiring. Enforced in code review — no DOM access from engine, no rule
       logic in render.

KISS:  DOM over Canvas. No RAF except cascade. CSS animations over JS animation
       library. No solver. No backend. Synthesized SFX (oscillators) over
       samples. No build step. Inline CSS in index.html per site convention.

Decision: Proceed.
```

## Verification plan

Per CLAUDE.md Chrome DevTools MCP protocol, after implementation:

- Navigate to `localhost:3003/games/solitaire/`, `wait_for` foundations + tableau visible
- `take_snapshot`, drag waste → tableau, snapshot again, verify card landed
- Trigger illegal drop, verify red flash + snap-back
- Dev hotkey to force a near-win state, verify cascade plays without console errors
- `resize_page` 375×812 (mobile), screenshot, verify 7 columns fit
- `list_console_messages types: ["error"]` → 0
- `list_network_requests` → only fonts and own JS, no 4xx/5xx
- Reload mid-game → state restored from `localStorage`
- Toggle `prefers-reduced-motion` in DevTools → cascade fades instead of bouncing
- Plug in a gamepad → `SharedGamepad` toast appears, D-pad cursor moves, A pick/place works

## Files (planned)

```
games/solitaire/
├── index.html                            new — page shell, HUD, drawer, win modal, inline CSS
├── game.js                               new — entry, glue, state machine
├── engine.js                             new — pure board state, rules, undo/redo
├── deal.js                               new — seeded shuffle, daily seed
├── render.js                             new — DOM card rendering, FLIP animations
├── input.js                              new — mouse/touch/keyboard/gamepad
└── audio.js                              new — Web Audio synth bus

games/shared/
└── gamepad.js                            modified — extend BUTTONS with B/X/Y/L1/R1/START

games/index.html                          modified — Solitaire card added to gallery

docs/adr/
└── 021-solitaire.md                      this file
```

## Status

**Accepted.** Ready to hand the visual decisions in §"Decisions" + the v1-scope visual items to `/frontend-design`, and the architecture decisions + tech approach to `/feature-dev:feature-dev`.
