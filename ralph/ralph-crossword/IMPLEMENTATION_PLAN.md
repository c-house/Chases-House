# Crossword Game — Implementation Plan
_Last updated: 2026-03-10_

## In Progress
(none)

## Todo

- [ ] **[CW-004]** Input handling — selection, typing, navigation [engine]
  - Acceptance: Click selects cell; click same cell toggles direction; A–Z places letter and auto-advances; Backspace clears/retreats; arrow keys navigate; Spacebar toggles direction; Tab/Shift+Tab jumps between words; clicking a clue selects its first empty cell; word highlighting updates on every selection change
  - Files: `games/crossword/game.js`
  - Click cell to select; click same cell to toggle across/down direction
  - A–Z places letter and auto-advances to next empty cell in current word
  - Backspace clears current cell; if empty, retreats and clears previous
  - Arrow keys navigate between non-black cells
  - Spacebar toggles direction
  - Tab/Shift+Tab jumps between words (next/previous clue)
  - Clicking a clue in the panel selects its first empty cell
  - Update word highlighting and active clue on every selection change
  - Depends on: CW-003

- [ ] **[CW-005]** Timer — count-up with pause/resume [engine]
  - Acceptance: Timer displays MM:SS; starts on first letter entry; pause/resume button works; auto-pauses on tab hidden; auto-resumes on tab visible
  - Files: `games/crossword/game.js`
  - Count-up timer displayed in toolbar area
  - Pause/resume toggle button
  - Auto-pause on `document.visibilitychange` (tab hidden)
  - Auto-resume on tab visible
  - Display as MM:SS format
  - Timer starts on first letter entry (not on page load)
  - Depends on: CW-003

- [ ] **[CW-006]** Check/Reveal — toolbar buttons and cell flag rendering [engine]
  - Acceptance: Check Letter/Word marks incorrect cells with terracotta style; Reveal Letter/Word fills correct answer with revealed style; revealed cells are locked from further input; re-render updates immediately
  - Files: `games/crossword/game.js`
  - Four toolbar buttons: Check Letter, Check Word, Reveal Letter, Reveal Word
  - Check marks incorrect cells with `.checked-incorrect` (terracotta)
  - Reveal fills correct letter with `.revealed` style (faint/italic)
  - Revealed cells are locked (no further input)
  - No keyboard shortcuts for check/reveal (prevent accidental use)
  - Re-render affected cells after each action
  - Depends on: CW-004

- [ ] **[CW-007]** Persistence — save/load state, best times [engine]
  - Acceptance: Full game state persists to localStorage after every action; page reload restores grid, timer, selection; completion clears saved state; best times per difficulty saved and displayed
  - Files: `games/crossword/game.js`
  - Save full state to localStorage after every action: `playerGrid`, `cellFlags`, timer elapsed, `selectedCell`, `direction`, current puzzle ID, difficulty
  - Restore state on page load if saved state matches current puzzle
  - Clear saved state on puzzle completion
  - Best times per difficulty saved to localStorage
  - Display best time in win overlay or status area
  - Depends on: CW-005, CW-006

- [ ] **[CW-008]** Daily puzzle — djb2 date hash, daily/random mode [engine]
  - Acceptance: Daily mode selects deterministic puzzle per date via djb2 hash; Random mode picks a different puzzle; toggle between modes works; default is Daily on page load
  - Files: `games/crossword/game.js`
  - Implement `djb2(string)` hash function
  - Daily mode: `djb2(YYYY-MM-DD) % poolSize` selects today's puzzle per difficulty
  - Random mode: pick random puzzle from pool (not today's)
  - Toggle between Daily and Random modes in UI
  - Default to Daily mode on page load
  - Depends on: CW-003

- [ ] **[CW-009]** Add crossword card to `games/index.html` gallery [ui]
  - Acceptance: Crossword card appears in games gallery with correct link to `games/crossword/`; styling matches existing game cards
  - Files: `games/index.html`
  - Add a crossword game card matching existing card style
  - Include title, description, and link to `games/crossword/`
  - Position in gallery alongside existing 6 games
  - Depends on: CW-002

- [ ] **[CW-010]** Replace placeholder puzzles with real crossword content [data]
  - Acceptance: 5–10 valid puzzles per difficulty level; all grids have proper symmetry and valid interlocking; clue difficulty matches level (Easy = direct definitions, Extreme = obscure/wordplay)
  - Files: `games/crossword/puzzles.js`
  - Expand to 5–10 valid puzzles per difficulty level
  - Ensure all grids have proper symmetry and valid interlocking
  - Clues are accurate and appropriately difficult for their level
  - Easy: direct definitions; Medium: moderate wordplay; Hard: tricky clues; Extreme: obscure/wordplay
  - Depends on: CW-008

## Done

- [x] **[CW-003]** Core `game.js` — state model, puzzle loading, rendering [engine]
  - _Completed: Created `games/crossword/game.js` (~330 lines) with IIFE pattern matching sudoku. State model: `puzzle`, `playerGrid`, `selectedCell`, `direction`, `cellFlags`, `wordSpans`, `clueMap`. Core functions: `loadPuzzle()` initializes state from puzzle data, `computeWordSpans()` maps each clue number to its cell list for O(1) lookup, `computeClueMap()` maps each cell to its across/down clue numbers, `getCellNumbers()` builds cell-number overlay map. Rendering: `renderBoard()` builds CSS Grid with `--grid-size` variable, cell numbers, player values, black cells, selected/word-highlight/checked-incorrect/revealed classes. `renderClues()` populates Across/Down panels with active highlighting and completed strikethrough. `updateActiveClueBar()` for mobile clue display. Input handling included early since rendering requires click handlers: cell click selects/toggles direction, clue click selects first empty cell, keyboard A-Z/Backspace/Space/Arrow/Tab navigation, auto-advance and retreat within words. Win detection checks all non-black cells match solution grid. Difficulty selector and New Puzzle button wire up to load random puzzle from pool. Files changed: `games/crossword/game.js` (new)._

- [x] **[CW-002]** Build `index.html` with full HTML structure + inline CSS [ui]
  - _Completed: Created `games/crossword/index.html` with full HTML structure and inline CSS. Includes: page title, difficulty selector (Easy/Medium/Hard/Extreme), Daily/Random mode toggle, timer display with pause button, CSS Grid board (`--grid-size` variable, `aspect-ratio: 1`), active clue bar (mobile), Across/Down clue panels with scrollable container, toolbar (Check Letter/Word, Reveal Letter/Word), status bar with New Puzzle button, win overlay (hidden by default), back link, footer. All cell state classes defined: `.selected`, `.word-highlight`, `.checked-incorrect`, `.revealed`, `.player-value`, `.black`. Responsive layout: flexbox `.game-layout` stacks on mobile (≤768px), active clue bar shows on mobile only. Uses site design tokens throughout. Scripts: `puzzles.js` + `game.js`. Files changed: `games/crossword/index.html`._

- [x] **[CW-001]** Seed `puzzles.js` with 2–3 puzzles per difficulty [data]
  - _Completed: Rewrote `games/crossword/puzzles.js` with 8 valid puzzles (2 per difficulty). Each puzzle uses a cross/plus grid pattern with interlocking across and down words. All grids validated: correct dimensions, clue answers match grid letters, no orphan letters. Easy (5×5) uses 3+3 word checkerboard pattern; Medium (9×9), Hard (13×13), Extreme (15×15) use a symmetric cross pattern with words along the arms. Files changed: `games/crossword/puzzles.js`. Replaced prior invalid puzzle data (had non-words like NOMEE, PELTR, CLEISTAR)._
