/* ═══════════════════════════════════════════════════════════════
   Embershore — game.js
   Module wiring + rAF loop. Mirrors games/pacman/game.js exactly:
   fixed-step accumulator, max 5 catch-up steps, render once per rAF.
   See docs/design/019-embershore-architecture.md §5.
   Exposes window.EmbershoreGame.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const E = window.EmbershoreEngine;
  const Render = window.EmbershoreRender;
  const Input = window.EmbershoreInput;
  const Audio = window.EmbershoreAudio;

  let canvas = null;
  let state = null;
  let running = false;
  let lastTs = 0;
  let accumulator = 0;
  const FIXED_STEP_MS = 1000 / 60;

  function init(opts) {
    canvas = (opts && opts.canvas) || document.getElementById('embershore-canvas');
    Render.init(canvas);
    Input.init({ onAnyInput: opts && opts.onAnyInput });
    attachDebugScrubber();
  }

  function startNew(name) {
    state = E.createState({ name: name || 'cinder' });
    state.prefs = E.loadPrefs();
    Audio.ensure();
    running = true;
    lastTs = performance.now();
    accumulator = 0;
    requestAnimationFrame(tick);
  }

  function startContinue() {
    const data = E.load();
    if (!data) {
      startNew('cinder');
      return;
    }
    state = E.createState(data);
    state.prefs = E.loadPrefs();
    Audio.ensure();
    running = true;
    lastTs = performance.now();
    accumulator = 0;
    requestAnimationFrame(tick);
  }

  function pause() { running = false; }
  function resume() {
    if (state && !running) {
      running = true;
      lastTs = performance.now();
      accumulator = 0;
      requestAnimationFrame(tick);
    }
  }

  function tick(ts) {
    if (!running) return;
    const dt = Math.min(250, ts - lastTs);
    lastTs = ts;
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP_MS && steps < 5) {
      const input = Input.poll(state);
      E.step(state, input);
      Audio.sync(state);
      accumulator -= FIXED_STEP_MS;
      steps++;
    }
    const alpha = accumulator / FIXED_STEP_MS;
    Render.render(state, alpha);
    requestAnimationFrame(tick);
  }

  // ── Debug scrubber: [, ], \ tune room-scroll feel ───────────
  function attachDebugScrubber() {
    window.addEventListener('keydown', function (e) {
      if (!state) return;
      if (e.code === 'BracketLeft') {
        E.setScrollFrames(E.getScrollFrames() - 1);
        showDebugToast('SCROLL ' + E.getScrollFrames() + 'f (' + Math.round(E.getScrollFrames() * 1000/60) + 'ms)');
      } else if (e.code === 'BracketRight') {
        E.setScrollFrames(E.getScrollFrames() + 1);
        showDebugToast('SCROLL ' + E.getScrollFrames() + 'f (' + Math.round(E.getScrollFrames() * 1000/60) + 'ms)');
      } else if (e.code === 'Backslash') {
        const name = E.cycleEasing();
        showDebugToast('EASING ' + name);
      }
    });
  }

  let toastEl = null;
  let toastTimer = null;
  function showDebugToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = `
        position: absolute; bottom: 1rem; left: 50%;
        transform: translateX(-50%);
        font-family: 'Press Start 2P', monospace;
        font-size: 0.55rem;
        letter-spacing: 0.18em;
        color: #faf3e6;
        background: rgba(20,20,22,0.85);
        border: 1px solid #a06828;
        padding: 0.5rem 0.9rem;
        border-radius: 3px;
        z-index: 50;
        pointer-events: none;
        opacity: 0;
        transition: opacity 200ms ease;
      `;
      const frame = document.getElementById('game-frame');
      if (frame) frame.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 1400);
  }

  function isRunning() { return running; }
  function getState() { return state; }

  window.EmbershoreGame = {
    init: init,
    startNew: startNew,
    startContinue: startContinue,
    pause: pause,
    resume: resume,
    isRunning: isRunning,
    getState: getState,
  };
})();
