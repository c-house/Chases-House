/* ═══════════════════════════════════════════════════════════════
   Shared — gamepad.js
   Game-agnostic Gamepad API wrapper. Knows nothing about slots,
   schemes, players, or Firebase. Consumers (Pac-Man, Jeopardy) build
   their own binding/identity model on top.
   Exposes window.SharedGamepad.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BUTTONS = Object.freeze({
    A: 0,
    B: 1,
    X: 2,
    Y: 3,
    LB: 4,
    RB: 5,
    LT: 6,
    RT: 7,
    BACK: 8,
    START: 9,
    LS: 10,
    RS: 11,
    DPAD_UP: 12,
    DPAD_DOWN: 13,
    DPAD_LEFT: 14,
    DPAD_RIGHT: 15
  });
  const AXIS_DEADZONE = 0.35;

  // edgeState[index][btn] = boolean (was pressed last call)
  const edgeState = {};
  let callbacks = {};
  let listenersAttached = false;

  function getPads() {
    return navigator.getGamepads ? navigator.getGamepads() : [];
  }

  function handleConnected(e) {
    if (callbacks.onConnect) callbacks.onConnect(e.gamepad.index, e.gamepad.id);
  }

  function handleDisconnected(e) {
    delete edgeState[e.gamepad.index];
    if (callbacks.onDisconnect) callbacks.onDisconnect(e.gamepad.index, e.gamepad.id);
  }

  function init(cbs) {
    callbacks = cbs || {};
    if (listenersAttached) return;
    window.addEventListener('gamepadconnected', handleConnected);
    window.addEventListener('gamepaddisconnected', handleDisconnected);
    listenersAttached = true;
  }

  function teardown() {
    if (listenersAttached) {
      window.removeEventListener('gamepadconnected', handleConnected);
      window.removeEventListener('gamepaddisconnected', handleDisconnected);
      listenersAttached = false;
    }
    callbacks = {};
    Object.keys(edgeState).forEach(k => delete edgeState[k]);
  }

  function listGamepads() {
    const pads = getPads();
    const result = [];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i]) result.push({ index: i, id: pads[i].id });
    }
    return result;
  }

  function consumeButtonPress(index, btn) {
    const pads = getPads();
    const pad = pads[index];
    if (!pad || !pad.buttons[btn]) return false;
    const pressed = !!pad.buttons[btn].pressed;
    const padEdges = edgeState[index] || (edgeState[index] = {});
    const prev = padEdges[btn] || false;
    padEdges[btn] = pressed;
    return pressed && !prev;
  }

  function getDirection(index) {
    const pads = getPads();
    const pad = pads[index];
    if (!pad) return null;
    if (pad.buttons[BUTTONS.DPAD_UP] && pad.buttons[BUTTONS.DPAD_UP].pressed) return 'up';
    if (pad.buttons[BUTTONS.DPAD_DOWN] && pad.buttons[BUTTONS.DPAD_DOWN].pressed) return 'down';
    if (pad.buttons[BUTTONS.DPAD_LEFT] && pad.buttons[BUTTONS.DPAD_LEFT].pressed) return 'left';
    if (pad.buttons[BUTTONS.DPAD_RIGHT] && pad.buttons[BUTTONS.DPAD_RIGHT].pressed) return 'right';
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

  function rumble(index, opts) {
    const pads = getPads();
    const pad = pads[index];
    if (!pad || !pad.vibrationActuator) return false;
    const o = opts || {};
    try {
      pad.vibrationActuator.playEffect('dual-rumble', {
        startDelay: o.startDelay || 0,
        duration: o.duration != null ? o.duration : 100,
        strongMagnitude: o.strongMagnitude != null ? o.strongMagnitude : 0.5,
        weakMagnitude: o.weakMagnitude != null ? o.weakMagnitude : 0.5
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  window.SharedGamepad = {
    init: init,
    teardown: teardown,
    listGamepads: listGamepads,
    consumeButtonPress: consumeButtonPress,
    getDirection: getDirection,
    rumble: rumble,
    BUTTONS: BUTTONS,
    AXIS_DEADZONE: AXIS_DEADZONE
  };
})();
