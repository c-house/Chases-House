# Test Results — Games Section

---

## TEST-001: Environment Setup & Games Gallery — PASS
Date: 2026-03-09

### Checks
- [x] Dev server running on port 3003 — PASS
- [x] MCP Chrome connected — PASS
- [x] Gallery renders: heading, description, game cards — PASS
- [x] DOM structure correct, 6 game cards with titles, descriptions, badges — PASS
- [x] Card links point to correct paths — PASS
  - Tic Tac Toe → `/games/tic-tac-toe/` ✓
  - Checkers → `/games/checkers/` ✓
  - Connect Four → `/games/connect-four/` ✓
  - Chess → `/games/chess/` ✓
  - Snake → `/games/snake/` ✓
  - Sudoku → `/games/sudoku/` ✓
- [x] Each game card navigates to the correct game page — PASS
- [x] Responsive layout at 768px (tablet) — PASS (2-column grid)
- [x] Responsive layout at 480px (mobile) — PASS (single-column stacked)
- [x] Console errors: zero — PASS

### Bugs Found
None.

### Screenshots
- `screenshots/gallery-desktop.png` — Full-page desktop layout (3-column grid, all 6 cards)
- `screenshots/gallery-tablet-768.png` — Tablet layout at 768px (2-column grid)
- `screenshots/gallery-mobile-480.png` — Mobile layout at 480px (single-column stacked)

---

## TEST-002: Tic Tac Toe — Full Playthrough — PASS
Date: 2026-03-09

### Checks
- [x] Initial state: empty 3x3 board, "Your turn — place your X" status, Medium selected by default — PASS
- [x] Difficulty buttons present: Easy, Medium, Hard, Extreme — PASS
- [x] New Game button and Back to Games link present — PASS
- [x] **Easy difficulty**: played full game, won with diagonal (center → top-left → bottom-right) — PASS
  - AI made random moves, did not block obvious diagonal threat
  - Status shows "You win!", win-cell class applied to winning cells (indices 0, 4, 8)
- [x] **Medium difficulty**: played full game, resulted in draw — PASS
  - AI blocked threats competently (minimax with ~30% random), forced draw
  - Status shows "It's a draw."
- [x] **Hard difficulty Game 1**: AI won — player could not beat it — PASS
  - AI took corner vs center opening (optimal), won with row 1
  - Win-cell class applied to indices 0, 1, 2
- [x] **Hard difficulty Game 2**: draw — player could not beat it — PASS
  - AI blocked fork attempts, played optimally throughout
  - Status shows "It's a draw."
- [x] **Extreme difficulty**: AI won — player could not beat it — PASS
  - Same behavior as Hard (optimal minimax), won with column 1
  - Win-cell class applied to indices 0, 3, 6
- [x] Win highlighting verified at each game end — PASS
- [x] Console errors: zero — PASS

### Bugs Found
None.

### Screenshots
- `screenshots/tictactoe-initial.png` — Initial empty board with Medium selected
- `screenshots/tictactoe-easy-win.png` — Player win on Easy (diagonal highlighted)
- `screenshots/tictactoe-medium-draw.png` — Draw on Medium (full board)
- `screenshots/tictactoe-hard-loss.png` — AI win on Hard Game 1 (row 1 highlighted)
- `screenshots/tictactoe-hard-draw.png` — Draw on Hard Game 2 (full board)
- `screenshots/tictactoe-extreme-loss.png` — AI win on Extreme (column 1 highlighted)

---

## TEST-003: Tic Tac Toe — Edge Cases & Responsiveness — PASS
Date: 2026-03-09

### Checks
- [x] **Occupied cell test (player X)**: clicked center cell with X already placed → no change, move rejected — PASS
- [x] **Occupied cell test (AI O)**: clicked cell with O already placed → no change, move rejected — PASS
- [x] **Click during AI turn**: used evaluate_script to click cell immediately after player move (during 300ms AI delay) → cell stayed empty, status showed "AI is thinking...", `currentTurn !== PLAYER` guard worked — PASS
- [x] **New Game mid-game**: played 4 moves (2X, 2O), clicked "New Game" → all 9 cells cleared to empty labels, status reset to "Your turn — place your X", X goes first — PASS
- [x] **Draw game on Easy**: forced draw via controlled random (X O X / X X O / O X O) → status shows "It's a draw." — PASS
- [x] **Win highlighting**: won on Easy with top row (indices 0, 1, 2) → `win-cell` class applied to exactly those 3 cells, status shows "You win!" — PASS
- [x] **Back link**: clicked "← Back to Games" → navigated to `/games/` gallery page with all 6 game cards — PASS
- [x] **Responsive at 480px**: board scales proportionally, difficulty buttons fit in one row, status/buttons visible, "Back to Games" link accessible — PASS
- [x] **Console errors**: checked at multiple points throughout testing → zero errors — PASS

### Bugs Found
None.

### Screenshots
- `screenshots/tictactoe-midgame-before-reset.png` — Mid-game board before New Game reset (2X, 2O)
- `screenshots/tictactoe-draw.png` — Draw state with full board (X O X / X X O / O X O)
- `screenshots/tictactoe-win-highlight.png` — Player win with top row highlighted (indices 0, 1, 2)
- `screenshots/tictactoe-mobile-480.png` — Mobile layout at 480px width

---

## TEST-004: Checkers — Full Playthrough — PASS
Date: 2026-03-09

### Checks
- [x] **Initial board**: 12 player pieces (accent-gold, rows 5-7), 12 AI pieces (terracotta, rows 0-2), 64-cell 8x8 grid — PASS
- [x] **Default difficulty**: Medium selected by default, 4 difficulty buttons (Easy, Medium, Hard, Extreme) — PASS
- [x] **Piece selection**: clicking a player piece highlights it (`.selected` class, scale 1.1x), valid moves shown as gold dots (`.valid-move`) — PASS
- [x] **Valid move highlighting**: selected piece at (5,2) showed two valid moves at (4,1) and (4,3) — PASS
- [x] **AI response**: AI responds after each player move, status shows "AI is thinking..." during computation — PASS
- [x] **Captures**: player captured AI piece by jumping diagonally, piece count updated correctly — PASS
- [x] **Valid capture highlighting**: capture squares shown with gold ring border (`.valid-capture`), distinct from simple move dots — PASS
- [x] **Mandatory captures**: when a jump is available, only jump moves are legal — non-jumping pieces show zero moves. Tested with multiple pieces: only pieces with capture available could be selected — PASS
- [x] **Multi-jump (chain jump)**: player executed double-jump chain (6,1)→(4,3)→(2,1) capturing two AI pieces. Status showed "Continue jumping — mandatory capture" between jumps — PASS
- [x] **AI multi-jump**: AI executed chain double-jump (1,6)→(3,4)→(5,6) capturing two player pieces in one turn — PASS
- [x] **King promotion (visual)**: `.king` CSS class adds crown icon (♚ U+265A) via `::after` pseudo-element. Verified on both player (gold tint) and AI (terracotta tint) king pieces — PASS
- [x] **King promotion (code logic)**: `promoteIfNeeded()` correctly promotes PLAYER at row 0 → PLAYER_KING, AI_PIECE at row 7 → AI_KING. `renderBoard()` applies `.king` class. Kings get bidirectional movement via `getMoveDirs()` — PASS (code review)
- [x] **Easy difficulty**: 2-ply search depth, AI makes basic moves, player can capture but AI also captures aggressively — PASS
- [x] **Medium difficulty**: 4-ply search depth, AI responds with deeper tactical play, mandatory captures enforced — PASS
- [x] **Hard difficulty**: 7-ply search depth, AI responded in ~425ms at opening, board resets on difficulty switch — PASS
- [x] **Difficulty switch resets game**: switching from Medium to Hard reset board to 12v12, cleared all state — PASS
- [x] **Score display**: "You: X" and "AI: Y" update correctly after each capture — PASS
- [x] **Console errors**: zero errors across all testing (Easy, Medium, Hard, desktop, mobile) — PASS
- [x] **Responsive at 480px**: board scales to fit viewport, difficulty buttons wrap and remain tappable, status/score/back-link all visible — PASS

### Bugs Found
None.

### Notes
- King promotion was verified via CSS class injection (adding `.king` to existing pieces) and code review. Natural gameplay king promotion was not reached in test games — the AI on Easy aggressively captures advancing pieces. The promotion logic is correctly implemented in code (lines 326-328 of game.js).
- AI difficulty progression is confirmed by code: Easy=2-ply, Medium=4-ply, Hard=7-ply, Extreme=9-ply minimax with alpha-beta pruning.

### Screenshots
- `screenshots/checkers-initial.png` — Initial board: 12 gold player pieces, 12 terracotta AI pieces
- `screenshots/checkers-piece-selected.png` — Piece selected with valid moves highlighted
- `screenshots/checkers-after-captures.png` — Mid-game state after captures
- `screenshots/checkers-king-visual.png` — King crown icon (♚) on both player and AI pieces
- `screenshots/checkers-hard-game.png` — Hard difficulty game in progress
- `screenshots/checkers-mobile-480.png` — Mobile layout at 480px width

---

## TEST-005: Connect Four — Full Playthrough — PASS
Date: 2026-03-09

### Checks
- [x] **Initial board**: empty 7x6 grid, dark theme, "Your turn — drop a disc" status, Medium selected by default, 4 difficulty buttons — PASS
- [x] **Column hover preview**: hovering over column shows gold disc preview at landing row — PASS
- [x] **Drop mechanic**: clicking column drops disc to lowest empty row, gravity correct — PASS
- [x] **Gravity/stacking**: multiple discs stack correctly bottom-to-top in same column — PASS
- [x] **Win detection — horizontal**: player connected 4 in bottom row (5,0)-(5,1)-(5,2)-(5,3), `win` class applied to all 4 cells, status "You win!" — PASS
- [x] **Win detection — vertical**: player stacked 4 in column 0 (rows 2-5), `win` class applied to all 4 cells, status "You win!" — PASS
- [x] **Win detection — diagonal**: AI connected diagonal (2,4)-(3,3)-(4,2)-(5,1), `win` class applied to all 4 cells, status "AI wins." — PASS
- [x] **AI difficulty — Hard**: AI (7-ply) blocked player's 3-in-a-row horizontal threat by playing (5,3), preventing the win — PASS
- [x] **AI difficulty — Easy**: AI (2-ply, 40% random) makes occasional mistakes, allowing player wins — PASS
- [x] **Console errors**: zero errors across all testing — PASS
- [x] **Responsive at 480px**: board scales properly, cell tap targets 70x70px (above 44px minimum), difficulty buttons and status visible — PASS

### Bugs Found
None.

### Notes
- Draw state was not tested to completion (filling a full 7x6 board without winning is extremely difficult to orchestrate). The draw detection code (`isBoardFull` check at lines 173-178 and 292-296 of game.js) is correct by code review.
- AI Easy difficulty uses 2-ply search with 40% random moves (line 305). Medium uses 4-ply, Hard uses 7-ply, Extreme uses 11-ply — all with alpha-beta pruning and center-column bias.
- Win detection handles all 4 directions (horizontal, vertical, diagonal-right, diagonal-left) via the same `checkWin` function with DIRECTIONS array.

### Screenshots
- `screenshots/connect-four-initial.png` — Initial empty board with Easy selected
- `screenshots/connect-four-hover-preview.png` — Column hover preview showing gold disc at landing position
- `screenshots/connect-four-horizontal-win.png` — Player horizontal win, 4 gold discs highlighted in bottom row
- `screenshots/connect-four-vertical-win.png` — Player vertical win, 4 gold discs stacked in column 0
- `screenshots/connect-four-diagonal-win.png` — AI diagonal win, 4 terracotta discs highlighted diagonally
- `screenshots/connect-four-mobile-480.png` — Mobile layout at 480px width

---

## TEST-006: Chess — Full Playthrough — PASS
Date: 2026-03-09

### Checks
- [x] **Initial board**: 64-square 8x8 board, 32 pieces (16 white player, 16 black AI), standard chess starting position with Unicode piece symbols — PASS
- [x] **Default difficulty**: Medium selected by default, 4 difficulty buttons (Easy, Medium, Hard, Extreme) — PASS
- [x] **Piece selection**: clicking a player piece highlights it (`.selected` class), valid moves shown as `.valid-move` dots, captures shown as `.valid-capture` with distinct styling — PASS
- [x] **Pawn forward move**: e2-e4 pawn moved correctly, double-step from starting row — PASS
- [x] **Legal move highlighting**: selected e2 pawn showed 2 valid moves (e3, e4); selected g1 knight showed 3 valid moves (f3, h3, e2) — PASS
- [x] **AI response**: AI responds after each player move within <3s on all difficulties, status shows "AI is thinking..." during computation — PASS
- [x] **Captures**: player bishop captured d7 pawn (Bxd7+), piece removed from board, piece count decreased from 32 to 31; AI recaptured with Bxd7, total dropped to 30 — PASS
- [x] **Capture highlighting**: `.valid-capture` class applied to enemy-occupied squares (distinct from `.valid-move` on empty squares) — PASS
- [x] **Castling (O-O)**: cleared f1 and g1, selected king, g1 appeared as valid move. After clicking g1: king moved to g1 (col 6), rook moved from h1 to f1 (col 5), e1 and h1 empty. Move history recorded "O-O" — PASS
- [x] **Check indicator**: Bxd7+ showed "+" in algebraic notation; Qxf7# showed "#" for checkmate — PASS
- [x] **Checkmate detection**: Scholar's Mate on Easy (1.e4 Nc6 2.Bc4 Rb8 3.Qh5 Ra8 4.Qxf7#) → status "Checkmate — you win!" — PASS
- [x] **Move history (algebraic notation)**: correct notation throughout: "e4", "Nc6", "Bb5", "Bxd7+", "O-O", "Qxf7#" — includes piece letters, captures (x), check (+), checkmate (#), castling (O-O) — PASS
- [x] **Pawn promotion UI**: promotionOverlay with "Promote pawn to:" heading, 4 buttons (♕ Queen, ♖ Rook, ♗ Bishop, ♘ Knight) renders correctly as modal overlay. Code review confirms: promotion moves generated at rank 0/7 (lines 238-261), executeMove replaces pawn with selected piece (lines 390-391), showPromotionDialog creates button per promotion option (lines 807-831) — PASS
- [x] **Easy difficulty**: Scholar's Mate succeeded in 4 moves. AI played Rb8 and Ra8 (passive rook shuffling, did not defend f7) — PASS
- [x] **Hard difficulty**: Same Scholar's Mate attempt failed. AI played Ne5 (active central move) then Nxc4 (captured bishop for material). Qxf7+ was only check, not mate — Kxf7 escaped. Clearly stronger play — PASS
- [x] **Difficulty configs (code review)**: Easy=2-ply material-only, Medium=3-ply with PST, Hard=4-ply with PST+move ordering, Extreme=5-ply with PST+ordering+TT+quiescence — PASS
- [x] **Console errors**: zero errors across all testing (Easy, Medium, Hard, multiple games) — PASS
- [x] **Responsive at 480px**: board scales to fit viewport, difficulty buttons in one row, move history panel visible, status/buttons/back-link all accessible — PASS

### Bugs Found
None.

### Notes
- Pawn promotion was verified via UI rendering (manually triggered overlay) and code review. Natural gameplay promotion requires advancing a pawn to rank 8, which is impractical in a test session. The promotion code (move generation, dialog, piece replacement) is correctly implemented.
- The AI consistently opens with Nc6 across all difficulties tested. On Easy, it follows with weak rook moves (Rb8, Ra8). On Hard, it plays tactically (Ne5, Nxc4).
- Castling rights tracking (wK, wQ, bK, bQ flags) is correctly implemented in the game state.

### Screenshots
- `screenshots/chess-initial.png` — Initial board with all 32 pieces, Medium selected
- `screenshots/chess-pawn-selected.png` — Pawn selected with valid move dots on e3 and e4
- `screenshots/chess-after-first-move.png` — After 1. e4 Nc6, move history panel showing notation
- `screenshots/chess-after-capture.png` — After 4. Bxd7+ Bxd7, pieces reduced to 30
- `screenshots/chess-castling.png` — After O-O, king on g1 and rook on f1
- `screenshots/chess-promotion-dialog.png` — Promotion UI overlay with 4 piece selection buttons
- `screenshots/chess-easy-mate.png` — Scholar's Mate on Easy: "Checkmate — you win!" after Qxf7#
- `screenshots/chess-hard-defense.png` — Hard AI survived Scholar's Mate attempt, Kxf7 escaped
- `screenshots/chess-mobile-480.png` — Mobile layout at 480px width

---

## TEST-007: Snake — Full Playthrough — PASS
Date: 2026-03-09

### Checks
- [x] **Initial render**: canvas with snake visible, start overlay ("Snake" title, "Arrow keys / WASD to move" hint, PLAY button), difficulty buttons (Easy/Medium/Hard/Extreme), Score: 0 · Best: 0 status bar, Back to Games link — PASS
- [x] **Movement (all 4 directions)**: automated 24-direction-change zigzag on Easy difficulty — snake survived all turns, confirming ArrowUp/ArrowDown/ArrowLeft/ArrowRight all work correctly. 180° reversal correctly blocked (OPPOSITE direction check at line 344) — PASS
- [x] **Food collection**: guided snake to food at (9,14) via canvas pixel scanning — score incremented from 0 to 1. Guided to second food at (4,13) — score incremented to 2. Snake grew by 1 segment per food eaten (3→4→5 segments) — PASS
- [x] **Wall collision**: snake steered into wall (top wall at y=0, right wall at x=19) — Game Over overlay displayed with Score and Best, Play Again button — PASS (confirmed multiple times)
- [x] **Self collision (code review)**: tick() lines 122-128 check new head position against all segments except tail. Tail is correctly skipped (comment: "skip tail — it will move away unless we just ate"). Same endGame() function as wall collision (lines 118, 126). 4-segment U-turn test confirmed tail-skip is correct — tail escapes during 3-turn loop, matching expected behavior — PASS
- [x] **Difficulty buttons**: all 4 switch correctly (Easy/Medium/Hard/Extreme), `.active` class applied, dataset.difficulty updated. Mid-game switching restarts the tick loop at new speed — PASS
- [x] **Speed constants (code review)**: SPEEDS = { easy: 200ms, medium: 130ms, hard: 80ms, extreme: 50ms } — appropriate progression from casual to intense — PASS
- [x] **Pause/Resume**: Space key toggles pause overlay correctly. Pause shows "Paused" with "Press Space or tap to resume" hint. Resume hides overlay and restarts game loop. Clicking pause overlay also resumes — PASS
- [x] **High score persistence**: localStorage key `snake-highscores` stores per-difficulty high scores as JSON object. After scoring 2 on Easy, localStorage confirmed: `{"medium":0,"easy":2}`. Best score display updated correctly — PASS
- [x] **Play Again**: button correctly restarts game — score resets to 0, all overlays hidden, new game starts. Space key from Game Over screen also restarts — PASS
- [x] **Game Over screen**: displays "Game Over" title, Score (highlighted), Best (highlighted), and "PLAY AGAIN" button — PASS
- [x] **Canvas rendering**: snake drawn with gradient from tail (#a06828) to body (#c8943e) to head (#e8b04a). Head has eyes (dark dots). Food drawn as glowing ember dot with radial gradient and shadow glow. Grid lines visible as subtle overlay — PASS
- [x] **Touch/swipe support (code review)**: touchstart/touchend handlers on canvas detect swipe direction (threshold 30px) or tap (toggles pause/start). touchmove prevented to block pull-to-refresh — PASS
- [x] **Console errors**: zero errors across all testing — PASS
- [x] **Responsive at 480px**: canvas scales proportionally via sizeCanvas() (min of viewport width-48px, 55% viewport height, 440px max), difficulty buttons wrap, all UI elements visible and accessible — PASS

### Bugs Found
None.

### Notes
- Food collection required canvas pixel scanning to locate randomly-placed food, then precise navigation via timed key dispatches. Score incremented correctly on each food consumption.
- Self-collision was verified by code review rather than gameplay trigger. With 4 segments, a tight U-turn correctly does NOT cause self-collision (tail escapes). 5+ segments are needed for a U-turn collision. The collision algorithm is the standard snake implementation and is correct.
- The IIFE pattern makes direct state inspection impossible via evaluate_script, requiring creative testing approaches (canvas pixel scanning, timed event dispatch, DOM observation).

### Screenshots
- `screenshots/snake-initial.png` — Start screen with title, PLAY button, difficulty selector
- `screenshots/snake-zigzag-alive.png` — Snake after 24 direction changes (eventually hit wall)
- `screenshots/snake-food-eaten.png` — Score 1 after eating first food, snake paused with 4 segments visible
- `screenshots/snake-gameover.png` — Game Over screen with Score, Best, and Play Again button
- `screenshots/snake-mobile-480.png` — Mobile layout at 480px width, all UI elements properly scaled

---

## TEST-008: Sudoku — Full Playthrough — PASS
Date: 2026-03-09

### Checks
- [x] **Initial board**: 9x9 grid with given cells, number pad (1-9), PENCIL/ERASE buttons, cells remaining counter, NEW PUZZLE button, difficulty selector (Easy/Medium/Hard/Extreme), Medium selected by default — PASS
- [x] **Given cells count**: 32 givens on default Medium (range 30-35 per ADR) — PASS
- [x] **Given cells non-editable**: clicked given cell (Row 1 Col 4, value "8"), clicked number pad "5" → cell retained "8", `given` class present, value unchanged — PASS
- [x] **Player input**: clicked empty cell (Row 1 Col 1), clicked number pad "5" → digit "5" appeared, `player-value` class applied, cells remaining decreased 49→48 — PASS
- [x] **Conflict highlighting**: entered "3" in Row 2 Col 1 (Row 2 already has "3" at Col 2) → both cells received `conflict` class, duplicate "3" in same row highlighted red — PASS
- [x] **Erase function**: selected conflicting cell, clicked ERASE → cell cleared, conflict class removed from all cells, cells remaining updated — PASS
- [x] **Pencil mode**: toggled PENCIL button (gained `active` class), clicked empty cell, entered "7" and "8" → pencil marks container created with small "7" and "8" marks in positions 7 and 8 of 3x3 mini-grid. Cell not counted as filled (cells remaining unchanged) — PASS
- [x] **Pencil marks overwrite**: entering a normal value (non-pencil mode) on a cell with pencil marks replaced them with the full digit — PASS
- [x] **Correct cell solving**: solved solution via backtracking, entered 3 correct values (Row 1 Col 1=4, Row 1 Col 2=2, Row 2 Col 1=7) → zero conflicts, cells remaining decreased correctly — PASS
- [x] **New Puzzle**: clicked NEW PUZZLE → fresh puzzle generated with different givens pattern, player entries cleared, cells remaining reset — PASS
- [x] **Difficulty — Easy**: switched to Easy → 39 givens (range 36-40 per ADR) — PASS
- [x] **Difficulty — Medium**: 32-35 givens across tests (range 30-35 per ADR) — PASS
- [x] **Difficulty — Hard**: switched to Hard → 25 givens (range 25-29 per ADR) — PASS
- [x] **Difficulty — Extreme**: switched to Extreme → 23 givens (range 20-24 per ADR) — PASS
- [x] **Difficulty switch generates new puzzle**: each difficulty button click generates a fresh puzzle with appropriate given count — PASS
- [x] **localStorage persistence**: entered value "5" in Row 1 Col 1 on Medium, reloaded page → value "5" persisted, difficulty "Medium" preserved, cells remaining unchanged (50) — PASS
- [x] **Console errors**: zero errors across all testing (all difficulties, input, conflicts, pencil, reload) — PASS
- [x] **Responsive at 480px**: grid scales to fit viewport, number pad buttons visible and tappable, difficulty buttons fit in one row, all UI elements accessible — PASS

### Bugs Found
None.

### Notes
- Puzzle generation uses backtracking with random seed for full solution, then removes cells verifying unique solution remains. All generated puzzles had valid, solvable configurations.
- The game uses an IIFE pattern — state variables (solution, board, givens, pencilMarks) are closure-scoped and not directly accessible via evaluate_script. Solution was verified by running a backtracking solver in the browser context.
- Pencil marks use a 3x3 mini-grid within each cell (9 span elements), where marks appear in their respective number positions (e.g., "7" in position 7, "8" in position 8).
- localStorage key is `sudoku-state`, storing full game state (board, solution, givens, pencil marks, difficulty) as JSON.

### Screenshots
- `screenshots/sudoku-initial.png` — Initial board on Medium difficulty with 32 givens
- `screenshots/sudoku-player-input.png` — After entering "5" in Row 1 Col 1
- `screenshots/sudoku-conflict.png` — Conflict highlighting: duplicate "3" in Row 2
- `screenshots/sudoku-pencil-marks.png` — Pencil marks "7" and "8" in Row 2 Col 1
- `screenshots/sudoku-correct-entries.png` — Three correct values entered with zero conflicts
- `screenshots/sudoku-mobile-480.png` — Mobile layout at 480px width
