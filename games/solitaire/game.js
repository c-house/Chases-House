/* ═══════════════════════════════════════════════════════════════
   Solitaire — game.js
   Entry point + state machine + localStorage + settings + stats.
   The single point that wires Engine ↔ Render ↔ Input ↔ Audio.
   Exposes window.SolitaireGame (for debugging only).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ENGINE = window.SolitaireEngine;
  const DEAL   = window.SolitaireDeal;
  const RENDER = window.SolitaireRender;
  const INPUT  = window.SolitaireInput;
  const AUDIO  = window.SolitaireAudio;

  const STORAGE = {
    state:    'chases-house:solitaire:state',
    settings: 'chases-house:solitaire:settings',
    stats:    'chases-house:solitaire:stats',
    tutorial: 'chases-house:solitaire:tutorial-seen'
  };

  const DIFFICULTY_PRESETS = {
    easy:   { drawSize: 1, redeals: 'inf',      scoring: 'untimed'  },
    medium: { drawSize: 1, redeals: 'inf',      scoring: 'standard' },
    hard:   { drawSize: 3, redeals: '3',        scoring: 'vegas'    }
  };

  // ── State ─────────────────────────────────────────────────────
  let state = null;             // engine state
  let settings = loadSettings();
  let stats = loadStats();
  let phase = 'loading';        // loading | playing | paused | won | ended
  let timerStart = 0;           // perf timestamp when last unpaused
  let elapsedAccum = 0;         // ms accumulated across pauses
  let timerRaf = 0;
  let dailyMoveMade = false;    // for engagement-streak rule
  let dailySeed = DEAL.dailySeed();
  let cascadeRunning = false;

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    RENDER.init();
    AUDIO.setMuted(!settings.sound);
    applySettingsToBody();
    applySettingsToInputs();

    INPUT.init(actions);
    INPUT.setState(null);   // until state is built

    // Restore mid-game if the saved seed matches today's daily; otherwise
    // generate a fresh deal at the saved settings (or defaults).
    const saved = loadGameState();
    if (saved) {
      state = saved;
      elapsedAccum = saved._elapsedMs || 0;
      dailyMoveMade = !!saved._dailyMoveMade;
    } else {
      newDeal(true);  // start with a daily seed
    }
    INPUT.setState(state);

    RENDER.drawAll(state);
    updateHud();
    refreshUndoRedoButtons();
    runTimer();
    phase = 'playing';

    // Tutorial — first-run only
    if (!localStorage.getItem(STORAGE.tutorial)) {
      // Defer slightly so the entrance animations finish first
      setTimeout(showTutorial, 700);
    }

    // Save on tab close so progress survives even without an explicit save
    window.addEventListener('beforeunload', saveGameState);
  }

  // ── New deal / restart ────────────────────────────────────────
  function newDeal(useDaily) {
    const seed = useDaily ? dailySeed : DEAL.randomSeed();
    const deck = DEAL.shuffledDeck(seed);
    state = ENGINE.newGame(deck, {
      drawSize: settings.drawSize,
      scoring: settings.scoring,
      redeals: settings.redeals,
      seed
    });
    elapsedAccum = 0;
    dailyMoveMade = false;
    INPUT.setState(state);
    RENDER.drawAll(state);
    updateHud();
    saveGameState();
    refreshUndoRedoButtons();
    stats.plays++;       // every fresh deal counts as one attempt
    saveStats();
    phase = 'playing';
  }

  function restartDeal() {
    if (!state || !state.seed) return newDeal(true);
    const deck = DEAL.shuffledDeck(state.seed);
    state = ENGINE.newGame(deck, {
      drawSize: settings.drawSize,
      scoring: settings.scoring,
      redeals: settings.redeals,
      seed: state.seed
    });
    elapsedAccum = 0;
    dailyMoveMade = false;
    INPUT.setState(state);
    RENDER.drawAll(state);
    updateHud();
    saveGameState();
    refreshUndoRedoButtons();
  }

  // ── Move plumbing — single chokepoint that updates render+sfx+save ──
  function tryMove(from, to, count) {
    AUDIO.resume();
    const ok = ENGINE.tryMove(state, from, to, count || 1);
    if (!ok) { AUDIO.dropIllegal(); return false; }

    // SFX
    if (to.startsWith('foundation-')) {
      const fdn = state.foundations[to.slice(11)];
      AUDIO.foundation(fdn.length);
    } else {
      AUDIO.dropLegal();
    }

    // Re-render the two affected piles and any pile that just had an
    // auto-flip happen (its top card may have changed face).
    RENDER.drawPile(state, from);
    RENDER.drawPile(state, to);
    afterMove();
    return true;
  }

  function afterMove() {
    dailyMoveMade = true;
    INPUT.setState(state);
    updateHud();
    refreshUndoRedoButtons();
    saveGameState();
    // Record engagement-streak interaction with the daily
    if (state.seed === dailySeed) recordDailyAttempt(dailySeed);

    if (state.won) celebrateWin();
  }

  function refreshUndoRedoButtons() {
    const undoBtn = document.querySelector('[data-action="undo"]');
    const redoBtn = document.querySelector('[data-action="redo"]');
    if (undoBtn) undoBtn.disabled = !state.undoStack.length;
    if (redoBtn) redoBtn.disabled = !state.redoStack.length;
  }

  // ── Win + cascade ─────────────────────────────────────────────
  function celebrateWin() {
    if (cascadeRunning) return;
    cascadeRunning = true;
    phase = 'won';
    stopTimer();
    AUDIO.cascadeFinale();
    // Update stats
    stats.wins++;
    if (state.scoring === 'standard' && (stats.bestTimeStdMs == null || elapsedAccum < stats.bestTimeStdMs)) {
      stats.bestTimeStdMs = elapsedAccum;
    }
    if (state.scoring === 'vegas' && (stats.bestVegas == null || state.score > stats.bestVegas)) {
      stats.bestVegas = state.score;
    }
    saveStats();

    // Bounce-loop SFX during cascade
    const bounceTimer = setInterval(() => AUDIO.cascadeBounce(), 220);

    RENDER.beginCascade(state, () => {
      clearInterval(bounceTimer);
      cascadeRunning = false;
      showWinModal();
      clearGameState(); // a won game shouldn't restore on next visit
    });
  }

  function showWinModal() {
    const overlay = document.getElementById('win-overlay');
    if (!overlay) return;
    const cells = overlay.querySelectorAll('.win-stat-value');
    if (cells[0]) cells[0].textContent = formatTime(elapsedAccum);
    if (cells[1]) cells[1].textContent = String(state.movesCount);
    if (cells[2]) cells[2].textContent = state.scoring === 'vegas'
      ? ((state.score >= 0 ? '+$' : '-$') + Math.abs(state.score))
      : String(state.score);
    const body = overlay.querySelector('.modal-body');
    if (body) {
      const isDaily = state.seed === dailySeed;
      if (isDaily) {
        body.innerHTML = 'Daily deal — <strong style="color:var(--text-primary)">streak now ' +
          stats.streak + ' day' + (stats.streak === 1 ? '' : 's') +
          '</strong>. Same seed available to anyone who plays today.';
      } else {
        body.innerHTML = 'Random deal cleared. Try the daily for a streak.';
      }
    }
    showOverlay(overlay, '[autofocus], .cta-primary');
  }

  // Show / hide a modal overlay with proper aria-hidden + focus management.
  function showOverlay(overlay, focusSelector) {
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    if (focusSelector) {
      const target = overlay.querySelector(focusSelector);
      if (target) target.focus();
    }
  }
  function hideOverlay(overlay) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }

  // ── Timer ─────────────────────────────────────────────────────
  function runTimer() {
    timerStart = performance.now();
    function tick() {
      if (phase === 'paused' || phase === 'won') { timerRaf = 0; return; }
      const now = performance.now();
      const total = elapsedAccum + (now - timerStart);
      RENDER.setHud(state, total, seedLabel());
      timerRaf = requestAnimationFrame(tick);
    }
    timerRaf = requestAnimationFrame(tick);
  }
  function stopTimer() {
    if (timerRaf) cancelAnimationFrame(timerRaf);
    timerRaf = 0;
    elapsedAccum += performance.now() - timerStart;
  }

  function updateHud() {
    const live = elapsedAccum + (timerRaf ? performance.now() - timerStart : 0);
    RENDER.setHud(state, live, seedLabel());
  }
  function seedLabel() {
    if (!state || !state.seed) return '';
    const num = DEAL.seedDealNumber(state.seed);
    const isDaily = state.seed === dailySeed;
    return (isDaily ? state.seed : 'Random') + ' · #' + num;
  }
  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  // ── Pause / menu ──────────────────────────────────────────────
  function pause() {
    if (phase !== 'playing') return;
    stopTimer();
    phase = 'paused';
  }
  function resume() {
    if (phase !== 'paused') return;
    phase = 'playing';
    runTimer();
  }

  // ── Settings persistence ──────────────────────────────────────
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE.settings);
      if (raw) return Object.assign(defaultSettings(), JSON.parse(raw));
    } catch (e) { /* fall through */ }
    return defaultSettings();
  }
  function defaultSettings() {
    return {
      difficulty: 'medium',
      drawSize:  1,
      redeals:   'inf',
      scoring:   'standard',
      fourColor: true,
      sound:     true
    };
  }
  function saveSettings() {
    try { localStorage.setItem(STORAGE.settings, JSON.stringify(settings)); } catch (e) { /* quota */ }
  }
  function applySettingsToBody() {
    document.body.classList.toggle('four-color', !!settings.fourColor);
    document.body.classList.toggle('diff-custom', settings.difficulty === 'custom');
  }
  function applySettingsToInputs() {
    const diffEl = document.getElementById('diff-' + settings.difficulty);
    if (diffEl) diffEl.checked = true;
    const drawEl = document.getElementById('draw-' + settings.drawSize);
    if (drawEl) drawEl.checked = true;
    const redealEl = document.getElementById('redeal-' + settings.redeals);
    if (redealEl) redealEl.checked = true;
    const scoreEl = document.getElementById('score-' + (settings.scoring === 'standard' ? 'std' : settings.scoring));
    if (scoreEl) scoreEl.checked = true;
    const fc = document.getElementById('opt-four-color');  if (fc)  fc.checked = !!settings.fourColor;
    const snd = document.getElementById('opt-sound');      if (snd) snd.checked = !!settings.sound;
  }

  // ── Persistent game state ─────────────────────────────────────
  function saveGameState() {
    if (!state) return;
    const payload = ENGINE.serialize(state);
    payload._elapsedMs = elapsedAccum + (timerRaf ? performance.now() - timerStart : 0);
    payload._dailyMoveMade = dailyMoveMade;
    try { localStorage.setItem(STORAGE.state, JSON.stringify(payload)); } catch (e) { /* quota */ }
  }
  function loadGameState() {
    try {
      const raw = localStorage.getItem(STORAGE.state);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const restored = ENGINE.deserialize(data);
      if (!restored || restored.won) return null;
      restored._elapsedMs = data._elapsedMs || 0;
      restored._dailyMoveMade = !!data._dailyMoveMade;
      return restored;
    } catch (e) { return null; }
  }
  function clearGameState() {
    try { localStorage.removeItem(STORAGE.state); } catch (e) { /* */ }
  }

  // ── Stats persistence ─────────────────────────────────────────
  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE.stats);
      if (raw) {
        const s = JSON.parse(raw);
        // attempted is stored as array → Set
        s.attempted = new Set(s.attempted || []);
        return Object.assign(defaultStats(), s);
      }
    } catch (e) { /* fall through */ }
    return defaultStats();
  }
  function defaultStats() {
    return {
      plays: 0, wins: 0,
      bestTimeStdMs: null, bestVegas: null,
      streak: 0, longestStreak: 0,
      attempted: new Set()        // 'YYYY-MM-DD' set of daily-seeds attempted
    };
  }
  function saveStats() {
    try {
      const s = Object.assign({}, stats, { attempted: Array.from(stats.attempted) });
      localStorage.setItem(STORAGE.stats, JSON.stringify(s));
    } catch (e) { /* */ }
  }

  // Engagement-streak: tick when the player makes ≥1 move on the day's daily
  function recordDailyAttempt(seed) {
    if (stats.attempted.has(seed)) return;
    stats.attempted.add(seed);
    // Update streak — was yesterday in the set?
    const today = parseDateSeed(seed);
    const yest = new Date(today);
    yest.setDate(today.getDate() - 1);
    const yestSeed = DEAL.dailySeed(yest);
    if (stats.attempted.has(yestSeed) || stats.streak === 0) {
      stats.streak = (stats.attempted.has(yestSeed) ? stats.streak : 0) + 1;
    } else {
      stats.streak = 1;
    }
    stats.longestStreak = Math.max(stats.longestStreak, stats.streak);
    saveStats();
  }
  function parseDateSeed(seed) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(seed);
    if (!m) return new Date();
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  // ── Tutorial ──────────────────────────────────────────────────
  function showTutorial() {
    const t = document.getElementById('tutorial');
    if (!t) return;
    // Position the bubble over the stock pile
    const stockEl = document.querySelector('.pile-stock');
    if (stockEl) {
      const rect = stockEl.getBoundingClientRect();
      const step = t.querySelector('.tutorial-step');
      if (step) {
        step.style.position = 'absolute';
        step.style.top  = (rect.bottom + 8) + 'px';
        step.style.left = (rect.left) + 'px';
      }
    }
    t.classList.remove('hidden');
    t.setAttribute('aria-hidden', 'false');
  }
  function hideTutorial() {
    const t = document.getElementById('tutorial');
    if (!t) return;
    t.classList.add('hidden');
    t.setAttribute('aria-hidden', 'true');
    try { localStorage.setItem(STORAGE.tutorial, '1'); } catch (e) { /* */ }
  }

  // ── Stats screen population ──────────────────────────────────
  function populateStatsScreen() {
    const overlay = document.getElementById('stats-overlay');
    if (!overlay) return;
    const winRate = stats.plays ? Math.round((stats.wins / stats.plays) * 100) : 0;
    const cells = overlay.querySelectorAll('.stat-cell-value');
    if (cells[0]) cells[0].textContent = String(stats.plays);
    if (cells[1]) cells[1].textContent = String(stats.wins);
    const subs = overlay.querySelectorAll('.stat-cell-sub');
    if (subs[0]) subs[0].textContent = winRate + '%';
    if (cells[2]) {
      const empty = stats.bestTimeStdMs == null;
      cells[2].textContent = empty ? '—' : formatTime(stats.bestTimeStdMs);
      cells[2].style.color = empty ? 'var(--text-faint)' : '';
    }
    if (cells[3]) {
      const empty = stats.bestVegas == null;
      cells[3].textContent = empty ? '—' : ((stats.bestVegas >= 0 ? '+$' : '-$') + Math.abs(stats.bestVegas));
      cells[3].style.color = empty ? 'var(--text-faint)' : '';
    }
    if (cells[4]) cells[4].textContent = String(stats.streak);
    if (cells[5]) cells[5].textContent = String(stats.longestStreak);

    // Calendar grid — current month
    const grid = overlay.querySelector('.calendar-grid');
    if (grid) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = today.getMonth();
      const monthName = today.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      const monthEl = overlay.querySelector('.calendar-month');
      if (monthEl) monthEl.textContent = monthName;
      const streakEl = overlay.querySelector('.calendar-streak');
      if (streakEl) streakEl.textContent = '● ' + stats.streak + '-day streak';
      const first = new Date(yyyy, mm, 1);
      const startDow = (first.getDay() + 6) % 7; // make Monday=0
      const dim = new Date(yyyy, mm + 1, 0).getDate();
      const cellsHtml = [
        '<span class="cal-dow">M</span><span class="cal-dow">T</span><span class="cal-dow">W</span>',
        '<span class="cal-dow">T</span><span class="cal-dow">F</span><span class="cal-dow">S</span><span class="cal-dow">S</span>'
      ];
      for (let i = 0; i < startDow; i++) cellsHtml.push('<span class="cal-day empty"></span>');
      for (let d = 1; d <= dim; d++) {
        const seed = yyyy + '-' + String(mm + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const cls = stats.attempted.has(seed) ? 'cal-day won' : 'cal-day';
        const today2 = (d === today.getDate());
        cellsHtml.push('<span class="' + cls + (today2 ? ' today' : '') + '">' + d + '</span>');
      }
      grid.innerHTML = cellsHtml.join('');
    }
  }

  // ── Actions exposed to input.js ───────────────────────────────
  const actions = {
    // Movement
    move: tryMove,
    autoFoundation: (from) => {
      AUDIO.resume();
      // Capture the suit BEFORE the move — after the engine moves the card,
      // the source's top changes (or auto-flips) and we'd lose the reference.
      const moving = ENGINE.topCard(state, from);
      if (!moving || !moving.faceUp) { AUDIO.dropIllegal(); return false; }
      const fdnId = 'foundation-' + moving.suit;
      const ok = ENGINE.tryAutoFoundation(state, from);
      if (!ok) { AUDIO.dropIllegal(); return false; }
      AUDIO.foundation(state.foundations[moving.suit].length);
      RENDER.drawPile(state, fdnId);
      RENDER.drawPile(state, from);
      afterMove();
      return true;
    },
    draw: () => {
      AUDIO.resume();
      const empty = state.stock.length === 0;
      const ok = ENGINE.draw(state);
      if (!ok) { AUDIO.dropIllegal(); return false; }
      if (empty) AUDIO.stockRecycle();
      else       AUDIO.stockDraw();
      RENDER.drawPile(state, 'stock');
      RENDER.drawPile(state, 'waste');
      afterMove();
      return true;
    },

    // Time travel
    undo: () => {
      AUDIO.resume();
      if (!ENGINE.undo(state)) return;
      AUDIO.undoSfx();
      RENDER.drawAll(state);
      INPUT.setState(state);
      updateHud();
      refreshUndoRedoButtons();
      saveGameState();
    },
    redo: () => {
      AUDIO.resume();
      if (!ENGINE.redo(state)) return;
      AUDIO.menuConfirm();
      RENDER.drawAll(state);
      INPUT.setState(state);
      updateHud();
      refreshUndoRedoButtons();
      saveGameState();
    },

    // Help
    hint: () => {
      AUDIO.resume();
      AUDIO.hintPulse();
      const h = ENGINE.findHint(state);
      RENDER.pulseHint(h);
    },

    // Pause / overlays
    'open-menu': () => {
      AUDIO.resume();
      AUDIO.menuConfirm();
      pause();
      showOverlay(document.getElementById('menu-overlay'), '.menu-item');
    },
    openMenu: () => actions['open-menu'](),
    'resume':  () => {
      hideOverlay(document.getElementById('menu-overlay'));
      resume();
    },
    'restart': () => {
      hideOverlay(document.getElementById('menu-overlay'));
      restartDeal();
      resume();
    },
    'new-game': () => {
      hideOverlay(document.getElementById('menu-overlay'));
      hideOverlay(document.getElementById('win-overlay'));
      newDeal(false);
      resume();
    },
    newGame: () => actions['new-game'](),
    'replay-seed': () => {
      hideOverlay(document.getElementById('win-overlay'));
      restartDeal();
      resume();
    },
    'open-stats': () => {
      AUDIO.menuConfirm();
      populateStatsScreen();
      showOverlay(document.getElementById('stats-overlay'), '.cta-primary');
    },
    'close-stats': () => {
      hideOverlay(document.getElementById('stats-overlay'));
    },
    'open-settings': () => {
      AUDIO.menuConfirm();
      const dr = document.getElementById('settings-drawer');
      dr.classList.add('open');
      dr.setAttribute('aria-hidden', 'false');
      document.body.classList.add('drawer-open');
    },
    'open-settings-from-menu': () => {
      document.getElementById('menu-overlay').classList.add('hidden');
      actions['open-settings']();
    },
    'close-drawer': () => {
      const dr = document.getElementById('settings-drawer');
      dr.classList.remove('open');
      dr.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('drawer-open');
    },
    'mute': () => {
      settings.sound = !settings.sound;
      AUDIO.setMuted(!settings.sound);
      saveSettings();
      const snd = document.getElementById('opt-sound');
      if (snd) snd.checked = settings.sound;
      // Update mute button icon (svg use href swap)
      const btn = document.querySelector('[data-action="mute"] .icn use');
      if (btn) btn.setAttribute('href', settings.sound ? '#ic-mute' : '#ic-mute-off');
    },
    'auto-complete': () => {
      // Step the engine one move at a time, animating
      function step() {
        if (!ENGINE.canAutoComplete(state)) {
          if (state.won) celebrateWin();
          return;
        }
        const m = ENGINE.autoCompleteStep(state);
        if (!m) { if (state.won) celebrateWin(); return; }
        AUDIO.foundation(state.foundations[m.to.slice(11)].length);
        RENDER.drawPile(state, m.from);
        RENDER.drawPile(state, m.to);
        updateHud();
        setTimeout(step, 110);
      }
      step();
    },

    // Settings
    setDifficulty: (val) => {
      settings.difficulty = val;
      if (val !== 'custom') {
        Object.assign(settings, DIFFICULTY_PRESETS[val]);
      }
      saveSettings();
      applySettingsToBody();
      applySettingsToInputs();
    },
    setRawSetting: (key, val) => {
      settings[key] = val;
      // Any raw change pops to "custom"
      settings.difficulty = 'custom';
      saveSettings();
      applySettingsToBody();
      applySettingsToInputs();
    },
    toggleFourColor: (on) => {
      settings.fourColor = !!on;
      saveSettings();
      applySettingsToBody();
    },
    toggleSound: (on) => {
      settings.sound = !!on;
      AUDIO.setMuted(!on);
      saveSettings();
    },

    // Tutorial
    'skip-tutorial': hideTutorial,
    'tutorial-next': hideTutorial,  // single-step v1 — just close on Next

    // Keyboard cursor — reuse the gold drop-target ring as the focus indicator.
    // Same visual semantics: "this pile is what your next action will hit."
    focusPile: (pileId) => {
      AUDIO.menuMove();
      RENDER.highlightDropTarget(pileId);
    }
  };

  document.addEventListener('DOMContentLoaded', init);

  window.SolitaireGame = {
    // for ad-hoc dev & for the cascade test from DevTools
    _state: () => state,
    _settings: () => settings,
    _stats: () => stats,
    _forceWin: () => {
      // dev hotkey: jam every card onto its foundation, then trigger cascade
      for (const s of ENGINE.SUITS) {
        state.foundations[s] = [];
        for (let r = 1; r <= 13; r++) state.foundations[s].push({ suit: s, rank: r, faceUp: true });
      }
      state.stock = []; state.waste = [];
      state.tableau = [[], [], [], [], [], [], []];
      state.won = true;
      RENDER.drawAll(state);
      celebrateWin();
    }
  };
})();
