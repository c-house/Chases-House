/* ═══════════════════════════════════════════════════════════════
   Hearthguard — input.js
   Effectful. Click, keyboard, gamepad → callback fires.
   Single-player, no slot-binding. Game.js polls tick() per RAF;
   SharedGamepad handles edge detection.
   Exposes window.HearthguardInput.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SG = window.SharedGamepad;
  const S = window.HearthguardState;

  let cb = {};
  let active = false;
  let cursorTile = 'D5';
  let focusables = null;
  let connectedPad = null;
  let dpadDownStart = 0;

  function init(callbacks) {
    cb = callbacks || {};
    if (active) return;
    active = true;
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onClick, true);
    SG.init({
      onConnect: idx => { connectedPad = idx; },
      onDisconnect: () => { connectedPad = null; },
    });
    const pads = SG.listGamepads();
    if (pads.length > 0) connectedPad = pads[0].index;
  }

  function teardown() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('click', onClick, true);
    if (SG.teardown) SG.teardown();
    active = false;
    cb = {};
  }

  function onClick(e) {
    const tileEl = e.target.closest('.hg-tile');
    const heroCard = e.target.closest('.hg-hero-card');
    const actionBtn = e.target.closest('[data-action]');

    if (heroCard) {
      const id = heroCard.dataset.unit;
      if (id) fire('onSelectUnit', id);
      return;
    }
    if (tileEl) {
      const tile = tileEl.dataset.tile;
      if (tile) {
        cursorTile = tile;
        fire('onTileClick', tile);
      }
      return;
    }
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      if (action) fire('onButtonAction', action);
    }
  }

  function onKeyDown(e) {
    if (e.repeat) return;
    const code = e.code;
    switch (code) {
      case 'ArrowUp':    moveCursor('N'); e.preventDefault(); return;
      case 'ArrowDown':  moveCursor('S'); e.preventDefault(); return;
      case 'ArrowLeft':  moveCursor('W'); e.preventDefault(); return;
      case 'ArrowRight': moveCursor('E'); e.preventDefault(); return;
      case 'KeyW':       moveCursor('N'); return;
      case 'KeyS':       moveCursor('S'); return;
      case 'KeyA':       moveCursor('W'); return;
      case 'KeyD':       moveCursor('E'); return;
      case 'Space':
      case 'Enter':      fire('onTileClick', cursorTile); e.preventDefault(); return;
      case 'KeyZ':       fire('onUndo'); return;
      case 'Escape':     fire('onCancel'); return;
      case 'KeyP':       fire('onPause'); return;
      case 'Digit1':     fire('onSelectHeroBySlot', 0); return;
      case 'Digit2':     fire('onSelectHeroBySlot', 1); return;
      case 'Digit3':     fire('onSelectHeroBySlot', 2); return;
      case 'Tab':        fire('onCycleHero', e.shiftKey ? -1 : 1); e.preventDefault(); return;
      case 'KeyC':       fire('onConfirm'); return;
    }
  }

  function moveCursor(dir) {
    const next = S.shiftTile(cursorTile, dir);
    if (!next) return;
    cursorTile = next;
    fire('onCursorMove', cursorTile);
    const el = document.querySelector(`.hg-tile[data-tile="${cursorTile}"]`);
    if (el) el.focus();
  }

  function tick() {
    if (connectedPad === null) return;

    if (SG.consumeButtonPress(connectedPad, SG.BUTTONS.A)) fire('onTileClick', cursorTile);
    if (SG.consumeButtonPress(connectedPad, SG.BUTTONS.B)) fire('onCancel');
    if (SG.consumeButtonPress(connectedPad, SG.BUTTONS.START)) fire('onPause');

    const dir = SG.getDirection(connectedPad);
    if (dir) {
      const map = { up: 'N', down: 'S', left: 'W', right: 'E' };
      moveCursor(map[dir]);
    }

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[connectedPad];
    if (pad) {
      const downHeld = pad.buttons[SG.BUTTONS.DPAD_DOWN] && pad.buttons[SG.BUTTONS.DPAD_DOWN].pressed;
      if (downHeld) {
        if (dpadDownStart === 0) dpadDownStart = performance.now();
        else if (performance.now() - dpadDownStart >= 600) {
          dpadDownStart = 0;
          fire('onConfirm');
        }
      } else {
        dpadDownStart = 0;
      }
    }
  }

  function setSelectedUnit() { /* reserved for kb-only flow */ }
  function setFocusableTiles(tileList) { focusables = tileList ? new Set(tileList) : null; }
  function setCursor(tile) { if (S.tileInBounds(tile)) cursorTile = tile; }

  function fire(name, arg) {
    const fn = cb[name];
    if (typeof fn === 'function') fn(arg);
  }

  window.HearthguardInput = {
    init, teardown, tick,
    setSelectedUnit, setFocusableTiles, setCursor,
  };
})();
