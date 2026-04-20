(function () {
  'use strict';

  const E = window.PacmanEngine;
  const R = window.PacmanRender;
  const I = window.PacmanInput;
  const A = window.PacmanAI;
  const Au = window.PacmanAudio;
  const Modes = window.PacmanModes;

  const FIXED_STEP_MS = 1000 / 60;

  let canvas = null;
  let state = null;
  let running = false;
  let accumulator = 0;
  let lastTs = 0;
  let selectedMode = null;
  let currentConfig = null;
  let bindingFlow = null;
  let onGameOverCb = null;

  function inputProvider(entity, state) {
    if (entity.role === 'pac') {
      return I.getDirection(entity.slot);
    }
    if (entity.role === 'ghost') {
      // Human control only when ghost is out of the house in normal/frightened mode.
      const isHuman = entity.controlledBy === 'human';
      const canBeHumanControlled = entity.houseState === 'out' && entity.mode !== 'eaten';
      if (isHuman && canBeHumanControlled) {
        return I.getDirection(entity.slot);
      }
      return A.getGhostDir(entity, state);
    }
    return null;
  }

  function startGame(config) {
    currentConfig = config;
    state = E.createState(config);
    Au.ensure();
    Au.resume();
    Au.resetForNewGame();
    Au.playIntro();
    running = true;
    accumulator = 0;
    lastTs = performance.now();
    requestAnimationFrame(tick);
  }

  function stopGame() { running = false; }
  function pauseGame() { running = false; }
  function resumeGame() {
    if (!state || state.gameOver) return;
    if (running) return;
    running = true;
    lastTs = performance.now();
    accumulator = 0;
    requestAnimationFrame(tick);
  }

  function tick(ts) {
    if (!running) return;
    const dt = Math.min(250, ts - lastTs);
    lastTs = ts;
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP_MS && steps < 5) {
      I.poll();
      E.step(state, inputProvider);
      Au.sync(state);
      accumulator -= FIXED_STEP_MS;
      steps++;
    }
    R.render(state);
    if (state.gameOver) {
      running = false;
      Au.resetForNewGame();
      if (onGameOverCb) onGameOverCb(state);
      return;
    }
    requestAnimationFrame(tick);
  }

  function init({ canvas: cv, onGameOver }) {
    canvas = cv;
    onGameOverCb = onGameOver;
    R.init(canvas);
    I.init({
      onConnect: (idx, id) => showToast(`Controller connected: ${shortPadName(id)}`),
      onDisconnect: (idx, id) => showToast(`Controller ${shortPadName(id)} disconnected`),
    });
  }

  function shortPadName(id) {
    if (!id) return 'Gamepad';
    const m = id.match(/([A-Za-z0-9_ -]{3,})/);
    return m ? m[1].trim().slice(0, 28) : 'Gamepad';
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  window.PacmanGame = {
    init,
    startGame,
    stopGame,
    pauseGame,
    resumeGame,
    Modes,
    isRunning: () => running,
    getState: () => state,
    showToast,
  };
})();
