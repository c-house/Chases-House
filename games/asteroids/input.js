/* ═══════════════════════════════════════════════════════════════
   Asteroids — input.js
   Keyboard + SharedGamepad. Single source of truth on whether fire /
   hyperspace can fire — owns the cooldown timers (per review fix #2).
   getIntent(slot) returns { rotate: -1|0|1, thrust: bool }.
   consumeFire(slot) / consumeHyperspace(slot) return true ONLY when
   (edge detected) AND (cooldown elapsed) — game.js never sees a
   consumed press it cannot satisfy.
   Exposes window.AsteroidsInput.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SG = window.SharedGamepad;

  // ── keyboard scheme tables ────────────────────────────────
  const SCHEMES = {
    arrows: { left: 'ArrowLeft', right: 'ArrowRight', thrust: 'ArrowUp',
              fire: 'Space', hyper: 'ShiftLeft', hyperAlt: 'ShiftRight' },
    wasd:   { left: 'KeyA', right: 'KeyD', thrust: 'KeyW',
              fire: 'KeyF', hyper: 'KeyG' }
  };
  const SCHEME_LIST = ['arrows', 'wasd'];

  // ── module state ──────────────────────────────────────────
  const pressedKeys = new Set();
  // slot (1|2) -> { kind: 'keyboard'|'gamepad', scheme?, gamepadIndex? }
  const slots = {};
  // slot -> { fire: number, hyper: number } — internal cooldown timers (s)
  const cooldowns = {};
  let listenersAttached = false;
  let onKeyCb = null;

  // ── keyboard listeners ────────────────────────────────────
  function handleKeyDown(e) {
    if (pressedKeys.has(e.code)) {
      // already held; still let onKey see it for repeat-safe meta keys
      if (onKeyCb) onKeyCb(e);
      return;
    }
    pressedKeys.add(e.code);
    // prevent default scroll for game keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) {
      e.preventDefault();
    }
    if (onKeyCb) onKeyCb(e);
  }

  function handleKeyUp(e) {
    pressedKeys.delete(e.code);
  }

  function init(opts) {
    onKeyCb = (opts && opts.onKey) || null;
    if (listenersAttached) return;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    SG.init({});
    listenersAttached = true;
  }

  function teardown() {
    if (!listenersAttached) return;
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    SG.teardown();
    listenersAttached = false;
    pressedKeys.clear();
    Object.keys(slots).forEach(k => delete slots[k]);
    Object.keys(cooldowns).forEach(k => delete cooldowns[k]);
    onKeyCb = null;
  }

  // ── slot binding ──────────────────────────────────────────
  // source shape: { kind: 'keyboard', scheme: 'arrows'|'wasd' }
  //               or { kind: 'gamepad', gamepadIndex: number }
  function claimInput(slot, source) {
    slots[slot] = source;
    cooldowns[slot] = { fire: 0, hyper: 0 };
  }

  function releaseSlot(slot) {
    delete slots[slot];
    delete cooldowns[slot];
  }

  function releaseAll() {
    Object.keys(slots).forEach(k => delete slots[k]);
    Object.keys(cooldowns).forEach(k => delete cooldowns[k]);
  }

  function getSlotSource(slot) { return slots[slot] || null; }

  function getBindings() { return Object.assign({}, slots); }

  // Walk the cooldown timers each tick. Game.js calls this once per logical step.
  function tickCooldowns(dt) {
    for (const k in cooldowns) {
      const c = cooldowns[k];
      if (c.fire > 0)  c.fire  -= dt;
      if (c.hyper > 0) c.hyper -= dt;
    }
  }

  // ── intent + actions ──────────────────────────────────────
  function getIntent(slot) {
    const src = slots[slot];
    if (!src) return { rotate: 0, thrust: false };
    if (src.kind === 'keyboard') {
      const m = SCHEMES[src.scheme];
      let rotate = 0;
      if (pressedKeys.has(m.left))  rotate -= 1;
      if (pressedKeys.has(m.right)) rotate += 1;
      const thrust = pressedKeys.has(m.thrust);
      return { rotate: rotate, thrust: thrust };
    }
    if (src.kind === 'gamepad') {
      const dir = SG.getDirection(src.gamepadIndex);
      let rotate = 0;
      if (dir === 'left')  rotate = -1;
      if (dir === 'right') rotate =  1;
      const thrust = (dir === 'up');
      return { rotate: rotate, thrust: thrust };
    }
    return { rotate: 0, thrust: false };
  }

  // Single source of truth on "can fire right now". Returns true exactly
  // once per press AND only when cooldown has elapsed. If returning true,
  // the cooldown is reset — caller must use the result (i.e., create a bullet).
  function consumeFire(slot) {
    const src = slots[slot];
    const c = cooldowns[slot];
    if (!src || !c) return false;
    let edge = false;
    if (src.kind === 'keyboard') {
      const fireCode = SCHEMES[src.scheme].fire;
      const held = pressedKeys.has(fireCode);
      edge = held && !slotKbEdge(slot, 'fire');
      setSlotKbEdge(slot, 'fire', held);
    } else if (src.kind === 'gamepad') {
      edge = SG.consumeButtonPress(src.gamepadIndex, SG.BUTTONS.A);
    }
    if (!edge || c.fire > 0) return false;
    c.fire = window.AsteroidsGame.CONSTANTS.BULLET_COOLDOWN_S;
    return true;
  }

  function consumeHyperspace(slot) {
    const src = slots[slot];
    const c = cooldowns[slot];
    if (!src || !c) return false;
    let edge = false;
    if (src.kind === 'keyboard') {
      const m = SCHEMES[src.scheme];
      const codes = [m.hyper];
      if (m.hyperAlt) codes.push(m.hyperAlt);
      const held = codes.some(code => pressedKeys.has(code));
      edge = held && !slotKbEdge(slot, 'hyper');
      setSlotKbEdge(slot, 'hyper', held);
    } else if (src.kind === 'gamepad') {
      edge = SG.consumeButtonPress(src.gamepadIndex, SG.BUTTONS.DPAD_DOWN);
    }
    if (!edge || c.hyper > 0) return false;
    c.hyper = window.AsteroidsGame.CONSTANTS.HYPERSPACE_COOLDOWN_S;
    return true;
  }

  // Per-slot keyboard edge tracking for fire/hyperspace
  // (gamepad uses SharedGamepad's internal edge state, so we only track keyboard).
  const kbEdges = {};
  function slotKbEdge(slot, name) {
    return (kbEdges[slot] && kbEdges[slot][name]) || false;
  }
  function setSlotKbEdge(slot, name, val) {
    if (!kbEdges[slot]) kbEdges[slot] = {};
    kbEdges[slot][name] = val;
  }

  // ── bind-screen helpers (review fix #3 — polled per tick from ui.js) ──

  // Returns the first input source not already claimed by any slot.
  // Returns null if nothing pressed or only claimed sources are pressed.
  // UI calls this every tick during the bind scene.
  function peekUnclaimedInput() {
    const claimedSchemes = new Set();
    const claimedPads = new Set();
    for (const s in slots) {
      const src = slots[s];
      if (src.kind === 'keyboard') claimedSchemes.add(src.scheme);
      if (src.kind === 'gamepad')  claimedPads.add(src.gamepadIndex);
    }

    // Check each scheme for any direction key held that isn't already claimed
    for (const sch of SCHEME_LIST) {
      if (claimedSchemes.has(sch)) continue;
      const m = SCHEMES[sch];
      const codes = [m.left, m.right, m.thrust, m.fire, m.hyper];
      if (m.hyperAlt) codes.push(m.hyperAlt);
      for (const code of codes) {
        if (pressedKeys.has(code)) return { kind: 'keyboard', scheme: sch };
      }
    }

    // Then gamepads
    const pads = SG.listGamepads();
    for (const p of pads) {
      if (claimedPads.has(p.index)) continue;
      // Any button press or stick deflection counts. Use SharedGamepad's
      // raw state via getDirection + a button scan via consumeButtonPress
      // on A (peek-not-consume isn't available, so we check raw via the
      // navigator API directly — same as Pac-Man's anyInputPressed pattern).
      const raw = navigator.getGamepads ? navigator.getGamepads()[p.index] : null;
      if (!raw) continue;
      // Any button down?
      for (let b = 0; b < raw.buttons.length; b++) {
        if (raw.buttons[b] && raw.buttons[b].pressed) return { kind: 'gamepad', gamepadIndex: p.index };
      }
      // Stick deflection?
      const ax = raw.axes[0] || 0, ay = raw.axes[1] || 0;
      if (Math.abs(ax) > SG.AXIS_DEADZONE || Math.abs(ay) > SG.AXIS_DEADZONE) {
        return { kind: 'gamepad', gamepadIndex: p.index };
      }
    }
    return null;
  }

  // For solo mode — returns true if any gamepad button is currently pressed
  // on a pad not yet bound to slot 1. Used to auto-attach a controller mid-play.
  function pollUnclaimedGamepadIndex() {
    const claimedPads = new Set();
    for (const s in slots) {
      const src = slots[s];
      if (src.kind === 'gamepad') claimedPads.add(src.gamepadIndex);
    }
    const pads = SG.listGamepads();
    for (const p of pads) {
      if (claimedPads.has(p.index)) continue;
      const raw = navigator.getGamepads ? navigator.getGamepads()[p.index] : null;
      if (!raw) continue;
      for (let b = 0; b < raw.buttons.length; b++) {
        if (raw.buttons[b] && raw.buttons[b].pressed) return p.index;
      }
    }
    return -1;
  }

  window.AsteroidsInput = {
    SCHEMES: SCHEMES, SCHEME_LIST: SCHEME_LIST,
    init: init, teardown: teardown,
    claimInput: claimInput, releaseSlot: releaseSlot, releaseAll: releaseAll,
    getSlotSource: getSlotSource, getBindings: getBindings,
    tickCooldowns: tickCooldowns,
    getIntent: getIntent,
    consumeFire: consumeFire, consumeHyperspace: consumeHyperspace,
    peekUnclaimedInput: peekUnclaimedInput,
    pollUnclaimedGamepadIndex: pollUnclaimedGamepadIndex
  };
})();
