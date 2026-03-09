# ADR-006: Connect Four

**Status**: Accepted
**Date**: 2026-03-09

## Context

Connect Four is a solved game with well-understood strategy, making it ideal for AI-based gameplay. Its vertical drop mechanic provides a distinct interaction pattern compared to the grid-click games in the collection.

## Decision

Built a standard 7-column, 6-row Connect Four game where the player competes against an AI. First to connect four in a row (horizontal, vertical, or diagonal) wins.

### Difficulty Levels

| Level | Search Depth | Notes |
|-------|-------------|-------|
| Easy | 2 plies | 40% random, 60% minimax |
| Medium | 4 plies | Pure minimax |
| Hard | 7 plies | Pure minimax |
| Extreme | 11 plies | Pure minimax |

### AI Approach

Minimax with alpha-beta pruning. Key optimizations: center-column move ordering at every search node (columns sorted by proximity to center for better cutoffs), immediate-win shortcut before full search, and depth-weighted terminal scores (`100000 + depth`) for faster wins.

Evaluation uses asymmetric threat weighting: AI 3-in-a-row scores +50 but player 3-in-a-row scores −80, making the AI more defensive than aggressive by design. Center column bias adds +6 per piece.

### Key Design Decisions

- Board is `board[row][col]` with row 0 at top; gravity via `getLowestEmptyRow`
- Disc drop animation uses CSS `@keyframes` with `--drop-rows` custom property for height-correct animation, including bouncy overshoot (70% at +5%, 85% at −3%)
- Column hover preview: `.preview` class on the landing cell shows translucent gold fill
- Win cells pulse with infinite `winPulse` scale animation
- Player discs in accent-gold, AI discs in terracotta
- No score counter (unlike Checkers)

## Files Changed

- `games/connect-four/index.html` — Game page with inline CSS (266 lines)
- `games/connect-four/game.js` — Game logic, drop mechanics, AI (466 lines)
- `games/index.html` — Connect Four card added to gallery

## Verification

- Drop mechanics and gravity behavior work correctly
- Win detection verified for all four directions
- Draw state (full board) handled correctly
- AI plays reasonably at each difficulty level
- Column hover preview and responsive layout confirmed
