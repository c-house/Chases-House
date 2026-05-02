/* ═══════════════════════════════════════════════════════════════
   Hearthguard — resolver.js
   Pure. Turn-resolution engine implementing the simultaneous-attack
   rule: enemies pre-commit to (targetTile, damage), then resolve
   sequentially against whoever occupies the targetTile at resolution
   time. This is the marquee mechanic; the bug-class that kills ItB
   clones is structurally prevented by computing the attack table
   BEFORE applying any damage.
   Exposes window.HearthguardResolver.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const S  = window.HearthguardState;
  const U  = window.HearthguardUnits;
  const AI = window.HearthguardAI;
  const M  = window.HearthguardMissions;

  // ── Phase G helpers ──────────────────────────────────────────
  function isMissionLost(state) {
    return S.livingVillagers(state).length === 0;
  }

  function isMissionWon(state) {
    return state.turn > state.maxTurns && S.livingVillagers(state).length > 0;
  }

  function evaluateMissionEnd(state) {
    const lost = isMissionLost(state);
    const ended = lost || state.turn > state.maxTurns;
    if (!ended) return null;

    const def = state.missionDef;
    const startVillagers = def.initialUnits.filter(u => u.type === 'villager').length;
    const startEnemies   = def.initialUnits.filter(u => U.statsFor(u.type).side === 'enemy').length;
    const totalEnemiesInMission = startEnemies +
      Object.values(def.spawnSchedule || {}).reduce((n, arr) => n + arr.length, 0);

    const saved = lost ? 0 : S.livingVillagers(state).length;
    const villagersHit = startVillagers - saved;
    const kills = totalEnemiesInMission - S.livingEnemies(state).length;
    const unspent = lost ? 0 : Math.max(0, state.maxTurns - (state.turn - 1));
    const perfect = !lost && villagersHit === 0 && S.livingEnemies(state).length === 0;

    const subtotal = saved * 100 + kills * 25 + unspent * 10;
    const bonus = perfect ? 50 : 0;
    const total = subtotal + bonus;

    return { ended: true, won: !lost, saved, kills, unspent, perfect, subtotal, bonus, total };
  }

  // ── Phase A: apply player actions in queue order ─────────────
  function applyPendingPlayerActions(state) {
    let s = state;
    const events = [];
    for (const action of s.pendingPlayerActions) {
      let r;
      switch (action.kind) {
        case 'move':
          r = U.applyMove(s, action.unitId, action.toTile);
          break;
        case 'push':
          r = U.applyPush(s, action.unitId, action.targetTile);
          break;
        case 'pull':
          r = U.applyPull(s, action.unitId, action.targetTile);
          break;
        case 'swap':
          r = U.applySwap(s, action.unitId, action.tileA, action.tileB);
          break;
        default:
          continue;
      }
      s = r.state;
      events.push(...r.events);
    }
    // Drain queue
    s = S.clone(s);
    s.pendingPlayerActions = [];
    return { state: s, events };
  }

  // ── Phase C+D: simultaneous enemy attacks ────────────────────
  // Build attack table from PRE-attack positions, then apply sequentially
  // against tile-occupant-at-resolution-time.
  function applyEnemyAttacks(state) {
    let s = state;
    const events = [];

    const attacks = s.units
      .filter(u => u.side === 'enemy' && u.hp > 0 && u.intent && u.intent.targetTile)
      .map(u => ({
        attackerId: u.id,
        targetTile: u.intent.targetTile,
        damage: u.intent.damage,
        kind: u.intent.kind,
        pushDir: u.intent.pushDir || null,
        sourceTile: u.intent.sourceTile,
      }))
      .sort((a, b) => {
        if (a.targetTile < b.targetTile) return -1;
        if (a.targetTile > b.targetTile) return 1;
        return a.attackerId < b.attackerId ? -1 : 1;
      });

    for (const atk of attacks) {
      const attacker = S.unitById(s, atk.attackerId);
      if (!attacker || attacker.hp <= 0) continue;

      events.push({
        kind: 'attack',
        attackerId: atk.attackerId,
        attackerType: attacker.type,
        targetTile: atk.targetTile,
        attackKind: atk.kind,
        dmg: atk.damage,
      });

      const occupant = S.unitAt(s, atk.targetTile);
      if (!occupant) {
        events.push({ kind: 'attack-whiff', attackerId: atk.attackerId, targetTile: atk.targetTile });
        continue;
      }

      const r1 = U.applyDamage(s, occupant.id, atk.damage, { source: atk.attackerId, kind: atk.kind });
      s = r1.state;
      events.push(...r1.events);

      if (atk.kind === 'melee+push' && atk.pushDir) {
        const stillThere = S.unitAt(s, atk.targetTile);
        if (stillThere && stillThere.id === occupant.id) {
          const r2 = U.applyShove(s, occupant.id, atk.pushDir);
          s = r2.state;
          events.push(...r2.events);
        }
      }
    }

    return { state: s, events };
  }

  // ── Phase H: end-of-turn cleanup + spawns + AI ───────────────
  function runEndOfTurnPhase(state) {
    let s = S.clone(state);
    const events = [];

    // 1. Reset hero per-turn flags
    for (const u of s.units) {
      if (u.side === 'hero' && u.hp > 0) {
        u.hasMoved = false;
        u.hasActed = false;
      }
      if (u.intent) u.intent = null;
    }

    // 2. Realize forecasts whose forTurn matches current turn
    const arrivingNow = (s.forecasts || []).filter(f => f.forTurn === s.turn);
    const remainingForecasts = (s.forecasts || []).filter(f => f.forTurn !== s.turn);
    s.forecasts = remainingForecasts;

    let unitCounters = {};
    for (const u of s.units) {
      const m = (u.id || '').match(/^(.+)-(\d+)$/);
      if (m) {
        const t = m[1];
        const n = parseInt(m[2], 10);
        unitCounters[t] = Math.max(unitCounters[t] || 0, n);
      }
    }

    for (const f of arrivingNow) {
      let tile = f.at;
      if (tile === 'random-edge') {
        const pick = M.pickRandomEdgeTile(s, s.rngSeed);
        s.rngSeed = pick.seed;
        tile = pick.tile;
        if (!tile) continue;
      }

      unitCounters[f.type] = (unitCounters[f.type] || 0) + 1;
      const newUnit = U.makeUnit(f.type, tile, { n: unitCounters[f.type] });

      const blocker = S.unitAt(s, tile);
      if (blocker) {
        events.push({ kind: 'spawn-collision', at: tile, displacedId: blocker.id, attemptedType: f.type });
        const r = U.applyDamage(s, blocker.id, 1, { kind: 'spawn-collision' });
        s = r.state;
        events.push(...r.events);
        continue;
      }
      s.units.push(newUnit);
      events.push({ kind: 'spawn', unitId: newUnit.id, type: f.type, at: tile });
    }

    // 3. New forecasts for next turn (turn+1 spawns)
    const upcoming = M.forecastsForNextTurn(s.missionDef, s.turn);
    for (const f of upcoming) {
      events.push({ kind: 'forecast', at: f.at, type: f.type, forTurn: f.forTurn });
    }
    s.forecasts = upcoming;

    // 4. AI: enemies move + set intents
    s = AI.advanceAllEnemies(s);

    s.phase = 'plan';
    return { state: s, events };
  }

  // ── Public: resolveTurn (called when player presses Confirm) ─
  function resolveTurn(state) {
    let s = S.clone(state);
    const events = [];

    s.phase = 'resolve';

    // Phase A — player actions
    const pa = applyPendingPlayerActions(s);
    s = pa.state;
    events.push(...pa.events);

    if (isMissionLost(s)) {
      s.phase = 'mission-end';
      s.missionScore = evaluateMissionEnd(s);
      s.events = events;
      return { state: s, events };
    }

    // Phase C+D — enemy attacks (simultaneous)
    const at = applyEnemyAttacks(s);
    s = at.state;
    events.push(...at.events);

    if (isMissionLost(s)) {
      s.phase = 'mission-end';
      s.missionScore = evaluateMissionEnd(s);
      s.events = events;
      return { state: s, events };
    }

    // Phase F — turn boundary
    s = S.clone(s);
    s.turn += 1;
    events.push({ kind: 'turn-end', turn: s.turn - 1 });

    // Phase G — mission-end check (won)
    if (s.turn > s.maxTurns) {
      s.phase = 'mission-end';
      s.missionScore = evaluateMissionEnd(s);
      s.events = events;
      return { state: s, events };
    }

    // Phase H — cleanup + spawns + AI
    const eot = runEndOfTurnPhase(s);
    s = eot.state;
    events.push(...eot.events);

    s.events = events;
    return { state: s, events };
  }

  // ── Mission boot ─────────────────────────────────────────────
  function startMission(runState, missionDef) {
    const initialUnits = M.buildInitialUnits(missionDef);
    let s = S.createMissionState(runState, missionDef, initialUnits);

    // Initial forecasts (turn 2 spawns shown at turn 1)
    s = S.clone(s);
    s.forecasts = M.forecastsForNextTurn(missionDef, s.turn);

    // Initial enemy intents (no movement at mission start — they're placed already)
    s = AI.computeInitialIntents(s);

    return s;
  }

  // ═══════════════════════════════════════════════════════════════
  // DEV: scenario tests for the marquee mechanic.
  // Run via window.Hearthguard.dev.runScenarios() in the console.
  // Returns { passed, failed, results }.
  // ═══════════════════════════════════════════════════════════════
  function runDevScenarios() {
    const results = [];

    function record(name, ok, detail) {
      results.push({ name, ok, detail });
    }

    function makeTestState(units, opts) {
      const def = M.byIndex(0);
      const run = S.createRunState({ seed: 42 });
      const counters = {};
      const built = units.map(u => {
        counters[u.type] = (counters[u.type] || 0) + 1;
        return U.makeUnit(u.type, u.at, { n: counters[u.type] });
      });
      let s = S.createMissionState(run, def, built);
      s = S.clone(s);
      s.forecasts = [];
      if (opts && opts.intents) {
        for (const it of opts.intents) {
          const u = S.unitById(s, it.unitId);
          if (u) u.intent = it;
        }
      }
      return s;
    }

    // ── Scenario 1: Knight pushes goblin into wall → goblin takes 1 damage ──
    try {
      let s = makeTestState([
        { type: 'knight', at: 'D7' },
        { type: 'goblin', at: 'D8' },
        { type: 'villager', at: 'A8' },
      ]);
      s = S.clone(s);
      s.pendingPlayerActions = [
        { kind: 'push', unitId: 'knight-1', targetTile: 'D8' },
      ];
      const result = resolveTurn(s);
      const goblin = S.unitById(result.state, 'goblin-1');
      const wallEvt = result.events.find(e => e.kind === 'collision-wall' && e.unitId === 'goblin-1');
      const ok = goblin && goblin.hp === 0 && goblin.at === null && !!wallEvt;
      record('S1: push-into-wall kills 1HP goblin', ok,
        ok ? 'goblin died on wall collision' :
             'goblin hp=' + (goblin && goblin.hp) + ' at=' + (goblin && goblin.at) + ' wallEvt=' + !!wallEvt);
    } catch (err) {
      record('S1: push-into-wall', false, 'threw: ' + err.message);
    }

    // ── Scenario 2: Knight pushes goblin into another goblin → both take 1 ──
    try {
      let s = makeTestState([
        { type: 'knight', at: 'C5' },
        { type: 'goblin', at: 'D5' },
        { type: 'goblin', at: 'E5' },
        { type: 'villager', at: 'A8' },
      ]);
      s = S.clone(s);
      s.pendingPlayerActions = [
        { kind: 'push', unitId: 'knight-1', targetTile: 'D5' },
      ];
      const result = resolveTurn(s);
      const g1 = S.unitById(result.state, 'goblin-1');
      const g2 = S.unitById(result.state, 'goblin-2');
      const ok = g1 && g1.hp === 0 && g2 && g2.hp === 0 && g1.at === null && g2.at === null;
      record('S2: push goblin into goblin → both die (1HP each, mutual collision)',
        ok,
        ok ? 'both goblins died from collision' :
             'g1.hp=' + (g1 && g1.hp) + ' g2.hp=' + (g2 && g2.hp));
    } catch (err) {
      record('S2: collision', false, 'threw: ' + err.message);
    }

    // ── Scenario 3 (the marquee): goblin telegraphs hit on D3; player pushes
    //    second goblin onto D3; both goblins die — one from collision, one from
    //    the redirected attack. ──
    try {
      let s = makeTestState([
        { type: 'knight', at: 'B4' },
        { type: 'goblin', at: 'D4' },           // attacker, will hit D3
        { type: 'goblin', at: 'C4' },           // pawn that we push onto D3
        { type: 'villager', at: 'D2' },         // would have died if not redirected
        { type: 'villager', at: 'A8' },
        { type: 'villager', at: 'B8' },
      ], {
        intents: [
          { unitId: 'goblin-1', kind: 'melee', sourceTile: 'D4', targetTile: 'D3', damage: 1, pushDir: null },
        ],
      });
      // Player: knight pushes goblin-2 east from C4 → D4? But D4 is occupied by goblin-1.
      // Better setup: Knight at C3, goblin-1 (attacker) at D5 telegraphing D4, goblin-2
      // at C4. Knight pushes goblin-2 east from C4 → D4, intercepting.
      s = makeTestState([
        { type: 'knight',   at: 'C3' },
        { type: 'goblin',   at: 'D5' },         // attacker
        { type: 'goblin',   at: 'C4' },         // will be pushed
        { type: 'villager', at: 'D3' },         // original target
        { type: 'villager', at: 'A8' },
        { type: 'villager', at: 'B8' },
      ], {
        intents: [
          { unitId: 'goblin-1', kind: 'melee', sourceTile: 'D5', targetTile: 'D4', damage: 1, pushDir: null },
        ],
      });
      // Hmm — to make the marquee scenario work, the GOBLIN must telegraph onto a tile
      // we redirect another unit onto. Let knight stand on C3, push goblin-2 (at D3)
      // east → E3? No — we want goblin-2 to end up on D4 where goblin-1 is targeting.
      // Setup: goblin-1 (attacker) at D6 telegraphs melee on D5. Knight at C5 pushes
      // goblin-2 (at D5? no, would block telegraph). Try: goblin-1 at E4 telegraphs
      // D4 (its west). Knight at B4 pushes goblin-2 (at C4) east → D4. Now D4 is
      // occupied by goblin-2, and goblin-1's attack at D4 hits goblin-2.
      s = makeTestState([
        { type: 'knight',   at: 'B4' },
        { type: 'goblin',   at: 'E4' },         // attacker, telegraphs D4 (west neighbor)
        { type: 'goblin',   at: 'C4' },         // we push this east → D4
        { type: 'villager', at: 'A8' },
        { type: 'villager', at: 'B8' },
        { type: 'villager', at: 'C8' },
      ], {
        intents: [
          { unitId: 'goblin-1', kind: 'melee', sourceTile: 'E4', targetTile: 'D4', damage: 1, pushDir: null },
        ],
      });
      s = S.clone(s);
      s.pendingPlayerActions = [
        { kind: 'push', unitId: 'knight-1', targetTile: 'C4' },
      ];
      const result = resolveTurn(s);
      const g1 = S.unitById(result.state, 'goblin-1');     // attacker
      const g2 = S.unitById(result.state, 'goblin-2');     // pushed pawn
      // After resolution:
      //  - Phase A: knight pushes C4 east → D4 (since C4 is east of B4? actually east
      //    of B4 is C4, so direction is E. Pushed unit moves further east: C4 → D4. ✓)
      //  - Phase D: goblin-1 attacks D4. D4 is occupied by goblin-2 (just pushed there).
      //    goblin-2 (1HP) takes 1 damage → dies.
      //  - But goblin-1 itself is unharmed by its own attack.
      // Verify: g2 dead, g1 alive.
      const villagersAlive = S.livingVillagers(result.state).length;
      const ok = g2 && g2.hp === 0 && g1 && g1.hp > 0 && villagersAlive === 3;
      record('S3 ★ MARQUEE: redirect attack onto enemy (push C4 east, goblin@E4 hits D4 → kills pushed goblin)',
        ok,
        ok ? 'goblin-2 redirected into D4 and killed by goblin-1\'s attack; villagers unhit' :
             'g1.hp=' + (g1 && g1.hp) + ' g2.hp=' + (g2 && g2.hp) + ' villagers=' + villagersAlive);
    } catch (err) {
      record('S3 marquee', false, 'threw: ' + err.message);
    }

    // ── Scenario 4: Mage swaps two adjacent units ──
    // Swap effects must be verified via the events log because Phase H may
    // re-position enemies via AI after Phase A has already swapped them.
    try {
      let s = makeTestState([
        { type: 'mage',   at: 'C5' },
        { type: 'goblin', at: 'D5' },
        { type: 'troll',  at: 'D6' },
        { type: 'villager', at: 'A8' },
        { type: 'villager', at: 'B8' },
        { type: 'villager', at: 'F8' },
      ]);
      s = S.clone(s);
      s.pendingPlayerActions = [
        { kind: 'swap', unitId: 'mage-1', tileA: 'D5', tileB: 'D6' },
      ];
      const result = resolveTurn(s);
      const swapEvt = result.events.find(e => e.kind === 'swap' && e.tileA === 'D5' && e.tileB === 'D6');
      const goblinFromEvt = swapEvt && (swapEvt.aId === 'goblin-1' || swapEvt.bId === 'goblin-1');
      const trollFromEvt  = swapEvt && (swapEvt.aId === 'troll-1'  || swapEvt.bId === 'troll-1');
      const ok = !!swapEvt && goblinFromEvt && trollFromEvt;
      record('S4: Mage swaps two adjacent units',
        ok,
        ok ? 'swap event fired with goblin-1↔troll-1 between D5/D6' :
             'no matching swap event; events=' + JSON.stringify(result.events.filter(e=>e.kind==='swap')));
    } catch (err) {
      record('S4: mage-swap', false, 'threw: ' + err.message);
    }

    // ── Scenario 5: All villagers fall → mission ends mid-resolution ──
    try {
      let s = makeTestState([
        { type: 'knight', at: 'A1' },
        { type: 'goblin', at: 'D7' },
        { type: 'goblin', at: 'E7' },
        { type: 'goblin', at: 'F7' },
        { type: 'villager', at: 'D8' },
        { type: 'villager', at: 'E8' },
        { type: 'villager', at: 'F8' },
      ], {
        intents: [
          { unitId: 'goblin-1', kind: 'melee', sourceTile: 'D7', targetTile: 'D8', damage: 1, pushDir: null },
          { unitId: 'goblin-2', kind: 'melee', sourceTile: 'E7', targetTile: 'E8', damage: 1, pushDir: null },
          { unitId: 'goblin-3', kind: 'melee', sourceTile: 'F7', targetTile: 'F8', damage: 1, pushDir: null },
        ],
      });
      s = S.clone(s);
      s.pendingPlayerActions = []; // player passes
      const result = resolveTurn(s);
      const villagersAlive = S.livingVillagers(result.state).length;
      const ok = result.state.phase === 'mission-end'
              && villagersAlive === 0
              && result.state.missionScore
              && result.state.missionScore.won === false;
      record('S5: mission-end fires when all villagers fall',
        ok,
        ok ? 'phase=mission-end, won=false, score=' + result.state.missionScore.total :
             'phase=' + result.state.phase + ' villagers=' + villagersAlive);
    } catch (err) {
      record('S5: mission-end', false, 'threw: ' + err.message);
    }

    const passed = results.filter(r => r.ok).length;
    const failed = results.length - passed;
    /* eslint-disable no-console */
    console.group('Hearthguard Resolver — dev scenarios');
    for (const r of results) {
      const fn = r.ok ? console.log : console.error;
      fn((r.ok ? '✓' : '✗') + ' ' + r.name + (r.detail ? ' — ' + r.detail : ''));
    }
    console.log('Passed: ' + passed + ' / ' + results.length);
    console.groupEnd();
    /* eslint-enable no-console */
    return { passed, failed, results };
  }

  window.HearthguardResolver = {
    resolveTurn,
    startMission,
    isMissionLost, isMissionWon, evaluateMissionEnd,
    runEndOfTurnPhase,
    runDevScenarios,
  };
})();
