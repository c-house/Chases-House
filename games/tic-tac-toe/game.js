// Tic Tac Toe — game.js
// Player = X (goes first), AI = O

(function () {
  'use strict';

  const PLAYER = 'X';
  const AI = 'O';
  const EMPTY = '';

  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  let board = Array(9).fill(EMPTY);
  let difficulty = 'medium';
  let gameOver = false;
  let currentTurn = PLAYER;

  const cells = document.querySelectorAll('.cell');
  const statusText = document.querySelector('.status-text');
  const newGameBtn = document.querySelector('.new-game-btn');
  const difficultyBtns = document.querySelectorAll('.difficulty-btn');

  // ── Initialization ────────────────────────────────

  function init() {
    cells.forEach(cell => {
      cell.addEventListener('click', onCellClick);
      cell.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCellClick.call(this);
        }
      });
    });

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

  // ── Game Flow ─────────────────────────────────────

  function onCellClick() {
    const index = parseInt(this.dataset.index);
    if (board[index] !== EMPTY || gameOver || currentTurn !== PLAYER) return;

    makeMove(index, PLAYER);

    if (gameOver) return;

    currentTurn = AI;
    setStatus('AI is thinking...');

    // Small delay so the player sees their move before AI responds
    setTimeout(aiMove, 300);
  }

  function makeMove(index, mark) {
    board[index] = mark;
    const cell = cells[index];
    cell.textContent = mark;
    cell.classList.add('taken', mark === PLAYER ? 'player' : 'ai');
    cell.setAttribute('aria-label', mark);

    const winLine = checkWin(board, mark);
    if (winLine) {
      highlightWin(winLine);
      gameOver = true;
      if (mark === PLAYER) {
        setStatus('You <span class="highlight">win!</span>');
      } else {
        setStatus('AI wins.');
      }
      return;
    }

    if (board.every(c => c !== EMPTY)) {
      gameOver = true;
      setStatus("It's a draw.");
      return;
    }
  }

  function aiMove() {
    if (gameOver) return;

    let move;
    if (difficulty === 'easy') {
      move = getRandomMove(board);
    } else if (difficulty === 'medium') {
      move = Math.random() < 0.3 ? getRandomMove(board) : getBestMove(board, AI);
    } else {
      // hard & extreme — optimal minimax
      move = getBestMove(board, AI);
    }

    makeMove(move, AI);

    if (!gameOver) {
      currentTurn = PLAYER;
      setStatus('Your turn — place your <span class="highlight">X</span>');
    }
  }

  function resetGame() {
    board = Array(9).fill(EMPTY);
    gameOver = false;
    currentTurn = PLAYER;

    cells.forEach(cell => {
      cell.textContent = '';
      cell.classList.remove('taken', 'player', 'ai', 'win-cell');
      const idx = cell.dataset.index;
      const row = Math.floor(idx / 3) + 1;
      const col = (idx % 3) + 1;
      cell.setAttribute('aria-label', 'Row ' + row + ', Column ' + col);
    });

    setStatus('Your turn — place your <span class="highlight">X</span>');
  }

  // ── Win Detection ─────────────────────────────────

  function checkWin(b, mark) {
    for (const line of WIN_LINES) {
      if (line.every(i => b[i] === mark)) return line;
    }
    return null;
  }

  function highlightWin(line) {
    line.forEach(i => cells[i].classList.add('win-cell'));
  }

  // ── AI: Random Move ───────────────────────────────

  function getRandomMove(b) {
    const available = [];
    for (let i = 0; i < 9; i++) {
      if (b[i] === EMPTY) available.push(i);
    }
    return available[Math.floor(Math.random() * available.length)];
  }

  // ── AI: Minimax ───────────────────────────────────

  function getBestMove(b, mark) {
    let bestScore = -Infinity;
    let bestMove = -1;

    for (let i = 0; i < 9; i++) {
      if (b[i] !== EMPTY) continue;
      b[i] = mark;
      const score = minimax(b, false, mark, 1);
      b[i] = EMPTY;
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }

    return bestMove;
  }

  function minimax(b, isMaximizing, aiMark, depth) {
    const humanMark = aiMark === AI ? PLAYER : AI;

    if (checkWin(b, aiMark)) return 10 - depth;
    if (checkWin(b, humanMark)) return depth - 10;
    if (b.every(c => c !== EMPTY)) return 0;

    if (isMaximizing) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (b[i] !== EMPTY) continue;
        b[i] = aiMark;
        best = Math.max(best, minimax(b, false, aiMark, depth + 1));
        b[i] = EMPTY;
      }
      return best;
    } else {
      let best = Infinity;
      for (let i = 0; i < 9; i++) {
        if (b[i] !== EMPTY) continue;
        b[i] = humanMark;
        best = Math.min(best, minimax(b, true, aiMark, depth + 1));
        b[i] = EMPTY;
      }
      return best;
    }
  }

  // ── UI Helpers ────────────────────────────────────

  function setStatus(html) {
    statusText.innerHTML = html;
  }

  // ── Start ─────────────────────────────────────────

  init();
})();
