/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense — input.js
   Owns keyboard listeners + gamepad cursor polling.
   Pointer events are handled in game.js via document delegation
   (since they target specific DOM elements with data-action attrs).
   Exposes window.CTDInput.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SG = () => window.SharedGamepad;

  let getStateFn = null;
  let actions = null;     // bag of callbacks set up by game.js
  let initialized = false;

  // Gamepad
  let activePadIndex = null;
  let dpadCooldownMs = 0;

  // Keyboard map: key.toLowerCase() → action
  const KEY_TO_TOWER = { '1': 'archer', '2': 'cannon', '3': 'mage', '4': 'frost' };

  function init(opts) {
    if (initialized) return;
    getStateFn = opts.getState;
    actions = opts.actions;
    document.addEventListener('keydown', onKey);
    SG().init({
      onConnect: (idx) => { if (activePadIndex == null) activePadIndex = idx; },
      onDisconnect: (idx) => { if (activePadIndex === idx) activePadIndex = null; }
    });
    // pick first already-connected pad (if any)
    const pads = SG().listGamepads();
    if (pads.length) activePadIndex = pads[0].index;
    initialized = true;
  }

  function onKey(ev) {
    const state = getStateFn && getStateFn();
    if (!state) return;
    const screen = document.body.getAttribute('data-screen');
    const k = ev.key.toLowerCase();

    if (k === 'escape') {
      ev.preventDefault();
      if (screen === 'play')  actions.pause();
      else if (screen === 'pause') actions.resume();
      else if (screen === 'map-select') actions.go('title');
      return;
    }

    // play-screen-only keys
    if (screen === 'play') {
      if (KEY_TO_TOWER[k]) {
        ev.preventDefault();
        actions.selectTower(KEY_TO_TOWER[k]);
        return;
      }
      if (k === 'u') { ev.preventDefault(); actions.upgrade(); return; }
      if (k === 's') { ev.preventDefault(); actions.sell();    return; }
      if (k === 'n') { ev.preventDefault(); actions.sendNextWave(); return; }
      if (k === 'f') { ev.preventDefault(); actions.toggleFastForward(); return; }
      if (k === ' ') { ev.preventDefault(); actions.pause(); return; }
    } else if (screen === 'pause') {
      if (k === ' ') { ev.preventDefault(); actions.resume(); return; }
    }
  }

  // ─── Gamepad polling (call each tick from game.js) ───────────
  function pollGamepad(state, dtMs) {
    if (activePadIndex == null) return;
    const sg = SG();
    const B = sg.BUTTONS;
    const screen = document.body.getAttribute('data-screen');

    // Edge-triggered button presses
    if (sg.consumeButtonPress(activePadIndex, B.START)) {
      if (screen === 'play')       actions.pause();
      else if (screen === 'pause') actions.resume();
    }
    if (sg.consumeButtonPress(activePadIndex, B.A)) {
      if (screen === 'play') actions.gamepadConfirm();
    }
    if (sg.consumeButtonPress(activePadIndex, B.B)) {
      if (screen === 'play') actions.gamepadCancel();
    }
    if (sg.consumeButtonPress(activePadIndex, B.X)) {
      if (screen === 'play') actions.upgrade();
    }
    if (sg.consumeButtonPress(activePadIndex, B.Y)) {
      if (screen === 'play') actions.sell();
    }
    if (sg.consumeButtonPress(activePadIndex, B.LB)) {
      if (screen === 'play') actions.cyclePalette(-1);
    }
    if (sg.consumeButtonPress(activePadIndex, B.RB)) {
      if (screen === 'play') actions.cyclePalette(1);
    }
    if (sg.consumeButtonPress(activePadIndex, B.RT)) {
      if (screen === 'play') actions.toggleFastForward();
    }
    if (sg.consumeButtonPress(activePadIndex, B.LT)) {
      if (screen === 'play') actions.sendNextWave();
    }

    // D-pad / stick — move cursor (snap-to-nearest-slot)
    if (screen !== 'play') return;
    if (dpadCooldownMs > 0) { dpadCooldownMs -= dtMs; return; }
    const dir = sg.getDirection(activePadIndex);
    if (dir) {
      moveCursor(state, dir);
      dpadCooldownMs = 180;
    }
  }

  function moveCursor(state, dir) {
    const map = state.mapDef;
    if (!map) return;
    const cx = state.cursor.x, cy = state.cursor.y;
    const candidates = map.buildSlots.filter(s => {
      const dx = s.x - cx, dy = s.y - cy;
      switch (dir) {
        case 'up':    return dy < -10 && Math.abs(dx) < Math.abs(dy);
        case 'down':  return dy > 10  && Math.abs(dx) < Math.abs(dy);
        case 'left':  return dx < -10 && Math.abs(dy) < Math.abs(dx);
        case 'right': return dx > 10  && Math.abs(dy) < Math.abs(dx);
      }
      return false;
    });
    if (!candidates.length) return;
    candidates.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    const target = candidates[0];
    state.cursor.x = target.x;
    state.cursor.y = target.y;
    state.hoverSlotId = target.id;
  }

  function rumble(opts) {
    if (activePadIndex == null) return;
    SG().rumble(activePadIndex, opts);
  }

  function getActivePadIndex() { return activePadIndex; }

  window.CTDInput = { init, pollGamepad, rumble, getActivePadIndex };
})();
