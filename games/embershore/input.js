/* ═══════════════════════════════════════════════════════════════
   Embershore — input.js
   Keyboard + gamepad polling. Single-player simplification of Pac-Man.
   See docs/design/019-embershore-architecture.md §12.
   Exposes window.EmbershoreInput.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SG = window.SharedGamepad;

  // Key sets per action
  const KEYS = {
    up:    new Set(['ArrowUp', 'KeyW']),
    down:  new Set(['ArrowDown', 'KeyS']),
    left:  new Set(['ArrowLeft', 'KeyA']),
    right: new Set(['ArrowRight', 'KeyD']),
    A:     new Set(['Space', 'KeyJ']),
    B:     new Set(['ShiftLeft', 'KeyK']),
    E:     new Set(['KeyE', 'KeyZ', 'Enter']),
    PAUSE: new Set(['Tab', 'Escape']),
    INV:   new Set(['KeyI']),
  };

  // State
  const pressed = new Set();        // currently held codes
  const pressOrder = [];            // for "most recent direction wins"
  const buttonEdge = {              // rising-edge consumption
    A: false, B: false, E: false, PAUSE: false, INV: false,
  };
  const buttonHandled = {           // tracks if rising edge already consumed
    A: false, B: false, E: false, PAUSE: false, INV: false,
  };

  let onAnyInputCallback = null;
  let attached = false;
  let gamepadIdx = null;

  function init(opts) {
    onAnyInputCallback = (opts && opts.onAnyInput) || null;
    if (attached) return;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    if (SG) {
      SG.init({
        onConnect: function (idx, id) {
          if (gamepadIdx == null) gamepadIdx = idx;
        },
        onDisconnect: function (idx) {
          if (gamepadIdx === idx) gamepadIdx = null;
        },
      });
    }
    attached = true;
  }

  function teardown() {
    if (!attached) return;
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('blur', handleBlur);
    if (SG) SG.teardown();
    attached = false;
  }

  function handleKeyDown(e) {
    // Avoid stealing focus from URL bar / dev tools
    if (isOurKey(e.code) === false) return;
    e.preventDefault();
    if (!pressed.has(e.code)) {
      pressed.add(e.code);
      pressOrder.push(e.code);
      // Edge for buttons
      if (KEYS.A.has(e.code)     && !buttonHandled.A)     buttonEdge.A = true;
      if (KEYS.B.has(e.code)     && !buttonHandled.B)     buttonEdge.B = true;
      if (KEYS.E.has(e.code)     && !buttonHandled.E)     buttonEdge.E = true;
      if (KEYS.PAUSE.has(e.code) && !buttonHandled.PAUSE) buttonEdge.PAUSE = true;
      if (KEYS.INV.has(e.code)   && !buttonHandled.INV)   buttonEdge.INV = true;
    }
    if (onAnyInputCallback) onAnyInputCallback({ kind: 'keyboard', code: e.code });
  }
  function handleKeyUp(e) {
    pressed.delete(e.code);
    const idx = pressOrder.indexOf(e.code);
    if (idx >= 0) pressOrder.splice(idx, 1);
    // Reset edge-handled state on release so next press re-fires
    if (KEYS.A.has(e.code))     buttonHandled.A = false;
    if (KEYS.B.has(e.code))     buttonHandled.B = false;
    if (KEYS.E.has(e.code))     buttonHandled.E = false;
    if (KEYS.PAUSE.has(e.code)) buttonHandled.PAUSE = false;
    if (KEYS.INV.has(e.code))   buttonHandled.INV = false;
  }
  function handleBlur() {
    pressed.clear();
    pressOrder.length = 0;
    Object.keys(buttonEdge).forEach(k => { buttonEdge[k] = false; buttonHandled[k] = false; });
  }
  function isOurKey(code) {
    if (KEYS.up.has(code) || KEYS.down.has(code) || KEYS.left.has(code) || KEYS.right.has(code)) return true;
    if (KEYS.A.has(code) || KEYS.B.has(code) || KEYS.E.has(code)) return true;
    if (KEYS.PAUSE.has(code) || KEYS.INV.has(code)) return true;
    // Debug scrubber keys (handled in game.js but still consume)
    if (code === 'BracketLeft' || code === 'BracketRight' || code === 'Backslash') return true;
    return false;
  }

  // Most recently pressed direction wins (LA-style)
  function getDirection() {
    // First check keyboard (in reverse pressOrder for "latest intent")
    for (let i = pressOrder.length - 1; i >= 0; i--) {
      const c = pressOrder[i];
      if (KEYS.up.has(c))    return 'up';
      if (KEYS.down.has(c))  return 'down';
      if (KEYS.left.has(c))  return 'left';
      if (KEYS.right.has(c)) return 'right';
    }
    // Fall back to gamepad
    if (gamepadIdx != null && SG) {
      return SG.getDirection(gamepadIdx);
    }
    return null;
  }

  function consumeButton(name) {
    if (buttonEdge[name]) {
      buttonEdge[name] = false;
      buttonHandled[name] = true;
      return true;
    }
    // Gamepad rising edge
    if (gamepadIdx != null && SG) {
      const map = { A: SG.BUTTONS.A, B: SG.BUTTONS.B, E: SG.BUTTONS.Y, PAUSE: SG.BUTTONS.START, INV: SG.BUTTONS.BACK };
      if (map[name] != null && SG.consumeButtonPress(gamepadIdx, map[name])) {
        return true;
      }
    }
    return false;
  }

  function isAnyPressed() {
    if (pressOrder.length > 0) return true;
    if (gamepadIdx != null && SG) {
      const pads = SG.listGamepads();
      return pads.some(p => p.index === gamepadIdx);  // any pad presence triggers fallback
    }
    return false;
  }

  // poll(state) — called once per engine tick from game.js
  function poll(state) {
    return {
      dir: getDirection(),
      btnA: consumeButton('A'),
      btnB: consumeButton('B'),
      btnE: consumeButton('E'),
      btnPause: consumeButton('PAUSE'),
      btnInv: consumeButton('INV'),
    };
  }

  window.EmbershoreInput = {
    init: init,
    teardown: teardown,
    poll: poll,
    getDirection: getDirection,
    consumeButton: consumeButton,
    isAnyPressed: isAnyPressed,
  };
})();
