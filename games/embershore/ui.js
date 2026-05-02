/* ═══════════════════════════════════════════════════════════════
   Embershore — ui.js
   DOM overlay flow + boot. Self-executing on parse.
   PR1: title overlay hides on first input; game starts.
   Later steps add name-entry, pause, map, dialogue, gameover, ending.
   See docs/design/019-embershore-architecture.md §13, ADR-019 §UI.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const G = window.EmbershoreGame;

  const overlayTitle = document.getElementById('overlay-title');
  const gameFrame = document.getElementById('game-frame');

  // Boot: init game, set up first-input handler
  G.init({
    canvas: document.getElementById('embershore-canvas'),
  });

  // First input → hide title, start the game
  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    if (overlayTitle) overlayTitle.classList.add('hidden');
    G.startNew('cinder');  // PR1 default name; PR2 adds the name-entry modal
  }

  function isInputEvent(e) {
    if (e.type === 'click') return true;
    if (e.type === 'keydown') {
      // Ignore modifier-only / OS shortcuts
      if (e.metaKey || e.ctrlKey || e.altKey) return false;
      if (e.code === 'Tab' || e.code === 'F5' || e.code === 'F12') return false;
      return true;
    }
    if (e.type === 'pointerdown') return true;
    return false;
  }

  window.addEventListener('keydown', function (e) {
    if (!booted && isInputEvent(e)) {
      e.preventDefault();
      boot();
    }
  }, { capture: true });

  window.addEventListener('pointerdown', function (e) {
    if (!booted && isInputEvent(e)) boot();
  });

  // ── Idle leaf flourish — fires after 6s no-input on any screen ─
  let idleTimer = null;
  const IDLE_MS = 6000;
  function dropLeaf() {
    if (!gameFrame) return;
    const leaf = document.createElement('div');
    leaf.className = 'idle-leaf fly';
    leaf.innerHTML = `
      <svg viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
        <use href="#leaf-glyph"/>
      </svg>`;
    leaf.style.top = (10 + Math.random() * 30) + '%';
    leaf.style.left = '-30px';
    gameFrame.appendChild(leaf);
    setTimeout(() => leaf.remove(), 4900);
  }
  function resetIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(dropLeaf, IDLE_MS);
  }
  ['mousemove', 'keydown', 'click', 'pointerdown'].forEach(evt => {
    window.addEventListener(evt, resetIdle, { passive: true });
  });
  resetIdle();
})();
