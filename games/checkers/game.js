// Checkers — game.js
// Player = gold pieces (bottom), AI = terracotta pieces (top)
// Standard American checkers: 8x8 board, diagonal movement,
// mandatory captures, multi-jump chains, king promotion.

(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────
  const EMPTY = 0;
  const PLAYER = 1;
  const PLAYER_KING = 2;
  const AI_PIECE = 3;
  const AI_KING = 4;

  const BOARD_SIZE = 8;

  const DIFFICULTY_DEPTH = {
    easy: 2,
    medium: 4,
    hard: 7,
    extreme: 9
  };

  // ── State ─────────────────────────────────────────
  let board = [];
  let difficulty = 'medium';
  let gameOver = false;
  let selectedPiece = null;   // { row, col }
  let validMoves = [];        // [{ row, col, captures: [{row,col}...] }]
  let currentTurn = 'player'; // 'player' | 'ai'
  let lastMove = null;        // { from: {row,col}, to: {row,col} }
  let chainJumping = null;    // { row, col } if mid-chain jump

  // DOM refs
  const boardEl = document.getElementById('board');
  const statusText = document.querySelector('.status-text');
  const newGameBtn = document.querySelector('.new-game-btn');
  const difficultyBtns = document.querySelectorAll('.difficulty-btn');
  const playerScoreEl = document.querySelector('.player-score');
  const aiScoreEl = document.querySelector('.ai-score');

  // ── Initialization ────────────────────────────────

  function initBoard() {
    board = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      board[r] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        if ((r + c) % 2 === 1) {
          if (r < 3) board[r][c] = AI_PIECE;
          else if (r > 4) board[r][c] = PLAYER;
          else board[r][c] = EMPTY;
        } else {
          board[r][c] = EMPTY;
        }
      }
    }
  }

  function init() {
    initBoard();
    gameOver = false;
    selectedPiece = null;
    validMoves = [];
    currentTurn = 'player';
    lastMove = null;
    chainJumping = null;
    renderBoard();
    updateScore();
    setStatus('Your turn — <span class="highlight">select a piece</span>');

    newGameBtn.addEventListener('click', resetGame);

    difficultyBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        difficulty = this.dataset.difficulty;
        difficultyBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        resetGame();
      });
    });
  }

  function resetGame() {
    initBoard();
    gameOver = false;
    selectedPiece = null;
    validMoves = [];
    currentTurn = 'player';
    lastMove = null;
    chainJumping = null;
    renderBoard();
    updateScore();
    setStatus('Your turn — <span class="highlight">select a piece</span>');
  }

  // ── Rendering ─────────────────────────────────────

  function renderBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const sq = document.createElement('div');
        sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        sq.dataset.row = r;
        sq.dataset.col = c;

        // Last move highlight
        if (lastMove &&
          ((lastMove.from.row === r && lastMove.from.col === c) ||
           (lastMove.to.row === r && lastMove.to.col === c))) {
          sq.classList.add('last-move');
        }

        // Valid move indicator
        const moveInfo = validMoves.find(m => m.row === r && m.col === c);
        if (moveInfo) {
          if (moveInfo.captures && moveInfo.captures.length > 0) {
            sq.classList.add('valid-capture');
          } else {
            sq.classList.add('valid-move');
          }
          sq.addEventListener('click', () => onMoveClick(r, c));
        }

        // Piece
        const piece = board[r][c];
        if (piece !== EMPTY) {
          const pieceEl = document.createElement('div');
          pieceEl.className = 'piece';

          if (piece === PLAYER || piece === PLAYER_KING) {
            pieceEl.classList.add('player');
          } else {
            pieceEl.classList.add('ai');
          }

          if (piece === PLAYER_KING || piece === AI_KING) {
            pieceEl.classList.add('king');
          }

          if (selectedPiece && selectedPiece.row === r && selectedPiece.col === c) {
            pieceEl.classList.add('selected');
          }

          // Click handler for player pieces
          if (isPlayerPiece(piece) && currentTurn === 'player' && !gameOver) {
            pieceEl.addEventListener('click', (e) => {
              e.stopPropagation();
              onPieceClick(r, c);
            });
            pieceEl.style.cursor = 'pointer';
          }

          sq.appendChild(pieceEl);
        }

        boardEl.appendChild(sq);
      }
    }
  }

  // ── Piece Helpers ─────────────────────────────────

  function isPlayerPiece(p) { return p === PLAYER || p === PLAYER_KING; }
  function isAIPiece(p) { return p === AI_PIECE || p === AI_KING; }
  function isKing(p) { return p === PLAYER_KING || p === AI_KING; }
  function isOwn(p, side) {
    return side === 'player' ? isPlayerPiece(p) : isAIPiece(p);
  }
  function isEnemy(p, side) {
    return side === 'player' ? isAIPiece(p) : isPlayerPiece(p);
  }

  // ── Move Generation ───────────────────────────────

  function getMoveDirs(piece) {
    // Regular pieces move in one direction; kings move both
    if (piece === PLAYER) return [[-1, -1], [-1, 1]];
    if (piece === AI_PIECE) return [[1, -1], [1, 1]];
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // kings
  }

  function getJumpsForPiece(b, r, c, piece) {
    const jumps = [];
    const dirs = getMoveDirs(piece);
    for (const [dr, dc] of dirs) {
      const mr = r + dr, mc = c + dc;  // middle (captured)
      const lr = r + 2 * dr, lc = c + 2 * dc; // landing
      if (lr < 0 || lr >= BOARD_SIZE || lc < 0 || lc >= BOARD_SIZE) continue;
      const side = isPlayerPiece(piece) ? 'player' : 'ai';
      if (isEnemy(b[mr][mc], side) && b[lr][lc] === EMPTY) {
        jumps.push({ row: lr, col: lc, captures: [{ row: mr, col: mc }] });
      }
    }
    return jumps;
  }

  function getSimpleMovesForPiece(b, r, c, piece) {
    const moves = [];
    const dirs = getMoveDirs(piece);
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
      if (b[nr][nc] === EMPTY) {
        moves.push({ row: nr, col: nc, captures: [] });
      }
    }
    return moves;
  }

  function getAllMovesForSide(b, side) {
    // Mandatory capture: if any jump exists, only jumps are legal
    let allJumps = [];
    let allSimple = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = b[r][c];
        if (!isOwn(p, side)) continue;
        const jumps = getJumpsForPiece(b, r, c, p);
        if (jumps.length > 0) {
          for (const j of jumps) {
            allJumps.push({ from: { row: r, col: c }, to: j });
          }
        }
        const simple = getSimpleMovesForPiece(b, r, c, p);
        for (const m of simple) {
          allSimple.push({ from: { row: r, col: c }, to: m });
        }
      }
    }

    return allJumps.length > 0 ? allJumps : allSimple;
  }

  function getMovesForPiece(b, r, c, mustJump) {
    const piece = b[r][c];
    if (mustJump) {
      return getJumpsForPiece(b, r, c, piece);
    }
    // Check if any piece can jump — mandatory capture
    const side = isPlayerPiece(piece) ? 'player' : 'ai';
    let anyJump = false;
    outer:
    for (let rr = 0; rr < BOARD_SIZE; rr++) {
      for (let cc = 0; cc < BOARD_SIZE; cc++) {
        if (isOwn(b[rr][cc], side) && getJumpsForPiece(b, rr, cc, b[rr][cc]).length > 0) {
          anyJump = true;
          break outer;
        }
      }
    }
    if (anyJump) {
      return getJumpsForPiece(b, r, c, piece);
    }
    return [...getJumpsForPiece(b, r, c, piece), ...getSimpleMovesForPiece(b, r, c, piece)];
  }

  // ── Player Interaction ────────────────────────────

  function onPieceClick(r, c) {
    if (gameOver || currentTurn !== 'player') return;

    // If we're chain-jumping, only the jumping piece can be selected
    if (chainJumping && (chainJumping.row !== r || chainJumping.col !== c)) return;

    selectedPiece = { row: r, col: c };
    const mustJump = chainJumping !== null;
    validMoves = getMovesForPiece(board, r, c, mustJump);
    renderBoard();
  }

  function onMoveClick(r, c) {
    if (gameOver || currentTurn !== 'player' || !selectedPiece) return;

    const move = validMoves.find(m => m.row === r && m.col === c);
    if (!move) return;

    executeMove(board, selectedPiece.row, selectedPiece.col, move);
    lastMove = { from: { row: selectedPiece.row, col: selectedPiece.col }, to: { row: r, col: c } };

    // Check for chain jump
    if (move.captures && move.captures.length > 0) {
      // Promote before checking chain jumps
      promoteIfNeeded(board, r, c);
      const furtherJumps = getJumpsForPiece(board, r, c, board[r][c]);
      if (furtherJumps.length > 0) {
        chainJumping = { row: r, col: c };
        selectedPiece = { row: r, col: c };
        validMoves = furtherJumps;
        updateScore();
        renderBoard();
        setStatus('Continue jumping — <span class="highlight">mandatory capture</span>');
        return;
      }
    }

    promoteIfNeeded(board, r, c);
    chainJumping = null;
    selectedPiece = null;
    validMoves = [];
    updateScore();

    // Check win
    if (checkGameEnd()) return;

    currentTurn = 'ai';
    renderBoard();
    setStatus('AI is thinking...');
    setTimeout(aiMove, 400);
  }

  function executeMove(b, fromR, fromC, move) {
    const piece = b[fromR][fromC];
    b[move.row][move.col] = piece;
    b[fromR][fromC] = EMPTY;
    if (move.captures) {
      for (const cap of move.captures) {
        b[cap.row][cap.col] = EMPTY;
      }
    }
  }

  function promoteIfNeeded(b, r, c) {
    if (b[r][c] === PLAYER && r === 0) b[r][c] = PLAYER_KING;
    if (b[r][c] === AI_PIECE && r === BOARD_SIZE - 1) b[r][c] = AI_KING;
  }

  // ── Game End Detection ────────────────────────────

  function checkGameEnd() {
    const playerMoves = getAllMovesForSide(board, 'player');
    const aiMoves = getAllMovesForSide(board, 'ai');
    const playerCount = countPieces(board, 'player');
    const aiCount = countPieces(board, 'ai');

    if (aiCount === 0 || aiMoves.length === 0) {
      gameOver = true;
      renderBoard();
      setStatus('You <span class="highlight">win!</span>');
      return true;
    }
    if (playerCount === 0 || playerMoves.length === 0) {
      gameOver = true;
      renderBoard();
      setStatus('AI wins.');
      return true;
    }
    return false;
  }

  function countPieces(b, side) {
    let count = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (isOwn(b[r][c], side)) count++;
      }
    }
    return count;
  }

  // ── Score Display ─────────────────────────────────

  function updateScore() {
    playerScoreEl.textContent = 'You: ' + countPieces(board, 'player');
    aiScoreEl.textContent = 'AI: ' + countPieces(board, 'ai');
  }

  // ── AI ────────────────────────────────────────────

  function aiMove() {
    if (gameOver) return;

    const depth = DIFFICULTY_DEPTH[difficulty];
    const bestMove = findBestMove(board, depth);

    if (!bestMove) {
      gameOver = true;
      renderBoard();
      setStatus('You <span class="highlight">win!</span>');
      return;
    }

    // Execute AI move (may involve chain jumps)
    executeAIMove(bestMove);
  }

  function executeAIMove(moveSequence) {
    // moveSequence is an array of {from, to} steps
    let i = 0;
    function step() {
      if (i >= moveSequence.length) {
        updateScore();
        if (checkGameEnd()) return;
        currentTurn = 'player';
        chainJumping = null;
        selectedPiece = null;
        validMoves = [];
        renderBoard();
        setStatus('Your turn — <span class="highlight">select a piece</span>');
        return;
      }

      const m = moveSequence[i];
      executeMove(board, m.from.row, m.from.col, m.to);
      promoteIfNeeded(board, m.to.row, m.to.col);
      lastMove = { from: m.from, to: { row: m.to.row, col: m.to.col } };
      updateScore();
      i++;

      if (i < moveSequence.length) {
        renderBoard();
        setTimeout(step, 300);
      } else {
        step();
      }
    }
    step();
  }

  // ── AI: Alpha-Beta Search ─────────────────────────

  function findBestMove(b, maxDepth) {
    // Get all legal moves with full chain-jump sequences
    const moves = getAllMoveSequences(b, 'ai');
    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0];

    let bestScore = -Infinity;
    let bestMoveSeq = moves[0];

    for (const moveSeq of moves) {
      const newBoard = cloneBoard(b);
      applyMoveSequence(newBoard, moveSeq);
      const score = alphaBeta(newBoard, maxDepth - 1, -Infinity, Infinity, false);
      if (score > bestScore) {
        bestScore = score;
        bestMoveSeq = moveSeq;
      }
    }

    return bestMoveSeq;
  }

  function alphaBeta(b, depth, alpha, beta, maximizing) {
    if (depth === 0) return evaluate(b);

    const side = maximizing ? 'ai' : 'player';
    const moves = getAllMoveSequences(b, side);

    if (moves.length === 0) {
      // Side has no moves — they lose
      return maximizing ? -10000 : 10000;
    }

    if (maximizing) {
      let value = -Infinity;
      for (const moveSeq of moves) {
        const newBoard = cloneBoard(b);
        applyMoveSequence(newBoard, moveSeq);
        value = Math.max(value, alphaBeta(newBoard, depth - 1, alpha, beta, false));
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
      return value;
    } else {
      let value = Infinity;
      for (const moveSeq of moves) {
        const newBoard = cloneBoard(b);
        applyMoveSequence(newBoard, moveSeq);
        value = Math.min(value, alphaBeta(newBoard, depth - 1, alpha, beta, true));
        beta = Math.min(beta, value);
        if (alpha >= beta) break;
      }
      return value;
    }
  }

  function getAllMoveSequences(b, side) {
    // Returns array of move sequences (each is an array of {from, to} steps)
    const allMoves = getAllMovesForSide(b, side);
    const isCapture = allMoves.length > 0 && allMoves[0].to.captures && allMoves[0].to.captures.length > 0;

    if (!isCapture) {
      // Simple moves — each is a single-step sequence
      return allMoves.map(m => [{ from: m.from, to: m.to }]);
    }

    // Capture moves — expand chain jumps
    const sequences = [];
    for (const m of allMoves) {
      const newBoard = cloneBoard(b);
      const piece = newBoard[m.from.row][m.from.col];
      newBoard[m.to.row][m.to.col] = piece;
      newBoard[m.from.row][m.from.col] = EMPTY;
      for (const cap of m.to.captures) {
        newBoard[cap.row][cap.col] = EMPTY;
      }
      // Promote
      let promoted = piece;
      if (piece === PLAYER && m.to.row === 0) promoted = PLAYER_KING;
      if (piece === AI_PIECE && m.to.row === BOARD_SIZE - 1) promoted = AI_KING;
      newBoard[m.to.row][m.to.col] = promoted;

      // Look for chain jumps
      const chains = expandChainJumps(newBoard, m.to.row, m.to.col, promoted, [{ from: m.from, to: m.to }]);
      sequences.push(...chains);
    }
    return sequences;
  }

  function expandChainJumps(b, r, c, piece, pathSoFar) {
    const jumps = getJumpsForPiece(b, r, c, piece);
    if (jumps.length === 0) return [pathSoFar];

    const results = [];
    for (const j of jumps) {
      const nb = cloneBoard(b);
      nb[j.row][j.col] = piece;
      nb[r][c] = EMPTY;
      for (const cap of j.captures) {
        nb[cap.row][cap.col] = EMPTY;
      }
      // Promote
      let promoted = piece;
      if (piece === PLAYER && j.row === 0) promoted = PLAYER_KING;
      if (piece === AI_PIECE && j.row === BOARD_SIZE - 1) promoted = AI_KING;
      nb[j.row][j.col] = promoted;

      const newPath = [...pathSoFar, { from: { row: r, col: c }, to: j }];
      results.push(...expandChainJumps(nb, j.row, j.col, promoted, newPath));
    }
    return results;
  }

  function applyMoveSequence(b, seq) {
    for (const step of seq) {
      const piece = b[step.from.row][step.from.col];
      b[step.to.row][step.to.col] = piece;
      b[step.from.row][step.from.col] = EMPTY;
      if (step.to.captures) {
        for (const cap of step.to.captures) {
          b[cap.row][cap.col] = EMPTY;
        }
      }
      // Promote
      if (b[step.to.row][step.to.col] === PLAYER && step.to.row === 0) {
        b[step.to.row][step.to.col] = PLAYER_KING;
      }
      if (b[step.to.row][step.to.col] === AI_PIECE && step.to.row === BOARD_SIZE - 1) {
        b[step.to.row][step.to.col] = AI_KING;
      }
    }
  }

  // ── Evaluation ────────────────────────────────────

  function evaluate(b) {
    let score = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = b[r][c];
        if (p === EMPTY) continue;

        if (p === AI_PIECE) {
          score += 100;
          // Advancement bonus (closer to promotion row)
          score += r * 3;
          // Center control
          if (c >= 2 && c <= 5 && r >= 2 && r <= 5) score += 5;
        } else if (p === AI_KING) {
          score += 175;
          // Kings prefer center
          if (c >= 2 && c <= 5 && r >= 2 && r <= 5) score += 8;
        } else if (p === PLAYER) {
          score -= 100;
          // Advancement bonus
          score -= (7 - r) * 3;
          // Center control
          if (c >= 2 && c <= 5 && r >= 2 && r <= 5) score -= 5;
        } else if (p === PLAYER_KING) {
          score -= 175;
          if (c >= 2 && c <= 5 && r >= 2 && r <= 5) score -= 8;
        }
      }
    }

    // Mobility
    const aiMoves = getAllMovesForSide(b, 'ai').length;
    const playerMoves = getAllMovesForSide(b, 'player').length;
    score += (aiMoves - playerMoves) * 2;

    return score;
  }

  // ── Board Utils ───────────────────────────────────

  function cloneBoard(b) {
    return b.map(row => row.slice());
  }

  // ── UI Helpers ────────────────────────────────────

  function setStatus(html) {
    statusText.innerHTML = html;
  }

  // ── Start ─────────────────────────────────────────

  init();
})();
