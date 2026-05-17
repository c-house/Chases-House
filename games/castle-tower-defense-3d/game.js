/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — game.js
   Boot, FSM, rAF tick, event delegation, audio bring-up.
   Module-typed so it executes AFTER assets/renderer/scene/lighting
   modules have populated their window globals. ADR-028 §7, §8, §15.
   Public surface: window.CastleTowerDefense.start()
   ═══════════════════════════════════════════════════════════════ */

const FIXED_STEP_MS = 1000 / 60;
const KEYS = {
  scores:        'ctd3:scores',
  settings:      'ctd3:settings',
  tutorialSeen:  'ctd3:tutorialSeen'
};
const SETTINGS_DEFAULTS = {
  musicVolume: 0.40, sfxVolume: 0.80, ambientVolume: 0.25,
  musicMuted: false, sfxMuted: false,
  reducedMotion: false, lowPowerForced: false
};

let state = null;
let running = false;
let lastTs = 0;
let accumulator = 0;

// ─── Persistence (via SharedStorage) ─────────────────────────
function loadScores()   { return window.SharedStorage.safeGet(KEYS.scores, {}); }
function saveScores(s)  { window.SharedStorage.safeSet(KEYS.scores, s); }
function loadSettings() {
  return Object.assign({}, SETTINGS_DEFAULTS, window.SharedStorage.safeGet(KEYS.settings, {}));
}
function saveSettings(s) { window.SharedStorage.safeSet(KEYS.settings, s); }
function tutorialSeen()    { return !!window.SharedStorage.safeGet(KEYS.tutorialSeen, false); }
function markTutorialSeen() { window.SharedStorage.safeSet(KEYS.tutorialSeen, true); }

function totalStars() {
  const all = loadScores();
  let n = 0;
  Object.values(all).forEach(map => Object.values(map).forEach(d => { n += d.stars || 0; }));
  return n;
}
function isMapUnlocked(mapId) {
  const map = window.CTD3Maps.byId(mapId);
  return totalStars() >= (map ? map.unlockRequirement : 0);
}
function isHardUnlocked(_mapId) {
  // 2 difficulties only — both available if map is unlocked. Kept for API parity.
  return true;
}
function commitResult(mapId, difficulty, stars, score) {
  const all = loadScores();
  const cur = (all[mapId] && all[mapId][difficulty]) || { stars: 0, bestScore: 0 };
  if (stars > cur.stars || (stars === cur.stars && score > cur.bestScore)) {
    all[mapId] = all[mapId] || {};
    all[mapId][difficulty] = {
      stars: Math.max(cur.stars, stars),
      bestScore: Math.max(cur.bestScore, score)
    };
    saveScores(all);
  }
  return (all[mapId] && all[mapId][difficulty] && all[mapId][difficulty].bestScore) || score;
}

// ─── Boot ────────────────────────────────────────────────────
async function start() {
  // Renderer + scene + lighting first
  const canvas = document.getElementById('canvas');
  window.CTD3Renderer.init(canvas);
  window.CTD3Scene.init();
  window.CTD3Lighting.init(window.CTD3Scene.getScene());

  // Low-power wiring
  window.CTD3Renderer.onLowPowerChange((on) => window.CTD3Scene.setLowPowerShadows(on));

  // UI
  window.CTD3Ui.init();

  // Settings → audio + render
  const settings = loadSettings();
  window.CTD3Audio.setMusicVolume(settings.musicVolume);
  window.CTD3Audio.setSfxVolume(settings.sfxVolume);
  window.CTD3Audio.setAmbientVolume(settings.ambientVolume);
  window.CTD3Audio.setMusicMuted(settings.musicMuted);
  window.CTD3Audio.setSfxMuted(settings.sfxMuted);
  window.CTD3Ui.setReducedMotion(settings.reducedMotion);
  if (settings.lowPowerForced) window.CTD3Renderer.setLowPower(true);

  // Input
  window.CTD3Input.init({ getState: () => state, actions });

  // Event delegation
  wireDocument();

  // First-load notice (for users with old 2D scores)
  window.CTD3Ui.showFirstLoadNoticeIfNeeded();

  // Asset preload (graceful when manifest missing)
  window.CTD3Ui.setLoadingProgress(20, 'Loading scene…');
  await window.CTD3Assets.preload();
  window.CTD3Ui.setLoadingProgress(100, 'Ready');

  // Pre-paint map-select
  refreshMapSelect();

  // First-click audio unlock
  document.addEventListener('click', firstClickAudio, { once: true });

  // Begin idle render loop (renders the canvas even on title screen)
  running = true;
  lastTs = performance.now();
  requestAnimationFrame(tick);

  // Show title
  window.CTD3Ui.setScreen('title');
}

function firstClickAudio() {
  window.CTD3Audio.ensure();
  window.CTD3Audio.resume();
  const s = loadSettings();
  if (!s.musicMuted) {
    window.CTD3Audio.startBGM();
    window.CTD3Audio.startAmbient();
  }
}

function refreshMapSelect() {
  window.CTD3Ui.hydrateMapSelect(loadScores(), isMapUnlocked, isHardUnlocked, totalStars);
}

// ─── FSM transitions ─────────────────────────────────────────
function go(screen) {
  window.CTD3Ui.setScreen(screen);
  if (screen === 'map-select') refreshMapSelect();
}

function startMap(mapId, difficulty) {
  if (!isMapUnlocked(mapId)) return;
  const useTutorial = !tutorialSeen() && mapId === 'plains';
  state = window.CTD3Engine.createState(mapId, difficulty, { tutorial: useTutorial });
  window.CTD3Scene.clearPlayfield();
  window.CTD3Scene.paintTerrain(state.mapDef);
  window.CTD3Ui.update(state);
  window.CTD3Ui.setScreen(state.tutorialActive ? 'tutorial' : 'play');
  window.CTD3Lighting.beginPhase('prepWave', 600);
}

function backToMapSelect() {
  state = null;
  window.CTD3Scene.clearPlayfield();
  go('map-select');
}

// ─── Document event delegation ──────────────────────────────
function wireDocument() {
  document.addEventListener('click', (ev) => {
    const goEl = ev.target.closest('[data-go]');
    if (goEl) { ev.preventDefault(); go(goEl.dataset.go); return; }
    const actionEl = ev.target.closest('[data-action]');
    if (actionEl) { ev.preventDefault(); handleAction(actionEl.dataset.action, actionEl); }
  });
}

function handleAction(name, el) {
  switch (name) {
    case 'show-help':                                                                break;  // no-op stub for v1
    case 'select-tower':           if (state) actions.selectTower(el.dataset.tower); break;
    case 'upgrade':                actions.upgrade(); break;
    case 'sell':                   actions.sell(); break;
    case 'send-next-wave':         actions.sendNextWave(); break;
    case 'toggle-fast-forward':    actions.toggleFastForward(); break;
    case 'pause':                  actions.pause(); break;
    case 'resume':                 actions.resume(); break;
    case 'restart':                actions.restart(); break;
    case 'play-again':             actions.restart(); break;
    case 'quit-to-map-select':     backToMapSelect(); break;
    case 'dismiss-tutorial':       actions.dismissTutorial(); break;
    case 'start-map':              startMap(el.dataset.mapId, el.dataset.difficulty || 'quiet'); break;
    case 'dismiss-first-load-notice': window.CTD3Ui.dismissFirstLoadNotice(); break;
  }
}

// ─── Actions bag ─────────────────────────────────────────────
const actions = {
  go,
  selectTower(type) {
    if (!state) return;
    window.CTD3Engine.setPaletteSelection(state, type);
    window.CTD3Audio.play('ui_click', { gain: 0.5 });
  },
  selectSlot(slotId) {
    if (!state) return;
    if (state.paletteSelection) {
      const result = window.CTD3Engine.place(state, slotId, state.paletteSelection);
      // Engine return enum caller contract (ADR-028 §8)
      if (result === 'unaffordable') window.CTD3Ui.setGoldFlash(true);
      // 'invalid' and 'occupied' are silent
    } else {
      window.CTD3Engine.selectSlot(state, slotId);
    }
  },
  selectTowerInstance(towerId) {
    if (!state) return;
    window.CTD3Engine.selectTower(state, towerId);
  },
  cancelSelection() {
    if (!state) return;
    window.CTD3Engine.setPaletteSelection(state, null);
    window.CTD3Engine.selectTower(state, null);
    state.hoverSlotId = null;
  },
  upgrade() {
    if (!state || !state.selectedTowerId) return;
    const result = window.CTD3Engine.upgrade(state, state.selectedTowerId);
    if (result === 'unaffordable') window.CTD3Ui.setGoldFlash(true);
  },
  sell() {
    if (!state || !state.selectedTowerId) return;
    window.CTD3Engine.sell(state, state.selectedTowerId);
  },
  sendNextWave() {
    if (!state) return;
    window.CTD3Engine.sendNextWave(state);
  },
  toggleFastForward() {
    if (!state) return;
    window.CTD3Engine.setFastForward(state);
  },
  pause() {
    if (!state) return;
    if (state.fsm === 'wonRun' || state.fsm === 'lostRun') return;
    window.CTD3Ui.setScreen('pause');
  },
  resume() {
    if (!state) return;
    window.CTD3Ui.setScreen(state.tutorialActive && state.tutorialStep !== 'done' ? 'tutorial' : 'play');
  },
  restart() {
    if (!state) return;
    const m = state.mapId, d = state.difficulty;
    startMap(m, d);
  },
  dismissTutorial() {
    if (!state) return;
    state.tutorialStep = 'done';
    state.tutorialActive = false;
    markTutorialSeen();
    window.CTD3Ui.setScreen('play');
  }
};

// ─── Tick ────────────────────────────────────────────────────
function tick(ts) {
  if (!running) return;
  const dtRaw = Math.min(250, ts - lastTs);
  lastTs = ts;
  const screen = document.body.getAttribute('data-screen');
  const isPlaying = (screen === 'play' || screen === 'tutorial');
  const dt = dtRaw * (state && state.fastForward ? 2 : 1);

  // Always-on
  window.CTD3Lighting.update(dtRaw);
  window.CTD3Renderer.trackFrame(dtRaw);

  if (isPlaying && state) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP_MS && steps < 5) {
      window.CTD3Engine.step(state, FIXED_STEP_MS);
      accumulator -= FIXED_STEP_MS;
      steps++;
    }
    consumeEngineEvents(state);
    window.CTD3Scene.sync(state);
    window.CTD3Ui.update(state);
    if (state.fsm === 'wonRun' || state.fsm === 'lostRun') showGameOver(state);
  } else {
    accumulator = 0;
  }

  // Render every frame regardless of FSM (lets title screen show the scene)
  window.CTD3Renderer.renderFrame(window.CTD3Scene.getScene());
  requestAnimationFrame(tick);
}

function consumeEngineEvents(state) {
  if (!state.events.length) return;
  window.CTD3Audio.flushEvents(state.events);
  for (const ev of state.events) {
    if (ev.kind === 'waveClear') {
      window.CTD3Ui.flashWaveClear();
    } else if (ev.kind === 'phaseTransition') {
      window.CTD3Lighting.beginPhase(ev.to, 1200);
    }
  }
  state.events.length = 0;
}

function showGameOver(state) {
  if (state._goSettled) return;
  state._goSettled = true;
  const won = state.fsm === 'wonRun';
  const stars = window.CTD3Engine.computeStars(state);
  const score = window.CTD3Engine.computeScore(state);
  const mapDef = state.mapDef;
  const best = won ? commitResult(state.mapId, state.difficulty, stars, score) : score;
  window.CTD3Ui.fillGameOver({
    won, stars, score,
    bestScore: Math.max(score, best),
    mapName: mapDef.displayName,
    difficulty: state.difficulty,
    livesRemaining: state.lives,
    startLives: state.startingLives
  });
  window.CTD3Ui.setScreen('game-over');
}

// ─── Public surface ──────────────────────────────────────────
window.CastleTowerDefense = {
  start,
  _test: new URLSearchParams(location.search).has('test') ? {
    getState: () => state,
    setLives: (n) => { if (state) state.lives = n; },
    grantGold: (n) => { if (state) state.gold += n; },
    jumpToWave: (idx) => { if (state) { state.waveIndex = idx; state.fsm = 'prepWave'; } }
  } : undefined
};

// Auto-boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
