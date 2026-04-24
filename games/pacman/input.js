(function () {
  'use strict';

  const SCHEMES = {
    wasd:   { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', action: 'Space' },
    arrows: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', action: 'Enter' },
    ijkl:   { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', action: 'KeyU' },
    numpad: { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', action: 'Numpad0',
              altDown: 'Numpad2' },
  };
  const SCHEME_LIST = ['wasd', 'arrows', 'ijkl', 'numpad'];

  const GAMEPAD_BUTTONS = {
    up: 12, down: 13, left: 14, right: 15,
    a: 0, b: 1, start: 9,
  };
  const AXIS_DEADZONE = 0.35;

  const pressedKeys = new Set();
  const pressOrder = [];     // order of keys pressed (latest last)
  const slots = {};          // slot -> { kind: 'keyboard'|'gamepad', scheme|index }
  const buttonEdges = {};    // slot -> { action: {pressed, prev} }
  let callbacks = {};
  let gamepadsKnown = {};

  function handleKeyDown(e) {
    if (pressedKeys.has(e.code)) return;
    pressedKeys.add(e.code);
    pressOrder.push(e.code);
    // Prevent arrow keys / numpad from scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) {
      e.preventDefault();
    }
  }

  function handleKeyUp(e) {
    pressedKeys.delete(e.code);
    const idx = pressOrder.lastIndexOf(e.code);
    if (idx >= 0) pressOrder.splice(idx, 1);
  }

  function handleGamepadConnected(e) {
    const pad = e.gamepad;
    gamepadsKnown[pad.index] = pad.id;
    if (callbacks.onConnect) callbacks.onConnect(pad.index, pad.id);
  }

  function handleGamepadDisconnected(e) {
    const pad = e.gamepad;
    delete gamepadsKnown[pad.index];
    // Unbind any slot using this gamepad
    for (const slot in slots) {
      if (slots[slot].kind === 'gamepad' && slots[slot].index === pad.index) {
        delete slots[slot];
      }
    }
    if (callbacks.onDisconnect) callbacks.onDisconnect(pad.index, pad.id);
  }

  function init(cbs) {
    callbacks = cbs || {};
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);
  }

  function teardown() {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('gamepadconnected', handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
    pressedKeys.clear();
    pressOrder.length = 0;
    Object.keys(slots).forEach(k => delete slots[k]);
  }

  function bindSlot(slot, source) { slots[slot] = source; buttonEdges[slot] = {}; }
  function unbindSlot(slot) { delete slots[slot]; delete buttonEdges[slot]; }
  function getBindings() { return Object.assign({}, slots); }

  function listGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const result = [];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i]) result.push({ index: i, id: pads[i].id });
    }
    return result;
  }

  function firstUnboundGamepadSlot() {
    const bound = new Set();
    for (const slot in slots) {
      if (slots[slot].kind === 'gamepad') bound.add(slots[slot].index);
    }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && !bound.has(i)) return i;
    }
    return null;
  }

  // Most-recently-pressed direction key in a scheme
  function latestSchemeDir(scheme) {
    const map = SCHEMES[scheme];
    if (!map) return null;
    for (let i = pressOrder.length - 1; i >= 0; i--) {
      const code = pressOrder[i];
      if (code === map.up) return 'up';
      if (code === map.down || code === map.altDown) return 'down';
      if (code === map.left) return 'left';
      if (code === map.right) return 'right';
    }
    return null;
  }

  function gamepadDir(index) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[index];
    if (!pad) return null;
    // D-pad first
    if (pad.buttons[GAMEPAD_BUTTONS.up] && pad.buttons[GAMEPAD_BUTTONS.up].pressed) return 'up';
    if (pad.buttons[GAMEPAD_BUTTONS.down] && pad.buttons[GAMEPAD_BUTTONS.down].pressed) return 'down';
    if (pad.buttons[GAMEPAD_BUTTONS.left] && pad.buttons[GAMEPAD_BUTTONS.left].pressed) return 'left';
    if (pad.buttons[GAMEPAD_BUTTONS.right] && pad.buttons[GAMEPAD_BUTTONS.right].pressed) return 'right';
    // Left stick
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    if (Math.abs(ax) > Math.abs(ay)) {
      if (ax < -AXIS_DEADZONE) return 'left';
      if (ax > AXIS_DEADZONE) return 'right';
    } else {
      if (ay < -AXIS_DEADZONE) return 'up';
      if (ay > AXIS_DEADZONE) return 'down';
    }
    return null;
  }

  function getDirection(slot) {
    const src = slots[slot];
    if (!src) return null;
    if (src.kind === 'keyboard') return latestSchemeDir(src.scheme);
    if (src.kind === 'gamepad') return gamepadDir(src.index);
    return null;
  }

  function schemeActionPressed(scheme) {
    const map = SCHEMES[scheme];
    if (!map || !map.action) return false;
    return pressedKeys.has(map.action);
  }

  function gamepadActionPressed(index) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[index];
    if (!pad) return false;
    return (pad.buttons[GAMEPAD_BUTTONS.a] && pad.buttons[GAMEPAD_BUTTONS.a].pressed) ||
           (pad.buttons[GAMEPAD_BUTTONS.start] && pad.buttons[GAMEPAD_BUTTONS.start].pressed);
  }

  function getButton(slot, name) {
    const src = slots[slot];
    if (!src) return false;
    const pressed = src.kind === 'keyboard'
      ? schemeActionPressed(src.scheme)
      : gamepadActionPressed(src.index);
    const edges = buttonEdges[slot] || (buttonEdges[slot] = {});
    const prev = edges[name] || false;
    edges[name] = pressed;
    // edge-triggered: true only on rising edge
    return pressed && !prev;
  }

  function anyInputPressed() {
    if (pressOrder.length) return { kind: 'keyboard', code: pressOrder[pressOrder.length - 1] };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p) continue;
      for (let b = 0; b < p.buttons.length; b++) {
        if (p.buttons[b] && p.buttons[b].pressed) return { kind: 'gamepad', index: i, button: b };
      }
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.abs(ax) > AXIS_DEADZONE || Math.abs(ay) > AXIS_DEADZONE) {
        return { kind: 'gamepad', index: i, axis: 'stick' };
      }
    }
    return null;
  }

  function poll() {
    // Auto-bind: if there's a pending scheme bound to a slot waiting for first input, etc.
    // We keep this minimal: consumers call anyInputPressed() during bind screen.
  }

  // Code → scheme (for auto-detecting which scheme a key press belongs to)
  function schemeForCode(code) {
    for (const s of SCHEME_LIST) {
      const m = SCHEMES[s];
      if (m.up === code || m.down === code || m.left === code || m.right === code ||
          (m.altDown && m.altDown === code) || m.action === code) return s;
    }
    return null;
  }

  window.PacmanInput = {
    SCHEMES, SCHEME_LIST,
    init, teardown,
    bindSlot, unbindSlot, getBindings,
    getDirection, getButton,
    listGamepads, firstUnboundGamepadSlot,
    anyInputPressed, schemeForCode,
    poll,
  };
})();
