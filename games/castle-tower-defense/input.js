/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — input.js
   Pointer (mouse + touch), keyboard, gesture, raycast hit-test.
   Gamepad is DELETED — no SharedGamepad usage. ADR-028 §7, §15.
   Exposes window.CTD3Input.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let getStateFn = null;
  let actions = null;
  let canvas = null;
  let initialized = false;

  // Pinch state
  const touches = new Map(); // pointerId → {x, y}
  let pinchStartDist = 0;
  let pinchStartZoom = 1;

  const KEY_TO_TOWER = { '1': 'ranger', '2': 'catapult', '3': 'mage', '4': 'warden' };

  function init(opts) {
    if (initialized) return;
    getStateFn = opts.getState;
    actions = opts.actions;
    canvas = window.CTD3Renderer.getCanvas();
    if (canvas) {
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
      canvas.addEventListener('wheel', onWheel, { passive: false });
    }
    document.addEventListener('keydown', onKey);
    initialized = true;
  }

  function onKey(ev) {
    const state = getStateFn && getStateFn();
    if (!state) return;
    const screen = document.body.getAttribute('data-screen');
    const k = ev.key.toLowerCase();
    if (k === 'escape') {
      ev.preventDefault();
      if (screen === 'play') actions.pause();
      else if (screen === 'pause') actions.resume();
      else if (screen === 'map-select') actions.go('title');
      return;
    }
    if (screen === 'play') {
      if (KEY_TO_TOWER[k]) { ev.preventDefault(); actions.selectTower(KEY_TO_TOWER[k]); return; }
      if (k === 'u') { ev.preventDefault(); actions.upgrade(); return; }
      if (k === 's') { ev.preventDefault(); actions.sell();    return; }
      if (k === 'n') { ev.preventDefault(); actions.sendNextWave(); return; }
      if (k === 'f') { ev.preventDefault(); actions.toggleFastForward(); return; }
      if (k === ' ') { ev.preventDefault(); actions.pause(); return; }
    } else if (screen === 'pause') {
      if (k === ' ') { ev.preventDefault(); actions.resume(); return; }
    }
  }

  function pointerToNDC(ev) {
    const r = canvas.getBoundingClientRect();
    const nx = ((ev.clientX - r.left) / r.width) * 2 - 1;
    const ny = -((ev.clientY - r.top) / r.height) * 2 + 1;
    return { nx, ny };
  }

  function onPointerDown(ev) {
    ev.preventDefault();
    canvas.setPointerCapture(ev.pointerId);
    touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (touches.size === 2) {
      // Start pinch
      const pts = [...touches.values()];
      pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartZoom = window.CTD3Renderer.getZoom();
      return;
    }

    // Single tap → raycast → action
    const state = getStateFn();
    if (!state || document.body.getAttribute('data-screen') !== 'play') return;
    const { nx, ny } = pointerToNDC(ev);
    const hit = window.CTD3Scene.raycastFromNormalizedPointer(nx, ny);
    if (!hit) return;
    if (hit.kind === 'slot') actions.selectSlot(hit.id);
    else if (hit.kind === 'tower') actions.selectTowerInstance(hit.id);
    else if (hit.kind === 'empty') actions.cancelSelection();
  }

  function onPointerMove(ev) {
    if (!touches.has(ev.pointerId)) return;
    touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (touches.size === 2 && pinchStartDist > 0) {
      const pts = [...touches.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = d / pinchStartDist;
      window.CTD3Renderer.setZoom(pinchStartZoom * ratio);
      return;
    }

    // Single-pointer hover → update hoverSlotId
    if (touches.size !== 1) return;
    const state = getStateFn();
    if (!state || document.body.getAttribute('data-screen') !== 'play') return;
    const { nx, ny } = pointerToNDC(ev);
    const hit = window.CTD3Scene.raycastFromNormalizedPointer(nx, ny);
    if (hit && hit.kind === 'slot') state.hoverSlotId = hit.id;
    else state.hoverSlotId = null;
  }

  function onPointerUp(ev) {
    touches.delete(ev.pointerId);
    if (touches.size < 2) {
      pinchStartDist = 0;
    }
  }

  function onWheel(ev) {
    ev.preventDefault();
    const delta = -ev.deltaY * 0.001;
    window.CTD3Renderer.setZoom(window.CTD3Renderer.getZoom() * (1 + delta));
  }

  window.CTD3Input = { init };
})();
