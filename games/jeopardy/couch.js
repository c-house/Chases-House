/* ═══════════════════════════════════════════════════════════════
   Jeopardy — couch.js
   Host-side coordinator for "couch" / hot-seat players: 2-4 controllers
   plugged into the host's machine, each acting as its own Firebase player.
   Keeps host.js's single responsibility (game flow); this module owns
   couch-player record writes, controller→player mapping, buzz writes,
   and rumble.
   Depends on shared.js (window.Jeopardy) and ../shared/gamepad.js.
   Exposes window.JeopardyCouch.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var J = window.Jeopardy;
  var SG = window.SharedGamepad;

  var BUZZ_RUMBLE = { duration: 80, strongMagnitude: 0.7, weakMagnitude: 0.3 };
  var LOCKOUT_RUMBLE = { duration: 220, strongMagnitude: 0, weakMagnitude: 0.5 };

  // ── Module state ──────────────────────────────────────────
  var roomCode = null;
  var authUid = null;
  var getClueState = null;     // callback to read currentClueData.state
  var getLockout = null;       // callback returning lockedOutPlayers map
  var onPanelUpdate = null;
  var probedPermission = false;

  // gamepadIndex → { synthId, name, padId, status: 'connected' | 'disconnected' }
  var assignments = {};
  // synthId → { name, padId } (disconnected couch entries kept for re-claim)
  var orphans = {};
  // synthId → bool (true after a successful buzz this clue, reset on clue end)
  var buzzedThisClue = {};
  // synthId → bool prev lockout state (for rumble edge detection)
  var prevLockoutState = {};

  // pending bind: when user clicks "Add couch player", we wait for a button press
  // on an unassigned controller. { name } while pending; null otherwise.
  var pendingBind = null;

  var pollRunning = false;
  var initialized = false;

  // ── Toast helper (host-page DOM) ──────────────────────────

  function showToast(msg) {
    var t = document.getElementById('gp-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  function shortPadName(id) {
    if (!id) return 'Gamepad';
    var m = id.match(/([A-Za-z0-9_ -]{3,})/);
    return m ? m[1].trim().slice(0, 28) : 'Gamepad';
  }

  // ── Synthetic ID generation ───────────────────────────────

  function makeSynthId() {
    return authUid + '_pad_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ── Reconnect reconciliation ──────────────────────────────

  function tryAutoReclaim(idx, padId) {
    var matching = Object.keys(orphans).filter(function (sid) {
      return orphans[sid].padId === padId;
    });
    if (matching.length === 1) {
      var sid = matching[0];
      var name = orphans[sid].name;
      reclaimOrphan(sid, idx);
      showToast('Re-linked ' + name + ' to controller');
      return true;
    }
    return false;
  }

  // ── Public: re-link an orphan to a connected pad ──────────

  function reclaimOrphan(synthId, gamepadIndex) {
    if (!orphans[synthId]) return;
    if (assignments[gamepadIndex]) return;
    var rec = orphans[synthId];
    delete orphans[synthId];
    assignments[gamepadIndex] = {
      synthId: synthId,
      name: rec.name,
      padId: rec.padId,
      status: 'connected'
    };
    J.ref('rooms/' + roomCode + '/players/' + synthId + '/connected').set(true);
    notifyPanel();
  }

  // ── Pad event handlers ────────────────────────────────────

  function onPadConnect(idx, id) {
    showToast('Controller connected: ' + shortPadName(id));
    if (tryAutoReclaim(idx, id)) {
      // handled
    } else {
      notifyPanel();
    }
  }

  function onPadDisconnect(idx, id) {
    showToast('Controller ' + shortPadName(id) + ' disconnected');
    var rec = assignments[idx];
    if (rec) {
      orphans[rec.synthId] = { name: rec.name, padId: rec.padId };
      delete assignments[idx];
      J.ref('rooms/' + roomCode + '/players/' + rec.synthId + '/connected').set(false);
    }
    notifyPanel();
  }

  // ── Bind flow: "Add couch player" ─────────────────────────

  function startBindFlow(name) {
    if (!name) return Promise.reject(new Error('Name required.'));
    pendingBind = { name: name };
    showToast('Press A on an unassigned controller for ' + name);
    return Promise.resolve();
  }

  function cancelBindFlow() {
    pendingBind = null;
    notifyPanel();
  }

  // Returns pad index that fired the buzz, or -1 if none unassigned pressed.
  function detectBindPress() {
    var pads = SG.listGamepads();
    for (var i = 0; i < pads.length; i++) {
      var idx = pads[i].index;
      if (assignments[idx]) continue;
      if (SG.consumeButtonPress(idx, SG.BUTTONS.A)) return idx;
    }
    return -1;
  }

  function completeBind(gamepadIndex, padId) {
    var name = pendingBind.name;
    pendingBind = null;
    var synthId = makeSynthId();
    assignments[gamepadIndex] = {
      synthId: synthId,
      name: name,
      padId: padId,
      status: 'connected'
    };

    J.joinRoomDirect(roomCode, synthId, name).then(function () {
      // First-time permission probe — surface Firebase rules misconfig.
      if (!probedPermission) {
        probedPermission = true;
        J.probeWritePermission(roomCode, synthId).catch(function () {
          showToast('Controller mode unavailable: Firebase rules need updating');
        });
      }
      SG.rumble(gamepadIndex, BUZZ_RUMBLE);
      showToast('Bound ' + name + ' to controller');
      notifyPanel();
    }).catch(function (err) {
      delete assignments[gamepadIndex];
      console.error('JeopardyCouch: failed to add couch player', err);
      showToast('Failed to add ' + name);
      notifyPanel();
    });
  }

  // ── Main poll loop ────────────────────────────────────────

  function poll() {
    if (!pollRunning) return;
    var clueState = getClueState ? getClueState() : null;
    var lockedOut = getLockout ? getLockout() : {};

    // 1) Pending bind: scan for first A-press on unassigned pad
    if (pendingBind) {
      var bindIdx = detectBindPress();
      if (bindIdx !== -1) {
        var pads = SG.listGamepads();
        var match = null;
        for (var i = 0; i < pads.length; i++) if (pads[i].index === bindIdx) { match = pads[i]; break; }
        completeBind(bindIdx, match ? match.id : '');
      }
    }

    // 2) Buzz polling for assigned pads
    if (clueState === J.CLUE_STATE.BUZZING) {
      Object.keys(assignments).forEach(function (idxKey) {
        var idx = +idxKey;
        var rec = assignments[idx];
        if (!rec || rec.status !== 'connected') return;
        if (lockedOut[rec.synthId]) return;
        if (buzzedThisClue[rec.synthId]) return;
        if (SG.consumeButtonPress(idx, SG.BUTTONS.A)) {
          buzzedThisClue[rec.synthId] = true;
          J.writeBuzz(roomCode, rec.synthId);
          SG.rumble(idx, BUZZ_RUMBLE);
        }
      });
    }

    // 3) Lockout transitions: rumble pad on rising edge
    Object.keys(assignments).forEach(function (idxKey) {
      var idx = +idxKey;
      var rec = assignments[idx];
      if (!rec) return;
      var now = !!lockedOut[rec.synthId];
      var prev = !!prevLockoutState[rec.synthId];
      if (now && !prev) SG.rumble(idx, LOCKOUT_RUMBLE);
      prevLockoutState[rec.synthId] = now;
    });

    requestAnimationFrame(poll);
  }

  // ── Panel rendering hook ──────────────────────────────────

  function notifyPanel() {
    if (onPanelUpdate) onPanelUpdate({
      assignments: assignments,
      orphans: orphans,
      pendingBind: pendingBind
    });
  }

  // ── Clue lifecycle hooks (called by host.js) ──────────────

  function resetForNewClue() {
    buzzedThisClue = {};
  }

  // ── Init / teardown ───────────────────────────────────────

  function init(opts) {
    if (initialized) return;
    initialized = true;
    roomCode = opts.roomCode;
    authUid = opts.authUid;
    getClueState = opts.getCurrentClueState;
    getLockout = opts.getLockout || function () { return {}; };
    onPanelUpdate = opts.onPanelUpdate || null;

    SG.init({ onConnect: onPadConnect, onDisconnect: onPadDisconnect });
    pollRunning = true;
    requestAnimationFrame(poll);
    notifyPanel();
  }

  function teardown() {
    pollRunning = false;
    SG.teardown();
    assignments = {};
    orphans = {};
    buzzedThisClue = {};
    prevLockoutState = {};
    pendingBind = null;
    initialized = false;
  }

  window.JeopardyCouch = {
    init: init,
    teardown: teardown,
    startBindFlow: startBindFlow,
    cancelBindFlow: cancelBindFlow,
    reclaimOrphan: reclaimOrphan,
    resetForNewClue: resetForNewClue
  };
})();
