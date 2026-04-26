/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense — game.js
   Boot module: owns FSM, rAF tick loop, document event delegation,
   localStorage persistence, audio bring-up.
   Public surface: window.CastleTowerDefense.start()

   LOCALSTORAGE NOTE: This is the 7th caller of localStorage in the
   chases.house codebase (after crossword, jeopardy×2, pacman, snake,
   sudoku). ADR-023 §13 flagged a future shared helper at this point.
   Recommend a follow-up ADR to extract a typed key/value helper.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const FIXED_STEP_MS = 1000 / 60;

  let state = null;
  let running = false;
  let lastTs = 0;
  let accumulator = 0;
  let goldDeficitFlashUntil = 0;

  // ─── Persistence ─────────────────────────────────────────────
  const KEYS = {
    scores:        'ctd:scores',
    settings:      'ctd:settings',
    tutorialSeen:  'ctd:tutorialSeen'
  };

  function loadScores() {
    try { return JSON.parse(localStorage.getItem(KEYS.scores)) || {}; } catch (e) { return {}; }
  }
  function saveScores(scores) {
    try { localStorage.setItem(KEYS.scores, JSON.stringify(scores)); } catch (e) {}
  }
  function loadSettings() {
    try {
      return Object.assign(
        { musicVolume: 0.4, sfxVolume: 0.8, musicMuted: false, sfxMuted: false, reducedMotion: false },
        JSON.parse(localStorage.getItem(KEYS.settings)) || {}
      );
    } catch (e) {
      return { musicVolume: 0.4, sfxVolume: 0.8, musicMuted: false, sfxMuted: false, reducedMotion: false };
    }
  }
  function saveSettings(s) { try { localStorage.setItem(KEYS.settings, JSON.stringify(s)); } catch (e) {} }
  function tutorialSeen() { try { return localStorage.getItem(KEYS.tutorialSeen) === '1'; } catch (e) { return false; } }
  function markTutorialSeen() { try { localStorage.setItem(KEYS.tutorialSeen, '1'); } catch (e) {} }

  function totalStars() {
    const all = loadScores();
    let n = 0;
    Object.values(all).forEach(map => Object.values(map).forEach(d => n += d.stars || 0));
    return n;
  }
  function isMapUnlocked(mapId) {
    const map = window.CTDMaps.byId(mapId);
    return totalStars() >= (map ? map.unlockRequirement : 0);
  }
  function isHardUnlocked(mapId) {
    const all = loadScores();
    return ((all[mapId] && all[mapId].normal && all[mapId].normal.stars) || 0) >= 3;
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
  function start() {
    window.CTDRender.init();

    // Initial settings → audio + render
    const settings = loadSettings();
    window.CTDAudio.setMusicVolume(settings.musicVolume);
    window.CTDAudio.setSfxVolume(settings.sfxVolume);
    window.CTDAudio.setMusicMuted(settings.musicMuted);
    window.CTDAudio.setSfxMuted(settings.sfxMuted);
    window.CTDRender.setReducedMotion(settings.reducedMotion);
    syncSettingsControls(settings);

    window.CTDInput.init({
      getState: () => state,
      actions: actions
    });

    wireDocument();

    // hydrate map-select up front so it's ready when user navigates there
    refreshMapSelect();

    // first-click audio unlock + BGM bring-up
    document.addEventListener('click', firstClickAudioBoot, { once: true });

    // begin idle tick (drives gamepad polling on title/map-select too)
    running = true;
    lastTs = performance.now();
    requestAnimationFrame(tick);
  }

  function firstClickAudioBoot() {
    window.CTDAudio.ensure();
    window.CTDAudio.resume();
    const settings = loadSettings();
    if (!settings.musicMuted) window.CTDAudio.startBGM();
  }

  function syncSettingsControls(settings) {
    const rm = document.getElementById('rmToggle');
    if (rm) {
      rm.classList.toggle('on', settings.reducedMotion);
      rm.setAttribute('aria-pressed', String(settings.reducedMotion));
    }
    const sliders = document.querySelectorAll('.pause-settings .slider-row');
    if (sliders.length >= 1) {
      const music = sliders[0].querySelector('input[type="range"]');
      if (music) {
        music.value = String(Math.round(settings.musicVolume * 100));
        sliders[0].querySelector('.v').textContent = String(music.value);
      }
    }
    if (sliders.length >= 2) {
      const sfx = sliders[1].querySelector('input[type="range"]');
      if (sfx) {
        sfx.value = String(Math.round(settings.sfxVolume * 100));
        sliders[1].querySelector('.v').textContent = String(sfx.value);
      }
    }
  }

  function refreshMapSelect() {
    window.CTDRender.hydrateMapSelect(loadScores(), isMapUnlocked, isHardUnlocked, totalStars);
  }

  // ─── FSM transitions ─────────────────────────────────────────
  function go(screen) {
    window.CTDRender.setScreen(screen);
    if (screen === 'map-select') refreshMapSelect();
  }

  function startMap(mapId, difficulty) {
    const map = window.CTDMaps.byId(mapId);
    if (!map) return;
    if (!isMapUnlocked(mapId)) return;
    if (difficulty === 'hard' && !isHardUnlocked(mapId)) return;
    const useTutorial = !tutorialSeen() && mapId === 'plains';
    state = window.CTDEngine.createState(mapId, difficulty, { tutorial: useTutorial });
    window.CTDRender.clearPlayfield();
    window.CTDRender.paintTerrain(state);
    window.CTDRender.updateHUD(state);
    if (state.tutorialActive) {
      window.CTDRender.setScreen('tutorial');
    } else {
      window.CTDRender.setScreen('play');
    }
  }

  function backToMapSelect() {
    state = null;
    window.CTDRender.clearPlayfield();
    go('map-select');
  }

  // ─── Document event delegation ───────────────────────────────
  function wireDocument() {
    document.addEventListener('click', (ev) => {
      const goEl = ev.target.closest('[data-go]');
      if (goEl) {
        ev.preventDefault();
        go(goEl.dataset.go);
        return;
      }
      const actionEl = ev.target.closest('[data-action]');
      if (actionEl) {
        ev.preventDefault();
        handleAction(actionEl.dataset.action, actionEl, ev);
      }
    });

    // Pause settings sliders
    const sliders = document.querySelectorAll('.pause-settings .slider-row');
    if (sliders[0]) {
      const r = sliders[0].querySelector('input[type="range"]');
      if (r) r.addEventListener('input', () => {
        const v = parseInt(r.value, 10) / 100;
        const s = loadSettings(); s.musicVolume = v; saveSettings(s);
        window.CTDAudio.setMusicVolume(v);
        sliders[0].querySelector('.v').textContent = r.value;
      });
    }
    if (sliders[1]) {
      const r = sliders[1].querySelector('input[type="range"]');
      if (r) r.addEventListener('input', () => {
        const v = parseInt(r.value, 10) / 100;
        const s = loadSettings(); s.sfxVolume = v; saveSettings(s);
        window.CTDAudio.setSfxVolume(v);
        sliders[1].querySelector('.v').textContent = r.value;
      });
    }
  }

  function handleAction(name, el, ev) {
    switch (name) {
      case 'select-tower':
        if (state) actions.selectTower(el.dataset.tower);
        break;
      case 'select-slot':
        if (state) actions.selectSlot(el.dataset.slotId);
        break;
      case 'select-tower-instance': {
        if (!state) return;
        const node = ev.target.closest('[data-tower-id]');
        if (node) actions.selectTowerInstance(node.dataset.towerId);
        break;
      }
      case 'upgrade':       actions.upgrade(); break;
      case 'sell':          actions.sell(); break;
      case 'send-next-wave': actions.sendNextWave(); break;
      case 'toggle-fast-forward': actions.toggleFastForward(); break;
      case 'pause':         actions.pause(); break;
      case 'resume':        actions.resume(); break;
      case 'restart':       actions.restart(); break;
      case 'play-again':    actions.restart(); break;
      case 'next-map':      actions.nextMap(); break;
      case 'quit-to-map-select': backToMapSelect(); break;
      case 'dismiss-tutorial': actions.dismissTutorial(); break;
      case 'start-map':     startMap(el.dataset.mapId, el.dataset.difficulty || 'normal'); break;
      case 'show-help':     document.body.classList.add('show-help'); break;
      case 'dismiss-help':  document.body.classList.remove('show-help'); break;
    }
    // Reduced-motion toggle button
    if (el.id === 'rmToggle') {
      const on = document.body.classList.toggle('reduced-motion');
      window.CTDRender.setReducedMotion(on);
      const s = loadSettings(); s.reducedMotion = on; saveSettings(s);
    }
  }

  // ─── Action handlers (mutate state through engine) ──────────
  const actions = {
    go,
    selectTower(type) {
      if (!state) return;
      window.CTDEngine.setPaletteSelection(state, type);
      window.CTDAudio.play('ui_click', { gain: 0.5 });
    },
    selectSlot(slotId) {
      if (!state) return;
      // If a palette tower is selected, attempt placement.
      if (state.paletteSelection) {
        const ok = window.CTDEngine.place(state, slotId, state.paletteSelection);
        if (!ok) goldDeficitFlashUntil = performance.now() + 800;
      } else {
        window.CTDEngine.selectSlot(state, slotId);
      }
    },
    selectTowerInstance(towerId) {
      if (!state) return;
      window.CTDEngine.selectTower(state, towerId);
    },
    upgrade() {
      if (!state || !state.selectedTowerId) return;
      window.CTDEngine.upgrade(state, state.selectedTowerId);
    },
    sell() {
      if (!state || !state.selectedTowerId) return;
      window.CTDEngine.sell(state, state.selectedTowerId);
    },
    sendNextWave() {
      if (!state) return;
      window.CTDEngine.sendNextWave(state);
    },
    toggleFastForward() {
      if (!state) return;
      window.CTDEngine.setFastForward(state);
      const btn = document.querySelector('[data-action="toggle-fast-forward"]');
      if (btn) btn.classList.toggle('active', state.fastForward);
    },
    pause() {
      if (!state) return;
      if (state.fsm === 'wonRun' || state.fsm === 'lostRun') return;
      window.CTDRender.setScreen('pause');
    },
    resume() {
      if (!state) return;
      if (state.tutorialActive && state.tutorialStep !== 'done') {
        window.CTDRender.setScreen('tutorial');
      } else {
        window.CTDRender.setScreen('play');
      }
    },
    restart() {
      if (!state) return;
      const m = state.mapId, d = state.difficulty;
      startMap(m, d);
    },
    nextMap() {
      if (!state) return;
      const idx = window.CTDMaps.MAPS.findIndex(x => x.id === state.mapId);
      const next = window.CTDMaps.MAPS[idx + 1];
      if (next && isMapUnlocked(next.id)) startMap(next.id, state.difficulty);
      else backToMapSelect();
    },
    dismissTutorial() {
      if (!state) return;
      state.tutorialStep = 'done';
      state.tutorialActive = false;
      markTutorialSeen();
      window.CTDRender.setScreen('play');
    },
    cyclePalette(dir) {
      if (!state) return;
      const order = ['archer', 'cannon', 'mage', 'frost'];
      const cur = state.paletteSelection;
      let i = cur ? order.indexOf(cur) : -1;
      i = (i + dir + order.length) % order.length;
      window.CTDEngine.setPaletteSelection(state, order[i]);
    },
    gamepadConfirm() {
      if (!state) return;
      // If hovering a slot and palette selected → place. Else if hovering a tower → select.
      if (state.hoverSlotId) {
        actions.selectSlot(state.hoverSlotId);
      }
    },
    gamepadCancel() {
      if (!state) return;
      window.CTDEngine.setPaletteSelection(state, null);
      window.CTDEngine.selectTower(state, null);
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

    // poll gamepad regardless of screen (lets START trigger pause from any state)
    if (state) window.CTDInput.pollGamepad(state, dtRaw);

    if (isPlaying && state) {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= FIXED_STEP_MS && steps < 5) {
        window.CTDEngine.step(state, FIXED_STEP_MS);
        accumulator -= FIXED_STEP_MS;
        steps++;
      }
      consumeEngineEvents(state);
      window.CTDRender.syncEntities(state);
      window.CTDRender.updateHUD(state);
      // Game-over transition
      if (state.fsm === 'wonRun' || state.fsm === 'lostRun') {
        showGameOver(state);
      }
    } else {
      accumulator = 0;
    }

    requestAnimationFrame(tick);
  }

  function consumeEngineEvents(state) {
    if (!state.events.length) return;
    // Audio
    window.CTDAudio.flushEvents(state.events);
    // Render flourishes
    for (const ev of state.events) {
      if (ev.kind === 'waveClear') {
        const map = window.CTDMaps.byId(state.mapId);
        const wave = map.waves[ev.waveIndex];
        const label = wave && wave.isBoss ? 'The Warlord Falls' : 'Wave Cleared';
        window.CTDRender.flashWaveClear(label);
        window.CTDRender.flyBird();
      } else if (ev.kind === 'castleHit') {
        window.CTDInput.rumble({ duration: 240, strongMagnitude: 0.7, weakMagnitude: 0.4 });
      } else if (ev.kind === 'fire') {
        // gentle rumble pulse — only if not muted; already wrapped in input.rumble
      } else if (ev.kind === 'victory') {
        window.CTDInput.rumble({ duration: 600, strongMagnitude: 0.5, weakMagnitude: 0.7 });
      } else if (ev.kind === 'defeat') {
        window.CTDInput.rumble({ duration: 800, strongMagnitude: 0.9, weakMagnitude: 0.4 });
      }
    }
    state.events.length = 0;
  }

  function showGameOver(state) {
    if (state._goSettled) return;
    state._goSettled = true;
    const won = state.fsm === 'wonRun';
    const stars = window.CTDEngine.computeStars(state);
    const score = window.CTDEngine.computeScore(state);
    const mapDef = state.mapDef;
    const best = won ? commitResult(state.mapId, state.difficulty, stars, score) : score;
    window.CTDRender.fillGameOver({
      won, stars, score, bestScore: Math.max(score, best),
      mapName: mapDef.displayName,
      difficulty: state.difficulty,
      livesRemaining: state.lives,
      startLives: state.startingLives
    });
    window.CTDRender.setScreen('game-over');
  }

  // ─── Public surface ─────────────────────────────────────────
  window.CastleTowerDefense = {
    start,
    // small testing helper, gated by ?test=1 in URL
    _test: new URLSearchParams(location.search).has('test') ? {
      getState: () => state,
      setLives: (n) => { if (state) state.lives = n; },
      grantGold: (n) => { if (state) state.gold += n; },
      jumpToWave: (idx) => { if (state) { state.waveIndex = idx; state.fsm = 'prepWave'; state.earlyBonusEligible = true; } }
    } : undefined
  };

  // Auto-boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
