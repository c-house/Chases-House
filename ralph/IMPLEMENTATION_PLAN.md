# Implementation Plan — Games Section

Build the games section for chases.house, transforming the placeholder into a full game gallery with 6 browser games.

Source: ADR-003 through ADR-009 in `docs/adr/`

---

## Todo

(none)

---

## Done

- [x] **GAME-007**: Sudoku (ADR-009)
  _Completed: Created `games/sudoku/index.html` and `games/sudoku/game.js`. 9x9 CSS Grid board with thicker 2px borders for 3x3 box boundaries. Backtracking puzzle generator: fills a complete valid board with randomized candidate ordering, then removes cells one at a time verifying unique solution remains via solution-counting solver (capped at 2). Difficulty scales via givens count: Easy (~36-40), Medium (~30-35), Hard (~25-29), Extreme (~20-24). Given cells displayed bold in heading color and non-editable; player-placed values in accent-gold. Click/tap cell selection with same-number highlighting across the board. Number pad (1-9) for input on desktop and mobile, pencil mark mode with 3x3 mini-grid display per cell, erase button, keyboard support (1-9 to place, P to toggle pencil, Delete/Backspace to erase, arrow keys to navigate). Real-time conflict highlighting in terracotta for row/column/box violations. Puzzle state persisted to localStorage (board, givens, solution, pencil marks, difficulty). Win detection triggers overlay with difficulty label. "New Puzzle" button regenerates at current difficulty. Added Sudoku card with "solo" tag to `games/index.html` gallery. Responsive layout matching existing game page patterns (header, footer, difficulty selector, status bar, back link). Files changed: `games/sudoku/index.html`, `games/sudoku/game.js`, `games/index.html`._


- [x] **GAME-001**: Games gallery page (ADR-003)
  _Completed: Rewrote `games/index.html` from placeholder to a gallery layout with heading, description, and a `.game-grid` container ready for game cards. Added shared game-card styles to `styles.css` (`.game-grid`, `.game-card`, `.game-card-icon`, `.game-card-title`, `.game-card-desc`, `.game-card-tag`) following the `.room-card` pattern — ember border, hover lift/glow, CSS Grid 1–3 columns responsive. Empty state shown with dashed border until first game ships. Files changed: `games/index.html`, `styles.css`._

- [x] **GAME-002**: Tic Tac Toe (ADR-004)
  _Completed: Created `games/tic-tac-toe/index.html` and `games/tic-tac-toe/game.js`. 3x3 CSS Grid board with player X (accent-gold) and AI O (text-faint). Minimax AI with depth-aware scoring: Easy (random), Medium (minimax + 30% random fallback), Hard/Extreme (optimal minimax). Difficulty selector with 4 levels, status bar with turn/result display, win-cell highlighting, "New Game" button, back link to games gallery. Replaced empty state in `games/index.html` with Tic Tac Toe game card. Keyboard accessible (Enter/Space on cells), responsive layout. Files changed: `games/tic-tac-toe/index.html`, `games/tic-tac-toe/game.js`, `games/index.html`._

- [x] **GAME-004**: Connect Four (ADR-006)
  _Completed: Created `games/connect-four/index.html` and `games/connect-four/game.js`. 7-column, 6-row CSS Grid board with disc drop animation (CSS keyframes with bounce easing). Player discs accent-gold, AI discs terracotta with radial gradients matching existing game style. Column hover preview shows landing position with subtle gold glow. Win state highlights four connected discs with pulsing animation. Alpha-beta pruning AI with center-column move ordering and window-based evaluation (horizontal, vertical, diagonal scoring): Easy (2 plies + 40% random), Medium (4 plies), Hard (7 plies), Extreme (11 plies). Win detection across all four directions, draw detection on full board. Added Connect Four card to `games/index.html` gallery. Responsive layout matching existing game page patterns. Files changed: `games/connect-four/index.html`, `games/connect-four/game.js`, `games/index.html`._

- [x] **GAME-005**: Chess (ADR-007)
  _Completed: Created `games/chess/index.html`, `games/chess/game.js`, and `games/chess/ai.js`. Full chess implementation with all standard rules: piece movement for all 6 piece types, castling (kingside and queenside), en passant, pawn promotion with piece selection modal UI, fifty-move rule, threefold repetition, stalemate, and insufficient material detection. Unicode chess symbols for pieces, click-to-select with legal move dots and capture rings, check/checkmate square highlighting, last-move highlighting, rank/file labels. Algebraic notation move history panel with auto-scroll. AI in separate file with difficulty-layered enhancements: Easy (2 plies, material-only), Medium (3 plies + piece-square tables), Hard (4 plies + alpha-beta + MVV-LVA move ordering), Extreme (5 plies + iterative deepening + transposition table + quiescence search). Board layout with side panel for move history on desktop, stacked on mobile. Added Chess card to `games/index.html` gallery. Responsive layout matching existing game page patterns. Files changed: `games/chess/index.html`, `games/chess/game.js`, `games/chess/ai.js`, `games/index.html`._

- [x] **GAME-003**: Checkers (ADR-005)
  _Completed: Created `games/checkers/index.html` and `games/checkers/game.js`. 8x8 board with alternating light/dark squares. Player pieces accent-gold with radial gradient, AI pieces terracotta with radial gradient, kings distinguished with crown symbol overlay. Full American checkers rules: diagonal movement, mandatory captures with visual cues, multi-jump chain enforcement, king promotion on back row. Alpha-beta pruning AI with positional evaluation (material, advancement, center control, mobility): Easy (2 plies), Medium (4 plies), Hard (7 plies), Extreme (9 plies). Click-to-select with valid move/capture highlighting, piece count score display, animated AI multi-jump sequences, last-move highlighting. Added Checkers card to `games/index.html` gallery. Responsive layout matching existing game page patterns. Files changed: `games/checkers/index.html`, `games/checkers/game.js`, `games/index.html`._

- [x] **GAME-006**: Snake (ADR-008)
  _Completed: Created `games/snake/index.html` and `games/snake/game.js`. Canvas-based 20x20 grid with snake rendered in accent-gold gradient (head brightest, body fading to ember tail) with rounded-rect segments and directional eyes. Food as glowing ember dot with radial gradient and shadow glow. Difficulty controls speed: Easy (200ms), Medium (130ms), Hard (80ms), Extreme (50ms). Arrow keys + WASD keyboard input with 180-degree reversal prevention. Touch/swipe gestures on mobile with configurable threshold; tap to pause. Start overlay, pause overlay, and game over overlay with score/best display. High scores persisted per-difficulty in localStorage. Canvas auto-sizes responsively based on viewport. Added Snake card with "solo" tag to `games/index.html` gallery. Files changed: `games/snake/index.html`, `games/snake/game.js`, `games/index.html`._
