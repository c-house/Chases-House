/* ═══════════════════════════════════════════════════════════════
   Hearthguard — game.js
   Effectful — orchestrator + entry point. Owns state, undo stack,
   the RAF loop, the state machine. Wires Input → state → Render.
   The single public surface (window.Hearthguard) is the
   LLM-agent / test API.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const S = window.HearthguardState;
  const U = window.HearthguardUnits;
  const M = window.HearthguardMissions;
  const R = window.HearthguardResolver;
  const Render = window.HearthguardRender;
  const Input = window.HearthguardInput;
  const Narrate = window.HearthguardNarrate;
  const Audio = window.HearthguardAudio;

  const UNDO_CAP = 32;
  const STORAGE = {
    bestRun:           'hearthguard-best-run',
    missionsCompleted: 'hearthguard-missions-completed',
    muted:             'hearthguard-muted',
    tutorialSeen:      'hearthguard-tutorial-seen',
    animSpeed:         'hearthguard-anim-speed',
  };

  let runState = null;
  let currentState = null;
  let undoStack = [];
  let prevRendered = null;
  let pendingSwapTileA = null;
  let resolving = false;
  let rafId = 0;

  function init() {
    const rootEl = document.querySelector('.hg-vellum-content');
    if (!rootEl) return;

    Render.mount(rootEl);
    Input.init({
      onSelectUnit:       handleSelectUnit,
      onTileClick:        handleTileClick,
      onUndo:             handleUndo,
      onCancel:           handleCancel,
      onPause:            handlePause,
      onSelectHeroBySlot: handleSelectHeroBySlot,
      onCycleHero:        handleCycleHero,
      onConfirm:          () => { if (currentState && currentState.phase === 'plan') confirmTurn(); },
      onCursorMove:       () => {},
      onButtonAction:     handleButtonAction,
    });

    runState = S.createRunState({ seed: Date.now() });
    refreshTitleScreen();
    refreshMuteUi();
    Render.showScreen('title');

    rafId = requestAnimationFrame(loop);
  }

  function loop() {
    Input.tick();
    rafId = requestAnimationFrame(loop);
  }

  // ── Tutorial dispatch (mission-1 hints) ─────────────────────
  function maybeFireTutorial(triggerEvent) {
    if (!currentState || !currentState.missionDef) return;
    const tut = currentState.missionDef.tutorial;
    if (!tut || !tut.triggers) return;
    const trigger = tut.triggers.find(t => t.on === triggerEvent);
    if (!trigger) return;
    Render.showTutorialHint(trigger.id, tutorialAnchor(triggerEvent), trigger.text);
  }

  function tutorialAnchor(triggerEvent) {
    switch (triggerEvent) {
      case 'turn-start':          return '.hg-hero-strip';
      case 'enemy-intent-shown':  return '.hg-board';
      case 'first-action-queued': return '.hg-board';
      case 'all-heroes-acted':    return '[data-action="confirm-turn"]';
      default:                    return null;
    }
  }

  // ── Button-action wiring (DOM data-action attributes) ───────
  function handleButtonAction(action) {
    // Audio context unlocks on first user gesture (any button).
    if (Audio) { Audio.ensure(); Audio.resume(); }
    if (Audio) Audio.menuConfirm();

    switch (action) {
      case 'begin-run':       startRun(); return;
      case 'how-to':          Render.showScreen('how-to'); return;
      case 'begin-mission':   startMission(); return;
      case 'quit-to-title':   resetToTitle(); return;
      case 'pause':           handlePause(); return;
      case 'resume':          Render.hideScreen('pause'); return;
      case 'restart-run':     resetToTitle(); return;
      case 'undo':            handleUndo(); return;
      case 'confirm-turn':    if (currentState && currentState.phase === 'plan') confirmTurn(); return;
      case 'continue-run':    advanceAfterMissionEnd(); return;
      case 'new-run':         startRun(); return;
      case 'mute-toggle':     toggleMute(); return;
    }
  }

  function toggleMute() {
    if (!Audio) return;
    Audio.setMuted(!Audio.isMuted());
    refreshMuteUi();
  }

  function refreshMuteUi() {
    const muted = Audio ? Audio.isMuted() : false;
    document.querySelectorAll('[data-action="mute-toggle"]').forEach(btn => {
      btn.dataset.muted = muted ? 'true' : 'false';
      btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      btn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
      btn.textContent = muted ? '♪̸' : '♪';
    });
  }

  // ── Run / mission lifecycle ─────────────────────────────────
  function startRun() {
    runState = S.createRunState({ seed: Date.now() });
    runState.missionIndex = 0;
    enterBriefing();
  }

  function enterBriefing() {
    const def = M.byIndex(runState.missionIndex);
    if (!def) { enterRunEnd(true); return; }
    populateBriefing(def);
    Render.showScreen('briefing');
  }

  function startMission() {
    const def = M.byIndex(runState.missionIndex);
    if (!def) return;
    currentState = R.startMission(runState, def);
    undoStack = [];
    prevRendered = null;
    pendingSwapTileA = null;
    Render.showScreen('play');
    Render.syncState(currentState, prevRendered);
    prevRendered = currentState;
    maybeFireTutorial('turn-start');
  }

  function confirmTurn() {
    if (!currentState || resolving) return;
    resolving = true;
    const result = R.resolveTurn(currentState);
    const state = result.state;
    Render.playEvents(result.events, animOpts(), state)
      .then(() => {
        currentState = state;
        undoStack = [];
        pendingSwapTileA = null;
        Render.syncState(currentState, prevRendered);
        prevRendered = currentState;
        if (currentState.phase === 'mission-end') {
          enterMissionEnd();
        } else {
          const anyIntent = currentState.units.some(u => u.side === 'enemy' && u.intent);
          if (anyIntent) maybeFireTutorial('enemy-intent-shown');
        }
        resolving = false;
      });
  }

  function enterMissionEnd() {
    const score = currentState.missionScore;
    if (!score) return;
    populateMissionEnd(score);
    Render.showScreen('mission-end');
    if (Audio) {
      if (score.won) Audio.missionWin();
      else Audio.runLose();
    }
  }

  function advanceAfterMissionEnd() {
    if (!currentState || !currentState.missionScore) return;
    const score = currentState.missionScore;
    if (!score.won) {
      enterRunEnd(false);
      return;
    }
    runState.runScore += score.total;
    runState.missionsCompleted += 1;
    bumpMissionsCompletedTotal();
    runState.missionIndex += 1;
    if (runState.missionIndex >= M.ALL.length) {
      enterRunEnd(true);
    } else {
      enterBriefing();
    }
  }

  function enterRunEnd(victorious) {
    persistBestRun(runState.runScore, runState.missionsCompleted);
    populateRunEnd(victorious);
    Render.showScreen('run-end');
    if (Audio) {
      if (victorious) Audio.runWin();
      else Audio.runLose();
    }
  }

  function resetToTitle() {
    currentState = null;
    undoStack = [];
    prevRendered = null;
    pendingSwapTileA = null;
    Render.hideScreen('pause');
    refreshTitleScreen();
    Render.showScreen('title');
  }

  // ── Click contract ──────────────────────────────────────────
  function handleSelectUnit(unitId) {
    if (!currentState || currentState.phase !== 'plan' || resolving) return;
    const u = S.unitById(currentState, unitId);
    if (!u || u.side !== 'hero' || u.hp <= 0) return;
    if (u.hasMoved && u.hasActed) {
      if (Audio) Audio.invalidAction();
      return;
    }
    if (Audio) Audio.unitSelect();
    setSelected(unitId);
    if (Narrate) Render.appendNote(Narrate.describeSelection(currentState));
  }

  function handleTileClick(tile) {
    if (!currentState || currentState.phase !== 'plan' || resolving) return;

    const occ = S.unitAt(currentState, tile);
    const heroId = currentState.selectedUnitId;

    if (!heroId) {
      if (occ && occ.side === 'hero' && !(occ.hasMoved && occ.hasActed)) {
        handleSelectUnit(occ.id);
      }
      return;
    }

    const hero = S.unitById(currentState, heroId);
    if (!hero) { setSelected(null); return; }

    if (occ && occ.side === 'hero') {
      if (occ.id === heroId) { setSelected(null); return; }
      if (!(occ.hasMoved && occ.hasActed)) { handleSelectUnit(occ.id); return; }
      return;
    }

    if (hero.type === 'mage' && pendingSwapTileA) {
      const targets = U.legalActionTargets(currentState, heroId);
      const match = targets.find(t =>
        t.kind === 'swap' &&
        ((t.tileA === pendingSwapTileA && t.tileB === tile) ||
         (t.tileB === pendingSwapTileA && t.tileA === tile))
      );
      if (match) {
        queueAction({ kind: 'swap', unitId: heroId, tileA: match.tileA, tileB: match.tileB });
        pendingSwapTileA = null;
      } else {
        const isFirstClickable = targets.some(t => t.kind === 'swap' && (t.tileA === tile || t.tileB === tile));
        pendingSwapTileA = isFirstClickable ? tile : null;
      }
      Render.syncState(currentState, prevRendered);
      prevRendered = currentState;
      return;
    }

    if (!hero.hasMoved) {
      const stats = U.statsFor(hero.type);
      const reach = S.reachableTiles(currentState, hero.at, stats.move);
      if (reach.has(tile)) {
        queueAction({ kind: 'move', unitId: heroId, toTile: tile });
        return;
      }
    }

    if (!hero.hasActed) {
      const targets = U.legalActionTargets(currentState, heroId);
      if (hero.type === 'mage') {
        const isFirstClickable = targets.some(t => t.kind === 'swap' && (t.tileA === tile || t.tileB === tile));
        if (isFirstClickable) {
          pendingSwapTileA = tile;
          Render.syncState(currentState, prevRendered);
          prevRendered = currentState;
          return;
        }
      } else {
        const t = targets.find(x => x.targetTile === tile);
        if (t) {
          queueAction({ kind: t.kind, unitId: heroId, targetTile: tile });
          return;
        }
      }
    }

    setSelected(null);
  }

  function handleCancel() {
    if (!currentState) return;
    if (pendingSwapTileA) {
      pendingSwapTileA = null;
      Render.syncState(currentState, prevRendered);
      prevRendered = currentState;
      return;
    }
    if (currentState.selectedUnitId) {
      setSelected(null);
      return;
    }
    handlePause();
  }

  function handlePause() {
    if (!currentState || currentState.phase !== 'plan') return;
    Render.showScreen('pause');
  }

  function handleSelectHeroBySlot(slot) {
    if (!currentState) return;
    const heroes = S.livingHeroes(currentState);
    const h = heroes[slot];
    if (h && !(h.hasMoved && h.hasActed)) setSelected(h.id);
  }

  function handleCycleHero(dir) {
    if (!currentState) return;
    const heroes = S.livingHeroes(currentState).filter(h => !(h.hasMoved && h.hasActed));
    if (heroes.length === 0) return;
    const cur = currentState.selectedUnitId;
    const idx = heroes.findIndex(h => h.id === cur);
    const next = heroes[((idx < 0 ? 0 : idx + dir) + heroes.length) % heroes.length];
    setSelected(next.id);
  }

  function handleUndo() {
    if (resolving) return;
    if (undoStack.length === 0) return;
    currentState = undoStack.pop();
    pendingSwapTileA = null;
    Render.syncState(currentState, prevRendered);
    prevRendered = currentState;
  }

  // ── State mutation helpers ──────────────────────────────────
  function setSelected(unitId) {
    if (!currentState) return;
    currentState = S.clone(currentState);
    currentState.selectedUnitId = unitId || null;
    pendingSwapTileA = null;
    Render.syncState(currentState, prevRendered);
    prevRendered = currentState;
  }

  function queueAction(action) {
    if (!currentState) return;
    pushUndo();
    let next;
    const augmented = { ...action };
    if (action.kind === 'move') {
      augmented.fromTile = S.unitById(currentState, action.unitId).at;
    } else if (action.kind === 'push' || action.kind === 'pull') {
      augmented.heroTile = S.unitById(currentState, action.unitId).at;
    }
    switch (action.kind) {
      case 'move': next = U.applyMove(currentState, action.unitId, action.toTile); break;
      case 'push': next = U.applyPush(currentState, action.unitId, action.targetTile); break;
      case 'pull': next = U.applyPull(currentState, action.unitId, action.targetTile); break;
      case 'swap': next = U.applySwap(currentState, action.unitId, action.tileA, action.tileB); break;
      default: return;
    }
    currentState = next.state;
    currentState.pendingPlayerActions = currentState.pendingPlayerActions.concat([augmented]);

    const hero = S.unitById(currentState, action.unitId);
    if (hero && hero.hasMoved && hero.hasActed) {
      currentState.selectedUnitId = pickNextHero();
    }

    if (Audio) playSfxForPlannedAction(augmented);
    if (Narrate) Render.appendNote(Narrate.describeAction(augmented, currentState));

    Render.syncState(currentState, prevRendered);
    prevRendered = currentState;

    if (currentState.pendingPlayerActions.length === 1) {
      maybeFireTutorial('first-action-queued');
    }
    const allSpent = S.livingHeroes(currentState).every(h => h.hasMoved && h.hasActed);
    if (allSpent) {
      maybeFireTutorial('all-heroes-acted');
    }
  }

  function playSfxForPlannedAction(action) {
    switch (action.kind) {
      case 'move': Audio.moveConfirm(); return;
      case 'push': Audio.knightStrike(); return;
      case 'pull': Audio.archerShot(); return;
      case 'swap': Audio.mageSwap(); return;
    }
  }

  function pickNextHero() {
    const heroes = S.livingHeroes(currentState).filter(h => !(h.hasMoved && h.hasActed));
    if (heroes.length === 0) return null;
    if (heroes.length === 1) return heroes[0].id;
    return null;
  }

  function pushUndo() {
    undoStack.push(S.clone(currentState));
    if (undoStack.length > UNDO_CAP) undoStack.shift();
  }

  // ── Screen content population ───────────────────────────────
  function populateBriefing(def) {
    const cap = def.name.charAt(0);
    const rest = def.name.slice(1);
    Render.setBind('briefing-cap', cap);
    Render.setBind('briefing-title-rest', rest);
    Render.setBind('briefing-flavor', def.flavor);

    const roster = document.querySelector('[data-bind="briefing-roster"]');
    if (!roster) return;
    const counts = {};
    for (const u of def.initialUnits) {
      const stats = U.statsFor(u.type);
      if (!stats || stats.side !== 'enemy') continue;
      counts[u.type] = (counts[u.type] || 0) + 1;
    }
    for (const sched of Object.values(def.spawnSchedule || {})) {
      for (const s of sched) counts[s.type] = (counts[s.type] || 0) + 1;
    }
    roster.innerHTML = '';
    for (const [type, n] of Object.entries(counts)) {
      const item = document.createElement('span');
      item.className = 'hg-roster-item';
      item.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true"><use href="#${U.statsFor(type).glyphId}"/></svg>× ${n} ${U.statsFor(type).label}`;
      roster.appendChild(item);
    }
  }

  function populateMissionEnd(score) {
    const headline = score.won
      ? (score.perfect ? 'Held — without loss.' : 'Held.')
      : 'Fallen.';
    Render.setBind('end-headline', headline);

    const card = document.querySelector('[data-bind="end-score"]');
    if (!card) return;
    card.innerHTML = '';
    addScoreRow(card, 'Villagers saved', `${score.saved} × 100`, score.saved * 100);
    addScoreRow(card, 'Enemies struck',  `${score.kills} × 25`,  score.kills * 25);
    addScoreRow(card, 'Turns unspent',   `${score.unspent} × 10`, score.unspent * 10);
    if (score.perfect) addScoreRow(card, '✦ Perfect mission', 'bonus', score.bonus, true);
    addScoreRow(card, 'Mission total', '', score.total, false, true);

    const seal = document.querySelector('[data-bind="seal-glyph"]');
    if (seal) seal.textContent = score.perfect ? '✦' : (score.won ? '⚔' : '✕');

    const continueBtn = document.querySelector('[data-action="continue-run"]');
    if (continueBtn) continueBtn.textContent = score.won ? 'Continue Run →' : 'See Run Summary →';
  }

  function addScoreRow(parent, label, expr, total, perfect, isTotal) {
    const row = document.createElement('div');
    row.className = 'hg-score-row';
    if (perfect) row.dataset.perfect = 'true';
    if (isTotal) row.classList.add('hg-score-total');
    const left = document.createElement('span');
    left.textContent = label;
    const right = document.createElement('span');
    right.textContent = (expr ? expr + '   ' : '') + total;
    row.appendChild(left);
    row.appendChild(right);
    parent.appendChild(row);
  }

  function populateRunEnd(victorious) {
    Render.setBind('run-end-headline', victorious ? 'A run held.' : 'The line broke.');
    const flavors = victorious
      ? ['Three missions, three seals, three nights of sleep for the village.']
      : [
          'The bards will sing of the third turn.',
          'Held by the archer alone.',
          'One pixel off. Next time.',
          'Closer than last time. They\'ll remember.',
        ];
    const flavor = flavors[Math.floor(Math.random() * flavors.length)];
    Render.setBind('run-end-flavor', flavor);

    const card = document.querySelector('[data-bind="run-end-score"]');
    if (!card) return;
    card.innerHTML = '';
    addScoreRow(card, 'Missions completed', '', `${runState.missionsCompleted} / ${M.ALL.length}`);
    addScoreRow(card, 'Total score', '', runState.runScore, false, true);
    const best = readBestRun();
    if (best && runState.runScore > best.score) {
      addScoreRow(card, '✦ New best run', '', '', true);
    }
  }

  function refreshTitleScreen() {
    const best = readBestRun();
    Render.setBind('best-run-label',
      best ? `Best run: ${best.score}` : 'Best run not yet recorded');
    const lifetime = readMissionsCompleted();
    Render.setBind('missions-completed-label',
      lifetime > 0 ? `${lifetime} mission${lifetime === 1 ? '' : 's'} held` : '');
  }

  // ── Persistence ─────────────────────────────────────────────
  function readBestRun() {
    try {
      const v = localStorage.getItem(STORAGE.bestRun);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }
  function persistBestRun(score, missions) {
    const prev = readBestRun();
    if (prev && prev.score >= score) return;
    try {
      localStorage.setItem(STORAGE.bestRun, JSON.stringify({
        score, missions, date: new Date().toISOString().slice(0, 10),
      }));
    } catch (e) {}
  }
  function readMissionsCompleted() {
    try {
      return parseInt(localStorage.getItem(STORAGE.missionsCompleted) || '0', 10);
    } catch (e) { return 0; }
  }
  function bumpMissionsCompletedTotal() {
    try {
      const v = readMissionsCompleted() + 1;
      localStorage.setItem(STORAGE.missionsCompleted, String(v));
    } catch (e) {}
  }

  function animOpts() {
    let speed = 1;
    try {
      const v = localStorage.getItem(STORAGE.animSpeed);
      if (v === 'fast') speed = 2;
      else if (v === 'instant') speed = 0;
    } catch (e) {}
    const reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { speed, reducedMotion: reduced };
  }

  // ── Public surface ──────────────────────────────────────────
  function describeState() {
    if (!currentState) return null;
    const proseLines = Narrate ? Narrate.describeForState(currentState) : [];
    return {
      phase: currentState.phase,
      turn: currentState.turn,
      maxTurns: currentState.maxTurns,
      mission: currentState.missionDef ? {
        id: currentState.missionDef.id,
        name: currentState.missionDef.name,
      } : null,
      runScore: runState ? runState.runScore : 0,
      units: currentState.units.map(u => ({
        id: u.id, side: u.side, type: u.type, at: u.at,
        hp: u.hp, maxHp: u.maxHp,
        hasMoved: u.hasMoved, hasActed: u.hasActed,
        intent: u.intent ? { ...u.intent } : null,
      })),
      forecasts: currentState.forecasts.slice(),
      pendingActions: currentState.pendingPlayerActions.slice(),
      legalActionsBySelected: legalActionsForSelected(),
      prose: proseLines,
    };
  }

  function legalActionsForSelected() {
    if (!currentState || !currentState.selectedUnitId) return [];
    const heroId = currentState.selectedUnitId;
    const hero = S.unitById(currentState, heroId);
    if (!hero) return [];
    const moves = [];
    if (!hero.hasMoved) {
      const stats = U.statsFor(hero.type);
      const reach = S.reachableTiles(currentState, hero.at, stats.move);
      for (const t of reach.keys()) moves.push({ kind: 'move', unitId: heroId, toTile: t });
    }
    const actions = hero.hasActed ? [] : U.legalActionTargets(currentState, heroId);
    return moves.concat(actions);
  }

  function performAction(action) {
    if (!currentState || currentState.phase !== 'plan' || resolving) return false;
    if (!action || !action.kind) return false;
    queueAction(action);
    return true;
  }

  function endTurn() {
    if (!currentState || currentState.phase !== 'plan' || resolving) return false;
    confirmTurn();
    return true;
  }

  function reset() { resetToTitle(); }
  function _getState() { return currentState ? S.clone(currentState) : null; }

  window.Hearthguard = {
    init, describeState, performAction, endTurn, reset, _getState,
    dev: {
      State: S, Units: U, Missions: M, AI: window.HearthguardAI,
      Resolver: R, Render, Input,
      runScenarios() { return R.runDevScenarios(); },
    },
  };
})();
