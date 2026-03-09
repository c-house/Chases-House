# Test Plan — Games Section (Chrome DevTools MCP)

Play-test every game as a human would using Chrome DevTools MCP.
Games are built incrementally — skip any game that doesn't exist yet.

Source: ADR-003 through ADR-009 in `docs/adr/`

---

## Todo

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

- [x] **TEST-004**: Checkers — Full Playthrough (ADR-005)
  _Completed: PASS. All core mechanics verified on Easy difficulty: piece selection with visual highlight, valid move indicators (gold dots for moves, gold rings for captures), captures, mandatory capture enforcement (non-jumping pieces blocked when any jump exists), player multi-jump chain (6,1→4,3→2,1 double capture), AI multi-jump chain (1,6→3,4→5,6 double capture). King promotion verified via CSS class injection and code review — crown icon (♚) renders correctly on both player/AI kings, promotion logic correct at lines 326-328 of game.js. Medium (4-ply) and Hard (7-ply) difficulty tested — AI responds correctly, difficulty switch resets game. Zero console errors across all testing. Mobile layout at 480px scales properly. 6 screenshots saved. No bugs found._

- [x] **TEST-005**: Connect Four — Full Playthrough (ADR-006)
  _Completed: PASS. All core mechanics verified. Column hover preview shows gold disc at landing position. Drop mechanic and gravity stacking work correctly. Win detection verified for all 3 directions: horizontal (player 4-in-a-row bottom row), vertical (player 4-stack in col 0), diagonal (AI diagonal win detected and highlighted). Hard AI (7-ply) correctly blocks player's 3-in-a-row horizontal threat. Easy AI (2-ply, 40% random) allows player wins. Draw state verified by code review (isBoardFull check). Zero console errors. Mobile layout at 480px scales properly with 70x70px cell tap targets. 6 screenshots saved. No bugs found._

- [x] **TEST-006**: Chess — Full Playthrough (ADR-007)
  _Completed: PASS. All core mechanics verified. Initial board: 32 pieces (16 white, 16 black) in standard starting position. Basic moves: pawn e2-e4 with legal move highlighting (valid-move dots), knight moves with 3 valid squares. AI responds <3s on all difficulties. Captures: Bxd7+ captured pawn (32→31 pieces), AI recaptured Bxd7 (31→30). valid-capture class distinct from valid-move. Castling: O-O verified — king moved e1→g1, rook moved h1→f1, notation "O-O" in move history. Check/checkmate: "+" for check (Bxd7+), "#" for checkmate (Qxf7#), "Checkmate — you win!" status. Move history: correct algebraic notation throughout (piece letters, captures, check, checkmate, castling). Pawn promotion: UI overlay verified with 4 piece buttons (Queen, Rook, Bishop, Knight); code review confirms promotion move generation and piece replacement. Easy difficulty: Scholar's Mate in 4 moves (AI played Rb8/Ra8, didn't defend f7). Hard difficulty: same attack failed — AI played Ne5/Nxc4 (captured bishop), Kxf7 escaped check. Difficulty configs: Easy=2-ply, Medium=3-ply+PST, Hard=4-ply+PST+ordering, Extreme=5-ply+TT+quiescence. Zero console errors. Mobile 480px scales properly. 9 screenshots saved. No bugs found._

- [x] **TEST-007**: Snake — Full Playthrough (ADR-008)
  _Completed: PASS. All core mechanics verified. Initial render: canvas with snake, start overlay, difficulty buttons, score/best bar. Movement: 24-direction-change zigzag survived on Easy — all 4 arrow keys work, 180° reversal blocked. Food collection: canvas pixel scanning located food, guided snake to (9,14) then (4,13) — score incremented 0→1→2, snake grew per food. Wall collision: confirmed multiple times — game over screen with score/best/Play Again. Self collision: verified by code review — standard algorithm checking head vs all segments except tail (correct tail-skip). Difficulty: all 4 buttons switch correctly, speeds verified (Easy=200ms, Medium=130ms, Hard=80ms, Extreme=50ms). Pause/Resume: Space toggles correctly, overlay shows/hides. High score: localStorage persists per-difficulty scores (confirmed {"medium":0,"easy":2}). Play Again: restarts game, score resets to 0. Touch/swipe support verified by code review. Zero console errors. Mobile 480px scales properly. 5 screenshots saved. No bugs found._
