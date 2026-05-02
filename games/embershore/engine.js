/* ═══════════════════════════════════════════════════════════════
   Embershore — engine.js
   State container, fixed-step tick, room-scroll, save/load.
   Mirrors games/pacman/engine.js patterns: pure step(state, input) over
   a single state object, events array drives audio/rumble.
   See docs/design/019-embershore-architecture.md §3, §4, §5, §7, §9.
   Exposes window.EmbershoreEngine.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window.EmbershoreWorld;
  const Ent = window.EmbershoreEntities;

  const FIXED_STEP_MS = 1000 / 60;
  const PLAYER_SPEED = 1.0;

  // Room-scroll tunables — debug scrubber writes these (game.js)
  let ROOM_SCROLL_FRAMES = 17;     // ~280ms at 60fps
  let easingIdx = 0;
  const EASINGS = [
    { name: 'cubic',     fn: cubicEaseInOut },
    { name: 'smoothstep', fn: smoothstep },
    { name: 'quart',     fn: quartEaseInOut },
    { name: 'quint',     fn: quintEaseInOut },
    { name: 'sine',      fn: sineEaseInOut },
  ];

  function cubicEaseInOut(t) {
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  }
  function smoothstep(t) { return t*t*(3 - 2*t); }
  function quartEaseInOut(t) {
    return t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t + 2, 4) / 2;
  }
  function quintEaseInOut(t) {
    return t < 0.5 ? 16*t*t*t*t*t : 1 - Math.pow(-2*t + 2, 5) / 2;
  }
  function sineEaseInOut(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }

  // ── State construction ──────────────────────────────────────
  function createState(saveData) {
    const s = {
      // Persistence-relevant
      name: (saveData && saveData.name) || 'cinder',
      scene: 'overworld',
      roomId: (saveData && saveData.roomId) || 'ow_0_0',
      player: Ent.createPlayer(saveData && saveData.player),
      inventory: (saveData && saveData.inventory) || [],
      equipped: (saveData && saveData.equipped) || { A: null, B: null },
      hearts: (saveData && saveData.hearts) || { current: 6, max: 6 },
      rupees: (saveData && saveData.rupees) || 0,
      sigils: (saveData && saveData.sigils) || { earth:false, tide:false, ember:false, gale:false },
      shells: (saveData && saveData.shells) || [],
      npcsTalkedTo: new Set((saveData && saveData.npcsTalkedTo) || []),
      fishCaught: (saveData && saveData.fishCaught) || {},
      bardVersesHeard: new Set((saveData && saveData.bardVersesHeard) || []),
      totemsRead: new Set((saveData && saveData.totemsRead) || []),
      visitedRooms: new Set((saveData && saveData.visitedRooms) || []),
      currentDate: new Date().toISOString().slice(0, 10),
      completed: (saveData && saveData.completed) || false,

      // Transient
      tiles: null,           // populated below
      entities: [],
      scroll: null,          // null OR { from, to, dir, frame, totalFrames }
      dialogue: null,
      menu: null,
      itemGet: null,
      events: [],
      tick: 0,
      inputThisFrame: { dir: null, btnA: false, btnB: false, btnE: false, btnPause: false },
      cameraOffset: { x: 0, y: 0 },
      prefs: { muted: false, reducedMotion: false, sfxVol: 1.0, musicVol: 0.7 },

      // HUD pulse — fades to 100% on event then eases back
      hudFlashFrames: 0,
    };
    // Boot-time room load
    enterRoom(s, s.roomId);
    s.visitedRooms.add(s.roomId);
    return s;
  }

  function enterRoom(state, roomId) {
    state.roomId = roomId;
    const room = W.getRoom(roomId);
    if (!room) return;
    state.tiles = room.tiles;  // shared reference; mutations persist in world.ROOMS
    state.entities = [];        // PR1: only player exists
    state.visitedRooms.add(roomId);
    pushEvent(state, 'room_enter', { roomId: roomId });
  }

  function pushEvent(state, type, data) {
    state.events.push({ type: type, data: data || {} });
  }

  // ── Tick ────────────────────────────────────────────────────
  function step(state, input) {
    state.events = [];
    state.tick++;
    state.inputThisFrame = input || state.inputThisFrame;

    if (state.hudFlashFrames > 0) state.hudFlashFrames--;

    if (state.scroll) {
      stepScroll(state);
      return;
    }
    if (state.dialogue) {
      // PR1 noop — handled in step 6
      return;
    }
    if (state.menu) {
      // PR1 noop — handled in step 7
      return;
    }

    // Step the player
    Ent.step(state, state.player, input);
    detectRoomEdgeAndTransition(state);
  }

  // Detect when the player has walked to the room edge and trigger a scroll
  function detectRoomEdgeAndTransition(state) {
    const p = state.player;
    const room = W.getRoom(state.roomId);
    if (!room) return;
    const ROOM_W = W.COLS * W.TILE;
    const ROOM_H = W.ROWS * W.TILE;
    // Player is blocked by canWalkAt before reaching the literal edge
    // (corner-bounding-box vs OOB tile). Margin 8 = half a tile buffer
    // so the natural wall-stop position is inside the trigger zone.
    const margin = 8;
    // Only trigger if player is also pressing toward that edge
    const inputDir = state.inputThisFrame && state.inputThisFrame.dir;
    let dir = null, neighbor = null;
    if (p.x <= margin && inputDir === 'left' && room.exits.W) { dir = 'left';  neighbor = room.exits.W; }
    else if (p.x >= ROOM_W - margin && inputDir === 'right' && room.exits.E) { dir = 'right'; neighbor = room.exits.E; }
    else if (p.y <= margin && inputDir === 'up' && room.exits.N) { dir = 'up';    neighbor = room.exits.N; }
    else if (p.y >= ROOM_H - margin && inputDir === 'down' && room.exits.S) { dir = 'down';  neighbor = room.exits.S; }
    if (!dir || !neighbor) return;

    if (state.prefs.reducedMotion) {
      // Instant cut — no animation
      enterRoom(state, neighbor);
      placePlayerAtEntry(state, dir);
      return;
    }

    // Begin scroll
    state.scroll = {
      from: state.roomId,
      to: neighbor,
      dir: dir,
      frame: 0,
      totalFrames: ROOM_SCROLL_FRAMES,
      // Snapshot of player start position (logical px in 'from' room space)
      playerStartX: p.x,
      playerStartY: p.y,
    };
  }

  function placePlayerAtEntry(state, fromDir) {
    const p = state.player;
    const ROOM_W = W.COLS * W.TILE;
    const ROOM_H = W.ROWS * W.TILE;
    const inset = 12;
    if (fromDir === 'right')      { p.x = inset;          p.dir = 'right'; }
    else if (fromDir === 'left')  { p.x = ROOM_W - inset; p.dir = 'left'; }
    else if (fromDir === 'down')  { p.y = inset;          p.dir = 'down'; }
    else if (fromDir === 'up')    { p.y = ROOM_H - inset; p.dir = 'up'; }
  }

  function stepScroll(state) {
    const scr = state.scroll;
    scr.frame++;

    // Move the player across the seam linearly
    const t = scr.frame / scr.totalFrames;
    const ROOM_W = W.COLS * W.TILE;
    const ROOM_H = W.ROWS * W.TILE;
    const inset = 12;
    if (scr.dir === 'right') {
      // Player walks from edge to inset of new room (over the seam)
      const startX = scr.playerStartX;       // typically near ROOM_W
      const targetX = ROOM_W + inset;        // 1 tile inside new room (in 'from' space)
      state.player.x = startX + (targetX - startX) * t;
      state.player.dir = 'right';
    } else if (scr.dir === 'left') {
      const startX = scr.playerStartX;
      const targetX = -inset;
      state.player.x = startX + (targetX - startX) * t;
      state.player.dir = 'left';
    } else if (scr.dir === 'down') {
      const startY = scr.playerStartY;
      const targetY = ROOM_H + inset;
      state.player.y = startY + (targetY - startY) * t;
      state.player.dir = 'down';
    } else if (scr.dir === 'up') {
      const startY = scr.playerStartY;
      const targetY = -inset;
      state.player.y = startY + (targetY - startY) * t;
      state.player.dir = 'up';
    }

    // Walk-frame animation continues during scroll
    state.player.moving = true;
    state.player.walkProgress += PLAYER_SPEED / 8;
    if (state.player.walkProgress >= 1) {
      state.player.walkFrame = 1 - state.player.walkFrame;
      state.player.walkProgress -= 1;
    }

    if (scr.frame >= scr.totalFrames) {
      // Complete: move to new room, snap player to entry position
      enterRoom(state, scr.to);
      placePlayerAtEntry(state, scr.dir);
      state.scroll = null;
    }
  }

  // ── Debug scrubber API (used by game.js keyboard handler) ────
  function setScrollFrames(n) {
    ROOM_SCROLL_FRAMES = Math.max(6, Math.min(40, n));
  }
  function getScrollFrames() { return ROOM_SCROLL_FRAMES; }
  function cycleEasing() {
    easingIdx = (easingIdx + 1) % EASINGS.length;
    return EASINGS[easingIdx].name;
  }
  function getEasing() { return EASINGS[easingIdx]; }

  // ── Persistence ─────────────────────────────────────────────
  const SAVE_KEY   = 'embershore.save.v1';
  const PREFS_KEY  = 'embershore.prefs.v1';
  const SCORES_KEY = 'embershore.scores.v1';

  function save(state) {
    try {
      const blob = {
        v: 1,
        name: state.name,
        scene: state.scene,
        roomId: state.roomId,
        player: { x: state.player.x, y: state.player.y, dir: state.player.dir },
        inventory: state.inventory,
        equipped: state.equipped,
        hearts: state.hearts,
        rupees: state.rupees,
        sigils: state.sigils,
        shells: state.shells,
        npcsTalkedTo: Array.from(state.npcsTalkedTo),
        fishCaught: state.fishCaught,
        bardVersesHeard: Array.from(state.bardVersesHeard),
        totemsRead: Array.from(state.totemsRead),
        visitedRooms: Array.from(state.visitedRooms),
        currentDate: state.currentDate,
        completed: state.completed,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
    } catch (e) { /* quota/disabled — ignore */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.v === 1) return data;
      return null;
    } catch (e) { return null; }
  }

  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? JSON.parse(raw) : { muted: false, reducedMotion: false, sfxVol: 1.0, musicVol: 0.7 };
    } catch (e) { return { muted: false, reducedMotion: false, sfxVol: 1.0, musicVol: 0.7 }; }
  }

  function savePrefs(prefs) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {}
  }

  function loadScores() {
    try {
      const raw = localStorage.getItem(SCORES_KEY);
      return raw ? JSON.parse(raw) : { biggestFish: {}, fastestRun: { completed: false, seconds: null } };
    } catch (e) { return { biggestFish: {}, fastestRun: { completed: false, seconds: null } }; }
  }

  function saveScore(category, value) {
    const scores = loadScores();
    if (category === 'fish') {
      const { species, cm } = value;
      if (!scores.biggestFish[species] || cm > scores.biggestFish[species]) {
        scores.biggestFish[species] = cm;
      }
    } else if (category === 'run' && value.completed) {
      if (!scores.fastestRun.completed || value.seconds < scores.fastestRun.seconds) {
        scores.fastestRun = value;
      }
    }
    try { localStorage.setItem(SCORES_KEY, JSON.stringify(scores)); } catch (e) {}
  }

  window.EmbershoreEngine = {
    FIXED_STEP_MS: FIXED_STEP_MS,
    PLAYER_SPEED: PLAYER_SPEED,
    createState: createState,
    step: step,
    enterRoom: enterRoom,
    pushEvent: pushEvent,

    // Room-scroll tunables / debug
    setScrollFrames: setScrollFrames,
    getScrollFrames: getScrollFrames,
    cycleEasing: cycleEasing,
    getEasing: getEasing,

    // Persistence
    save: save,
    load: load,
    clearSave: clearSave,
    loadPrefs: loadPrefs,
    savePrefs: savePrefs,
    loadScores: loadScores,
    saveScore: saveScore,
  };
})();
