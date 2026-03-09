(() => {
  'use strict';

  // ── Constants ──────────────────────────────────────
  const GRID_SIZE = 20;
  const CELL_COUNT = GRID_SIZE * GRID_SIZE;
  const SPEEDS = { easy: 200, medium: 130, hard: 80, extreme: 50 };
  const DIRECTIONS = {
    up:    { x:  0, y: -1 },
    down:  { x:  0, y:  1 },
    left:  { x: -1, y:  0 },
    right: { x:  1, y:  0 },
  };
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const STORAGE_KEY = 'snake-highscores';

  // ── Colors (from CSS vars, hardcoded for canvas) ───
  const COLOR = {
    bg:        '#1e1e21',
    gridLine:  'rgba(160, 104, 40, 0.06)',
    snakeHead: '#e8b04a',
    snakeBody: '#c8943e',
    snakeTail: '#a06828',
    food:      '#a06828',
    foodGlow:  'rgba(200, 148, 62, 0.35)',
  };

  // ── DOM Elements ───────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const startOverlay = document.getElementById('start-overlay');
  const pauseOverlay = document.getElementById('pause-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const finalScoreEl = document.getElementById('final-score');
  const bestScoreEl = document.getElementById('best-score');
  const scoreDisplay = document.getElementById('score-display');
  const highscoreDisplay = document.getElementById('highscore-display');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const difficultyBtns = document.querySelectorAll('.difficulty-btn');

  // ── State ──────────────────────────────────────────
  let snake, direction, nextDirection, food, score, gameOver, paused, loopId;
  let difficulty = 'medium';
  let cellPx;

  // ── High Score Persistence ─────────────────────────
  function loadHighScores() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }

  function getHighScore() {
    return loadHighScores()[difficulty] || 0;
  }

  function saveHighScore(val) {
    const scores = loadHighScores();
    scores[difficulty] = val;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }

  // ── Canvas Sizing ──────────────────────────────────
  function sizeCanvas() {
    const maxPx = Math.min(
      window.innerWidth - 48,
      window.innerHeight * 0.55,
      440
    );
    const size = Math.floor(maxPx / GRID_SIZE) * GRID_SIZE;
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    cellPx = size / GRID_SIZE;
  }

  // ── Init / Reset ───────────────────────────────────
  function initGame() {
    const mid = Math.floor(GRID_SIZE / 2);
    snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    direction = 'right';
    nextDirection = 'right';
    score = 0;
    gameOver = false;
    paused = false;
    spawnFood();
    updateScoreUI();
  }

  // ── Food Placement ─────────────────────────────────
  function spawnFood() {
    const occupied = new Set(snake.map(s => s.y * GRID_SIZE + s.x));
    if (occupied.size >= CELL_COUNT) return; // board full — win (extremely unlikely)
    let idx;
    do {
      idx = Math.floor(Math.random() * CELL_COUNT);
    } while (occupied.has(idx));
    food = { x: idx % GRID_SIZE, y: Math.floor(idx / GRID_SIZE) };
  }

  // ── Game Tick ──────────────────────────────────────
  function tick() {
    if (gameOver || paused) return;

    direction = nextDirection;
    const head = snake[0];
    const d = DIRECTIONS[direction];
    const nx = head.x + d.x;
    const ny = head.y + d.y;

    // Wall collision
    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) {
      endGame();
      return;
    }

    // Self collision (skip tail — it will move away unless we just ate)
    for (let i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === nx && snake[i].y === ny) {
        endGame();
        return;
      }
    }

    const newHead = { x: nx, y: ny };
    snake.unshift(newHead);

    if (nx === food.x && ny === food.y) {
      score++;
      updateScoreUI();
      spawnFood();
    } else {
      snake.pop();
    }

    draw();
  }

  // ── End Game ───────────────────────────────────────
  function endGame() {
    gameOver = true;
    clearInterval(loopId);
    loopId = null;

    const best = Math.max(score, getHighScore());
    saveHighScore(best);

    finalScoreEl.textContent = score;
    bestScoreEl.textContent = best;
    highscoreDisplay.textContent = best;
    gameoverOverlay.hidden = false;
  }

  // ── UI Updates ─────────────────────────────────────
  function updateScoreUI() {
    scoreDisplay.textContent = score;
    highscoreDisplay.textContent = getHighScore();
  }

  // ── Drawing ────────────────────────────────────────
  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = COLOR.gridLine;
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID_SIZE; i++) {
      const p = i * cellPx;
      ctx.beginPath();
      ctx.moveTo(p, 0); ctx.lineTo(p, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p); ctx.lineTo(w, p);
      ctx.stroke();
    }

    // Food — glowing ember dot
    const fx = food.x * cellPx + cellPx / 2;
    const fy = food.y * cellPx + cellPx / 2;
    const foodRadius = cellPx * 0.35;

    ctx.save();
    ctx.shadowColor = COLOR.foodGlow;
    ctx.shadowBlur = cellPx * 0.6;
    ctx.beginPath();
    ctx.arc(fx, fy, foodRadius, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.food;
    ctx.fill();
    ctx.restore();

    // Second pass for brighter center
    const foodGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, foodRadius);
    foodGrad.addColorStop(0, '#e8b04a');
    foodGrad.addColorStop(1, COLOR.food);
    ctx.beginPath();
    ctx.arc(fx, fy, foodRadius, 0, Math.PI * 2);
    ctx.fillStyle = foodGrad;
    ctx.fill();

    // Snake
    const len = snake.length;
    for (let i = len - 1; i >= 0; i--) {
      const seg = snake[i];
      const t = len > 1 ? i / (len - 1) : 0; // 0 = tail, 1 = head
      const px = seg.x * cellPx;
      const py = seg.y * cellPx;
      const pad = cellPx * 0.08;

      // Interpolate color from tail to head
      if (i === 0) {
        ctx.fillStyle = COLOR.snakeHead;
      } else {
        ctx.fillStyle = lerpColor(COLOR.snakeTail, COLOR.snakeBody, t);
      }

      const radius = cellPx * 0.15;
      roundRect(ctx, px + pad, py + pad, cellPx - pad * 2, cellPx - pad * 2, radius);
      ctx.fill();
    }

    // Head eyes
    drawEyes(snake[0]);
  }

  function drawEyes(head) {
    const d = DIRECTIONS[direction];
    const cx = head.x * cellPx + cellPx / 2;
    const cy = head.y * cellPx + cellPx / 2;
    const eyeOff = cellPx * 0.18;
    const eyeR = cellPx * 0.07;

    // Perpendicular to direction for left/right eye placement
    const px = -d.y;
    const py = d.x;

    const e1x = cx + d.x * eyeOff * 0.5 + px * eyeOff;
    const e1y = cy + d.y * eyeOff * 0.5 + py * eyeOff;
    const e2x = cx + d.x * eyeOff * 0.5 - px * eyeOff;
    const e2y = cy + d.y * eyeOff * 0.5 - py * eyeOff;

    ctx.fillStyle = '#0a0a0b';
    ctx.beginPath();
    ctx.arc(e1x, e1y, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(e2x, e2y, eyeR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Helpers ────────────────────────────────────────
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function lerpColor(a, b, t) {
    const ar = parseInt(a.slice(1, 3), 16);
    const ag = parseInt(a.slice(3, 5), 16);
    const ab = parseInt(a.slice(5, 7), 16);
    const br = parseInt(b.slice(1, 3), 16);
    const bg = parseInt(b.slice(3, 5), 16);
    const bb = parseInt(b.slice(5, 7), 16);
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bv = Math.round(ab + (bb - ab) * t);
    return `rgb(${r},${g},${bv})`;
  }

  // ── Start / Restart ────────────────────────────────
  function startGame() {
    startOverlay.hidden = true;
    pauseOverlay.hidden = true;
    gameoverOverlay.hidden = true;
    initGame();
    draw();
    startLoop();
  }

  function startLoop() {
    if (loopId) clearInterval(loopId);
    loopId = setInterval(tick, SPEEDS[difficulty]);
  }

  // ── Pause / Resume ────────────────────────────────
  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    pauseOverlay.hidden = !paused;
    if (!paused) startLoop();
    else { clearInterval(loopId); loopId = null; }
  }

  // ── Keyboard Input ─────────────────────────────────
  const KEY_MAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', W: 'up', s: 'down', S: 'down',
    a: 'left', A: 'left', d: 'right', D: 'right',
  };

  document.addEventListener('keydown', (e) => {
    // Space: start or pause
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (!startOverlay.hidden) { startGame(); return; }
      if (!gameoverOverlay.hidden) { startGame(); return; }
      togglePause();
      return;
    }

    const dir = KEY_MAP[e.key];
    if (!dir) return;
    e.preventDefault();

    // If on start screen, start with that direction
    if (!startOverlay.hidden) {
      startGame();
      nextDirection = dir;
      return;
    }

    if (paused || gameOver) return;

    // Prevent 180-degree reversal
    if (dir !== OPPOSITE[direction]) {
      nextDirection = dir;
    }
  });

  // ── Touch / Swipe Input ────────────────────────────
  let touchStartX, touchStartY;
  const SWIPE_THRESHOLD = 30;

  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    if (touchStartX === undefined) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Tap (no significant movement) — toggle pause
    if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
      if (!startOverlay.hidden) { startGame(); return; }
      if (!gameoverOverlay.hidden) { startGame(); return; }
      togglePause();
      return;
    }

    if (paused || gameOver) return;

    let dir;
    if (absDx > absDy) {
      dir = dx > 0 ? 'right' : 'left';
    } else {
      dir = dy > 0 ? 'down' : 'up';
    }

    if (dir !== OPPOSITE[direction]) {
      nextDirection = dir;
    }
  });

  // Prevent pull-to-refresh on the container
  const container = document.querySelector('.canvas-container');
  container.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  // ── Overlay Button Handlers ────────────────────────
  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  // Click on pause overlay to resume
  pauseOverlay.addEventListener('click', togglePause);

  // ── Difficulty Selector ────────────────────────────
  difficultyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      difficultyBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty = btn.dataset.difficulty;
      updateScoreUI();

      // If mid-game, restart the loop at the new speed
      if (loopId && !paused && !gameOver) {
        startLoop();
      }
    });
  });

  // ── Window Resize ──────────────────────────────────
  window.addEventListener('resize', () => {
    sizeCanvas();
    if (snake) draw();
  });

  // ── Initial Setup ──────────────────────────────────
  sizeCanvas();
  initGame();
  draw();
  updateScoreUI();
})();
