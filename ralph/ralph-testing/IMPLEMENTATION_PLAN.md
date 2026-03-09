# Test Plan — Games Section (Chrome DevTools MCP)

Play-test every game as a human would using Chrome DevTools MCP.
Games are built incrementally — skip any game that doesn't exist yet.

Source: ADR-003 through ADR-009 in `docs/adr/`

---

## Todo

- [ ] **TEST-004**: Checkers — Full Playthrough (ADR-005)
  - **Pre-check**: verify `games/checkers/index.html` exists; if not, mark SKIPPED
  - Navigate to `http://localhost:3003/games/checkers/`
  - `take_screenshot` — verify initial board: 12 player pieces (accent-gold), 12 AI pieces (terracotta)
  - **Easy difficulty**: play a game — click a piece to select, verify valid moves highlighted, click destination to move. Verify AI responds after each move. Play enough moves to test captures, multi-jumps.
  - **Mandatory captures**: when a jump is available, try to make a non-jump move → verify it's blocked
  - **King promotion**: advance a piece to the back row → verify it becomes a king (visual distinction)
  - **Multi-jump**: set up a double/triple jump → verify chain completes
  - Play through on Medium and Hard, verify increasing AI quality
  - `list_console_messages` with `types: ["error"]` → must be zero
  - `resize_page` to 480px → `take_screenshot` → verify mobile layout
  - Save screenshots, log results to TEST_RESULTS.md

- [ ] **TEST-005**: Connect Four — Full Playthrough (ADR-006)
  - **Pre-check**: verify `games/connect-four/index.html` exists; if not, mark SKIPPED
  - Navigate to `http://localhost:3003/games/connect-four/`
  - `take_screenshot` — verify initial empty 7x6 board
  - **Column hover**: hover over columns → verify preview indicator
  - **Drop mechanic**: click a column → verify disc drops to bottom, animation plays
  - **Gravity**: stack multiple discs in one column → verify they stack correctly
  - **Win detection**: on Easy, win with a horizontal 4 → verify highlighted. New game, win with vertical 4 → verify. Win with diagonal → verify.
  - **Draw state**: fill the board without 4-in-a-row (if reachable on Easy) → verify draw message
  - **AI difficulty**: play on Hard → verify AI blocks obvious threats
  - `list_console_messages` with `types: ["error"]` → must be zero
  - `resize_page` to 480px → `take_screenshot` → verify tap targets
  - Save screenshots, log results to TEST_RESULTS.md

- [ ] **TEST-006**: Chess — Full Playthrough (ADR-007)
  - **Pre-check**: verify `games/chess/index.html` exists; if not, mark SKIPPED
  - Navigate to `http://localhost:3003/games/chess/`
  - `take_screenshot` — verify initial board setup, all 32 pieces correct
  - **Basic moves**: move a pawn forward, verify legal move highlighting, verify AI responds <3s
  - **Captures**: capture an AI piece → verify it disappears
  - **Castling**: set up castling conditions → verify king+rook move together
  - **Check indicator**: put AI king in check → verify visual indicator
  - **Pawn promotion**: advance a pawn to rank 8 → verify promotion UI appears, select Queen
  - **Move history**: verify algebraic notation updates after each move
  - **Difficulty levels**: play on Easy, verify AI makes more mistakes. Play on Hard, verify stronger play.
  - `list_console_messages` with `types: ["error"]` → must be zero
  - `resize_page` to 480px → `take_screenshot` → verify mobile layout
  - Save screenshots, log results to TEST_RESULTS.md

- [ ] **TEST-007**: Snake — Full Playthrough (ADR-008)
  - **Pre-check**: verify `games/snake/index.html` exists; if not, mark SKIPPED
  - Navigate to `http://localhost:3003/games/snake/`
  - `take_screenshot` — verify canvas renders, initial snake visible
  - **Movement**: use `press_key` with ArrowUp/ArrowDown/ArrowLeft/ArrowRight → verify snake moves
  - **Food**: guide snake to food → verify snake grows, score increments
  - **Wall collision**: steer into wall → verify game over screen with score
  - **Self collision**: grow snake then steer into self → verify game over
  - **Difficulty**: switch to each speed level → verify tick rate changes
  - **Pause**: press Space → verify game pauses, press again → verify resume
  - **High score**: play twice, score higher second time → verify localStorage persists
  - **"Play Again"**: after game over, click play again → verify fresh start
  - `list_console_messages` with `types: ["error"]` → must be zero
  - Save screenshots, log results to TEST_RESULTS.md

- [ ] **TEST-008**: Sudoku — Full Playthrough (ADR-009)
  - **Pre-check**: verify `games/sudoku/index.html` exists; if not, mark SKIPPED
  - Navigate to `http://localhost:3003/games/sudoku/`
  - `take_screenshot` — verify 9x9 grid with given cells, number pad visible
  - **Given cells**: click a given (pre-filled) cell → verify it's non-editable
  - **Player input**: click an empty cell, then click a number on the number pad → verify digit appears
  - **Conflict highlighting**: enter a number that duplicates in row/col/box → verify red highlight
  - **Pencil marks**: toggle pencil mode, enter notes in a cell → verify small marks appear
  - **Puzzle solve**: solve a few cells correctly → verify no false conflicts
  - **New Puzzle**: click "New Puzzle" → verify fresh puzzle generated
  - **Difficulty**: switch difficulties → verify different number of givens
  - **localStorage**: partially complete puzzle, reload page → verify state persists
  - `list_console_messages` with `types: ["error"]` → must be zero
  - `resize_page` to 480px → `take_screenshot` → verify number pad usable on mobile
  - Save screenshots, log results to TEST_RESULTS.md

---

## Done

- [x] **TEST-001**: Environment Setup & Games Gallery
  _Completed: PASS. Gallery renders correctly with heading, description, and 6 game cards (Tic Tac Toe, Checkers, Connect Four, Chess, Snake, Sudoku). All card links navigate to the correct game pages. Responsive layout works at 768px (2-col grid) and 480px (single-col stack). Zero console errors. Screenshots saved. No bugs found._

- [x] **TEST-002**: Tic Tac Toe — Full Playthrough (ADR-004)
  _Completed: PASS. All 4 difficulty levels tested. Easy: player wins easily (AI random). Medium: draw (AI blocks ~70% optimally). Hard: AI unbeatable — Game 1 AI won, Game 2 draw. Extreme: AI unbeatable — AI won (same as Hard). Win highlighting verified with win-cell class on correct cells. Status text correct for win/loss/draw. Zero console errors. 6 screenshots saved. No bugs found._

- [x] **TEST-003**: Tic Tac Toe — Edge Cases & Responsiveness (ADR-004)
  _Completed: PASS. All edge cases verified. Occupied cell clicks rejected (both X and O cells). Clicks during AI turn (300ms delay) rejected via currentTurn guard. New Game mid-game clears board and resets status. Draw state tested with controlled game (X O X / X X O / O X O) — "It's a draw." displayed. Win highlighting confirmed with win-cell class on indices 0,1,2 (top row). Back link navigates to /games/ gallery. Mobile layout at 480px scales properly. Zero console errors throughout. 4 screenshots saved. No bugs found._
