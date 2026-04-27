# ADR-017: Yahtzee

**Status**: Accepted (open questions resolved 2026-04-24; ready for `/frontend-design` and `/feature-dev:feature-dev`)
**Date**: 2026-04-24

## Summary

Add Yahtzee to chases.house as a self-contained client-side game at `games/yahtzee/`. v1 ships **solo** (high-score chase, persistent across sessions) and **local hot-seat 2–4 players** (same screen, alternating turns). Visual direction is warm midcentury felt-and-bakelite — green felt table, ivory dice, paper-cream scorecard — extending the site's existing gold/ember/sage tokens rather than introducing a new palette. No backend, no Firebase, no build step. Reuses `games/shared/gamepad.js` (ADR-016) for controller input; no other shared utility extraction is justified yet.

## Context

The existing gallery covers board strategy (Tic-Tac-Toe, Checkers, Connect-Four, Chess), puzzles (Sudoku, Crossword), arcade (Snake, Pac-Man), and party trivia (Jeopardy). What's missing is a **dice / push-your-luck** game and a true **couch hot-seat** experience that doesn't require phones-as-controllers. Yahtzee fills both holes with a 5–15 minute session length that suits a personal site, and it's a natural fit for static hosting because all state is client-side and turn-based.

The game's appeal is well-understood — five dice, three rolls, thirteen categories, agonizing risk decisions — but amateur recreations consistently get the rules slightly wrong (Yahtzee bonus eligibility, joker rules, Small Straight requirements, the requirement to score *something* every turn). This ADR records canonical rules so the implementation can be checked against them.

## Decisions

### Modes
- **Solo:** primary — score chase against personal best. Mid-game state persists in localStorage so a refresh doesn't kill a run.
- **Local hot-seat 2–4:** same device, alternating turns. Player names entered at setup; shared dice + per-player scorecards.
- **Online multiplayer, AI opponent, daily challenge:** out of v1 (see Out of scope).

### Rules (canonical — implementation must match)
- 5 standard d6, 3 rolls per turn (1 initial + up to 2 re-rolls of any subset of held/unheld dice).
- 13 categories, each scored exactly once. The player **must** score every turn (forced zero is legal and sometimes optimal).
- **Upper:** Aces…Sixes = sum of matching dice. **Upper bonus = +35 if upper subtotal ≥ 63.**
- **Lower:** 3-of-a-kind (sum of *all* dice, requires ≥3 matching), 4-of-a-kind (sum of all dice, ≥4 matching), Full House = 25, Small Straight = 30 (4 consecutive), Large Straight = 40 (5 consecutive), Yahtzee = 50 (5-of-a-kind), Chance = sum.
- **Yahtzee bonus = +100 per additional Yahtzee**, *only* if the first Yahtzee was scored as 50 (not zeroed).
- **Joker rule** for subsequent Yahtzees: must fill the matching upper box if still open; otherwise any open lower category at its face value (Full House → 25, Small → 30, Large → 40, etc.); only if upper *and* all unrelated lower are full may a player zero out an upper category.

### Controls
- **Keyboard:** Space = roll; 1–5 = toggle hold on dice 1–5; ↑/↓ = navigate scorecard; Enter = commit category; Esc = pause menu.
- **Mouse / touch:** tap die to toggle hold; tap scorecard row to preview score; tap again (or tap "Confirm") to commit.
- **Gamepad** (via `window.SharedGamepad`): A = roll / confirm; D-pad ←/→ = move dice cursor; A on a die = toggle hold; D-pad ↑/↓ = navigate scorecard. Focus shifts dice → scorecard automatically after roll 3 or when the player hits "Done."
- Accessibility: dice show pips **and** a small numeral; held dice carry a lock glyph (not just color); reduced-motion toggle disables tumble; full keyboard play.

### Persistence
- `localStorage["yahtzee-high-scores"]` — top 10 solo scores: `{ initials, score, date }`.
- `localStorage["yahtzee-state"]` — solo mid-game resume only. Hot-seat resume is intentionally out of v1 (multi-player resume UX is a tar pit).
- `localStorage["yahtzee-audio"]` — `{ musicVolume, sfxVolume, muted }`.

### Visual direction (handoff brief for `/frontend-design`)
- **Mood:** warm, tactile, midcentury felt-and-leather; bakelite dice; cozy den, not casino floor.
- **Era:** 1960s board-game-box meets walnut-and-brass club. Not pixel-art. Not Vegas neon.
- **Palette (extends site tokens, no new tokens):**
  - Felt table: site `--sage` `#6a7d5a` deepened.
  - Dice: bakelite ivory using site `--text-primary` `#f0e6d3`; pips in `--bg-deep` `#0a0a0b`.
  - Scorecard: paper-cream surface, ink-brown numbers in `--accent-ember` `#a06828`.
  - Celebration / preview highlight: `--accent-gold` `#c8943e` and `--accent-glow`.
- **Type:** Fraunces (display — title, "YAHTZEE!" fanfare, section labels), Bricolage (body — scorecard numbers, buttons). No new fonts.
- **Motion:** weighty dice tumble (~600 ms) with settle bounce; CSS-driven snap on hold toggle; explosive radial flash + gold particles on Yahtzee; site's existing `fadeSlideUp` for screen transitions.
- **Iconography:** custom SVG dice (sharp pips, soft shadow) — **no emoji dice**. Small SVG glyphs per scorecard category (pip stacks for upper section, house for full house, ladder for straights, crown for Yahtzee).
- **Background:** static felt texture using the existing site `<filter id="grain">` SVG noise; no parallax.
- **Signature flourish:** title screen has a small bakelite dice cup that rocks once every ~6 seconds during idle.

### Audio
- **Music:** optional ambient loop, off by default. Player toggles in pause menu.
- **SFX:** dice rumble, per-die landing click, hold-snap, hold-release, hover blip on scorecard, score-commit chime, upper-bonus ribbon flourish, **Yahtzee fanfare**, zero-out descending tone, game-over chime, menu nav tick, menu confirm.
- **Source:** CC0 samples (per Pac-Man precedent / ADR-014); synthesized fallback via Web Audio for the Yahtzee fanfare if no clean CC0 horn-sting is available.
- **Gate:** AudioContext resumes on first Roll click — no autoplay attempts.

### Architecture (handoff brief for `/feature-dev:feature-dev`)
- **Files:** `games/yahtzee/index.html`, `game.js` (state machine + main loop), `score.js` (pure scoring functions for all 13 categories — testable in isolation), `dice.js` (dice rendering + tumble animation), `audio.js` (Web Audio bus + SFX). Five files justified by single-responsibility separation; collapse to fewer only if a file ends up trivially small.
- **Module pattern:** `window.Yahtzee.{Game, Score, Dice, Audio}` (matches `games/chess/` multi-file precedent).
- **State:** single state object, explicit named phases (`title → setup → rolling → choosing → gameover`). No reducers, no event bus — direct mutation + render call is sufficient at this scale.
- **Render:** DOM + inline SVG for dice, CSS transitions for animation. Canvas is overkill for ~5 dice + 13 scorecard rows.
- **Tick loop:** none for the game itself (turn-based). CSS animations cover dice tumble; Web Audio handles its own scheduling. RAF only for the Yahtzee particle burst, and only if pure CSS keyframes can't hit it.
- **Shared utilities:** `games/shared/gamepad.js` (already exists). **No new shared module in v1.** A shared local-storage high-score utility is tempting but Yahtzee is the only concrete consumer today; per the gamepad ADR's pattern, extract on the second consumer, not the first.
- **Testing:** Chrome DevTools MCP per CLAUDE.md — title-screen screenshot, mode select, full solo round (force a Yahtzee via `evaluate_script` to verify the fanfare), hot-seat 2-player smoke test, mobile resize, zero console errors, zero failed network requests.

### Scope discipline (DRY · YAGNI · SOLID · KISS)

```
DRY:   gamepad already shared (ADR-016); audio + storage patterns exist
       elsewhere but with only one Yahtzee consumer there's no duplication
       to extract yet → no new shared modules.
YAGNI: AI opponent, online multiplayer, daily challenge, replay system,
       optimal-play hints — none required for a shippable v1.
SOLID: scoring rules live as pure functions in score.js (single
       responsibility, easy to verify against canonical tables); dice
       rendering decoupled from scoring; state machine has named phases.
KISS:  DOM + SVG + CSS animations + localStorage. No build step, no
       framework, no backend.

Decision: proceed.
```

## v1 scope (ship list)

- Solo mode with full canonical rules (all 13 categories, upper bonus, Yahtzee bonus, joker rule).
- Local hot-seat 2–4 players, shared dice, per-player scorecards.
- Title → setup → play → game-over → high-scores flow.
- localStorage solo high-scores (top 10) and solo mid-game resume.
- Keyboard, mouse/touch, and gamepad (via `SharedGamepad`) input.
- Visual direction: felt + bakelite + paper-cream extending site tokens; Fraunces / Bricolage; custom SVG dice.
- CC0 SFX inventory + optional ambient music; mute persisted.
- Yahtzee fanfare moment (gold burst + horn sting + dice glow).
- Upper-bonus ribbon flourish on first crossing 63.
- Reduced-motion toggle, colorblind-safe held-die marker (lock glyph, not just color).
- Idle title-screen flourish: dice cup rocks every ~6 s.
- Konami-code easter egg on title → next round uses gold dice (cosmetic only).

## Out of scope / follow-ups

Each is parked for a future ADR if interest surfaces; none are stubs in v1 code.

- AI solo opponent (would need an EV solver — separate ADR).
- Online multiplayer via Firebase Realtime DB (Jeopardy precedent exists; defer until demand).
- Daily fixed-roll challenge with Wordle-style emoji share grid.
- Replay system / shareable seed URLs.
- "Optimal play" hint mode.
- Photo-mode / shareable end-of-game result card image.
- Cross-game "House Cup" unified leaderboard across chases.house games (cross-cutting; needs its own ADR covering Snake, Sudoku, Crossword, etc.).
- Hot-seat mid-game resume.
- Custom dice skins / cosmetic unlocks.
- Triple Yahtzee, Yatzy, and other rule variants.

## Resolved questions (2026-04-24)

1. **Felt + dice palette:** keep the iconic, traditional Yahtzee look — green felt table, bakelite ivory dice with black pips. Site `--sage` deepened for the felt; `--text-primary` `#f0e6d3` for the dice; `--accent-gold` reserved for the celebration / preview highlight only.
2. **Music default:** start **muted** on first load. Player toggles in the pause menu; preference persists in `localStorage["yahtzee-audio"]`.
3. **Hot-seat scores:** **skip the high-score table for hot-seat entirely.** Hot-seat names are arbitrary and would pollute the solo leaderboard. Hot-seat shows its own end-of-game ranking screen with the round's player names but writes nothing to localStorage's high-score key.
4. **Konami easter egg:** **ship.** Activating Konami on the title (or pause menu) flags the next round to render gold dice — cosmetic only, no scoring effect.
5. **Gamepad support:** **ship as drafted.** Yahtzee will be the third consumer of `SharedGamepad` after Pac-Man and Jeopardy; the existing trimmed `BUTTONS` set (`A`, `DPAD_UP/DOWN/LEFT/RIGHT`) covers the controls described in §Decisions / Controls. No `SharedGamepad` API changes.

## Handoff (after review)

When the open questions are resolved:
1. Invoke `/frontend-design` with the **Visual direction** section above as the brief.
2. Invoke `/feature-dev:feature-dev` with the **Architecture** section above as the brief.
3. Build per CLAUDE.md protocol (DRY · YAGNI · SOLID · KISS), with Chrome DevTools MCP verification before marking complete.

Do **not** write game code before both skills have returned.
