# Crossword Game — Implementation Plan
_Last updated: 2026-03-10_

## In Progress
(none)

## Todo

- [ ] **[CW-001]** Seed `puzzles.js` with 2–3 puzzles per difficulty [data]
  - Acceptance: `window.CrosswordPuzzles` exports puzzle arrays for Easy (5×5), Medium (9×9), Hard (13×13), Extreme (15×15) with 2–3 valid puzzles each; all grids have proper interlocking (no orphan letters); clues match answers
  - Files: `games/crossword/puzzles.js`
  - Create `games/crossword/puzzles.js` exporting via `window.CrosswordPuzzles`
  - Include 2–3 puzzles each for Easy (5×5), Medium (9×9), Hard (13×13), Extreme (15×15)
  - Follow JSON schema from ADR-010: `id`, `size`, `title`, `grid` (2D array, `#` = black), `clues` with `across`/`down` arrays
  - Each clue has `num`, `row`, `col`, `text`, `answer`
  - Puzzles must have valid interlocking words (no orphan letters)
  - Depends on: (none)

- [ ] **[CW-002]** Build `index.html` with full HTML structure + inline CSS [ui]
  - Acceptance: Page loads with no console errors; grid container, clue panels (Across/Down), toolbar, timer display, difficulty selector, and status bar all present; responsive layout stacks on mobile (≤768px); design matches site tokens
  - Files: `games/crossword/index.html`
  - Create `games/crossword/index.html` with grid container, clue panels (Across/Down), toolbar (Check/Reveal buttons), timer display, difficulty selector, status bar
  - CSS Grid for board: `grid-template-columns: repeat(var(--grid-size), 1fr)` with `--grid-size` set dynamically
  - Responsive layout: flexbox `.game-layout` with board left, clues right (desktop); stacked on mobile (≤768px) with active-clue-bar
  - Cell states: `.selected`, `.word-highlight`, `.checked-incorrect`, `.revealed`, `.player-value`
  - Clue numbering: absolute-positioned `<span class="cell-number">` in top-left
  - Board width scales per difficulty via `clamp()` values
  - Match existing site design tokens from `styles.css` (colors, fonts, animations)
  - Include `<script>` tags for `puzzles.js` and `game.js`
  - Depends on: (none)

- [ ] **[CW-003]** Core `game.js` — state model, puzzle loading, rendering [engine]
  - Acceptance: Puzzle loads and renders correct grid with numbered cells and black cells; clue panels show Across/Down lists with active highlighting; difficulty selector loads different puzzles
  - Files: `games/crossword/game.js`
  - Create `games/crossword/game.js` with game state: `puzzle`, `playerGrid`, `selectedCell`, `direction`, `cellFlags`
  - `loadPuzzle(puzzle)` — initialize state from puzzle data
  - `computeWordSpans()` — map each clue to its list of cells for O(1) lookup
  - `computeClueMap()` — map each cell to its {across, down} clue numbers
  - `renderBoard()` — render grid cells with numbers, player values, black cells
  - `renderClues()` — render Across/Down clue lists with active highlighting and completed strikethrough
  - Difficulty selector wires up to load puzzles of selected difficulty
  - Study `games/sudoku/game.js` for rendering and state patterns
  - Depends on: CW-001, CW-002

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
(none yet)
