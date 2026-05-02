/* ═══════════════════════════════════════════════════════════════════════
   Underhearth — input.js
   Keyboard (DAS 180 / ARR 90 held-set joystick), mouse, touch, gamepad.
   Translates raw events into intent objects and forwards them to game.js
   via the onIntent callback registered in init().

   Movement model (per ADR-017 §3):
     - Held-set summing for arrow / WASD / hjkl cardinals → diagonal walks.
     - Single deliberate press = single step. Held = walk-repeat.
     - Vi-keys yubn and numpad 7913 are instant-step single diagonals
       (they have native diagonal semantics; no joystick summing).
     - Walk-repeat halts on any non-movement keypress, on game.haltWalk()
       called from game.js after FOV / HP / item interrupts.

   Exposes window.UnderhearthInput.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SG = window.SharedGamepad || null;

  const DAS = 180;
  const ARR = 90;

  // Map of key code → cardinal direction name
  const MOVE = {
    // arrows
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    // WASD
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    // hjkl (vi-keys cardinals)
    KeyH: 'left', KeyJ: 'down', KeyK: 'up', KeyL: 'right',
    // numpad cardinals
    Numpad8: 'up', Numpad2: 'down', Numpad4: 'left', Numpad6: 'right',
  };

  // Native single-key diagonals (never joystick-summed)
  const DIAG = {
    KeyY: { dx: -1, dy: -1 }, // NW
    KeyU: { dx:  1, dy: -1 }, // NE
    KeyB: { dx: -1, dy:  1 }, // SW
    KeyN: { dx:  1, dy:  1 }, // SE
    Numpad7: { dx: -1, dy: -1 },
    Numpad9: { dx:  1, dy: -1 },
    Numpad1: { dx: -1, dy:  1 },
    Numpad3: { dx:  1, dy:  1 },
  };

  // Single-press actions (no held semantics)
  const ACTIONS = {
    Period:    () => ({ kind: 'wait' }),
    Numpad5:   () => ({ kind: 'wait' }),
    KeyG:      () => ({ kind: 'pickup' }),
    Comma:     () => ({ kind: 'pickup' }),
    KeyI:      () => ({ kind: 'open-inventory' }),
    Slash:     () => ({ kind: 'open-help' }),
    Escape:    () => ({ kind: 'close-overlay' }),
  };
  // > and < are produced by Shift+Period and Shift+Comma; handled in keydown via e.key.

  let onIntent = null;
  let heldMoves = new Set();
  let walkTimer = null;     // setTimeout/setInterval handle
  let walkPhase = 'idle';   // 'idle' | 'das' | 'arr'
  let gamepadRaf = null;
  let lastGamepadDir = null;

  // ── Public API ─────────────────────────────────────────────────────────

  function init(opts) {
    onIntent = (opts && opts.onIntent) || function () {};
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup',   onKeyUp);
    window.addEventListener('blur', haltWalk);
    bindGridClicks();
    if (SG) {
      SG.init({
        onConnect:    () => {},
        onDisconnect: () => {},
      });
      gamepadRaf = requestAnimationFrame(pollGamepads);
    }
  }

  function teardown() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup',   onKeyUp);
    window.removeEventListener('blur', haltWalk);
    haltWalk();
    if (gamepadRaf) cancelAnimationFrame(gamepadRaf);
    gamepadRaf = null;
  }

  function haltWalk() {
    if (walkTimer != null) {
      clearTimeout(walkTimer);
      clearInterval(walkTimer);
      walkTimer = null;
    }
    walkPhase = 'idle';
  }

  // ── Keyboard ───────────────────────────────────────────────────────────

  function shouldIgnore(e) {
    const tag = e.target && e.target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function onKeyDown(e) {
    if (shouldIgnore(e)) return;
    if (e.repeat) return; // we drive our own repeat

    // Stairs (Shift+Period, Shift+Comma)
    if (e.key === '>') { e.preventDefault(); haltWalk(); emit({ kind: 'descend' }); return; }
    if (e.key === '<') { e.preventDefault(); haltWalk(); emit({ kind: 'ascend' }); return; }

    if (DIAG[e.code]) {
      e.preventDefault();
      haltWalk();
      const d = DIAG[e.code];
      emit({ kind: 'move', dx: d.dx, dy: d.dy });
      return;
    }

    if (MOVE[e.code]) {
      e.preventDefault();
      const dir = MOVE[e.code];
      if (heldMoves.has(dir)) return; // already held; OS auto-repeat suppression
      heldMoves.add(dir);
      const v = vector();
      if (v.dx === 0 && v.dy === 0) { haltWalk(); return; }
      if (walkTimer != null) {
        // Already walking. Direction will pick up new vector on next ARR tick.
        // Fire one step immediately for snappy direction-change response.
        emit({ kind: 'move', dx: v.dx, dy: v.dy });
      } else {
        startWalk();
      }
      return;
    }

    if (ACTIONS[e.code]) {
      e.preventDefault();
      haltWalk();
      emit(ACTIONS[e.code]());
      return;
    }
  }

  function onKeyUp(e) {
    if (shouldIgnore(e)) return;
    if (MOVE[e.code]) {
      heldMoves.delete(MOVE[e.code]);
      const v = vector();
      if (v.dx === 0 && v.dy === 0) haltWalk();
    }
  }

  function vector() {
    let dx = 0, dy = 0;
    if (heldMoves.has('up'))    dy -= 1;
    if (heldMoves.has('down'))  dy += 1;
    if (heldMoves.has('left'))  dx -= 1;
    if (heldMoves.has('right')) dx += 1;
    return { dx, dy };
  }

  function startWalk() {
    haltWalk();
    // Immediate single step
    const v = vector();
    if (v.dx === 0 && v.dy === 0) return;
    emit({ kind: 'move', dx: v.dx, dy: v.dy });
    walkPhase = 'das';
    walkTimer = setTimeout(function arrFire() {
      // Guard: haltWalk() may have run between scheduling and firing.
      if (walkPhase !== 'das') return;
      const v2 = vector();
      if (v2.dx === 0 && v2.dy === 0) { haltWalk(); return; }
      emit({ kind: 'move', dx: v2.dx, dy: v2.dy });
      walkPhase = 'arr';
      walkTimer = setInterval(function arr() {
        if (walkPhase !== 'arr') { haltWalk(); return; }
        const v3 = vector();
        if (v3.dx === 0 && v3.dy === 0) { haltWalk(); return; }
        emit({ kind: 'move', dx: v3.dx, dy: v3.dy });
      }, ARR);
    }, DAS);
  }

  // ── Mouse / touch click on grid ────────────────────────────────────────

  function bindGridClicks() {
    const grid = document.getElementById('mock-grid');
    if (!grid) return;
    grid.addEventListener('click', onGridClick);
  }

  function onGridClick(e) {
    const span = e.target.closest('span');
    if (!span) return;
    const grid = document.getElementById('mock-grid');
    if (!grid) return;
    const idx = Array.prototype.indexOf.call(grid.children, span);
    if (idx < 0) return;
    const cols = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--uh-grid-cols'), 10) || 60;
    const x = idx % cols, y = Math.floor(idx / cols);
    haltWalk();
    emit({ kind: 'click-tile', x, y });
  }

  // ── Gamepad ────────────────────────────────────────────────────────────

  function pollGamepads() {
    gamepadRaf = requestAnimationFrame(pollGamepads);
    if (!SG) return;
    const pads = SG.listGamepads();
    for (const pad of pads) {
      const idx = pad.index;
      if (SG.consumeButtonPress(idx, SG.BUTTONS.A))     emit({ kind: 'pickup' });
      if (SG.consumeButtonPress(idx, SG.BUTTONS.B))     emit({ kind: 'close-overlay' });
      if (SG.consumeButtonPress(idx, SG.BUTTONS.Y))     emit({ kind: 'wait' });
      if (SG.consumeButtonPress(idx, SG.BUTTONS.LB))    emit({ kind: 'open-inventory' });
      if (SG.consumeButtonPress(idx, SG.BUTTONS.RT))    emit({ kind: 'descend' });
      if (SG.consumeButtonPress(idx, SG.BUTTONS.LT))    emit({ kind: 'ascend' });
      if (SG.consumeButtonPress(idx, SG.BUTTONS.START)) emit({ kind: 'open-settings' });
      if (SG.consumeButtonPress(idx, SG.BUTTONS.BACK))  emit({ kind: 'open-memorial' });

      // D-pad / stick → cardinal step on edge (Phase-1 simplification;
      // full DAS/ARR for gamepad direction lands in Phase 4).
      const dir = SG.getDirection(idx);
      if (dir !== lastGamepadDir) {
        lastGamepadDir = dir;
        if (dir) {
          const v = ({ up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } })[dir];
          if (v) emit({ kind: 'move', dx: v.dx, dy: v.dy });
        }
      }
    }
  }

  function emit(intent) {
    if (onIntent) onIntent(intent);
  }

  window.UnderhearthInput = { init, teardown, haltWalk };
})();
