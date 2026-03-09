# ADR-009: Sudoku

**Status**: Accepted
**Date**: 2026-03-09

## Context

Sudoku is a solo puzzle game that adds variety to the collection. Unlike the other games, it is neither real-time nor adversarial — the challenge comes from the puzzle itself. It requires a puzzle generator and validator, which are algorithmically well-documented.

## Decision

Built a Sudoku puzzle game with generated puzzles at varying difficulty. The player fills a 9x9 grid so every row, column, and 3x3 box contains digits 1–9.

### Difficulty Levels

Difficulty scales via the number of given (pre-filled) cells:

| Level | Givens |
|-------|--------|
| Easy | 36–40 |
| Medium | 30–35 |
| Hard | 25–29 |
| Extreme | 20–24 |

### Puzzle Generation

1. `solveGrid` fills an empty 9x9 grid via randomized backtracking (shuffled 1–9 trial order)
2. Store the complete solution
3. Remove cells in random order, calling `countSolutions(grid, 2)` after each removal — if count !== 1, restore the cell. The limit=2 early exit makes uniqueness checks efficient
4. Stop when `totalGivens <= targetGivens`

Win detection validates by Sudoku rules directly (`getConflicts()` returns all-zero grid + all cells filled), not by comparing against the stored solution — any valid completion counts.

### Key Design Decisions

- 9x9 CSS Grid with thicker borders on 3x3 box boundaries (via `[data-col]`/`[data-row]` attribute selectors)
- Given cells visually distinct (bolder, non-editable) from player cells
- Number pad input for both desktop and mobile
- Pencil marks stored as ES6 `Set` objects per cell, rendered as 3x3 sub-grid of `<span>` elements
- `P` key toggles pencil mode; arrow keys navigate with wrap-around
- Real-time conflict highlighting using `--terracotta` color for violations
- Same-number highlighting: all cells sharing the selected cell's value get a subtle gold tint
- Full state persistence to `localStorage` (board, pencil marks with Set→Array serialization, difficulty) — the only game that survives page refresh mid-game
- Win state clears saved state so completed puzzles don't persist

## Files Changed

- `games/sudoku/index.html` — Game page with grid, number pad, inline CSS (438 lines)
- `games/sudoku/game.js` — Puzzle generation, validation, input, rendering (466 lines)
- `games/index.html` — Sudoku card added to gallery

## Verification

- Generated and solved puzzles at each difficulty level
- All generated puzzles have a unique solution
- Conflict highlighting works for invalid placements
- Pencil mark functionality works (toggle on/off, clear on firm placement)
- Puzzle state persists across page reloads
- Mobile usability confirmed (number pad tap targets)
