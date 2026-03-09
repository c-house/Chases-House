# ADR-004: Tic Tac Toe

**Status**: Accepted
**Date**: 2026-03-09

## Context

Tic Tac Toe is the first game for the games section. Its simplicity made it ideal for establishing the patterns and conventions (file structure, styling, AI architecture, difficulty model) that all subsequent games follow.

## Decision

Built a classic 3x3 Tic Tac Toe game where the player competes against an AI opponent. Player is X and goes first.

### Difficulty Levels

- **Easy** — AI makes random moves
- **Medium** — 70% minimax (optimal), 30% random
- **Hard** — Full minimax, no randomness (unbeatable)
- **Extreme** — Identical to Hard (minimax is already perfect for 3x3; exists for UI consistency)

### AI Approach

Minimax with depth-weighted scoring (`10 - depth` for wins, `depth - 10` for losses) — the AI prefers quicker wins and delays losses. No alpha-beta pruning needed; the 3x3 game tree is small enough for full-depth search. The board is mutated in-place during search and restored (no cloning), which is efficient for this size.

### Key Design Decisions

- Board is a flat `Array(9)` with `data-index` attributes on static HTML cells (never recreated)
- Player marks styled in accent-gold, AI marks muted
- Win cells get `.win-cell` class; player wins in gold, AI wins in muted tone
- Keyboard accessible (Enter/Space on cells)
- Status bar uses `innerHTML` with `<span class="highlight">` for gold emphasis — pattern reused across all games
- No score tracking or session persistence
- Default difficulty is Medium

## Files Changed

- `games/tic-tac-toe/index.html` — Game page with inline CSS (263 lines)
- `games/tic-tac-toe/game.js` — Game logic, AI, DOM interaction (213 lines)
- `games/index.html` — Tic Tac Toe card added to gallery

## Verification

- Played through at each difficulty level
- Hard/Extreme AI is unbeatable (minimax optimal)
- Win, loss, and draw states display correctly
- Responsive layout and theme consistency confirmed
