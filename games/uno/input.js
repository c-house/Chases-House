/* ═══════════════════════════════════════════════════════════════
   Uno — input.js
   Keyboard + gamepad routing. Mouse/touch handled directly in DOM
   by game.js (click/tap on cards is event-driven, not polled).
   Exposes window.UnoInput.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let callbacks = {};
  let focusedHandIdx = 0;
  let gamepadPolling = false;
  let connectedPads = 0;
  const SG = window.SharedGamepad;

  function init(cbs) {
    callbacks = cbs || {};
    bindKeyboard();
    if (SG) {
      SG.init({
        onConnect: (idx, id) => {
          connectedPads++;
          maybeStartPoll();
        },
        onDisconnect: () => {
          connectedPads = Math.max(0, connectedPads - 1);
        }
      });
      // If a pad is already connected at boot, kick off poll
      if (SG.listGamepads().length > 0) {
        connectedPads = SG.listGamepads().length;
        maybeStartPoll();
      }
    }
  }

  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Don't intercept while typing in inputs
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Color picker takes priority if open
      const colorOpen = !document.getElementById('overlay-color').classList.contains('hidden');
      if (colorOpen) {
        const map = { '1': 'red', '2': 'yellow', '3': 'blue', '4': 'green',
                      'r': 'red', 'y': 'yellow', 'b': 'blue', 'g': 'green' };
        if (map[e.key.toLowerCase()]) {
          e.preventDefault();
          if (callbacks.onColorPick) callbacks.onColorPick(map[e.key.toLowerCase()]);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          moveFocus(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveFocus(1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (callbacks.onConfirm) callbacks.onConfirm();
          break;
        case 'd':
        case 'D':
          if (callbacks.onDrawClick) callbacks.onDrawClick();
          break;
        case 'u':
        case 'U':
          if (callbacks.onCallUno) callbacks.onCallUno();
          break;
        default:
          // 1-9 jump cursor
          if (/^[1-9]$/.test(e.key)) {
            const idx = parseInt(e.key, 10) - 1;
            setFocus(idx);
          }
      }
    });
  }

  function getHandCards() {
    const hand = document.getElementById('hand');
    if (!hand) return [];
    return Array.prototype.slice.call(hand.querySelectorAll('.card'));
  }

  function setFocus(idx) {
    const cards = getHandCards();
    if (cards.length === 0) return;
    focusedHandIdx = Math.max(0, Math.min(cards.length - 1, idx));
    cards.forEach((c, i) => c.classList.toggle('focused', i === focusedHandIdx));
    if (cards[focusedHandIdx] && cards[focusedHandIdx].focus) cards[focusedHandIdx].focus({ preventScroll: true });
  }
  function moveFocus(delta) {
    const cards = getHandCards();
    if (cards.length === 0) return;
    setFocus((focusedHandIdx + delta + cards.length) % cards.length);
  }

  // ── Gamepad poll ───────────────────────────────────────
  function maybeStartPoll() {
    if (gamepadPolling || !SG) return;
    gamepadPolling = true;
    pollLoop();
  }

  function pollLoop() {
    if (!gamepadPolling || !SG) return;
    const pads = SG.listGamepads();
    pads.forEach((pad) => {
      const idx = pad.index;
      // D-pad cursor
      const dir = SG.getDirection(idx);
      if (dir === 'left' && !padDirHeld[idx]) { moveFocus(-1); padDirHeld[idx] = dir; }
      else if (dir === 'right' && !padDirHeld[idx]) { moveFocus(1); padDirHeld[idx] = dir; }
      else if (!dir) { padDirHeld[idx] = null; }

      // Buttons
      if (SG.consumeButtonPress(idx, SG.BUTTONS.A)) {
        if (callbacks.onConfirm) callbacks.onConfirm();
      }
      if (SG.consumeButtonPress(idx, SG.BUTTONS.B)) {
        if (callbacks.onDrawClick) callbacks.onDrawClick();
      }
      if (SG.consumeButtonPress(idx, SG.BUTTONS.X)) {
        if (callbacks.onCallUno) callbacks.onCallUno();
      }
      if (SG.consumeButtonPress(idx, SG.BUTTONS.Y)) {
        if (callbacks.onMenu) callbacks.onMenu();
      }
    });
    if (pads.length === 0) {
      gamepadPolling = false;
      return;
    }
    requestAnimationFrame(pollLoop);
  }
  const padDirHeld = {};

  function teardown() {
    gamepadPolling = false;
    if (SG) SG.teardown();
  }

  window.UnoInput = {
    init: init,
    teardown: teardown,
    setFocus: setFocus
  };
})();
