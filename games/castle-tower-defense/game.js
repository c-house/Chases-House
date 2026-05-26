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
  Object.entries(all).forEach(([mapId, map]) => {
    if (mapId.startsWith('user:')) return;
    Object.values(map).forEach(d => { n += d.stars || 0; });
  });
  return n;
}
function isMapUnlocked(mapId) {
  const map = window.CTD3Maps.byId(mapId);
  if (!map) return false;
  if (map.source === 'user') return true;
  return totalStars() >= map.unlockRequirement;
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

  // ?test=1 overlay
  if (new URLSearchParams(location.search).has('test')) {
    const overlay = document.getElementById('test-overlay');
    if (overlay) overlay.style.display = 'block';
  }

  // ?test=tile-debug — R1 visual gate (ADR-030 §21). Bypass normal map
  // flow and render the tile-rotation reference grid near the origin.
  // Path tile assets are background-loaded after critical preload, so we
  // paint once on onReady (placeholders if not yet cached) then refresh
  // a few times until the meshes have actually been parsed in.
  if ((new URLSearchParams(location.search).get('test') || '') === 'tile-debug') {
    window.CTD3Assets.onReady(() => {
      window.CTD3Scene.paintTileDebug();
      window.CTD3Ui.setScreen('play');
      // Repaint with real meshes as background fetches complete.
      let attempts = 0;
      const refresh = () => {
        attempts += 1;
        window.CTD3Scene.paintTileDebug();
        if (attempts < 8) setTimeout(refresh, 500);
      };
      setTimeout(refresh, 400);
    });
  }
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
  if (window.CTD3Renderer && typeof window.CTD3Renderer.resetPan === 'function') {
    window.CTD3Renderer.resetPan();
  }
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
  wireSettings();
}

function wireSettings() {
  const settings = loadSettings();
  const bind = (key) => document.querySelector(`[data-bind="${key}"]`);
  const sliders = [
    { slider: bind('slider-music'),   value: bind('value-music'),   key: 'musicVolume',   apply: window.CTD3Audio.setMusicVolume },
    { slider: bind('slider-sfx'),     value: bind('value-sfx'),     key: 'sfxVolume',     apply: window.CTD3Audio.setSfxVolume },
    { slider: bind('slider-ambient'), value: bind('value-ambient'), key: 'ambientVolume', apply: window.CTD3Audio.setAmbientVolume }
  ];
  sliders.forEach(({ slider, value, key, apply }) => {
    if (!slider) return;
    const initVal = Math.round((settings[key] ?? 0.5) * 100);
    slider.value = String(initVal);
    if (value) value.textContent = initVal + '%';
    slider.addEventListener('input', () => {
      const v = parseInt(slider.value, 10);
      if (value) value.textContent = v + '%';
      const s = loadSettings();
      s[key] = v / 100;
      saveSettings(s);
      apply(v / 100);
    });
  });

  const rm = document.querySelector('[data-bind="reduced-motion-toggle"]');
  if (rm) {
    rm.checked = !!settings.reducedMotion;
    rm.addEventListener('change', () => {
      const s = loadSettings();
      s.reducedMotion = rm.checked;
      saveSettings(s);
      window.CTD3Ui.setReducedMotion(rm.checked);
    });
  }

  const lp = document.querySelector('[data-bind="low-power-toggle"]');
  if (lp) {
    lp.checked = !!settings.lowPowerForced;
    lp.addEventListener('change', () => {
      const s = loadSettings();
      s.lowPowerForced = lp.checked;
      saveSettings(s);
      window.CTD3Renderer.setLowPower(lp.checked);
    });
  }
}

function handleAction(name, el) {
  switch (name) {
    case 'show-help':              window.CTD3Ui.fillHelpScreen(); window.CTD3Ui.setScreen('help'); window.CTD3Audio.uiSfx('click'); break;
    case 'dismiss-help':           window.CTD3Ui.setScreen('title'); window.CTD3Audio.uiSfx('click'); break;
    case 'select-tower':           if (state) actions.selectTower(el.dataset.tower); break;
    case 'upgrade':                actions.upgrade(); break;
    case 'sell':                   actions.sell(); break;
    case 'send-next-wave':         actions.sendNextWave(); break;
    case 'toggle-fast-forward':    actions.toggleFastForward(); break;
    case 'pause':                  actions.pause(); window.CTD3Audio.uiSfx('click'); break;
    case 'resume':                 actions.resume(); window.CTD3Audio.uiSfx('click'); break;
    case 'restart':                actions.restart(); window.CTD3Audio.uiSfx('click'); break;
    case 'play-again':             actions.restart(); window.CTD3Audio.uiSfx('click'); break;
    case 'show-restart-confirm':   window.CTD3Ui.setScreen('restart-confirm'); window.CTD3Audio.uiSfx('click'); break;
    case 'confirm-restart':        actions.restart(); window.CTD3Audio.uiSfx('click'); break;
    case 'cancel-restart':         window.CTD3Ui.setScreen('pause'); window.CTD3Audio.uiSfx('click'); break;
    case 'quit-to-map-select':     backToMapSelect(); window.CTD3Audio.uiSfx('click'); break;
    case 'dismiss-tutorial':       actions.dismissTutorial(); window.CTD3Audio.uiSfx('click'); break;
    case 'start-map':              startMap(el.dataset.mapId, el.dataset.difficulty || 'quiet'); window.CTD3Audio.uiSfx('click'); break;
    case 'dismiss-first-load-notice': window.CTD3Ui.dismissFirstLoadNotice(); window.CTD3Audio.uiSfx('click'); break;
    case 'sheet-close':            window.CTD3Ui.closeSheets(); window.CTD3Audio.uiSfx('click'); break;
    case 'sheet-pick': {
      const slotId = window.CTD3Ui.getSheetSlotId();
      const towerType = el.dataset.tower;
      if (slotId && towerType) actions.placeFromSheet(slotId, towerType);
      window.CTD3Audio.uiSfx('click');
      break;
    }
    case 'test-grant-gold': if (window.CastleTowerDefense._test) window.CastleTowerDefense._test.grantGold(500); break;
    case 'test-set-lives':  if (window.CastleTowerDefense._test && state) state.lives = Math.min(99, state.lives + 10); break;
    case 'test-jump-last':
      if (state) { state.waveIndex = state.waveTotal - 1; state.fsm = 'prepWave'; }
      break;
    case 'test-kill-all':
      if (state) { state.enemies.forEach(en => { en.hp = 0; }); }
      break;
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
      if (result === 'unaffordable') {
        window.CTD3Ui.setGoldFlash(true);
        window.CTD3Audio.uiSfx('error');
      }
      // 'invalid' and 'occupied' are silent
    } else {
      // No palette selection → open slot-select action sheet
      const occupied = state.towers.some(t => t.slotId === slotId);
      if (occupied) {
        // Tap on occupied slot → open tower sheet instead
        const tw = state.towers.find(t => t.slotId === slotId);
        if (tw) {
          window.CTD3Engine.selectTower(state, tw.id);
          window.CTD3Ui.openTowerSheet(tw, state.gold);
        }
      } else {
        window.CTD3Engine.selectSlot(state, slotId);
        window.CTD3Ui.openSlotSheet(slotId, state.gold);
      }
    }
  },
  selectTowerInstance(towerId) {
    if (!state) return;
    window.CTD3Engine.selectTower(state, towerId);
    const tw = state.towers.find(t => t.id === towerId);
    if (tw) window.CTD3Ui.openTowerSheet(tw, state.gold);
  },
  placeFromSheet(slotId, towerType) {
    if (!state) return;
    const result = window.CTD3Engine.place(state, slotId, towerType);
    if (result === 'unaffordable') {
      window.CTD3Ui.setGoldFlash(true);
      window.CTD3Audio.uiSfx('error');
    }
    if (result === 'ok') {
      window.CTD3Ui.closeSheets();
      window.CTD3Audio.uiSfx('click');
    }
  },
  cancelSelection() {
    if (!state) return;
    window.CTD3Engine.setPaletteSelection(state, null);
    window.CTD3Engine.selectTower(state, null);
    state.hoverSlotId = null;
    window.CTD3Ui.closeSheets();
  },
  upgrade() {
    if (!state || !state.selectedTowerId) return;
    const result = window.CTD3Engine.upgrade(state, state.selectedTowerId);
    if (result === 'unaffordable') {
      window.CTD3Ui.setGoldFlash(true);
      window.CTD3Audio.uiSfx('error');
    }
    if (result === 'ok') {
      window.CTD3Audio.uiSfx('click');
      // Repaint the open tower sheet (if any) with the new tier's stats
      const tw = state.towers.find(t => t.id === state.selectedTowerId);
      if (tw && window.CTD3Ui.getActiveSheet() === 'tower') {
        window.CTD3Ui.paintTowerSheet(tw, state.gold);
      }
    }
  },
  sell() {
    if (!state || !state.selectedTowerId) return;
    const result = window.CTD3Engine.sell(state, state.selectedTowerId);
    if (result === 'unaffordable') window.CTD3Audio.uiSfx('error');
    if (result === 'ok') {
      window.CTD3Ui.closeSheets();
      window.CTD3Audio.uiSfx('click');
    }
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
  updateTestOverlay(dtRaw);
  requestAnimationFrame(tick);
}

const _fpsSmoothing = { samples: [], cap: 30 };
function updateTestOverlay(dtMs) {
  const overlay = document.getElementById('test-overlay');
  if (!overlay || overlay.style.display === 'none') return;
  _fpsSmoothing.samples.push(dtMs);
  if (_fpsSmoothing.samples.length > _fpsSmoothing.cap) _fpsSmoothing.samples.shift();
  const avg = _fpsSmoothing.samples.reduce((a, v) => a + v, 0) / _fpsSmoothing.samples.length;
  const fps = Math.round(1000 / Math.max(0.1, avg));
  const ft = avg.toFixed(1);
  const set = (k, v) => {
    const e = overlay.querySelector(`[data-bind="${k}"]`);
    if (e) e.textContent = String(v);
  };
  set('test-fps', fps);
  set('test-ft', ft);
  set('test-low-power', window.CTD3Renderer.isLowPower() ? 'low' : 'norm');
  set('test-towers',  state ? state.towers.length : 0);
  set('test-enemies', state ? state.enemies.length : 0);
  set('test-projs',   state ? state.projectiles.length : 0);
}

function consumeEngineEvents(state) {
  if (!state.events.length) return;
  window.CTD3Audio.flushEvents(state.events);
  for (const ev of state.events) {
    if (ev.kind === 'waveClear') {
      window.CTD3Ui.flashWaveClear();
    } else if (ev.kind === 'phaseTransition') {
      window.CTD3Lighting.beginPhase(ev.to, 1200);
    } else if (ev.kind === 'fire' && ev.towerId) {
      window.CTD3Scene.flashTower(ev.towerId);
    } else if (ev.kind === 'place') {
      // Auto-dismiss the tutorial screen on first successful placement —
      // engine.place clears tutorialActive but doesn't touch the screen
      // attribute. Without this, the tutorial popup overlay would linger
      // after the user did the exact action the prompt instructed.
      if (!state.tutorialActive && window.CTD3Ui.getScreen() === 'tutorial') {
        markTutorialSeen();
        window.CTD3Ui.setScreen('play');
      }
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
  // Best: on win, commitResult both persists + returns the post-update best.
  // On loss, READ the prior persisted best so the modal doesn't mislead the
  // player into thinking their losing score IS their best (audit T1).
  let best;
  if (won) {
    best = commitResult(state.mapId, state.difficulty, stars, score);
  } else {
    const all = loadScores();
    best = (all[state.mapId] && all[state.mapId][state.difficulty] && all[state.mapId][state.difficulty].bestScore) || 0;
  }
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
