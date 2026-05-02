/* ═══════════════════════════════════════════════════════════════
   Uno — game.js
   State, rules, state machine, action dispatch, bootstrap.
   Exposes window.UnoGame.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const COLORS = ['red', 'yellow', 'green', 'blue'];
  const PHASES = {
    TITLE: 'TITLE', SETUP: 'SETUP', DEALING: 'DEALING',
    PLAYER_TURN: 'PLAYER_TURN', AWAITING_COLOR: 'AWAITING_COLOR',
    AWAITING_UNO_WINDOW: 'AWAITING_UNO_WINDOW',
    RESOLVING_EFFECT: 'RESOLVING_EFFECT',
    ROUND_END: 'ROUND_END', MATCH_END: 'MATCH_END'
  };
  const SAVE_KEY  = 'uno_save_v1';
  const HIGH_KEY  = 'uno_high_v1';
  const TUTOR_KEY = 'uno_seen_tutorial_v1';

  const DEFAULT_NAMES = ['Mom', 'Dad', 'Sis', 'Bro', 'Gran', 'Pop', 'Doc', 'Aunt Jay'];

  const UNO_WINDOW_MS = 1200;       // grace before auto-bot catches
  const AI_THINK_MIN  = 700;
  const AI_THINK_MAX  = 1300;
  const ANIM_PLAY_MS  = 320;        // matches CSS card-fly + buffer

  // ── State ──────────────────────────────────────────────
  let state = null;
  let pendingTimers = [];           // for cleanup on quit/round-end

  function clearTimers() {
    pendingTimers.forEach((t) => clearTimeout(t));
    pendingTimers = [];
  }
  function later(fn, ms) {
    const t = setTimeout(() => {
      pendingTimers = pendingTimers.filter((x) => x !== t);
      fn();
    }, ms);
    pendingTimers.push(t);
    return t;
  }

  // ── PRNG (Mulberry32) ──────────────────────────────────
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Deterministic-ish seed; advances per-card-drawn within a round.
  function makeRng() {
    return { state: state.rngState >>> 0 };
  }
  function rng() {
    state.rngState = (state.rngState + 0x6D2B79F5) >>> 0;
    let t = state.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ── Deck ───────────────────────────────────────────────
  function buildDeck() {
    const deck = [];
    let id = 0;
    COLORS.forEach((color) => {
      // 1 zero
      deck.push({ id: 'c' + (id++), color, value: 0, points: 0 });
      // 2 each of 1–9, skip, reverse, draw2
      for (let n = 1; n <= 9; n++) {
        deck.push({ id: 'c' + (id++), color, value: n, points: n });
        deck.push({ id: 'c' + (id++), color, value: n, points: n });
      }
      ['skip', 'reverse', 'draw2'].forEach((v) => {
        deck.push({ id: 'c' + (id++), color, value: v, points: 20 });
        deck.push({ id: 'c' + (id++), color, value: v, points: 20 });
      });
    });
    // Wilds
    for (let i = 0; i < 4; i++) {
      deck.push({ id: 'c' + (id++), color: 'wild', value: 'wild',  points: 50 });
      deck.push({ id: 'c' + (id++), color: 'wild', value: 'wild4', points: 50 });
    }
    return deck;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  // ── Rules ──────────────────────────────────────────────
  function isPlayable(card, top, currentColor /*, state */) {
    if (!top) return true;
    if (card.color === 'wild') return true;
    if (card.color === currentColor) return true;
    if (card.value === top.value && top.color !== 'wild') return true;
    return false;
  }

  function scoreHand(cards) {
    let s = 0;
    for (let i = 0; i < cards.length; i++) s += cards[i].points;
    return s;
  }

  // Draw N cards into a player's hand. Triggers reshuffle if drawPile empties.
  function drawN(playerIdx, n) {
    const hand = state.hands[playerIdx];
    let drawn = 0;
    for (let i = 0; i < n; i++) {
      if (state.drawPile.length === 0) {
        if (!reshuffleDiscard()) break;
      }
      hand.push(state.drawPile.pop());
      drawn++;
    }
    return drawn;
  }

  function reshuffleDiscard() {
    if (state.discard.length <= 1) return false;
    const top = state.discard.pop();
    // Reset Wilds back to colorless before shuffling
    state.discard.forEach((c) => { if (c.color === 'wild') { /* identity preserved */ } });
    state.drawPile = state.discard;
    state.discard = [top];
    shuffle(state.drawPile);
    return true;
  }

  // ── Setup / new round ──────────────────────────────────
  function newGame(config) {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
    const players = [{ id: 'p0', name: 'You', kind: 'human', slot: 0 }];
    const used = ['You'];
    for (let i = 0; i < config.opponents; i++) {
      const name = pickName(used);
      used.push(name);
      players.push({ id: 'p' + (i + 1), name: name, kind: 'ai', difficulty: config.difficulty });
    }
    state = {
      config: {
        mode: 'solo',
        matchType: config.matchType,
        matchTarget: 500,
        rules: config.rules,
        opponents: config.opponents,
        difficulty: config.difficulty
      },
      phase: PHASES.DEALING,
      players: players,
      hands: players.map(() => []),
      drawPile: [],
      discard: [],
      currentColor: 'red',
      turnIndex: 0,
      direction: 1,
      drawStack: 0,
      stackingValue: null,        // 'draw2' | 'wild4' | null — what's being stacked
      unoCalls: {},
      unoWindow: null,
      scores: players.map(() => 0),
      roundsPlayed: 0,
      seed: seed,
      rngState: seed,
      events: [],
      stats: { roundStartMs: 0 }
    };
    players.forEach((p) => { state.unoCalls[p.id] = false; });
    dealRound();
  }

  function pickName(used) {
    const free = DEFAULT_NAMES.filter((n) => used.indexOf(n) === -1);
    if (free.length === 0) return 'Bot ' + (used.length);
    return free[Math.floor(Math.random() * free.length)];
  }

  function dealRound() {
    const deck = buildDeck();
    state.rngState = (state.seed + state.roundsPlayed * 13) >>> 0;
    shuffle(deck);
    state.drawPile = deck;
    state.discard = [];
    state.players.forEach((_, i) => { state.hands[i] = []; });

    // 7 cards each
    for (let r = 0; r < 7; r++) {
      for (let i = 0; i < state.players.length; i++) {
        state.hands[i].push(state.drawPile.pop());
      }
    }
    // Flip starter
    let starter = state.drawPile.pop();
    while (starter.value === 'wild4') {
      // Mattel: if first flip is wild+4, return it and re-flip
      state.drawPile.unshift(starter);
      shuffle(state.drawPile);
      starter = state.drawPile.pop();
    }
    state.discard.push(starter);
    state.currentColor = starter.color === 'wild' ? COLORS[Math.floor(rng() * 4)] : starter.color;
    state.direction = 1;
    state.turnIndex = 0;
    state.drawStack = 0;
    state.stackingValue = null;
    state.players.forEach((p) => { state.unoCalls[p.id] = false; });
    state.unoWindow = null;
    state.stats.roundStartMs = Date.now();
    state.phase = PHASES.PLAYER_TURN;

    // Apply starter's effect to player 0 (Mattel rule)
    pushEvent({ type: 'round-start' });
    applyStarterEffect(starter);

    flushAndRender();
    scheduleAITurn();
  }

  function applyStarterEffect(card) {
    if (card.color === 'wild') {
      // Plain Wild: player 0 chooses color (skip the auto-color from above)
      if (state.players[0].kind === 'human') {
        state.phase = PHASES.AWAITING_COLOR;
      } else {
        state.currentColor = pickAIColor(0);
        pushEvent({ type: 'wild-color', color: state.currentColor });
      }
      return;
    }
    if (card.value === 'skip') {
      pushEvent({ type: 'skip', skippedId: state.players[0].id });
      advanceTurn();
    } else if (card.value === 'reverse') {
      state.direction *= -1;
      pushEvent({ type: 'reverse' });
      // 2-player game: reverse acts as skip
      if (state.players.length === 2) advanceTurn();
    } else if (card.value === 'draw2') {
      drawN(0, 2);
      pushEvent({ type: 'forced-draw', playerId: 'p0', count: 2 });
      advanceTurn();
    }
  }

  // ── Event bus ──────────────────────────────────────────
  function pushEvent(ev) { state.events.push(ev); }

  function flushAndRender() {
    const events = state.events;
    state.events = [];
    if (window.UnoRender) {
      window.UnoRender.render(state);
      window.UnoRender.applyEvents(state, events);
    }
    if (window.UnoAudio) window.UnoAudio.syncEvents(events);
  }

  // ── Turn flow ──────────────────────────────────────────
  function nextIndex(idx) {
    return (idx + state.direction + state.players.length) % state.players.length;
  }
  function advanceTurn() {
    state.turnIndex = nextIndex(state.turnIndex);
  }

  function scheduleAITurn() {
    if (state.phase !== PHASES.PLAYER_TURN) return;
    const cur = state.players[state.turnIndex];
    if (!cur || cur.kind !== 'ai') return;
    const delay = AI_THINK_MIN + Math.floor(Math.random() * (AI_THINK_MAX - AI_THINK_MIN));
    later(() => runAITurn(state.turnIndex), delay);
  }

  function runAITurn(playerIdx) {
    if (state.phase !== PHASES.PLAYER_TURN) return;
    if (state.turnIndex !== playerIdx) return;
    const ai = window.UnoAI;
    if (!ai) { drawAndPass(playerIdx); return; }
    const action = ai.chooseAction(playerIdx, snapshot(), state.players[playerIdx].difficulty);
    dispatchAI(playerIdx, action);
  }

  function dispatchAI(playerIdx, action) {
    if (!action) { drawAndPass(playerIdx); return; }
    if (action.type === 'play') {
      const hand = state.hands[playerIdx];
      const card = hand.find((c) => c.id === action.cardId);
      if (!card) { drawAndPass(playerIdx); return; }
      // AI may declare UNO simultaneously when about to drop to 1
      if (hand.length === 2) state.unoCalls[state.players[playerIdx].id] = true;
      playCardImpl(playerIdx, card, action.chosenColor || null);
    } else {
      drawAndPass(playerIdx);
    }
  }

  function drawAndPass(playerIdx) {
    const player = state.players[playerIdx];
    const drewIdx = state.hands[playerIdx].length;
    const drew = drawN(playerIdx, 1);
    pushEvent({ type: 'card-drawn', playerId: player.id, count: drew });
    // Draw-then-play: if drawn card is playable, AI plays it (humans get prompt)
    const top = state.discard[state.discard.length - 1];
    const drawnCard = state.hands[playerIdx][drewIdx];
    if (state.config.rules.drawThenPlay && drawnCard && isPlayable(drawnCard, top, state.currentColor)) {
      if (player.kind === 'ai') {
        if (state.hands[playerIdx].length === 2) state.unoCalls[player.id] = true;
        const chosenColor = drawnCard.color === 'wild' ? pickAIColor(playerIdx) : null;
        later(() => playCardImpl(playerIdx, drawnCard, chosenColor), 600);
        flushAndRender();
        return;
      } else {
        // Human: render, await click. Mark drawnCard as freshly-drawn for UI prompt.
        state.justDrewIdx = drewIdx;
        flushAndRender();
        return;
      }
    }
    state.justDrewIdx = -1;
    advanceTurn();
    flushAndRender();
    scheduleAITurn();
  }

  // ── Core: play a card ──────────────────────────────────
  function playCardImpl(playerIdx, card, chosenColor) {
    const player = state.players[playerIdx];
    const hand = state.hands[playerIdx];
    const handBefore = hand.length;
    const top = state.discard[state.discard.length - 1];

    // Stacking check: if drawStack > 0, only same-value stack legal
    if (state.drawStack > 0) {
      if (!state.config.rules.stacking) return; // shouldn't reach
      if (card.value !== state.stackingValue) return;
    } else {
      if (!isPlayable(card, top, state.currentColor)) return;
    }

    // Remove from hand
    const idx = hand.indexOf(card);
    if (idx === -1) return;
    hand.splice(idx, 1);

    // Push event
    pushEvent({
      type: 'card-played',
      playerId: player.id,
      card: card,
      handAfter: hand.length,
      fromRect: getHandCardRect(playerIdx, idx)
    });

    state.justDrewIdx = -1;
    state.discard.push(card);

    // Win check
    if (hand.length === 0) {
      // Going-out card's effect still applies to next player per Mattel rule
      applyEffect(card, chosenColor);
      endRound(playerIdx);
      return;
    }

    // UNO grace: if just dropped to 1 and didn't call, open punishment window
    if (hand.length === 1) {
      const calledEarly = !!state.unoCalls[player.id];
      if (!calledEarly) {
        openUnoWindow(player.id);
      }
    }

    applyEffect(card, chosenColor);
  }

  function applyEffect(card, chosenColor) {
    const playerIdx = indexById(state.discard[state.discard.length - 1] ? null : null) || state.turnIndex;

    // Color effect
    if (card.color === 'wild') {
      if (chosenColor) {
        state.currentColor = chosenColor;
        pushEvent({ type: 'wild-color', color: chosenColor });
      } else {
        // Human pick: enter modal
        state.phase = PHASES.AWAITING_COLOR;
        flushAndRender();
        return;
      }
    } else {
      state.currentColor = card.color;
    }

    // Action effects
    if (card.value === 'reverse') {
      state.direction *= -1;
      pushEvent({ type: 'reverse' });
      if (state.players.length === 2) {
        // Acts as skip in 2-player
        state.turnIndex = nextIndex(state.turnIndex); // self again — actually skip the (only) opponent
      }
    } else if (card.value === 'skip') {
      const skipped = state.players[nextIndex(state.turnIndex)];
      pushEvent({ type: 'skip', skippedId: skipped.id });
      state.turnIndex = nextIndex(state.turnIndex);
    } else if (card.value === 'draw2') {
      if (state.config.rules.stacking) {
        state.drawStack += 2;
        state.stackingValue = 'draw2';
        // If next player can stack, leave it to them; else force draw immediately
        if (!nextPlayerCanStack()) {
          settleDrawStack();
        }
      } else {
        const targetIdx = nextIndex(state.turnIndex);
        drawN(targetIdx, 2);
        pushEvent({ type: 'forced-draw', playerId: state.players[targetIdx].id, count: 2 });
        state.turnIndex = nextIndex(state.turnIndex); // skip target
      }
    } else if (card.value === 'wild4') {
      if (state.config.rules.stacking) {
        state.drawStack += 4;
        state.stackingValue = 'wild4';
        if (!nextPlayerCanStack()) {
          settleDrawStack();
        }
      } else {
        const targetIdx = nextIndex(state.turnIndex);
        drawN(targetIdx, 4);
        pushEvent({ type: 'forced-draw', playerId: state.players[targetIdx].id, count: 4 });
        state.turnIndex = nextIndex(state.turnIndex);
      }
    }

    advanceTurn();
    flushAndRender();
    scheduleAITurn();
  }

  function nextPlayerCanStack() {
    const targetIdx = nextIndex(state.turnIndex);
    const hand = state.hands[targetIdx];
    return hand.some((c) => c.value === state.stackingValue);
  }

  function settleDrawStack() {
    const targetIdx = nextIndex(state.turnIndex);
    drawN(targetIdx, state.drawStack);
    pushEvent({ type: 'forced-draw', playerId: state.players[targetIdx].id, count: state.drawStack });
    state.drawStack = 0;
    state.stackingValue = null;
    state.turnIndex = nextIndex(state.turnIndex); // skip target
  }

  function indexById(id) {
    for (let i = 0; i < state.players.length; i++) if (state.players[i].id === id) return i;
    return -1;
  }

  function getHandCardRect(playerIdx, cardIdxInHand) {
    if (state.players[playerIdx].id !== 'p0') {
      // Opponent — use their fan position
      const opp = document.querySelector('.opponent[data-player-id="' + state.players[playerIdx].id + '"] .opponent-fan');
      if (opp) return opp.getBoundingClientRect();
      return null;
    }
    const handEl = document.getElementById('hand');
    if (!handEl) return null;
    const cardEls = handEl.querySelectorAll('.card');
    const target = cardEls[cardIdxInHand] || cardEls[0];
    return target ? target.getBoundingClientRect() : null;
  }

  // ── UNO window ─────────────────────────────────────────
  function openUnoWindow(targetId) {
    state.unoWindow = { targetId: targetId, closeAt: Date.now() + UNO_WINDOW_MS };
    later(() => {
      if (state.unoWindow && state.unoWindow.targetId === targetId) {
        state.unoWindow = null;
        flushAndRender();
      }
    }, UNO_WINDOW_MS);
    scheduleAIUnoCatch(targetId);
  }

  function scheduleAIUnoCatch(targetId) {
    const targetIsBot = state.players.find((p) => p.id === targetId).kind === 'ai';
    state.players.forEach((p) => {
      if (p.id === targetId) return;
      if (p.kind !== 'ai') return;
      const cfg = window.UnoAI ? window.UnoAI.getDifficultyConfig(p.difficulty) : { autoUnoCatch: 0.5 };
      // Bots are slightly less aggressive at catching their fellow bots
      const prob = targetIsBot ? cfg.autoUnoCatch * 0.6 : cfg.autoUnoCatch;
      if (Math.random() > prob) return;
      const offset = 200 + Math.random() * (UNO_WINDOW_MS - 400);
      later(() => doCatch(p.id, targetId), offset);
    });
  }

  function doCatch(callerId, targetId) {
    if (!state.unoWindow || state.unoWindow.targetId !== targetId) return;
    state.unoWindow = null;
    const targetIdx = indexById(targetId);
    drawN(targetIdx, 2);
    pushEvent({ type: 'uno-caught', targetId: targetId, callerId: callerId });
    flushAndRender();
  }

  // ── Round / match end ──────────────────────────────────
  function endRound(winnerIdx) {
    state.phase = PHASES.ROUND_END;
    const winner = state.players[winnerIdx];
    let pts = 0;
    state.hands.forEach((h, i) => { if (i !== winnerIdx) pts += scoreHand(h); });
    state.scores[winnerIdx] += pts;
    state.roundsPlayed++;
    pushEvent({ type: 'round-end', winnerId: winner.id, points: pts });
    clearTimers();
    persistHighScores(winnerIdx, pts);

    flushAndRender();
    showRoundEndOverlay(winnerIdx, pts);

    // Confetti only when the human wins
    if (winner.id === 'p0' && window.UnoRender) window.UnoRender.fireConfetti();

    // Match-end check
    if (state.config.matchType === 'play-to-500' && state.scores[winnerIdx] >= state.config.matchTarget) {
      // Defer to "End match" click
    }
  }

  function showRoundEndOverlay(winnerIdx, pts) {
    const winner = state.players[winnerIdx];
    const eyebrow = document.getElementById('round-eyebrow');
    const title   = document.getElementById('round-title');
    const summary = document.getElementById('round-summary');
    if (eyebrow) eyebrow.textContent = 'Round ' + state.roundsPlayed;
    if (title)   title.textContent   = (winner.id === 'p0' ? 'You went out!' : winner.name + ' went out');
    if (summary) {
      summary.innerHTML = '';
      // Show point breakdown
      state.players.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'round-summary-row' + (i === winnerIdx ? ' winner' : '');
        const lbl = document.createElement('span');
        lbl.textContent = (p.id === 'p0' ? 'You' : p.name) +
          (i === winnerIdx ? ' — won round' : ' — ' + state.hands[i].length + ' card' + (state.hands[i].length === 1 ? '' : 's') + ' left');
        const val = document.createElement('span');
        val.className = 'points';
        val.textContent = i === winnerIdx ? '+' + pts : '−' + scoreHand(state.hands[i]);
        row.appendChild(lbl); row.appendChild(val);
        summary.appendChild(row);
      });
      // Match score running total
      const total = document.createElement('div');
      total.className = 'round-summary-row';
      total.style.marginTop = '0.4rem';
      const tlbl = document.createElement('span'); tlbl.textContent = 'Match · You';
      const tval = document.createElement('span'); tval.className = 'points'; tval.textContent = String(state.scores[indexById('p0')] || 0);
      total.appendChild(tlbl); total.appendChild(tval);
      summary.appendChild(total);
    }

    // First-out match: end immediately. Play-to-N: continue if winner < target.
    const winnerScore = state.scores[winnerIdx];
    const matchOver = state.config.matchType === 'first-out'
                  || (state.config.matchType === 'play-to-500' && winnerScore >= state.config.matchTarget);

    const nextBtn = document.getElementById('btn-next-round');
    const endBtn  = document.getElementById('btn-end-match');
    if (nextBtn) nextBtn.style.display = matchOver ? 'none' : '';
    if (endBtn)  endBtn.textContent = matchOver ? 'See match results' : 'End match';

    if (window.UnoRender) window.UnoRender.showOverlay('round');
  }

  function showMatchEnd() {
    state.phase = PHASES.MATCH_END;
    let bestIdx = 0;
    for (let i = 1; i < state.scores.length; i++) if (state.scores[i] > state.scores[bestIdx]) bestIdx = i;
    const title = document.getElementById('match-title');
    const summary = document.getElementById('match-summary');
    const winner = state.players[bestIdx];
    if (title) title.textContent = (winner.id === 'p0' ? 'You won the match!' : winner.name + ' won the match');
    if (summary) {
      summary.innerHTML = '';
      const ranked = state.players.map((p, i) => ({ p: p, i: i, s: state.scores[i] })).sort((a, b) => b.s - a.s);
      ranked.forEach((r, rank) => {
        const row = document.createElement('div');
        row.className = 'round-summary-row' + (r.i === bestIdx ? ' winner' : '');
        const lbl = document.createElement('span'); lbl.textContent = (rank + 1) + '. ' + (r.p.id === 'p0' ? 'You' : r.p.name);
        const val = document.createElement('span'); val.className = 'points'; val.textContent = String(r.s);
        row.appendChild(lbl); row.appendChild(val);
        summary.appendChild(row);
      });
    }
    pushEvent({ type: 'match-end', winnerId: winner.id });
    if (window.UnoAudio) window.UnoAudio.syncEvents([{ type: 'match-end' }]);
    if (window.UnoRender) window.UnoRender.showOverlay('match');
    clearSavedRound();
  }

  // ── Persistence ────────────────────────────────────────
  function persistHighScores(winnerIdx, pts) {
    if (state.players[winnerIdx].id !== 'p0') return;
    let hi = {};
    try { hi = JSON.parse(localStorage.getItem(HIGH_KEY) || '{}'); } catch (e) { hi = {}; }
    const ms = Date.now() - state.stats.roundStartMs;
    if (!hi.fastestRound || ms < hi.fastestRound.ms) {
      hi.fastestRound = { ms: ms, date: new Date().toISOString().slice(0, 10) };
    }
    if (!hi.biggestHaul || pts > hi.biggestHaul.points) {
      hi.biggestHaul = { points: pts, date: new Date().toISOString().slice(0, 10) };
    }
    hi.totalRoundsWon = (hi.totalRoundsWon || 0) + 1;
    try { localStorage.setItem(HIGH_KEY, JSON.stringify(hi)); } catch (e) {}
  }

  function saveSnapshot() {
    if (!state) return;
    if (state.phase === PHASES.TITLE || state.phase === PHASES.MATCH_END) return;
    if (state.phase === PHASES.ROUND_END) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        state: state,
        savedAt: Date.now()
      }));
    } catch (e) {}
  }
  function loadSnapshot() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const wrap = JSON.parse(raw);
      // Discard saves >7 days old
      if (!wrap.savedAt || Date.now() - wrap.savedAt > 7 * 86400000) return null;
      return wrap.state;
    } catch (e) { return null; }
  }
  function clearSavedRound() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  // ── Action API (called from input layer + DOM events) ──
  function handleHandCardClick(handIdx) {
    if (state.phase !== PHASES.PLAYER_TURN) return;
    const cur = state.players[state.turnIndex];
    if (cur.id !== 'p0') return;
    const hand = state.hands[indexById('p0')];
    const card = hand[handIdx];
    if (!card) return;
    const top = state.discard[state.discard.length - 1];
    if (state.drawStack > 0) {
      if (card.value !== state.stackingValue) return;
    } else {
      if (!isPlayable(card, top, state.currentColor)) return;
    }
    if (card.color === 'wild') {
      // Show color picker; on pick, finalise
      state.pendingWild = { handIdx: handIdx };
      state.phase = PHASES.AWAITING_COLOR;
      flushAndRender();
      if (window.UnoRender) window.UnoRender.showOverlay('color');
      return;
    }
    playCardImpl(indexById('p0'), card, null);
  }
  function handleColorPick(color) {
    if (state.phase !== PHASES.AWAITING_COLOR) return;
    if (window.UnoRender) window.UnoRender.hideOverlays();
    if (state.pendingWild) {
      const handIdx = state.pendingWild.handIdx;
      state.pendingWild = null;
      const hand = state.hands[indexById('p0')];
      const card = hand[handIdx];
      state.phase = PHASES.PLAYER_TURN;
      playCardImpl(indexById('p0'), card, color);
    } else {
      // Starter wild: just set color
      state.currentColor = color;
      state.phase = PHASES.PLAYER_TURN;
      pushEvent({ type: 'wild-color', color: color });
      flushAndRender();
      scheduleAITurn();
    }
  }
  function handleDrawClick() {
    if (state.phase !== PHASES.PLAYER_TURN) return;
    const cur = state.players[state.turnIndex];
    if (cur.id !== 'p0') return;
    drawAndPass(indexById('p0'));
  }
  function handleUnoClick() {
    const myIdx = indexById('p0');
    const myHand = state.hands[myIdx];
    if (myHand.length === 1 && state.unoWindow && state.unoWindow.targetId === 'p0') {
      // Catch yourself: cancels the window
      state.unoCalls.p0 = true;
      state.unoWindow = null;
      pushEvent({ type: 'uno-called', playerId: 'p0' });
      flushAndRender();
      return;
    }
    if (myHand.length === 2 && state.players[state.turnIndex].id === 'p0') {
      state.unoCalls.p0 = true;
      pushEvent({ type: 'uno-called', playerId: 'p0' });
      flushAndRender();
    }
  }

  // ── Snapshot for AI (defensive copy) ───────────────────
  function snapshot() {
    return JSON.parse(JSON.stringify({
      players: state.players,
      hands: state.hands,
      discard: state.discard,
      drawPile: state.drawPile.length, // hide identities
      currentColor: state.currentColor,
      turnIndex: state.turnIndex,
      direction: state.direction,
      drawStack: state.drawStack,
      stackingValue: state.stackingValue,
      rules: state.config.rules
    }));
  }

  function pickAIColor(playerIdx) {
    const hand = state.hands[playerIdx];
    const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
    hand.forEach((c) => { if (c.color !== 'wild') counts[c.color]++; });
    let best = 'red', max = -1;
    COLORS.forEach((c) => { if (counts[c] > max) { best = c; max = counts[c]; } });
    if (max <= 0) best = COLORS[Math.floor(Math.random() * 4)];
    return best;
  }

  // ── Bootstrap ──────────────────────────────────────────
  function init(opts) {
    if (window.UnoRender) window.UnoRender.init({ root: opts.root });
    if (window.UnoInput) window.UnoInput.init({
      onCardClick: handleHandCardClick,
      onDrawClick: handleDrawClick,
      onCallUno: handleUnoClick,
      onColorPick: handleColorPick,
      onMenu: handleMenuClick,
      onConfirm: handleConfirm
    });
    wireDOM();
    showTitle();

    // Save-on-pagehide
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveSnapshot();
    });
    window.addEventListener('beforeunload', saveSnapshot);
  }

  function showTitle() {
    state = { phase: PHASES.TITLE };
    if (window.UnoRender) {
      window.UnoRender.render(state);
      window.UnoRender.showOverlay('title');
    }
    const continueBtn = document.getElementById('btn-continue');
    if (continueBtn) {
      const saved = loadSnapshot();
      continueBtn.hidden = !saved;
    }
  }

  function wireDOM() {
    // Title
    const playBtn = document.getElementById('btn-play');
    if (playBtn) playBtn.addEventListener('click', () => {
      if (window.UnoAudio) { window.UnoAudio.ensure(); window.UnoAudio.play('menu-confirm'); }
      if (window.UnoRender) window.UnoRender.showOverlay('setup');
    });
    const continueBtn = document.getElementById('btn-continue');
    if (continueBtn) continueBtn.addEventListener('click', () => {
      const saved = loadSnapshot();
      if (!saved) return;
      state = saved;
      if (window.UnoRender) {
        window.UnoRender.hideOverlays();
        window.UnoRender.render(state);
      }
      // Resume — if it was an AI's turn, schedule
      scheduleAITurn();
    });
    const howtoBtn = document.getElementById('btn-howto');
    if (howtoBtn) howtoBtn.addEventListener('click', () => {
      if (window.UnoRender) window.UnoRender.showOverlay('howto');
    });
    const howtoClose = document.getElementById('btn-howto-close');
    if (howtoClose) howtoClose.addEventListener('click', () => {
      if (state && state.phase === PHASES.TITLE) {
        if (window.UnoRender) window.UnoRender.showOverlay('title');
      } else {
        if (window.UnoRender) window.UnoRender.hideOverlays();
      }
    });

    // Setup
    const setupForm = {
      opponents: 3, difficulty: 'normal', matchType: 'first-out',
      rules: { stacking: true, drawThenPlay: true, jumpIn: false, sevenZero: false, forcePlay: false, challengeFour: false }
    };
    bindPills('setup-opponents', 'opponents', (v) => parseInt(v, 10), setupForm);
    bindPills('setup-difficulty', 'difficulty', null, setupForm);
    bindPills('setup-match', 'matchType', null, setupForm);
    bindToggles(setupForm);

    const startBtn = document.getElementById('btn-start');
    if (startBtn) startBtn.addEventListener('click', () => {
      if (window.UnoAudio) { window.UnoAudio.ensure(); window.UnoAudio.play('menu-confirm'); }
      if (window.UnoRender) window.UnoRender.hideOverlays();
      newGame(setupForm);
    });
    const backTitle = document.getElementById('btn-back-title');
    if (backTitle) backTitle.addEventListener('click', () => {
      if (window.UnoRender) window.UnoRender.showOverlay('title');
    });

    // Color picker quadrants
    document.querySelectorAll('#overlay-color [data-color]').forEach((btn) => {
      btn.addEventListener('click', () => handleColorPick(btn.dataset.color));
    });

    // Hand card clicks (delegation)
    const hand = document.getElementById('hand');
    if (hand) hand.addEventListener('click', (e) => {
      const cardEl = e.target.closest('.card');
      if (!cardEl || !hand.contains(cardEl)) return;
      const idx = parseInt(cardEl.dataset.index, 10);
      if (isFinite(idx)) handleHandCardClick(idx);
    });

    // Draw pile
    const drawPile = document.getElementById('draw-pile');
    if (drawPile) {
      drawPile.addEventListener('click', handleDrawClick);
      drawPile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDrawClick(); }
      });
    }

    // UNO
    const unoBtn = document.getElementById('uno-call');
    if (unoBtn) unoBtn.addEventListener('click', handleUnoClick);

    // Menu / pause
    const menuBtn = document.getElementById('hud-menu');
    if (menuBtn) menuBtn.addEventListener('click', handleMenuClick);
    const resumeBtn = document.getElementById('btn-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', () => {
      if (window.UnoRender) window.UnoRender.hideOverlays();
    });
    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) {
      muteBtn.textContent = window.UnoAudio && window.UnoAudio.getMuted() ? 'Unmute' : 'Mute';
      muteBtn.addEventListener('click', () => {
        if (!window.UnoAudio) return;
        const m = window.UnoAudio.getMuted();
        window.UnoAudio.setMuted(!m);
        muteBtn.textContent = !m ? 'Unmute' : 'Mute';
      });
    }
    const quitBtn = document.getElementById('btn-quit');
    if (quitBtn) quitBtn.addEventListener('click', () => {
      clearSavedRound();
      clearTimers();
      showTitle();
    });

    // Round-end
    const nextRound = document.getElementById('btn-next-round');
    if (nextRound) nextRound.addEventListener('click', () => {
      if (window.UnoRender) window.UnoRender.hideOverlays();
      dealRound();
    });
    const endMatch = document.getElementById('btn-end-match');
    if (endMatch) endMatch.addEventListener('click', showMatchEnd);

    // Match-end
    const playAgain = document.getElementById('btn-play-again');
    if (playAgain) playAgain.addEventListener('click', () => {
      if (window.UnoRender) {
        window.UnoRender.hideOverlays();
        window.UnoRender.showOverlay('setup');
      }
    });

    // Esc → pause
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state && state.phase !== PHASES.TITLE && state.phase !== PHASES.SETUP) {
        handleMenuClick();
      }
    });
  }

  function bindPills(containerId, key, transform, target) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        container.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        const val = pill.dataset[key === 'opponents' ? 'opponents' : key === 'difficulty' ? 'difficulty' : 'match'];
        target[key] = transform ? transform(val) : val;
      });
    });
  }
  function bindToggles(target) {
    document.querySelectorAll('.toggle-switch').forEach((sw) => {
      sw.addEventListener('click', () => {
        const rule = sw.dataset.rule;
        const on = !sw.classList.contains('on');
        sw.classList.toggle('on', on);
        sw.setAttribute('aria-pressed', on ? 'true' : 'false');
        target.rules[rule] = on;
      });
    });
  }

  function handleMenuClick() {
    const overlay = document.getElementById('overlay-pause');
    if (!overlay) return;
    if (overlay.classList.contains('hidden')) {
      if (window.UnoRender) window.UnoRender.showOverlay('pause');
    } else {
      if (window.UnoRender) window.UnoRender.hideOverlays();
    }
  }
  function handleConfirm() {
    // Used by keyboard/gamepad: play focused card, or fall back to draw
    const hand = document.getElementById('hand');
    if (!hand) return;
    const focused = hand.querySelector('.card.focused, .card:focus-visible');
    if (focused) {
      const idx = parseInt(focused.dataset.index, 10);
      if (isFinite(idx)) handleHandCardClick(idx);
    }
  }

  // ── Public API ─────────────────────────────────────────
  window.UnoGame = {
    init: init,
    isPlayable: isPlayable,
    scoreHand: scoreHand,
    PHASES: PHASES,
    COLORS: COLORS,
    // Test hooks
    _state: () => state
  };
})();
