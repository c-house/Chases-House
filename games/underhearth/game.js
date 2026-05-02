/* ═══════════════════════════════════════════════════════════════════════
   Underhearth — game.js
   Orchestrator + FSM + RNG + persistence (mid-run save only in Phase 1;
   memorial + ghost lands in Phase 3).
   Owns the canonical `state` object and routes intents through engine.
   Exposes window.Underhearth.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const E   = window.UnderhearthEntities;
  const D   = window.UnderhearthDungeon;
  const Eng = window.UnderhearthEngine;
  const R   = window.UnderhearthRender;
  const I   = window.UnderhearthInput;
  const A   = window.UnderhearthAudio;
  const S   = window.UnderhearthStorage;

  if (!E || !D || !Eng || !R || !I || !A || !S) {
    console.error('Underhearth: a required module failed to load.',
      { E: !!E, D: !!D, Eng: !!Eng, R: !!R, I: !!I, A: !!A, S: !!S });
    return;
  }

  const RUN_VERSION = 1;
  const FOV_RADIUS = 8;
  const TUTORIAL_KEY = 'underhearth-tutorial-seen';

  function tutorialSeen() {
    try { return localStorage.getItem(TUTORIAL_KEY) === '1'; } catch (_) { return false; }
  }
  function markTutorialSeen() {
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (_) {}
  }

  // ── State + RNG ────────────────────────────────────────────────────────

  let state = null;
  let rng = null;        // { next, getState, setState }

  function makeRng(seed) {
    let s = seed >>> 0;
    return {
      next() {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      getState() { return s; },
      setState(v) { s = v >>> 0; },
    };
  }

  function djb2(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return h >>> 0;
  }

  function randomSeedString() {
    // 8-char alphanumeric — readable, paste-friendly
    const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
    let s = '';
    for (let i = 0; i < 8; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
    return s;
    // NB: Math.random above is for the *seed string* (one-time pre-game),
    // not for any in-game roll. All gameplay randomness flows through `rng`.
  }

  // ── FSM ────────────────────────────────────────────────────────────────

  // FSM state strings match the data-screen / data-overlay attributes used by index.html's CSS.
  const FSM_STATES = ['title', 'playing', 'inventory', 'targeting', 'death', 'memorial', 'how-to-play', 'settings'];

  function setFsm(next) {
    if (!FSM_STATES.includes(next)) return;
    state.fsm = next;
    R.syncScreen(state);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  function start(seedString, cls, opts) {
    opts = opts || {};
    const seed = (seedString || '').trim() || randomSeedString();
    const seedInt = djb2(seed);
    rng = makeRng(seedInt);

    state = blankState();
    state.seed = seed;
    state.seedInt = seedInt;
    state.daily = !!opts.daily;
    state.cls = cls || 'archer';
    state.ids = E.generateIdAliases(rng.next);
    const base = E.classBase(state.cls);
    state.player = {
      x: 0, y: 0,
      hp: base.hp, hpMax: base.hp,
      mp: base.mp, mpMax: base.mp,
      hunger: 1000, energy: 0, speed: 100, statuses: [],
    };

    const ghostHint = S.loadGhost();
    let floor = D.generate(rng.next, state.depth, ghostHint);
    if (!floor) {
      rng.next(); // burn one and retry
      floor = D.generate(rng.next, state.depth, ghostHint);
      if (!floor) { console.error('Underhearth: generation impossible'); return; }
    }
    state.floor = floor;
    state.player.x = state.floor.playerStart.x;
    state.player.y = state.floor.playerStart.y;
    state.rngState = rng.getState();

    R.init(state);
    recomputeFOV();
    log({ kind: 'flavor', text: 'You enter the underhearth.' });

    // First-time-ever players get the floor-1 tutorial popups before the
    // FSM moves to 'playing'. Subsequent runs skip straight in.
    if (!tutorialSeen() && state.depth === 1) {
      state.htpStep = 1;
      document.body.dataset.htpStep = '1';
      setFsm('how-to-play');
    } else {
      setFsm('playing');
    }
    R.renderFrame(state);
    saveRun();

    // first-input audio unlock
    A.ensure();
  }

  function abandon() {
    clearRun();
    setFsm('title');
  }

  function openMemorial() {
    if (!state) state = blankState();
    state.memorialTab = state.memorialTab || 'free';
    setFsm('memorial');
    R.renderFrame(state);
  }

  function advanceTutorial() {
    if (!state) return;
    state.htpStep = (state.htpStep || 1) + 1;
    if (state.htpStep > 3) {
      finishTutorial();
      return;
    }
    document.body.dataset.htpStep = String(state.htpStep);
  }
  function finishTutorial() {
    if (!state) return;
    markTutorialSeen();
    state.htpStep = 0;
    delete document.body.dataset.htpStep;
    setFsm('playing');
  }

  function loadFromMemorial(seed, cls, daily) {
    if (!seed) return;
    setFsm('title');
    const seedInput = document.querySelector('.seed-input');
    if (seedInput) seedInput.value = seed;
    document.querySelectorAll('.class-card').forEach(c => {
      c.setAttribute('aria-pressed', c.dataset.class === cls ? 'true' : 'false');
    });
    // Don't auto-start — let the player confirm with Begin Descent.
  }

  function tryAgain() {
    // Same class, fresh seed.
    const cls = state ? state.cls : selectedClassFromUi();
    start(randomSeedString(), cls);
  }

  // ── Intent routing ─────────────────────────────────────────────────────

  function onIntent(intent) {
    if (!state) return;
    if (state.fsm === 'title') return; // title's own buttons handle interaction
    if (intent.kind === 'close-overlay') {
      if (['inventory', 'targeting', 'how-to-play', 'settings'].includes(state.fsm)) setFsm('playing');
      return;
    }
    if (intent.kind === 'open-inventory') { if (state.fsm === 'playing') setFsm('inventory');    return; }
    if (intent.kind === 'open-help')      { if (state.fsm === 'playing') setFsm('how-to-play');  return; }
    if (intent.kind === 'open-memorial')  { if (state.fsm !== 'death')   { /* phase 3 wires this */ } return; }
    if (intent.kind === 'open-settings')  { setFsm('settings'); return; }

    if (state.fsm !== 'playing') return; // modals freeze input

    // Click-to-walk: phase-1 collapse to a single-step toward the click.
    if (intent.kind === 'click-tile') {
      const dx = Math.sign(intent.x - state.player.x);
      const dy = Math.sign(intent.y - state.player.y);
      if (dx === 0 && dy === 0) return;
      intent = { kind: 'move', dx, dy };
    }

    const { events: pe } = Eng.executePlayerTurn(state, intent, rng);
    state.rngState = rng.getState();
    let died = applyEvents(pe);

    if (!died && advancesTurn(intent, pe)) {
      const { events: me } = Eng.executeMonsterTurns(state, rng);
      state.rngState = rng.getState();
      died = applyEvents(me);
      recomputeFOV();
    }

    R.renderFrame(state);
    if (!died) saveRun();
  }

  function advancesTurn(intent, events) {
    // Walking into a wall or 'no-stairs' / 'nothing-here' do not advance the turn.
    if (events.some(ev => ev.kind === 'bump' || ev.kind === 'no-stairs' || ev.kind === 'nothing-here')) return false;
    return ['move', 'wait', 'pickup'].includes(intent.kind);
  }

  function applyEvents(events) {
    let died = false;
    let interesting = false;
    for (const ev of events) {
      switch (ev.kind) {
        case 'descend': descendFloor(); A.play('stairs'); interesting = true; break;
        case 'death': onDeath(ev); A.play('death'); died = true; break;
        case 'hit':
          A.play(ev.crit ? 'crit' : 'hit');
          if (ev.target === 'player') {
            log({ kind: 'threat', text: 'The ' + ev.label + (ev.crit ? ' CRITS you for ' : ' hits you for ') + ev.dmg + '.' });
            R.shake(ev.crit ? 140 : 80);
            rumble(ev.crit ? 240 : 120, 0.6, 0.7);
            interesting = true;
          } else {
            log({ kind: 'info', text: 'You ' + (ev.crit ? 'CRIT ' : 'hit ') + 'the ' + ev.label + ' for ' + ev.dmg + '.' });
            rumble(80, 0.4, 0.5);
          }
          break;
        case 'miss':
          A.play('miss');
          if (ev.target === 'player') log({ kind: 'info', text: 'The ' + ev.label + ' swings — and misses.' });
          else                        log({ kind: 'info', text: 'You miss the ' + ev.label + '.' });
          break;
        case 'kill':
          A.play('kill');
          log({ kind: 'info', text: 'You kill the ' + ev.label + '.' });
          interesting = true;
          break;
        case 'pickup-gold':
          A.play('gold');
          log({ kind: 'flavor', text: 'You pocket ' + ev.qty + ' gold.' });
          interesting = true;
          break;
        case 'pickup':
          A.play('pickup');
          log({ kind: 'info', text: 'You pick up ' + ev.label + '.' });
          interesting = true;
          break;
        case 'item-here':
          log({ kind: 'info', text: 'There is ' + ev.label + ' here. (g to pick up)' });
          interesting = true;
          break;
        case 'on-stairs-down':
          log({ kind: 'flavor', text: 'There are stairs leading down here. (> to descend)' });
          interesting = true;
          break;
        case 'no-stairs':
          log({ kind: 'info', text: 'There are no stairs down here.' });
          break;
        case 'bump':
          break; // silent
        case 'nothing-here':
          log({ kind: 'info', text: 'There is nothing to pick up here.' });
          break;
        case 'quaff': A.play('quaff'); log({ kind: 'magic', text: 'You quaff the ' + ev.label + '.' }); interesting = true; break;
        case 'read':  A.play('read');  log({ kind: 'magic', text: 'You read the ' + ev.label + '.' }); interesting = true; break;
        case 'identified':
          A.play('identify');
          log({ kind: 'flavor', text: 'It was ' + ev.label + '!' });
          break;
        case 'eff-heal':       log({ kind: 'magic', text: 'You feel restored — +' + ev.amount + ' HP.' }); break;
        case 'eff-paralysis':  log({ kind: 'lethal', text: 'You cannot move!' }); break;
        case 'eff-haste':      log({ kind: 'magic', text: 'You feel quick.' }); break;
        case 'eff-might':      log({ kind: 'magic', text: 'You feel mighty.' }); break;
        case 'eff-mapping':    log({ kind: 'magic', text: 'A map of the floor unfolds in your mind.' }); break;
        case 'eff-teleport':   log({ kind: 'magic', text: 'The world folds — you are elsewhere.' }); interesting = true; break;
        case 'eff-identify':   log({ kind: 'magic', text: 'Your possessions reveal themselves' + (ev.count ? ' (' + ev.count + ' items).' : '.') }); break;
        case 'eff-confuse':    log({ kind: 'lethal', text: 'Your thoughts scatter.' }); break;
        case 'eff-fizzle':     log({ kind: 'info', text: 'Nothing happens.' }); break;
        case 'cant-use':       log({ kind: 'info', text: 'You cannot use that.' }); break;
        case 'no-such-item':   log({ kind: 'info', text: 'That item is gone.' }); break;
        case 'drop':           log({ kind: 'info', text: 'You drop the ' + ev.label + '.' }); interesting = true; break;
        case 'ghost-found':    A.play('ghost'); log({ kind: 'flavor', text: 'You find your previous self. The cold has been kind to your gear.' }); interesting = true; break;
      }
    }
    // Low-HP heartbeat trigger (once per crossing into danger zone)
    if (state && state.player && state.player.hp > 0 && state.player.hp <= state.player.hpMax * 0.25 && !state._lowHpBuzzed) {
      A.play('heartbeat');
      state._lowHpBuzzed = true;
    } else if (state && state.player && state.player.hp > state.player.hpMax * 0.4) {
      state._lowHpBuzzed = false;
    }
    if (interesting) I.haltWalk();
    return died;
  }

  // Gamepad rumble helper. Iterates connected pads; safe no-op when none.
  function rumble(durationMs, strong, weak) {
    if (!window.SharedGamepad) return;
    const pads = window.SharedGamepad.listGamepads();
    for (const p of pads) {
      window.SharedGamepad.rumble(p.index, { duration: durationMs, strongMagnitude: strong, weakMagnitude: weak });
    }
  }

  function descendFloor() {
    state.depth++;
    const ghostHint = S.loadGhost();
    let floor = D.generate(rng.next, state.depth, ghostHint);
    if (!floor) { rng.next(); floor = D.generate(rng.next, state.depth, ghostHint); }
    state.rngState = rng.getState();
    if (!floor) {
      console.error('Underhearth: descent generation failed at depth', state.depth);
      state.depth--; // back out
      return;
    }
    state.floor = floor;
    state.player.x = floor.playerStart.x;
    state.player.y = floor.playerStart.y;
    state.turn++; // descent costs a turn for the counter; monster phase is skipped (new floor).
    recomputeFOV();
    log({ kind: 'flavor', text: 'You descend to the ' + E.ordinal(state.depth) + ' floor.' });
    if (floor.ghosts && floor.ghosts.length) {
      log({ kind: 'flavor', text: 'A familiar shape lies somewhere on this floor…' });
    }
  }

  function onDeath(ev) {
    const invSnapshot = state.inv.map(it => ({ kind: it.kind, sub: it.sub, qty: it.qty }));
    const death = {
      cause:    ev.label || ev.cause || 'something unseen',
      depth:    state.depth,
      turns:    state.turn,
      gold:     state.gold,
      seed:     state.seed,
      daily:    !!state.daily,
      ts:       Date.now(),
      cls:      state.cls,
      win:      false,
      initials: getPlayerInitials(),
      inv:      invSnapshot,
    };
    state.death = death;
    setFsm('death');
    S.recordDeath(death);
    S.saveGhost({
      depth: state.depth,
      x: state.player.x, y: state.player.y,
      items: invSnapshot,
      gold:  state.gold,
    });
    S.clearRun();
  }

  function getPlayerInitials() {
    // Use the cross-game player handle if set (Snake/Pac-Man precedent).
    // Read directly to avoid depending on PlayerHandle being loaded.
    try {
      const raw = localStorage.getItem('player-handle');
      if (raw) {
        const parsed = JSON.parse(raw);
        const handle = typeof parsed === 'string' ? parsed : (parsed && parsed.handle);
        if (handle) return handle.toUpperCase();
      }
    } catch (_) {}
    return 'YOU';
  }

  // ── FOV bookkeeping ────────────────────────────────────────────────────

  function recomputeFOV() {
    if (!state || !state.floor) return;
    const cols = state.floor.cols, rows = state.floor.rows;
    const seen = state.floor.seen;
    // Demote currently-visible to remembered
    for (let i = 0; i < cols * rows; i++) if (seen[i] === 2) seen[i] = 1;
    const fov = Eng.computeFOV(state, state.player.x, state.player.y, FOV_RADIUS);
    for (let i = 0; i < cols * rows; i++) if (fov[i]) seen[i] = 2;
  }

  // ── Persistence ────────────────────────────────────────────────────────
  // Delegates to UnderhearthStorage. saveRun is a no-op when the game is on
  // the title screen or in a death state — those have nothing meaningful to
  // resume.

  function saveRun() {
    if (!state) return;
    if (state.fsm === 'death' || state.fsm === 'title') return;
    S.saveRun(state);
  }
  function clearRun() { S.clearRun(); }
  function loadRun()  { return S.loadRun(); }

  // ── Helpers ────────────────────────────────────────────────────────────

  function blankState() {
    return {
      v: RUN_VERSION,
      fsm: 'title',
      seed: '', seedInt: 0, rngState: 0,
      daily: false,
      startedAt: Date.now(),
      cls: 'archer',
      player: null,
      depth: 1,
      floor: null,
      ids: { potions: {}, scrolls: {}, wands: {}, discovered: { potions: {}, scrolls: {}, wands: {} } },
      inv: [],
      gold: 0,
      log: [],
      turn: 0,
      death: null,
      ghost: null,
    };
  }

  function log(line) {
    if (!state) return;
    line.turn = state.turn;
    R.appendLogLine(state, line);
  }

  function selectedClassFromUi() {
    const card = document.querySelector('.class-card[aria-pressed="true"]');
    return card ? card.dataset.class : 'archer';
  }
  function seedFromUi() {
    const el = document.querySelector('.seed-input');
    return el ? el.value.trim() : '';
  }

  // ── Boot ───────────────────────────────────────────────────────────────

  function boot() {
    // Wire title-screen + in-game button clicks.
    document.addEventListener('click', function (e) {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      if (act === 'begin')          { e.preventDefault(); start(seedFromUi(), selectedClassFromUi(), { daily: false }); }
      else if (act === 'daily')     { e.preventDefault(); const today = new Date().toISOString().slice(0, 10); const i = document.querySelector('.seed-input'); if (i) i.value = today; start(today, selectedClassFromUi(), { daily: true }); }
      else if (act === 'restart')   { e.preventDefault(); tryAgain(); }
      else if (act === 'memorial')  { e.preventDefault(); openMemorial(); }
      else if (act === 'back-to-title') { e.preventDefault(); abandon(); }
      else if (act === 'open-settings') { e.preventDefault(); /* design-pass overlay handles it */ }
      else if (act === 'inv-use')      { e.preventDefault(); onIntent({ kind: 'use', uid: t.dataset.uid }); }
      else if (act === 'inv-drop')     { e.preventDefault(); onIntent({ kind: 'drop', uid: t.dataset.uid }); }
      else if (act === 'memorial-tab') { e.preventDefault(); state.memorialTab = t.dataset.tab; R.renderFrame(state); }
      else if (act === 'memorial-load'){ e.preventDefault(); loadFromMemorial(t.dataset.seed, t.dataset.cls, t.dataset.daily === 'true'); }
      else if (act === 'htp-next')     { e.preventDefault(); advanceTutorial(); }
      else if (act === 'htp-skip')     { e.preventDefault(); finishTutorial(); }
    });

    // Resume mid-run if present.
    const saved = loadRun();
    if (saved) {
      state = saved;
      rng = makeRng(state.seedInt);
      rng.setState(state.rngState);
      R.init(state);
      setFsm(saved.fsm === 'title' ? 'title' : 'playing');
      R.renderFrame(state);
      log({ kind: 'flavor', text: 'You resume your descent.' });
    } else {
      state = blankState();
      setFsm('title');
    }

    I.init({ onIntent });
  }

  window.Underhearth = {
    start, abandon, tryAgain,
    getState() { return state; },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
