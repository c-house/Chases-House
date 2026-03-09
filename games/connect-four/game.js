// Connect Four — game.js
// Player = gold discs, AI = terracotta discs
// Standard 7-column, 6-row Connect Four with drop animation.
// AI uses minimax with alpha-beta pruning.

(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────
  const ROWS = 6;
  const COLS = 7;
  const EMPTY = 0;
  const PLAYER = 1;
  const AI_PIECE = 2;

  const DIFFICULTY_DEPTH = {
    easy: 2,
    medium: 4,
    hard: 7,
    extreme: 11
  };

  // ── State ─────────────────────────────────────────
  let board = [];         // board[row][col], row 0 = top
  let difficulty = 'medium';
  let gameOver = false;
  let currentTurn = 'player';
  let winCells = [];      // [{row,col}, ...] for highlight
  let hoverCol = -1;      // column being hovered

  // DOM refs
  const boardEl = document.getElementById('board');
  const statusText = document.querySelector('.status-text');
  const newGameBtn = document.querySelector('.new-game-btn');
  const difficultyBtns = document.querySelectorAll('.difficulty-btn');

  // ── Initialization ────────────────────────────────

  function initBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
      board[r] = new Array(COLS).fill(EMPTY);
    }
  }

  function init() {
    initBoard();
    gameOver = false;
    currentTurn = 'player';
    winCells = [];
    hoverCol = -1;
    renderBoard();
    setStatus('Your turn — <span class="highlight">drop a disc</span>');

    newGameBtn.addEventListener('click', resetGame);

    difficultyBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        difficulty = this.dataset.difficulty;
        difficultyBtns.forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        resetGame();
      });
    });
  }

  function resetGame() {
    initBoard();
    gameOver = false;
    currentTurn = 'player';
    winCells = [];
    hoverCol = -1;
    renderBoard();
    setStatus('Your turn — <span class="highlight">drop a disc</span>');
  }

  // ── Rendering ─────────────────────────────────────

  function renderBoard(dropCol, dropRow) {
    boardEl.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        var piece = board[r][c];

        if (piece === PLAYER) {
          cell.classList.add('player');
        } else if (piece === AI_PIECE) {
          cell.classList.add('ai');
        }

        // Win highlight
        if (winCells.some(function (w) { return w.row === r && w.col === c; })) {
          cell.classList.add('win');
        }

        // Drop animation
        if (dropCol === c && dropRow === r && piece !== EMPTY) {
          cell.classList.add('dropping');
          cell.style.setProperty('--drop-rows', String(dropRow + 1));
        }

        // Hover preview (only on empty cells in hovered column, show in landing row)
        if (!gameOver && currentTurn === 'player' && hoverCol === c && piece === EMPTY) {
          var landingRow = getLowestEmptyRow(board, c);
          if (landingRow === r) {
            cell.classList.add('preview');
          }
        }

        // Inner disc circle
        var inner = document.createElement('div');
        inner.className = 'cell-inner';
        cell.appendChild(inner);

        // Click handler
        if (!gameOver && currentTurn === 'player') {
          (function (col) {
            cell.addEventListener('click', function () { onColumnClick(col); });
            cell.addEventListener('mouseenter', function () { onColumnHover(col); });
            cell.addEventListener('mouseleave', function () { onColumnLeave(); });
          })(c);
        }

        boardEl.appendChild(cell);
      }
    }
  }

  // ── Column Hover ──────────────────────────────────

  function onColumnHover(col) {
    if (gameOver || currentTurn !== 'player') return;
    if (hoverCol !== col) {
      hoverCol = col;
      renderBoard();
    }
  }

  function onColumnLeave() {
    if (hoverCol !== -1) {
      hoverCol = -1;
      renderBoard();
    }
  }

  // ── Player Interaction ────────────────────────────

  function onColumnClick(col) {
    if (gameOver || currentTurn !== 'player') return;

    var row = getLowestEmptyRow(board, col);
    if (row === -1) return; // column full

    board[row][col] = PLAYER;
    hoverCol = -1;
    renderBoard(col, row);

    // Check win/draw
    var win = checkWin(board, row, col, PLAYER);
    if (win) {
      winCells = win;
      gameOver = true;
      renderBoard();
      setStatus('You <span class="highlight">win!</span>');
      return;
    }

    if (isBoardFull(board)) {
      gameOver = true;
      renderBoard();
      setStatus('Draw — board is full.');
      return;
    }

    currentTurn = 'ai';
    renderBoard(col, row);
    setStatus('AI is thinking...');
    setTimeout(aiMove, 400);
  }

  // ── Board Helpers ─────────────────────────────────

  function getLowestEmptyRow(b, col) {
    for (var r = ROWS - 1; r >= 0; r--) {
      if (b[r][col] === EMPTY) return r;
    }
    return -1;
  }

  function isBoardFull(b) {
    for (var c = 0; c < COLS; c++) {
      if (b[0][c] === EMPTY) return false;
    }
    return true;
  }

  function getValidColumns(b) {
    var cols = [];
    for (var c = 0; c < COLS; c++) {
      if (b[0][c] === EMPTY) cols.push(c);
    }
    return cols;
  }

  function cloneBoard(b) {
    return b.map(function (row) { return row.slice(); });
  }

  // ── Win Detection ─────────────────────────────────

  var DIRECTIONS = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal down-right
    [1, -1]   // diagonal down-left
  ];

  function checkWin(b, row, col, piece) {
    for (var d = 0; d < DIRECTIONS.length; d++) {
      var dr = DIRECTIONS[d][0];
      var dc = DIRECTIONS[d][1];
      var cells = [{ row: row, col: col }];

      // Count forward
      for (var i = 1; i < 4; i++) {
        var nr = row + dr * i;
        var nc = col + dc * i;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
        if (b[nr][nc] !== piece) break;
        cells.push({ row: nr, col: nc });
      }

      // Count backward
      for (var i = 1; i < 4; i++) {
        var nr = row - dr * i;
        var nc = col - dc * i;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
        if (b[nr][nc] !== piece) break;
        cells.push({ row: nr, col: nc });
      }

      if (cells.length >= 4) return cells;
    }
    return null;
  }

  function hasWinAnywhere(b, piece) {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (b[r][c] === piece && checkWin(b, r, c, piece)) return true;
      }
    }
    return false;
  }

  // ── AI ────────────────────────────────────────────

  function aiMove() {
    if (gameOver) return;

    var depth = DIFFICULTY_DEPTH[difficulty];
    var col;

    if (difficulty === 'easy') {
      col = aiMoveEasy();
    } else {
      col = findBestColumn(board, depth);
    }

    if (col === -1) return; // no moves (shouldn't happen)

    var row = getLowestEmptyRow(board, col);
    board[row][col] = AI_PIECE;
    renderBoard(col, row);

    // Check win/draw
    var win = checkWin(board, row, col, AI_PIECE);
    if (win) {
      winCells = win;
      gameOver = true;
      renderBoard();
      setStatus('AI wins.');
      return;
    }

    if (isBoardFull(board)) {
      gameOver = true;
      renderBoard();
      setStatus('Draw — board is full.');
      return;
    }

    currentTurn = 'player';
    renderBoard();
    setStatus('Your turn — <span class="highlight">drop a disc</span>');
  }

  function aiMoveEasy() {
    // Easy: search 2 plies but add 40% random moves
    if (Math.random() < 0.4) {
      var cols = getValidColumns(board);
      return cols[Math.floor(Math.random() * cols.length)];
    }
    return findBestColumn(board, DIFFICULTY_DEPTH.easy);
  }

  // ── AI: Alpha-Beta Search ─────────────────────────

  function findBestColumn(b, maxDepth) {
    var validCols = getValidColumns(b);
    if (validCols.length === 0) return -1;

    // Column order: prefer center columns for better pruning
    validCols.sort(function (a, bb) {
      return Math.abs(a - 3) - Math.abs(bb - 3);
    });

    var bestScore = -Infinity;
    var bestCol = validCols[0];

    for (var i = 0; i < validCols.length; i++) {
      var col = validCols[i];
      var newBoard = cloneBoard(b);
      var row = getLowestEmptyRow(newBoard, col);
      newBoard[row][col] = AI_PIECE;

      // Check for immediate win
      if (checkWin(newBoard, row, col, AI_PIECE)) return col;

      var score = alphaBeta(newBoard, maxDepth - 1, -Infinity, Infinity, false);
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }

    return bestCol;
  }

  function alphaBeta(b, depth, alpha, beta, maximizing) {
    // Terminal checks
    if (hasWinAnywhere(b, AI_PIECE)) return 100000 + depth;
    if (hasWinAnywhere(b, PLAYER)) return -100000 - depth;
    if (isBoardFull(b)) return 0;
    if (depth === 0) return evaluate(b);

    var validCols = getValidColumns(b);

    // Column ordering: center first
    validCols.sort(function (a, bb) {
      return Math.abs(a - 3) - Math.abs(bb - 3);
    });

    if (maximizing) {
      var value = -Infinity;
      for (var i = 0; i < validCols.length; i++) {
        var col = validCols[i];
        var nb = cloneBoard(b);
        var row = getLowestEmptyRow(nb, col);
        nb[row][col] = AI_PIECE;
        value = Math.max(value, alphaBeta(nb, depth - 1, alpha, beta, false));
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
      return value;
    } else {
      var value = Infinity;
      for (var i = 0; i < validCols.length; i++) {
        var col = validCols[i];
        var nb = cloneBoard(b);
        var row = getLowestEmptyRow(nb, col);
        nb[row][col] = PLAYER;
        value = Math.min(value, alphaBeta(nb, depth - 1, alpha, beta, true));
        beta = Math.min(beta, value);
        if (alpha >= beta) break;
      }
      return value;
    }
  }

  // ── Evaluation ────────────────────────────────────

  function evaluate(b) {
    var score = 0;

    // Center column preference
    for (var r = 0; r < ROWS; r++) {
      if (b[r][3] === AI_PIECE) score += 6;
      else if (b[r][3] === PLAYER) score -= 6;
    }

    // Evaluate all windows of 4
    // Horizontal
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c <= COLS - 4; c++) {
        score += evaluateWindow(b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]);
      }
    }

    // Vertical
    for (var c = 0; c < COLS; c++) {
      for (var r = 0; r <= ROWS - 4; r++) {
        score += evaluateWindow(b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]);
      }
    }

    // Diagonal down-right
    for (var r = 0; r <= ROWS - 4; r++) {
      for (var c = 0; c <= COLS - 4; c++) {
        score += evaluateWindow(b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]);
      }
    }

    // Diagonal down-left
    for (var r = 0; r <= ROWS - 4; r++) {
      for (var c = 3; c < COLS; c++) {
        score += evaluateWindow(b[r][c], b[r + 1][c - 1], b[r + 2][c - 2], b[r + 3][c - 3]);
      }
    }

    return score;
  }

  function evaluateWindow(a, b, c, d) {
    var aiCount = 0;
    var playerCount = 0;
    var emptyCount = 0;

    var cells = [a, b, c, d];
    for (var i = 0; i < 4; i++) {
      if (cells[i] === AI_PIECE) aiCount++;
      else if (cells[i] === PLAYER) playerCount++;
      else emptyCount++;
    }

    // Mixed windows (both players) are worthless
    if (aiCount > 0 && playerCount > 0) return 0;

    // AI scoring
    if (aiCount === 4) return 10000;
    if (aiCount === 3 && emptyCount === 1) return 50;
    if (aiCount === 2 && emptyCount === 2) return 8;

    // Player threat scoring (negative = bad for AI)
    if (playerCount === 4) return -10000;
    if (playerCount === 3 && emptyCount === 1) return -80;
    if (playerCount === 2 && emptyCount === 2) return -6;

    return 0;
  }

  // ── UI Helpers ────────────────────────────────────

  function setStatus(html) {
    statusText.innerHTML = html;
  }

  // ── Start ─────────────────────────────────────────

  init();
})();
