// ── Crossword Game ─────────────────────────────────────
(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────
  const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard', 'extreme'];

  // ── State ──────────────────────────────────────────
  let difficulty = 'easy';
  let puzzle = null;        // current puzzle object from CrosswordPuzzles
  let playerGrid = [];      // 2D array: null for black, '' for empty, letter for filled
  let selectedCell = null;  // { row, col } or null
  let direction = 'across'; // 'across' or 'down'
  let cellFlags = [];       // 2D array: null for black, { incorrect: bool, revealed: bool }
  let wordSpans = {};       // { across: { num: [{row,col},...] }, down: { ... } }
  let clueMap = [];         // 2D array: { across: num|null, down: num|null }
  let solved = false;

  // ── Timer State ────────────────────────────────────
  let timerElapsed = 0;       // seconds elapsed
  let timerRunning = false;   // is the timer actively counting
  let timerStarted = false;   // has the user typed at least one letter
  let timerInterval = null;   // setInterval handle

  // ── DOM refs ───────────────────────────────────────
  const boardEl = document.getElementById('board');
  const cluesAcrossEl = document.getElementById('clues-across');
  const cluesDownEl = document.getElementById('clues-down');
  const statusText = document.getElementById('status-text');
  const newGameBtn = document.getElementById('new-game-btn');
  const winOverlay = document.getElementById('win-overlay');
  const winSubtitle = document.getElementById('win-subtitle');
  const winNewBtn = document.getElementById('win-new-btn');
  const activeClueBar = document.getElementById('active-clue-bar');
  const difficultyBtns = document.querySelectorAll('.difficulty-btn');
  const timerValueEl = document.getElementById('timer-value');
  const timerBtn = document.getElementById('timer-btn');

  // ── Timer ──────────────────────────────────────────

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function updateTimerDisplay() {
    timerValueEl.textContent = formatTime(timerElapsed);
  }

  function startTimer() {
    if (timerRunning || solved) return;
    timerRunning = true;
    timerStarted = true;
    timerBtn.textContent = 'Pause';
    timerInterval = setInterval(() => {
      timerElapsed++;
      updateTimerDisplay();
    }, 1000);
  }

  function pauseTimer() {
    if (!timerRunning) return;
    timerRunning = false;
    timerBtn.textContent = 'Resume';
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function stopTimer() {
    pauseTimer();
    timerStarted = false;
  }

  function resetTimer() {
    stopTimer();
    timerElapsed = 0;
    timerBtn.textContent = 'Pause';
    updateTimerDisplay();
  }

  // ── Puzzle Loading ─────────────────────────────────

  function loadPuzzle(p) {
    puzzle = p;
    solved = false;
    winOverlay.hidden = true;
    selectedCell = null;
    direction = 'across';
    resetTimer();

    const size = puzzle.size;
    playerGrid = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) =>
        puzzle.grid[r][c] === '#' ? null : ''
      )
    );
    cellFlags = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) =>
        puzzle.grid[r][c] === '#' ? null : { incorrect: false, revealed: false }
      )
    );

    computeWordSpans();
    computeClueMap();
    renderBoard();
    renderClues();
    updateStatus();
    updateActiveClueBar();
  }

  function computeWordSpans() {
    wordSpans = { across: {}, down: {} };

    for (const clue of puzzle.clues.across) {
      const cells = [];
      for (let c = clue.col; c < puzzle.size && puzzle.grid[clue.row][c] !== '#'; c++) {
        cells.push({ row: clue.row, col: c });
      }
      wordSpans.across[clue.num] = cells;
    }

    for (const clue of puzzle.clues.down) {
      const cells = [];
      for (let r = clue.row; r < puzzle.size && puzzle.grid[r][clue.col] !== '#'; r++) {
        cells.push({ row: r, col: clue.col });
      }
      wordSpans.down[clue.num] = cells;
    }
  }

  function computeClueMap() {
    const size = puzzle.size;
    clueMap = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({ across: null, down: null }))
    );

    for (const clue of puzzle.clues.across) {
      const cells = wordSpans.across[clue.num];
      for (const { row, col } of cells) {
        clueMap[row][col].across = clue.num;
      }
    }

    for (const clue of puzzle.clues.down) {
      const cells = wordSpans.down[clue.num];
      for (const { row, col } of cells) {
        clueMap[row][col].down = clue.num;
      }
    }
  }

  // ── Cell Number Map ────────────────────────────────

  function getCellNumbers() {
    const nums = {};
    for (const clue of puzzle.clues.across) {
      nums[`${clue.row},${clue.col}`] = clue.num;
    }
    for (const clue of puzzle.clues.down) {
      nums[`${clue.row},${clue.col}`] = clue.num;
    }
    return nums;
  }

  // ── Active Word Cells ──────────────────────────────

  function getActiveWordCells() {
    if (!selectedCell) return [];
    const { row, col } = selectedCell;
    const clueNum = clueMap[row][col][direction];
    if (clueNum == null) {
      // Try opposite direction
      const alt = direction === 'across' ? 'down' : 'across';
      const altNum = clueMap[row][col][alt];
      if (altNum != null) return wordSpans[alt][altNum];
      return [];
    }
    return wordSpans[direction][clueNum];
  }

  function getActiveClueNum() {
    if (!selectedCell) return null;
    const { row, col } = selectedCell;
    let num = clueMap[row][col][direction];
    if (num == null) {
      const alt = direction === 'across' ? 'down' : 'across';
      num = clueMap[row][col][alt];
    }
    return num;
  }

  function getActiveDirection() {
    if (!selectedCell) return direction;
    const { row, col } = selectedCell;
    if (clueMap[row][col][direction] != null) return direction;
    const alt = direction === 'across' ? 'down' : 'across';
    if (clueMap[row][col][alt] != null) return alt;
    return direction;
  }

  // ── Rendering ──────────────────────────────────────

  function renderBoard() {
    const size = puzzle.size;
    boardEl.style.setProperty('--grid-size', size);
    boardEl.innerHTML = '';

    const cellNums = getCellNumbers();
    const activeWordCells = getActiveWordCells();
    const activeSet = new Set(activeWordCells.map(c => `${c.row},${c.col}`));

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        const isBlack = puzzle.grid[r][c] === '#';
        if (isBlack) {
          cell.classList.add('black');
          boardEl.appendChild(cell);
          continue;
        }

        const isSelected = selectedCell && selectedCell.row === r && selectedCell.col === c;
        const isHighlighted = activeSet.has(`${r},${c}`);
        const value = playerGrid[r][c];
        const flags = cellFlags[r][c];

        if (isSelected) cell.classList.add('selected');
        if (isHighlighted && !isSelected) cell.classList.add('word-highlight');
        if (value) cell.classList.add('player-value');
        if (flags && flags.incorrect) cell.classList.add('checked-incorrect');
        if (flags && flags.revealed) cell.classList.add('revealed');

        // Cell number
        const numKey = `${r},${c}`;
        if (cellNums[numKey] != null) {
          const numSpan = document.createElement('span');
          numSpan.className = 'cell-number';
          numSpan.textContent = cellNums[numKey];
          cell.appendChild(numSpan);
        }

        // Cell value
        if (value) {
          const valSpan = document.createElement('span');
          valSpan.className = 'cell-value';
          valSpan.textContent = value;
          cell.appendChild(valSpan);
        }

        cell.addEventListener('click', () => handleCellClick(r, c));
        boardEl.appendChild(cell);
      }
    }
  }

  function renderClues() {
    renderClueList(cluesAcrossEl, puzzle.clues.across, 'across');
    renderClueList(cluesDownEl, puzzle.clues.down, 'down');
  }

  function renderClueList(listEl, clues, dir) {
    listEl.innerHTML = '';
    const activeNum = getActiveClueNum();
    const activeDir = getActiveDirection();

    for (const clue of clues) {
      const li = document.createElement('li');
      li.className = 'clue-item';
      li.dataset.num = clue.num;
      li.dataset.direction = dir;

      // Check if this clue's word is completed
      const cells = wordSpans[dir][clue.num];
      const isCompleted = cells.every(({ row, col }) => playerGrid[row][col] !== '');
      if (isCompleted) li.classList.add('completed');

      // Active highlighting
      if (activeNum === clue.num && activeDir === dir) {
        li.classList.add('active');
      }

      const numSpan = document.createElement('span');
      numSpan.className = 'clue-num';
      numSpan.textContent = clue.num;

      li.appendChild(numSpan);
      li.appendChild(document.createTextNode(clue.text));

      li.addEventListener('click', () => handleClueClick(clue, dir));
      listEl.appendChild(li);
    }
  }

  function updateActiveClueBar() {
    if (!selectedCell) {
      activeClueBar.querySelector('.clue-direction').textContent = '';
      activeClueBar.querySelector('.clue-text').textContent = 'Select a cell to begin';
      return;
    }

    const activeDir = getActiveDirection();
    const activeNum = getActiveClueNum();
    if (activeNum == null) return;

    const clueList = puzzle.clues[activeDir];
    const clue = clueList.find(c => c.num === activeNum);
    if (!clue) return;

    activeClueBar.querySelector('.clue-direction').textContent =
      `${activeNum} ${activeDir.charAt(0).toUpperCase() + activeDir.slice(1)}`;
    activeClueBar.querySelector('.clue-text').textContent = clue.text;
  }

  function scrollActiveClueIntoView() {
    const activeItem = document.querySelector('.clue-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // ── Status ─────────────────────────────────────────

  function updateStatus() {
    if (solved) {
      statusText.innerHTML = '<span class="highlight">Puzzle complete!</span>';
      return;
    }
    const totalCells = countTotalCells();
    const filledCells = countFilledCells();
    const remaining = totalCells - filledCells;
    if (remaining === 0) {
      statusText.innerHTML = 'All cells filled — <span class="highlight">check your answers</span>';
    } else {
      statusText.innerHTML = `<span class="highlight">${remaining}</span> cell${remaining !== 1 ? 's' : ''} remaining`;
    }
  }

  function countTotalCells() {
    let count = 0;
    for (let r = 0; r < puzzle.size; r++) {
      for (let c = 0; c < puzzle.size; c++) {
        if (puzzle.grid[r][c] !== '#') count++;
      }
    }
    return count;
  }

  function countFilledCells() {
    let count = 0;
    for (let r = 0; r < puzzle.size; r++) {
      for (let c = 0; c < puzzle.size; c++) {
        if (playerGrid[r][c]) count++;
      }
    }
    return count;
  }

  // ── Event Handlers ─────────────────────────────────

  function handleCellClick(row, col) {
    if (solved) return;
    if (puzzle.grid[row][col] === '#') return;

    // Click same cell: toggle direction
    if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
      const alt = direction === 'across' ? 'down' : 'across';
      // Only toggle if the cell belongs to a word in the alt direction
      if (clueMap[row][col][alt] != null) {
        direction = alt;
      }
    } else {
      selectedCell = { row, col };
    }

    renderBoard();
    renderClues();
    updateActiveClueBar();
    scrollActiveClueIntoView();
  }

  function handleClueClick(clue, dir) {
    if (solved) return;
    direction = dir;
    const cells = wordSpans[dir][clue.num];
    // Select first empty cell, or first cell if all filled
    const emptyCell = cells.find(({ row, col }) => playerGrid[row][col] === '');
    const target = emptyCell || cells[0];
    selectedCell = { row: target.row, col: target.col };

    renderBoard();
    renderClues();
    updateActiveClueBar();
    scrollActiveClueIntoView();
  }

  // ── Difficulty Selector ────────────────────────────

  function selectDifficulty(diff) {
    difficulty = diff;
    difficultyBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.difficulty === diff);
    });
    startNewGame();
  }

  function startNewGame() {
    const pool = window.CrosswordPuzzles[difficulty];
    if (!pool || pool.length === 0) return;
    const idx = Math.floor(Math.random() * pool.length);
    loadPuzzle(pool[idx]);
  }

  // ── Wire Up Events ─────────────────────────────────

  difficultyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      selectDifficulty(btn.dataset.difficulty);
    });
  });

  newGameBtn.addEventListener('click', () => startNewGame());
  winNewBtn.addEventListener('click', () => startNewGame());

  timerBtn.addEventListener('click', () => {
    if (!timerStarted) return;
    if (timerRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!timerStarted || solved) return;
    if (document.hidden) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  // ── Keyboard Input ─────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (solved) return;
    if (!selectedCell) return;

    const { row, col } = selectedCell;

    // A–Z letter input
    if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      const letter = e.key.toUpperCase();
      const flags = cellFlags[row][col];
      if (flags && flags.revealed) return; // locked cell

      // Start timer on first letter entry
      if (!timerStarted) startTimer();

      // Clear incorrect flag when typing
      if (flags) flags.incorrect = false;
      playerGrid[row][col] = letter;

      // Auto-advance to next empty cell in current word
      autoAdvance();

      renderBoard();
      renderClues();
      updateActiveClueBar();
      updateStatus();
      checkWin();
      return;
    }

    // Backspace
    if (e.key === 'Backspace') {
      e.preventDefault();
      const flags = cellFlags[row][col];
      if (flags && flags.revealed) return;

      if (playerGrid[row][col]) {
        playerGrid[row][col] = '';
        if (flags) flags.incorrect = false;
      } else {
        // Retreat to previous cell in word
        retreat();
      }

      renderBoard();
      renderClues();
      updateActiveClueBar();
      updateStatus();
      return;
    }

    // Spacebar: toggle direction
    if (e.key === ' ') {
      e.preventDefault();
      const alt = direction === 'across' ? 'down' : 'across';
      if (clueMap[row][col][alt] != null) {
        direction = alt;
      }
      renderBoard();
      renderClues();
      updateActiveClueBar();
      scrollActiveClueIntoView();
      return;
    }

    // Arrow keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      navigateArrow(e.key);
      renderBoard();
      renderClues();
      updateActiveClueBar();
      scrollActiveClueIntoView();
      return;
    }

    // Tab / Shift+Tab: jump between words
    if (e.key === 'Tab') {
      e.preventDefault();
      jumpToNextWord(e.shiftKey);
      renderBoard();
      renderClues();
      updateActiveClueBar();
      scrollActiveClueIntoView();
      return;
    }
  });

  // ── Navigation Helpers ─────────────────────────────

  function autoAdvance() {
    const activeDir = getActiveDirection();
    const activeNum = getActiveClueNum();
    if (activeNum == null) return;

    const cells = wordSpans[activeDir][activeNum];
    const idx = cells.findIndex(c => c.row === selectedCell.row && c.col === selectedCell.col);
    if (idx === -1) return;

    // Find next empty cell in word after current position
    for (let i = idx + 1; i < cells.length; i++) {
      if (playerGrid[cells[i].row][cells[i].col] === '') {
        selectedCell = { row: cells[i].row, col: cells[i].col };
        return;
      }
    }

    // If no empty cell after, just move to next cell if available
    if (idx + 1 < cells.length) {
      selectedCell = { row: cells[idx + 1].row, col: cells[idx + 1].col };
    }
  }

  function retreat() {
    const activeDir = getActiveDirection();
    const activeNum = getActiveClueNum();
    if (activeNum == null) return;

    const cells = wordSpans[activeDir][activeNum];
    const idx = cells.findIndex(c => c.row === selectedCell.row && c.col === selectedCell.col);
    if (idx <= 0) return;

    selectedCell = { row: cells[idx - 1].row, col: cells[idx - 1].col };
    const flags = cellFlags[cells[idx - 1].row][cells[idx - 1].col];
    if (flags && !flags.revealed) {
      playerGrid[cells[idx - 1].row][cells[idx - 1].col] = '';
      if (flags) flags.incorrect = false;
    }
  }

  function navigateArrow(key) {
    let { row, col } = selectedCell;
    const dr = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
    const dc = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;

    let nr = row + dr;
    let nc = col + dc;

    // Skip black cells, stay in bounds
    while (nr >= 0 && nr < puzzle.size && nc >= 0 && nc < puzzle.size) {
      if (puzzle.grid[nr][nc] !== '#') {
        selectedCell = { row: nr, col: nc };
        // Update direction based on arrow key
        if (dc !== 0) direction = 'across';
        if (dr !== 0) direction = 'down';
        return;
      }
      nr += dr;
      nc += dc;
    }
  }

  function jumpToNextWord(reverse) {
    const activeDir = getActiveDirection();
    const clueList = puzzle.clues[activeDir];
    const activeNum = getActiveClueNum();

    let idx = clueList.findIndex(c => c.num === activeNum);
    if (idx === -1) idx = 0;

    if (reverse) {
      idx = (idx - 1 + clueList.length) % clueList.length;
    } else {
      idx = (idx + 1) % clueList.length;
    }

    // If wrapping, switch direction
    if ((reverse && idx === clueList.length - 1) || (!reverse && idx === 0)) {
      const alt = activeDir === 'across' ? 'down' : 'across';
      direction = alt;
      const altClues = puzzle.clues[alt];
      idx = reverse ? altClues.length - 1 : 0;
      handleClueClick(altClues[idx], alt);
      return;
    }

    handleClueClick(clueList[idx], activeDir);
  }

  // ── Win Detection ──────────────────────────────────

  function checkWin() {
    for (let r = 0; r < puzzle.size; r++) {
      for (let c = 0; c < puzzle.size; c++) {
        if (puzzle.grid[r][c] === '#') continue;
        if (playerGrid[r][c] !== puzzle.grid[r][c]) return;
      }
    }
    solved = true;
    selectedCell = null;
    stopTimer();
    const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    winSubtitle.textContent = `${diffLabel} — ${formatTime(timerElapsed)}`;
    winOverlay.hidden = false;
    updateStatus();
    renderBoard();
    renderClues();
  }

  // ── Init ───────────────────────────────────────────

  startNewGame();

})();
