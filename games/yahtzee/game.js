// ── Yahtzee · Game coordinator ────────────────────────────────────────
//
// State machine, screen transitions, render, input wiring, persistence.
// Owns the canonical state object; consumes Score, Dice, Audio, and
// SharedGamepad. Keep this file thin — the rule logic lives in score.js,
// the visual layer in dice.js. If a function gets >40 lines here, it
// probably wants to live in one of those modules instead.

(function () {
  'use strict';

  window.Yahtzee = window.Yahtzee || {};
  const S = window.Yahtzee.Score;
  const D = window.Yahtzee.Dice;
  const A = window.Yahtzee.Audio;
  const SG = window.SharedGamepad;

  const STORAGE_STATE = 'yahtzee-state';
  const STORAGE_HISCORE = 'yahtzee-high-scores';
  const STORAGE_PREFS = 'yahtzee-prefs';

  // ── State ───────────────────────────────────────────────────────────

  let state = null;            // null when on title / hiscores
  let setup = { mode: 'solo', count: 1, names: ['Player'] };
  let prefs = { reducedMotion: false, konamiArmed: false };
  let isRolling = false;       // animation lock
  let isFanfare = false;       // fanfare lock; defers next-turn
  let scorecardCursor = null;  // category key when keyboard-navigating

  // ── Persistence ─────────────────────────────────────────────────────

  function saveState() {
    if (!state || state.mode !== 'solo' || state.phase !== 'playing') return;
    try { localStorage.setItem(STORAGE_STATE, JSON.stringify(state)); } catch (_) { /* quota */ }
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_STATE);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s && s.phase === 'playing' && s.mode === 'solo' && s.players && s.players.length === 1) {
        return s;
      }
    } catch (_) { /* ignore */ }
    return null;
  }
  function clearState() { try { localStorage.removeItem(STORAGE_STATE); } catch (_) {} }
  function hasSavedGame() { return !!loadState(); }

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HISCORE);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) { return []; }
  }
  function saveHighScore(initials, score) {
    const list = loadHighScores();
    const date = new Date().toISOString().slice(0, 10);
    list.push({ initials: (initials || '???').toUpperCase().slice(0, 3), score, date });
    list.sort(function (a, b) { return b.score - a.score; });
    list.splice(10);
    try { localStorage.setItem(STORAGE_HISCORE, JSON.stringify(list)); } catch (_) {}
  }
  function isHighScore(score) {
    const list = loadHighScores();
    return list.length < 10 || score > list[list.length - 1].score;
  }

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_PREFS);
      if (raw) Object.assign(prefs, JSON.parse(raw));
    } catch (_) {}
    D.setReducedMotion(!!prefs.reducedMotion);
    if (prefs.reducedMotion) document.body.classList.add('reduced-motion');
  }
  function savePrefs() {
    try { localStorage.setItem(STORAGE_PREFS, JSON.stringify(prefs)); } catch (_) {}
  }

  // ── State factory ───────────────────────────────────────────────────

  function freshDice() {
    const d = [];
    for (let i = 0; i < 5; i++) d.push({ value: null, held: false });
    return d;
  }

  function newState(mode, names) {
    const players = names.map(function (n) {
      return { name: n.trim() || 'Player', scorecard: S.emptyScorecard(), bonusYahtzees: 0 };
    });
    return {
      phase: 'playing',
      mode: mode,
      players: players,
      currentPlayerIndex: 0,
      dice: freshDice(),
      rollsRemaining: 3
    };
  }

  // ── Screens ─────────────────────────────────────────────────────────

  function showScreen(name) {
    const screens = document.querySelectorAll('.screen');
    for (let i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    const target = document.querySelector('.screen[data-screen="' + name + '"]');
    if (target) target.classList.add('active');
  }
  function showOverlay(name) {
    const o = document.querySelector('.overlay[data-overlay="' + name + '"]');
    if (o) o.classList.add('active');
  }
  function hideOverlay(name) {
    const o = document.querySelector('.overlay[data-overlay="' + name + '"]');
    if (o) o.classList.remove('active');
  }
  function isOverlayOpen(name) {
    const o = document.querySelector('.overlay[data-overlay="' + name + '"]');
    return !!(o && o.classList.contains('active'));
  }
  function anyOverlayOpen() {
    return !!document.querySelector('.overlay.active');
  }

  // ── Title / setup / hiscores transitions ────────────────────────────

  function gotoTitle() {
    state = null;
    isFanfare = false;
    isRolling = false;
    document.getElementById('continue-btn').hidden = !hasSavedGame();
    showScreen('title');
  }

  function gotoSetup() {
    showScreen('setup');
    renderSetup();
  }

  function gotoHiscores() {
    renderHighScores();
    showScreen('hiscores');
  }

  function continueGame() {
    const saved = loadState();
    if (!saved) { gotoTitle(); return; }
    state = saved;
    showScreen('play');
    render();
  }

  function startGame() {
    // Read setup form into setup{}.
    const modeBtn = document.querySelector('.mode-btn.active');
    setup.mode = modeBtn ? modeBtn.dataset.mode : 'solo';
    if (setup.mode === 'solo') {
      setup.count = 1;
    } else {
      const cBtn = document.querySelector('.pc-btn.active');
      setup.count = cBtn ? parseInt(cBtn.dataset.count, 10) : 2;
    }
    const inputs = document.querySelectorAll('#name-fields .name-input');
    setup.names = [];
    for (let i = 0; i < setup.count; i++) {
      const v = inputs[i] ? inputs[i].value : '';
      setup.names.push((v && v.trim()) || (setup.mode === 'solo' ? 'Player' : 'P' + (i + 1)));
    }

    state = newState(setup.mode, setup.names);
    if (prefs.konamiArmed) {
      document.body.classList.add('konami');
      prefs.konamiArmed = false;
      savePrefs();
    } else {
      document.body.classList.remove('konami');
    }
    clearState(); // clear any prior solo save before this new run
    showScreen('play');
    render();
    A.ensure(); A.resume();
  }

  // ── Setup screen rendering ──────────────────────────────────────────

  function renderSetup() {
    const titleEl = document.getElementById('setup-title');
    const subEl = document.getElementById('setup-sub');
    const pcEl = document.getElementById('player-count');
    const fields = document.getElementById('name-fields');

    const modeBtns = document.querySelectorAll('.mode-btn');
    let activeMode = 'solo';
    for (let i = 0; i < modeBtns.length; i++) {
      if (modeBtns[i].classList.contains('active')) activeMode = modeBtns[i].dataset.mode;
    }

    function makeNameInput(idx, value, placeholder) {
      const input = document.createElement('input');
      input.className = 'name-input';
      input.dataset.idx = String(idx);
      input.name = 'player-name-' + idx;
      input.setAttribute('aria-label', 'Player ' + (idx + 1) + ' name');
      input.maxLength = 16;
      if (placeholder) input.placeholder = placeholder;
      input.value = value;
      return input;
    }

    if (activeMode === 'solo') {
      titleEl.textContent = 'Solo';
      subEl.textContent = 'Score chase against your personal best.';
      pcEl.classList.add('hidden');
      fields.innerHTML = '';
      fields.appendChild(makeNameInput(0, (setup.mode === 'solo' && setup.names[0]) || 'Player'));
    } else {
      titleEl.textContent = 'Hot Seat';
      subEl.textContent = 'Same screen, alternating turns.';
      pcEl.classList.remove('hidden');
      const countBtn = document.querySelector('.pc-btn.active');
      const count = countBtn ? parseInt(countBtn.dataset.count, 10) : 2;
      fields.innerHTML = '';
      for (let i = 0; i < count; i++) {
        fields.appendChild(makeNameInput(
          i,
          (setup.mode === 'hotseat' && setup.names[i]) || ('Player ' + (i + 1)),
          'Player ' + (i + 1)
        ));
      }
    }
  }

  // ── Action handlers ─────────────────────────────────────────────────

  function rollDice() {
    if (!state || state.phase !== 'playing') return;
    if (isRolling || isFanfare) return;
    if (state.rollsRemaining <= 0) return;

    // Skip a no-op roll (all values already locked).
    if (state.rollsRemaining < 3 && state.dice.every(function (d) { return d.held; })) return;

    A.playSFX('diceRoll');
    isRolling = true;

    const finalValues = state.dice.map(function (d, i) {
      if (state.rollsRemaining < 3 && d.held) return null; // skip held
      return Math.floor(Math.random() * 6) + 1;
    });

    const slots = document.querySelectorAll('#dice-row .die-slot');
    const dice = [];
    for (let i = 0; i < slots.length; i++) {
      slots[i].classList.remove('blank'); // dice now have values
      dice.push(slots[i].querySelector('.die'));
    }

    // Pre-mark the new visual values on non-held slots so layout is right.
    D.tumbleAll(dice, finalValues).then(function () {
      for (let i = 0; i < state.dice.length; i++) {
        if (finalValues[i] != null) state.dice[i].value = finalValues[i];
      }
      state.rollsRemaining--;
      A.playSFX('dieLand');
      isRolling = false;
      render();
    });
  }

  function toggleHold(idx) {
    if (!state || state.phase !== 'playing') return;
    if (isRolling || isFanfare) return;
    if (state.rollsRemaining === 3) return; // before first roll
    if (state.rollsRemaining === 0) return; // last roll done — useless to hold
    if (state.dice[idx].value == null) return;
    state.dice[idx].held = !state.dice[idx].held;
    A.playSFX(state.dice[idx].held ? 'holdSnap' : 'holdRelease');
    render();
  }

  function canCommit(cat) {
    if (!state || state.phase !== 'playing') return false;
    if (isRolling || isFanfare) return false;
    if (state.rollsRemaining === 3) return false; // must roll first
    const player = state.players[state.currentPlayerIndex];
    if (player.scorecard[cat] != null) return false;
    const dice = state.dice.map(function (d) { return d.value; });
    if (dice.some(function (v) { return v == null; })) return false;
    return S.legalCategories(player.scorecard, dice).indexOf(cat) >= 0;
  }

  function commitCategory(cat) {
    if (!canCommit(cat)) return;
    const player = state.players[state.currentPlayerIndex];
    const diceVals = state.dice.map(function (d) { return d.value; });

    const wasUpperBelow63 = S.upperSubtotal(player.scorecard) < 63;
    const result = S.commitCategory(player.scorecard, diceVals, cat);
    player.scorecard = result.scorecard;
    if (result.yahtzeeBonus > 0) {
      player.bonusYahtzees += result.yahtzeeBonus / 100;
    }
    const upperNowAt63 = S.upperSubtotal(player.scorecard) >= 63;
    const upperBonusEarnedNow = wasUpperBelow63 && upperNowAt63;

    // Audio + fanfare routing.
    const isYahtzeeRoll = S.isYahtzee(diceVals);
    const isFirstYahtzeeAt50 = isYahtzeeRoll && cat === 'yahtzee' && result.score === 50;
    const isBonusYahtzee = result.yahtzeeBonus > 0;

    announceCommit(cat, result.score, isFirstYahtzeeAt50, isBonusYahtzee, upperBonusEarnedNow);

    if (isFirstYahtzeeAt50 || isBonusYahtzee) {
      A.playSFX('yahtzee');
      const subtitle = isBonusYahtzee
        ? 'Five of a kind · +' + result.score + ' · bonus +100'
        : 'Five of a kind · +50';
      // Refresh the scorecard now so the +50 is visible behind the fanfare —
      // otherwise the total stays stale for the full 2.8s overlay.
      renderScorecard();
      showFanfare(subtitle);
      isFanfare = true;
      setTimeout(function () {
        isFanfare = false;
        if (upperBonusEarnedNow) A.playSFX('upperBonus');
        nextTurn();
      }, 2800);
    } else if (result.score === 0) {
      A.playSFX('zeroOut');
      if (upperBonusEarnedNow) setTimeout(function () { A.playSFX('upperBonus'); }, 380);
      nextTurn();
    } else {
      A.playSFX('commit');
      if (upperBonusEarnedNow) setTimeout(function () { A.playSFX('upperBonus'); }, 380);
      nextTurn();
    }
    saveState();
  }

  function nextTurn() {
    if (!state) return;
    const allDone = state.players.every(function (p) { return S.isScorecardComplete(p.scorecard); });
    if (allDone) { endGame(); return; }

    let next = state.currentPlayerIndex;
    do { next = (next + 1) % state.players.length; }
    while (S.isScorecardComplete(state.players[next].scorecard));

    state.currentPlayerIndex = next;
    state.dice = freshDice();
    state.rollsRemaining = 3;
    scorecardCursor = null;
    render();
  }

  function endGame() {
    state.phase = 'gameover';
    clearState();
    A.playSFX('gameOver');
    document.body.classList.remove('konami'); // konami is one round only
    showScreen('gameover');
    renderGameover();
  }

  function showFanfare(subtitle) {
    const fan = document.getElementById('fanfare');
    document.getElementById('fanfare-sub').textContent = subtitle || 'Five of a kind · +50';
    fan.classList.remove('active');
    // Force reflow so the keyframes restart on repeat fanfares.
    void fan.offsetWidth;
    spawnSparks(fan);
    fan.classList.add('active');
    // Rumble all connected pads.
    if (SG) {
      const pads = SG.listGamepads();
      for (let i = 0; i < pads.length; i++) {
        SG.rumble(pads[i].index, { duration: 600, strongMagnitude: 1.0, weakMagnitude: 0.8 });
      }
    }
    setTimeout(function () { fan.classList.remove('active'); }, 2800);
  }

  function announceCommit(cat, score, isFirstYahtzee, isBonusYahtzee, upperBonusEarnedNow) {
    const el = document.getElementById('commit-announce');
    if (!el) return;
    const label = S.LABELS[cat] || cat;
    let phrase;
    if (isFirstYahtzee) {
      phrase = label + ': 50 points scored. Yahtzee bonus armed.';
    } else if (isBonusYahtzee) {
      phrase = label + ': ' + score + ' points scored. Yahtzee bonus plus 100.';
    } else if (score === 0) {
      phrase = label + ': zero (forced).';
    } else {
      phrase = label + ': ' + score + ' points scored.';
    }
    if (upperBonusEarnedNow) phrase += ' Upper bonus plus 35 earned.';
    // Clear first so identical phrases re-trigger the polite announcement.
    el.textContent = '';
    setTimeout(function () { el.textContent = phrase; }, 30);
  }

  function spawnSparks(fan) {
    const old = fan.querySelectorAll('.spark');
    for (let i = 0; i < old.length; i++) old[i].remove();
    if (prefs.reducedMotion) return;
    const count = 24 + Math.floor(Math.random() * 13); // 24..36
    for (let i = 0; i < count; i++) {
      const s = document.createElement('div');
      s.className = 'spark';
      const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.5;
      const dist = 28 + Math.random() * 32; // vmin
      s.style.setProperty('--spark-x', (Math.cos(angle) * dist).toFixed(2) + 'vmin');
      s.style.setProperty('--spark-y', (Math.sin(angle) * dist).toFixed(2) + 'vmin');
      s.style.setProperty('--spark-size', (4 + Math.random() * 7).toFixed(1) + 'px');
      s.style.setProperty('--spark-delay', Math.floor(Math.random() * 220) + 'ms');
      fan.appendChild(s);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────

  function render() {
    if (!state || state.phase !== 'playing') return;
    renderPlayerStrip();
    renderTurnBar();
    renderDice();
    renderScorecard();
    renderRollControls();
  }

  function renderPlayerStrip() {
    const strip = document.getElementById('player-strip');
    if (state.players.length === 1) {
      strip.classList.add('solo');
      strip.innerHTML = '';
      return;
    }
    strip.classList.remove('solo');
    let html = '';
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      const total = S.totalScore(p.scorecard, p.bonusYahtzees);
      const isActive = i === state.currentPlayerIndex;
      const isDone = S.isScorecardComplete(p.scorecard);
      const cls = 'player-chip' + (isActive ? ' active' : '') + (isDone ? ' done' : '');
      html += '<div class="' + cls + '">' +
        '<span class="pc-dot"></span>' +
        '<span class="pc-name">' + escapeHtml(p.name) + '</span>' +
        '<span class="pc-score">' + total + '</span>' +
        '</div>';
    }
    strip.innerHTML = html;
  }

  function renderTurnBar() {
    const player = state.players[state.currentPlayerIndex];
    document.getElementById('turn-label').textContent = state.players.length > 1 ? 'Up next' : 'Solo run';
    document.getElementById('who-name').textContent = player.name;

    const meter = document.getElementById('roll-meter');
    const pips = meter.querySelectorAll('.roll-pip');
    const used = 3 - state.rollsRemaining;
    for (let i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('spent', i < used);
    }
    document.getElementById('roll-meter-label').textContent =
      state.rollsRemaining === 0 ? 'Pick a category' : ('Roll ' + (used + 1) + ' / 3');
  }

  function renderDice() {
    const slots = document.querySelectorAll('#dice-row .die-slot');
    D.render(state.dice, slots);
  }

  function renderRollControls() {
    const btn = document.getElementById('roll-btn');
    const hint = document.getElementById('roll-hint');
    const canRoll = state.rollsRemaining > 0 &&
      (state.rollsRemaining === 3 || state.dice.some(function (d) { return !d.held; }));
    btn.disabled = !canRoll || isRolling || isFanfare;
    if (state.rollsRemaining === 0) {
      hint.textContent = 'No rolls left — score a category';
    } else if (state.rollsRemaining === 3) {
      hint.textContent = 'Space · A · or tap';
    } else {
      hint.textContent = state.rollsRemaining + ' roll' + (state.rollsRemaining === 1 ? '' : 's') + ' left · or score now';
    }
  }

  // Glyphs for scorecard rows — kept inline so dice.js doesn't reach into the scorecard DOM.
  const GLYPHS = {
    aces:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.4" fill="#4a3520"/></svg>',
    twos:   '<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="2.2" fill="#4a3520"/><circle cx="16" cy="12" r="2.2" fill="#4a3520"/></svg>',
    threes: '<svg viewBox="0 0 24 24"><circle cx="7" cy="7" r="2" fill="#4a3520"/><circle cx="12" cy="12" r="2" fill="#4a3520"/><circle cx="17" cy="17" r="2" fill="#4a3520"/></svg>',
    fours:  '<svg viewBox="0 0 24 24"><circle cx="7" cy="7" r="2" fill="#4a3520"/><circle cx="17" cy="7" r="2" fill="#4a3520"/><circle cx="7" cy="17" r="2" fill="#4a3520"/><circle cx="17" cy="17" r="2" fill="#4a3520"/></svg>',
    fives:  '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="1.8" fill="#4a3520"/><circle cx="18" cy="6" r="1.8" fill="#4a3520"/><circle cx="12" cy="12" r="1.8" fill="#4a3520"/><circle cx="6" cy="18" r="1.8" fill="#4a3520"/><circle cx="18" cy="18" r="1.8" fill="#4a3520"/></svg>',
    sixes:  '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="1.6" fill="#4a3520"/><circle cx="18" cy="6" r="1.6" fill="#4a3520"/><circle cx="6" cy="12" r="1.6" fill="#4a3520"/><circle cx="18" cy="12" r="1.6" fill="#4a3520"/><circle cx="6" cy="18" r="1.6" fill="#4a3520"/><circle cx="18" cy="18" r="1.6" fill="#4a3520"/></svg>',
    threeOfKind: '<svg viewBox="0 0 24 24"><rect x="4" y="10" width="4" height="4" fill="#4a3520"/><rect x="10" y="10" width="4" height="4" fill="#4a3520"/><rect x="16" y="10" width="4" height="4" fill="#4a3520"/></svg>',
    fourOfKind:  '<svg viewBox="0 0 24 24"><rect x="3" y="10" width="3.5" height="4" fill="#4a3520"/><rect x="8" y="10" width="3.5" height="4" fill="#4a3520"/><rect x="13" y="10" width="3.5" height="4" fill="#4a3520"/><rect x="18" y="10" width="3.5" height="4" fill="#4a3520"/></svg>',
    fullHouse:   '<svg viewBox="0 0 24 24"><path d="M 4 18 L 4 12 L 8 8 L 12 12 L 12 18 Z M 14 18 L 14 14 L 17 11 L 20 14 L 20 18 Z" fill="#4a3520"/></svg>',
    smallStraight: '<svg viewBox="0 0 24 24"><path d="M 4 18 L 8 14 L 12 10 L 16 6" stroke="#4a3520" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
    largeStraight: '<svg viewBox="0 0 24 24"><path d="M 3 19 L 7 15 L 11 11 L 15 7 L 19 3" stroke="#4a3520" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>',
    yahtzee: '<svg viewBox="0 0 24 24"><path d="M 4 18 L 7 8 L 12 14 L 17 8 L 20 18 Z" fill="#4a3520"/><circle cx="12" cy="6" r="2" fill="#4a3520"/></svg>',
    chance:  '<svg viewBox="0 0 24 24"><path d="M 4 16 Q 12 6 20 16" stroke="#4a3520" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
  };

  function rowHtml(cat, scorecard, previewVal, status) {
    // status: 'scored' | 'open' | 'preview' | 'tip' | 'disabled'
    const filled = scorecard[cat] != null;
    const label = S.LABELS[cat];
    let scoreCell;
    if (filled) {
      scoreCell = '<span class="score">' + scorecard[cat] + '</span>';
    } else if (status === 'preview' || status === 'tip') {
      scoreCell = '<span class="score">' + previewVal + '</span>';
    } else {
      scoreCell = '<span class="score"><span class="empty-dash">—</span></span>';
    }
    const cls = 'sc-row' +
      (filled ? ' scored' : '') +
      (status === 'preview' ? ' preview' : '') +
      (status === 'tip' ? ' tip' : '') +
      (status === 'disabled' ? ' disabled' : '') +
      (status === 'cursor' ? ' cursor' : '');
    const tag = (status === 'preview') ? '<span class="preview-tag">Preview</span>' : '';
    return '<div class="' + cls + '" data-cat="' + cat + '">' +
      '<span class="glyph">' + GLYPHS[cat] + '</span>' +
      '<span class="label">' + label + '</span>' +
      tag +
      scoreCell +
      '</div>';
  }

  function renderScorecard() {
    const sc = document.getElementById('scorecard');
    const player = state.players[state.currentPlayerIndex];
    const card = player.scorecard;
    const dice = state.dice.map(function (d) { return d.value; });
    const diceComplete = dice.every(function (v) { return v != null; });
    const legal = diceComplete ? S.legalCategories(card, dice) : [];

    function rowStatus(cat) {
      if (card[cat] != null) return 'scored';
      if (!diceComplete) return 'open';
      if (legal.indexOf(cat) < 0) return 'disabled';
      if (scorecardCursor === cat) return 'preview';
      // 'tip': legal AND would actually score points — surface this so the
      // player can see at a glance which boxes pay out for the current dice.
      if (S.previewScore(card, dice, cat) > 0) return 'tip';
      return 'open';
    }
    function previewFor(cat) {
      if (!diceComplete || legal.indexOf(cat) < 0) return 0;
      return S.previewScore(card, dice, cat);
    }

    let html = '';
    html += '<div class="sc-header">' +
      '<span class="sc-h-name">' + escapeHtml(player.name) + '</span>' +
      '<span class="sc-h-bonus">Total ' + S.totalScore(card, player.bonusYahtzees) + '</span>' +
      '</div>';

    html += '<div class="sc-section-h">Upper</div>';
    for (let i = 0; i < S.UPPER.length; i++) {
      const cat = S.UPPER[i];
      html += rowHtml(cat, card, previewFor(cat), rowStatus(cat));
    }
    const sub = S.upperSubtotal(card);
    const bonus = S.upperBonus(card);
    const bonusCls = 'sc-bonus' + (bonus > 0 ? ' earned' : '');
    html += '<div class="' + bonusCls + '">' +
      '<span>Upper subtotal · ' + sub + ' / 63</span>' +
      '<span>' + (bonus > 0 ? '+35' : '+0') + '</span>' +
      '</div>';

    html += '<div class="sc-section-h" style="margin-top:0.4rem;">Lower</div>';
    for (let i = 0; i < S.LOWER.length; i++) {
      const cat = S.LOWER[i];
      html += rowHtml(cat, card, previewFor(cat), rowStatus(cat));
    }

    if (player.bonusYahtzees > 0) {
      html += '<div class="sc-yahtzee-bonus">' +
        '<span>Yahtzee bonus × ' + player.bonusYahtzees + '</span>' +
        '<span>+' + (player.bonusYahtzees * 100) + '</span>' +
        '</div>';
    }

    html += '<div class="sc-total">' +
      '<span class="label">Total</span>' +
      '<span>' + S.totalScore(card, player.bonusYahtzees) + '</span>' +
      '</div>';
    sc.innerHTML = html;
  }

  // ── Game over rendering ─────────────────────────────────────────────

  function renderGameover() {
    const sub = document.getElementById('gameover-sub');
    sub.textContent = state.players.length > 1 ? 'Final scores' : 'Solo run · final score';

    // Build sorted ranking.
    const ranked = state.players.map(function (p, i) {
      return { name: p.name, score: S.totalScore(p.scorecard, p.bonusYahtzees), idx: i };
    }).sort(function (a, b) { return b.score - a.score; });

    let html = '';
    for (let i = 0; i < ranked.length; i++) {
      const r = ranked[i];
      const isWinner = i === 0;
      const crown = isWinner
        ? '<svg class="crown" viewBox="0 0 24 24"><path d="M 3 18 L 4 8 L 9 13 L 12 5 L 15 13 L 20 8 L 21 18 Z" fill="#e8b04a" stroke="#5a3614" stroke-width="0.8"/><circle cx="4" cy="8" r="1.2" fill="#faf3e6"/><circle cx="20" cy="8" r="1.2" fill="#faf3e6"/><circle cx="12" cy="5" r="1.2" fill="#faf3e6"/></svg>'
        : '';
      html += '<div class="rank-row' + (isWinner ? ' winner' : '') + '">' +
        '<div class="place">' + (i + 1) + '</div>' +
        '<div class="name">' + escapeHtml(r.name) + ' ' + crown + '</div>' +
        '<div class="score">' + r.score + '</div>' +
        '</div>';
    }
    document.getElementById('ranking').innerHTML = html;

    // High-score prompt — solo only, only when score qualifies.
    const prompt = document.getElementById('hi-score-prompt');
    if (state.mode === 'solo' && isHighScore(ranked[0].score)) {
      prompt.hidden = false;
      const input = document.getElementById('initials-input');
      input.value = '';
      setTimeout(function () { input.focus(); }, 100);
    } else {
      prompt.hidden = true;
    }
  }

  function renderHighScores() {
    const list = loadHighScores();
    const el = document.getElementById('hi-list');
    let html = '';
    for (let i = 0; i < 10; i++) {
      const e = list[i];
      if (e) {
        html += '<div class="hi-row">' +
          '<span class="rank">' + (i + 1) + '</span>' +
          '<span class="initials">' + escapeHtml(e.initials) + '</span>' +
          '<span class="date">' + escapeHtml(e.date) + '</span>' +
          '<span class="score">' + e.score + '</span>' +
          '</div>';
      } else {
        const dateText = (i === 0 && list.length === 0) ? 'Be the first' : '—';
        const dateClass = (i === 0 && list.length === 0) ? 'date lead' : 'date';
        html += '<div class="hi-row placeholder">' +
          '<span class="rank">' + (i + 1) + '</span>' +
          '<span class="initials">—</span>' +
          '<span class="' + dateClass + '">' + dateText + '</span>' +
          '<span class="score">—</span>' +
          '</div>';
      }
    }
    el.innerHTML = html;
  }

  // ── Pause / mute / motion ──────────────────────────────────────────

  function togglePause() {
    if (!state || state.phase !== 'playing') return;
    if (isOverlayOpen('help')) return;
    if (isOverlayOpen('pause')) {
      hideOverlay('pause');
    } else {
      syncPauseUI();
      showOverlay('pause');
    }
  }
  function syncPauseUI() {
    const sound = document.querySelector('[data-toggle="sound"]');
    sound.classList.toggle('on', !A.isMuted());
    const motion = document.querySelector('[data-toggle="motion"]');
    motion.classList.toggle('on', !!prefs.reducedMotion);
  }
  function syncMuteIcon() {
    const on = document.getElementById('icon-sound-on');
    const off = document.getElementById('icon-sound-off');
    if (A.isMuted()) {
      on.style.display = 'none'; off.style.display = '';
    } else {
      on.style.display = ''; off.style.display = 'none';
    }
  }
  function toggleMute() {
    A.setMuted(!A.isMuted());
    syncMuteIcon();
    if (isOverlayOpen('pause')) syncPauseUI();
  }
  function toggleReducedMotion() {
    prefs.reducedMotion = !prefs.reducedMotion;
    savePrefs();
    D.setReducedMotion(prefs.reducedMotion);
    document.body.classList.toggle('reduced-motion', prefs.reducedMotion);
    if (isOverlayOpen('pause')) syncPauseUI();
  }

  // ── Keyboard nav for scorecard ──────────────────────────────────────

  function moveScorecardCursor(dir) {
    if (!state || state.phase !== 'playing') return;
    const player = state.players[state.currentPlayerIndex];
    const dice = state.dice.map(function (d) { return d.value; });
    if (dice.some(function (v) { return v == null; })) return;
    const legal = S.legalCategories(player.scorecard, dice);
    if (legal.length === 0) return;

    if (scorecardCursor == null) {
      scorecardCursor = legal[0];
    } else {
      let i = legal.indexOf(scorecardCursor);
      if (i < 0) i = 0;
      else i = (i + (dir > 0 ? 1 : legal.length - 1)) % legal.length;
      scorecardCursor = legal[i];
    }
    A.playSFX('nav');
    renderScorecard();
  }
  function commitScorecardCursor() {
    if (scorecardCursor) commitCategory(scorecardCursor);
  }

  // ── Konami easter egg ───────────────────────────────────────────────

  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  let konamiBuf = [];
  function handleKonami(code) {
    konamiBuf.push(code);
    if (konamiBuf.length > KONAMI.length) konamiBuf.shift();
    for (let i = 0; i < konamiBuf.length; i++) {
      if (konamiBuf[i] !== KONAMI[KONAMI.length - konamiBuf.length + i]) return;
    }
    if (konamiBuf.length === KONAMI.length) {
      konamiBuf = [];
      prefs.konamiArmed = true;
      savePrefs();
      A.playSFX('upperBonus');
      flashToast('Gold dice armed for next round');
    }
  }

  // ── Toast (gamepad connect/disconnect, konami flash) ────────────────

  let toastTimer = null;
  function flashToast(msg) {
    const el = document.getElementById('gp-toast');
    el.textContent = msg;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }
  function shortPadName(id) {
    if (!id) return 'controller';
    const m = id.match(/^([^(]+)/);
    return (m ? m[1] : id).trim().slice(0, 24);
  }

  // ── Gamepad poll loop ──────────────────────────────────────────────

  let gpRunning = false;
  let prevDir = {};
  let dirHoldUntil = {};

  function startGamepadPoll() {
    if (gpRunning || !SG) return;
    gpRunning = true;
    requestAnimationFrame(gpTick);
  }
  function gpTick() {
    if (!gpRunning) return;
    if (state && state.phase === 'playing' && !anyOverlayOpen()) {
      const pads = SG.listGamepads();
      // Direction navigation — first pad with a direction wins.
      let actedDir = false;
      for (let i = 0; i < pads.length && !actedDir; i++) {
        const idx = pads[i].index;
        const dir = SG.getDirection(idx);
        const prev = prevDir[idx] || null;
        const now = performance.now();
        // Rising edge OR repeat after 180 ms of holding.
        const isEdge = dir && dir !== prev;
        const isRepeat = dir && dir === prev && now > (dirHoldUntil[idx] || 0);
        if (isEdge || isRepeat) {
          handleGamepadDirection(dir);
          dirHoldUntil[idx] = now + (isEdge ? 320 : 140);
          actedDir = true;
        }
        prevDir[idx] = dir;
      }
      // A button — first rising edge wins.
      for (let i = 0; i < pads.length; i++) {
        if (SG.consumeButtonPress(pads[i].index, SG.BUTTONS.A)) {
          handleGamepadA();
          break;
        }
      }
    }
    requestAnimationFrame(gpTick);
  }
  function handleGamepadDirection(dir) {
    if (dir === 'up') moveScorecardCursor(-1);
    else if (dir === 'down') moveScorecardCursor(1);
    else if (dir === 'left' || dir === 'right') {
      // Toggle hold on a leftmost / rightmost not-yet-held die.
      // KISS: cycle through dice with left/right; A toggles hold.
      // For now, treat left/right as "hold the next available die".
      cycleDieHoldFocus(dir);
    }
  }
  let dieHoldCursor = -1;
  function cycleDieHoldFocus(dir) {
    if (!state || state.phase !== 'playing') return;
    if (state.rollsRemaining === 3 || state.rollsRemaining === 0) return;
    const slots = document.querySelectorAll('#dice-row .die-slot');
    if (dir === 'right') dieHoldCursor = (dieHoldCursor + 1) % 5;
    else dieHoldCursor = (dieHoldCursor + 4) % 5;
    for (let i = 0; i < slots.length; i++) slots[i].classList.toggle('cursor', i === dieHoldCursor);
    A.playSFX('nav');
  }
  function handleGamepadA() {
    if (!state || state.phase !== 'playing') return;
    if (isRolling || isFanfare) return;
    if (scorecardCursor) {
      commitScorecardCursor();
      return;
    }
    if (dieHoldCursor >= 0 && state.rollsRemaining < 3 && state.rollsRemaining > 0) {
      toggleHold(dieHoldCursor);
      return;
    }
    // Default: roll.
    rollDice();
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // ── Event wiring ────────────────────────────────────────────────────

  function wireEvents() {
    // Click delegation for data-action buttons.
    document.body.addEventListener('click', function (e) {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      switch (action) {
        case 'new-game':       gotoSetup(); break;
        case 'continue':       continueGame(); break;
        case 'hiscores':       gotoHiscores(); break;
        case 'back-to-title':  gotoTitle(); break;
        case 'start-game':     startGame(); break;
        case 'resume':         hideOverlay('pause'); break;
        case 'restart':        hideOverlay('pause'); state = newState(state.mode, state.players.map(function(p){return p.name;})); render(); break;
        case 'quit-to-title':  hideOverlay('pause'); clearState(); gotoTitle(); break;
        case 'play-again':     gotoSetup(); break;
        case 'close-help':     hideOverlay('help'); break;
      }
    });

    // Mode toggle.
    document.querySelectorAll('.mode-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.mode-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        renderSetup();
      });
    });
    // Player count.
    document.querySelectorAll('.pc-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.pc-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        renderSetup();
      });
    });

    // Roll button.
    document.getElementById('roll-btn').addEventListener('click', rollDice);

    // Dice slots — click to hold.
    document.querySelectorAll('#dice-row .die-slot').forEach(function (slot) {
      slot.addEventListener('click', function () {
        const idx = parseInt(slot.dataset.idx, 10);
        toggleHold(idx);
      });
    });

    // Scorecard — click to commit.
    document.getElementById('scorecard').addEventListener('click', function (e) {
      const row = e.target.closest('.sc-row');
      if (!row) return;
      const cat = row.dataset.cat;
      if (canCommit(cat)) {
        scorecardCursor = cat;
        renderScorecard();
        // Tiny delay so the player sees the gold preview.
        setTimeout(function () { commitCategory(cat); }, 80);
      }
    });
    // Hover preview. mouseover bubbles + each renderScorecard() replaces the
    // row DOM, so without this guard we'd loop: new node → mouseover → render
    // → new node → … causing a buzzing pile-up of hover SFX.
    document.getElementById('scorecard').addEventListener('mouseover', function (e) {
      const row = e.target.closest('.sc-row');
      if (!row || !state) return;
      const cat = row.dataset.cat;
      if (scorecardCursor === cat) return;
      if (canCommit(cat)) {
        scorecardCursor = cat;
        renderScorecard();
        A.playSFX('hover');
      }
    });
    document.getElementById('scorecard').addEventListener('mouseleave', function () {
      if (scorecardCursor) {
        scorecardCursor = null;
        renderScorecard();
      }
    });

    // Util bar.
    document.getElementById('mute-btn').addEventListener('click', toggleMute);
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('help-btn').addEventListener('click', function () {
      if (isOverlayOpen('help')) hideOverlay('help'); else showOverlay('help');
    });
    document.querySelector('[data-toggle="sound"]').addEventListener('click', toggleMute);
    document.querySelector('[data-toggle="motion"]').addEventListener('click', toggleReducedMotion);

    // High-score form.
    document.getElementById('hi-score-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const initials = document.getElementById('initials-input').value;
      const ranked = state.players.map(function (p) { return S.totalScore(p.scorecard, p.bonusYahtzees); }).sort(function (a, b) { return b - a; });
      saveHighScore(initials, ranked[0]);
      document.getElementById('hi-score-prompt').hidden = true;
    });

    // Keyboard.
    document.addEventListener('keydown', function (e) {
      handleKonami(e.code);

      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

      if (e.code === 'Escape') {
        e.preventDefault();
        if (isOverlayOpen('help')) { hideOverlay('help'); return; }
        if (isOverlayOpen('pause')) { hideOverlay('pause'); return; }
        if (state && state.phase === 'playing') togglePause();
        return;
      }
      if (anyOverlayOpen()) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (state && state.phase === 'playing') rollDice();
        return;
      }
      if (e.code === 'Enter') {
        e.preventDefault();
        commitScorecardCursor();
        return;
      }
      if (e.code === 'ArrowUp')   { e.preventDefault(); moveScorecardCursor(-1); return; }
      if (e.code === 'ArrowDown') { e.preventDefault(); moveScorecardCursor(1); return; }
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 5) { e.preventDefault(); toggleHold(n - 1); }
      }
    });

    // Gamepad connect / disconnect.
    if (SG) {
      SG.init({
        onConnect: function (idx, id) { flashToast('Controller connected: ' + shortPadName(id)); },
        onDisconnect: function (idx, id) { flashToast('Controller ' + shortPadName(id) + ' disconnected'); }
      });
      startGamepadPoll();
    }

    window.addEventListener('beforeunload', function () { saveState(); });
  }

  // ── Init ────────────────────────────────────────────────────────────

  function init() {
    loadPrefs();
    syncMuteIcon();
    wireEvents();
    gotoTitle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Yahtzee.Game = { init: init };
})();
