// ── Sudoku Game ─────────────────────────────────────
(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────
  const DIFFICULTY_GIVENS = {
    easy:    { min: 36, max: 40 },
    medium:  { min: 30, max: 35 },
    hard:    { min: 25, max: 29 },
    extreme: { min: 20, max: 24 }
  };

  const STORAGE_KEY = 'sudoku-state';

  // ── State ──────────────────────────────────────────
  let difficulty = 'medium';
  let solution = [];      // 9x9 complete solution
  let givens = [];        // 9x9 booleans
  let board = [];         // 9x9 current player values (0 = empty)
  let pencilMarks = [];   // 9x9 arrays of Sets
  let selectedCell = null; // { row, col } or null
  let pencilMode = false;
  let solved = false;

  // ── DOM refs ───────────────────────────────────────
  const boardEl = document.getElementById('board');
  const statusText = document.getElementById('status-text');
  const newGameBtn = document.getElementById('new-game-btn');
  const pencilBtn = document.getElementById('pencil-btn');
  const eraseBtn = document.getElementById('erase-btn');
  const winOverlay = document.getElementById('win-overlay');
  const winSubtitle = document.getElementById('win-subtitle');
  const winNewBtn = document.getElementById('win-new-btn');
  const difficultyBtns = document.querySelectorAll('.difficulty-btn');
  const numpadBtns = document.querySelectorAll('.numpad-btn');

  // ── Puzzle Generation ──────────────────────────────

  function createEmptyGrid() {
    return Array.from({ length: 9 }, () => Array(9).fill(0));
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function isValidPlacement(grid, row, col, num) {
    for (let i = 0; i < 9; i++) {
      if (grid[row][i] === num) return false;
      if (grid[i][col] === num) return false;
    }
    const boxR = Math.floor(row / 3) * 3;
    const boxC = Math.floor(col / 3) * 3;
    for (let r = boxR; r < boxR + 3; r++) {
      for (let c = boxC; c < boxC + 3; c++) {
        if (grid[r][c] === num) return false;
      }
    }
    return true;
  }

  function solveGrid(grid) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
          for (const num of nums) {
            if (isValidPlacement(grid, r, c, num)) {
              grid[r][c] = num;
              if (solveGrid(grid)) return true;
              grid[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  function countSolutions(grid, limit) {
    let count = 0;
    function solve(g) {
      if (count >= limit) return;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (g[r][c] === 0) {
            for (let num = 1; num <= 9; num++) {
              if (isValidPlacement(g, r, c, num)) {
                g[r][c] = num;
                solve(g);
                g[r][c] = 0;
              }
            }
            return;
          }
        }
      }
      count++;
    }
    solve(grid);
    return count;
  }

  function generatePuzzle(diff) {
    const grid = createEmptyGrid();
    solveGrid(grid);
    const sol = grid.map(r => [...r]);

    const { min, max } = DIFFICULTY_GIVENS[diff];
    const targetGivens = min + Math.floor(Math.random() * (max - min + 1));
    let totalGivens = 81;

    const cells = shuffle(
      Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9])
    );

    for (const [r, c] of cells) {
      if (totalGivens <= targetGivens) break;
      const val = grid[r][c];
      grid[r][c] = 0;
      if (countSolutions(grid.map(row => [...row]), 2) !== 1) {
        grid[r][c] = val;
      } else {
        totalGivens--;
      }
    }

    return { solution: sol, puzzle: grid };
  }

  // ── Game Logic ─────────────────────────────────────

  function initGame(diff, fromSave) {
    difficulty = diff;
    solved = false;
    winOverlay.hidden = true;

    if (fromSave) {
      renderBoard();
      updateStatus();
      return;
    }

    const { solution: sol, puzzle } = generatePuzzle(diff);
    solution = sol;
    board = puzzle.map(r => [...r]);
    givens = puzzle.map(r => r.map(v => v !== 0));
    pencilMarks = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Set())
    );
    selectedCell = null;
    pencilMode = false;
    pencilBtn.classList.remove('active');

    saveState();
    renderBoard();
    updateStatus();
  }

  function selectCell(row, col) {
    if (solved) return;
    selectedCell = { row, col };
    renderBoard();
  }

  function placeNumber(num) {
    if (!selectedCell || solved) return;
    const { row, col } = selectedCell;
    if (givens[row][col]) return;

    if (pencilMode) {
      board[row][col] = 0;
      const marks = pencilMarks[row][col];
      if (marks.has(num)) {
        marks.delete(num);
      } else {
        marks.add(num);
      }
    } else {
      pencilMarks[row][col].clear();
      board[row][col] = board[row][col] === num ? 0 : num;
    }

    saveState();
    renderBoard();
    updateStatus();
    checkWin();
  }

  function eraseCell() {
    if (!selectedCell || solved) return;
    const { row, col } = selectedCell;
    if (givens[row][col]) return;
    board[row][col] = 0;
    pencilMarks[row][col].clear();
    saveState();
    renderBoard();
    updateStatus();
  }

  function getConflicts() {
    const conflicts = createEmptyGrid();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = board[r][c];
        if (val === 0) continue;

        // Check row
        for (let i = 0; i < 9; i++) {
          if (i !== c && board[r][i] === val) {
            conflicts[r][c] = 1;
            conflicts[r][i] = 1;
          }
        }
        // Check column
        for (let i = 0; i < 9; i++) {
          if (i !== r && board[i][c] === val) {
            conflicts[r][c] = 1;
            conflicts[i][c] = 1;
          }
        }
        // Check box
        const boxR = Math.floor(r / 3) * 3;
        const boxC = Math.floor(c / 3) * 3;
        for (let br = boxR; br < boxR + 3; br++) {
          for (let bc = boxC; bc < boxC + 3; bc++) {
            if ((br !== r || bc !== c) && board[br][bc] === val) {
              conflicts[r][c] = 1;
              conflicts[br][bc] = 1;
            }
          }
        }
      }
    }
    return conflicts;
  }

  function checkWin() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) return;
      }
    }
    const conflicts = getConflicts();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (conflicts[r][c]) return;
      }
    }
    solved = true;
    selectedCell = null;
    const labels = { easy: 'Easy', medium: 'Medium', hard: 'Hard', extreme: 'Extreme' };
    winSubtitle.textContent = `Difficulty: ${labels[difficulty]}`;
    winOverlay.hidden = false;
    clearSavedState();
    renderBoard();
  }

  function countFilledCells() {
    let count = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== 0) count++;
      }
    }
    return count;
  }

  function updateStatus() {
    const filled = countFilledCells();
    const remaining = 81 - filled;
    if (solved) {
      statusText.innerHTML = '<span class="highlight">Puzzle solved!</span>';
    } else if (remaining === 0) {
      statusText.innerHTML = 'Check for <span class="highlight">conflicts</span>';
    } else {
      statusText.innerHTML = `<span class="highlight">${remaining}</span> cell${remaining !== 1 ? 's' : ''} remaining`;
    }
  }

  // ── Rendering ──────────────────────────────────────

  function renderBoard() {
    const conflicts = getConflicts();
    const selectedVal = selectedCell ? board[selectedCell.row][selectedCell.col] : 0;

    boardEl.innerHTML = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('aria-label', `Row ${r + 1}, Column ${c + 1}`);

        const val = board[r][c];
        const isGiven = givens[r][c];
        const isSelected = selectedCell && selectedCell.row === r && selectedCell.col === c;
        const isConflict = conflicts[r][c];
        const isSameNumber = selectedVal !== 0 && val === selectedVal;

        if (isGiven) cell.classList.add('given');
        if (!isGiven && val !== 0) cell.classList.add('player-value');
        if (isSelected) cell.classList.add('selected');
        if (isConflict) cell.classList.add('conflict');
        if (isSameNumber && !isSelected) cell.classList.add('same-number');

        if (val !== 0) {
          cell.textContent = val;
        } else {
          const marks = pencilMarks[r][c];
          if (marks.size > 0) {
            const container = document.createElement('div');
            container.className = 'pencil-marks';
            for (let n = 1; n <= 9; n++) {
              const span = document.createElement('span');
              span.textContent = marks.has(n) ? n : '';
              container.appendChild(span);
            }
            cell.appendChild(container);
          }
        }

        cell.addEventListener('click', () => selectCell(r, c));
        boardEl.appendChild(cell);
      }
    }

    // Update numpad active state
    numpadBtns.forEach(btn => {
      const num = parseInt(btn.dataset.num);
      btn.classList.toggle('active-num', selectedVal !== 0 && num === selectedVal);
    });
  }

  // ── Persistence ────────────────────────────────────

  function saveState() {
    const state = {
      difficulty,
      solution,
      board,
      givens,
      pencilMarks: pencilMarks.map(row =>
        row.map(set => [...set])
      )
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore quota errors */ }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const state = JSON.parse(raw);
      difficulty = state.difficulty;
      solution = state.solution;
      board = state.board;
      givens = state.givens;
      pencilMarks = state.pencilMarks.map(row =>
        row.map(arr => new Set(arr))
      );
      selectedCell = null;
      pencilMode = false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearSavedState() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── Event Handlers ─────────────────────────────────

  difficultyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      difficultyBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      clearSavedState();
      statusText.innerHTML = 'Generating puzzle…';
      // Defer generation to allow UI update
      setTimeout(() => initGame(btn.dataset.difficulty, false), 10);
    });
  });

  numpadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      placeNumber(parseInt(btn.dataset.num));
    });
  });

  pencilBtn.addEventListener('click', () => {
    pencilMode = !pencilMode;
    pencilBtn.classList.toggle('active', pencilMode);
  });

  eraseBtn.addEventListener('click', eraseCell);
  newGameBtn.addEventListener('click', () => {
    clearSavedState();
    statusText.innerHTML = 'Generating puzzle…';
    setTimeout(() => initGame(difficulty, false), 10);
  });
  winNewBtn.addEventListener('click', () => {
    statusText.innerHTML = 'Generating puzzle…';
    setTimeout(() => initGame(difficulty, false), 10);
  });

  document.addEventListener('keydown', (e) => {
    if (solved) return;

    const num = parseInt(e.key);
    if (num >= 1 && num <= 9) {
      e.preventDefault();
      placeNumber(num);
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      eraseCell();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      pencilMode = !pencilMode;
      pencilBtn.classList.toggle('active', pencilMode);
      return;
    }

    if (selectedCell && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      let { row, col } = selectedCell;
      if (e.key === 'ArrowUp') row = (row + 8) % 9;
      else if (e.key === 'ArrowDown') row = (row + 1) % 9;
      else if (e.key === 'ArrowLeft') col = (col + 8) % 9;
      else if (e.key === 'ArrowRight') col = (col + 1) % 9;
      selectCell(row, col);
    }
  });

  // ── Init ───────────────────────────────────────────

  if (loadState()) {
    // Set the difficulty button to match loaded state
    difficultyBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.difficulty === difficulty);
    });
    initGame(difficulty, true);
  } else {
    initGame('medium', false);
  }

})();
