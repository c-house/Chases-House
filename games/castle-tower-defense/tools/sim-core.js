/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — sim-core.js  (ADR-036 X-1)
   Shared scripted-build runner + static curve computation.
   ONE implementation, consumed by two callers:
     • tools/sim-harness.cjs (Node) — requires this after the
       game IIFE modules through its `global.window` shim.
     • tools/map-editor.html (browser) — loads it as a <script>
       alongside engine.js to power the "Simulate this map" panel.
   Pure sim: reads window.CTD3Entities + window.CTD3Engine lazily;
   no DOM, no Three, no require. Exposes window.CTD3SimCore.

   Map-resolution bridge: CTD3Engine.createState(mapId) resolves the
   id via window.CTD3Maps.byId. The editor never loads maps.js and the
   harness passes official map objects, so runScripted takes the map
   OBJECT and installs a single-map CTD3Maps facade around the run,
   restoring whatever was there afterward. No permanent CTD3Maps is
   defined here (it would collide with the real maps.js in the harness).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const E = () => window.CTD3Entities;
  const Eng = () => window.CTD3Engine;

  const TICK_MS = 1000 / 60;
  const MAX_SIM_MS = 60 * 60 * 1000; // hard cap per run; sim is deterministic and self-terminating

  // ─── Static curve computation (ADR-036 §2.2) ─────────────────
  // Split children (Slime → 2 Mini Slimes) count toward both wave HP and
  // income: they are real HP the towers must clear and real bounty paid.
  // The split chain is walked recursively so a future chain-split type
  // (child that itself splits) is counted, not silently dropped; a cycle
  // in ENEMIES splitsInto throws rather than hanging or undercounting.
  // ONE walk, used two ways. waveStatsByType returns the per-type breakdown the
  // ADR-040 D28 anchor rule needs; waveStats is its aggregation, which is what
  // the curve computation and the spawn-ceiling checks consume.
  //
  // These were briefly two separate walks guarded by a cross-check on their
  // totals. That guard was worthless and is gone: both totals are sums over the
  // same terms regardless of which TYPE each term is attributed to, so a
  // mis-attribution — the only error the per-type version can make that the
  // aggregate cannot — passed the cross-check while reporting a wrong ratio.
  // Deriving one from the other removes the divergence instead of watching for it.
  function waveStatsByType(wave, hpMult) {
    const ENEMIES = E().ENEMIES;
    const bodies = {}, hp = {}, bounty = {};
    for (const gDef of wave.enemies) {
      let def = ENEMIES[gDef.type];
      if (!def) continue;
      let n = gDef.count, name = gDef.type;
      const seen = new Set();
      while (def) {
        if (seen.has(def)) {
          throw new Error('ENEMIES splitsInto cycle reached from "' + gDef.type + '" — fix entities.js');
        }
        seen.add(def);
        bodies[name] = (bodies[name] || 0) + n;
        hp[name] = (hp[name] || 0) + n * Math.round(def.hp * hpMult);
        bounty[name] = (bounty[name] || 0) + n * def.bounty;
        const childName = def.splitsInto;
        const child = childName && ENEMIES[childName];
        n = child ? n * (def.splitCount || 2) : 0;
        name = childName;
        def = child || null;
      }
    }
    return { bodies, hp, bounty };
  }

  function waveStats(wave, hpMult) {
    const per = waveStatsByType(wave, hpMult);
    const sum = o => Object.values(o).reduce((s, v) => s + v, 0);
    const bounty = sum(per.bounty);
    return { hp: sum(per.hp), bounty, count: sum(per.bodies),
             income: bounty + (wave.reward || 0) };
  }

  function computeCurves(map) {
    const quiet = E().mergedDifficulty('quiet', map.difficultyOverrides);
    const rows = [];
    let cum = quiet.startGold;
    map.waves.forEach((w, i) => {
      const base = waveStats(w, 1.0);
      const q = waveStats(w, quiet.hpMult);
      rows.push({
        wave: i + 1,
        isBoss: !!w.isBoss,
        baseHp: base.hp,
        quietHp: q.hp,
        income: q.income,
        cumGoldBefore: cum,
        attrition: q.hp / cum
      });
      cum += q.income;
    });
    return rows;
  }

  // ─── Scripted build policies ─────────────────────────────────
  function cheapestTowerType() {
    let best = null, bestCost = Infinity;
    for (const [type, def] of Object.entries(E().TOWERS)) {
      if (def.tiers[0].cost < bestCost) { best = type; bestCost = def.tiers[0].cost; }
    }
    return best;
  }

  function emptySlots(state) {
    const used = new Set(state.towers.map(t => t.slotId));
    return state.mapDef.buildSlots.filter(s => !used.has(s.id));
  }

  function cheapestUpgrade(state) {
    let best = null, bestCost = Infinity;
    for (const tw of state.towers) {
      const next = E().TOWERS[tw.type].tiers[tw.tier + 1];
      if (next && next.cost < bestCost) { best = tw; bestCost = next.cost; }
    }
    return best ? { tower: best, cost: bestCost } : null;
  }

  const POLICIES = {
    // Always the globally cheapest affordable action; ties favor placement.
    'greedy-cheapest': function (state) {
      for (;;) {
        const slots = emptySlots(state);
        const type = cheapestTowerType();
        const placeCost = E().TOWERS[type].tiers[0].cost;
        const up = cheapestUpgrade(state);
        if (slots.length && placeCost <= state.gold && (!up || placeCost <= up.cost)) {
          if (Eng().place(state, slots[0].id, type) !== 'ok') return;
        } else if (up && up.cost <= state.gold) {
          if (Eng().upgrade(state, up.tower.id) !== 'ok') return;
        } else return;
      }
    },
    // Rangers on every slot, then max each one out in slot order (concentration).
    'ranger-heavy': function (state) {
      for (;;) {
        const slots = emptySlots(state);
        if (slots.length) {
          if (E().TOWERS.ranger.tiers[0].cost > state.gold) return;
          if (Eng().place(state, slots[0].id, 'ranger') !== 'ok') return;
          continue;
        }
        const tw = state.towers.find(t => E().TOWERS[t.type].tiers[t.tier + 1]);
        if (!tw) return;
        if (E().TOWERS[tw.type].tiers[tw.tier + 1].cost > state.gold) return;
        if (Eng().upgrade(state, tw.id) !== 'ok') return;
      }
    },
    // Mixed composition cycling through roles, then cheapest-upgrade-first.
    'balanced': function (state) {
      const comp = ['ranger', 'catapult', 'ranger', 'warden', 'mage', 'ranger', 'catapult'];
      for (;;) {
        const slots = emptySlots(state);
        if (slots.length) {
          const type = comp[state.towers.length % comp.length];
          if (E().TOWERS[type].tiers[0].cost > state.gold) return;
          if (Eng().place(state, slots[0].id, type) !== 'ok') return;
          continue;
        }
        const up = cheapestUpgrade(state);
        if (!up || up.cost > state.gold) return;
        if (Eng().upgrade(state, up.tower.id) !== 'ok') return;
      }
    }
  };

  const BUILDS = Object.keys(POLICIES);

  // ─── Sim runner ──────────────────────────────────────────────
  // Takes the map OBJECT (not an id): installs a single-map CTD3Maps
  // facade so CTD3Engine.createState resolves it, then restores.
  // opts.slowCall: wait out the ADR-036 D4 early-call countdown before
  // each send (forfeits every bonus) — the control arm for the
  // early-call check.
  // opts.endless / opts.seed / opts.maxWaves / opts.callEarly (ADR-037 C-1):
  // run the map in endless mode from a fixed seed. Endless prep AUTO-sends,
  // so the default arm never calls sendNextWave itself — it waits out every
  // countdown (no early-call bonus, maximum interest accrual). callEarly is
  // the opposite pole. maxWaves is a run cap so a build that refuses to die
  // is reported as capped rather than silently eating the whole sim budget.
  function runScripted(map, difficulty, build, opts) {
    const engine = Eng();
    const policy = POLICIES[build];
    if (!policy) throw new Error('unknown scripted build "' + build + '"');
    const o = opts || {};
    const slowCall = !!o.slowCall;
    const endless = !!o.endless;
    const maxWaves = o.maxWaves || 0;
    const savedMaps = window.CTD3Maps;
    window.CTD3Maps = { byId: (id) => (id === map.id ? map : null) };
    try {
      const state = engine.createState(map.id, difficulty,
        endless ? { endless: true, seed: o.seed != null ? o.seed : 1 } : undefined);
      const kills = {};
      let elapsed = 0, hitWaveCap = false;
      while (state.fsm !== 'wonRun' && state.fsm !== 'lostRun' && elapsed < MAX_SIM_MS) {
        policy(state);
        if (endless) {
          if (o.callEarly && engine.canSendNextWave(state)) engine.sendNextWave(state);
        } else if (engine.canSendNextWave(state) && (!slowCall || state.prepCountdownMs <= 0)) {
          engine.sendNextWave(state);
        }
        engine.step(state, TICK_MS);
        for (const ev of state.events) if (ev.kind === 'kill') kills[ev.enemyType] = (kills[ev.enemyType] || 0) + 1;
        state.events.length = 0;
        elapsed += TICK_MS;
        if (maxWaves && state.waveIndex >= maxWaves) { hitWaveCap = true; break; }
      }
      return {
        won: state.fsm === 'wonRun',
        lost: state.fsm === 'lostRun',
        timedOut: elapsed >= MAX_SIM_MS,
        hitWaveCap,
        lives: state.lives,
        gold: state.gold,
        goldEarned: state.goldEarned,
        goldSpent: state.goldSpent,
        interestEarned: state.interestEarned,
        livesBought: state.livesBought,
        wavesCleared: state.fsm === 'wonRun' ? state.waveTotal : state.waveIndex,
        simSec: Math.round(elapsed / 1000),
        kills
      };
    } finally {
      window.CTD3Maps = savedMaps;
    }
  }

  // ─── Figure-ground anchor rule (ADR-040 D28) ─────────────────
  // The ONE place the threshold and the low-contrast type set live. It sits in
  // sim-core rather than in the harness because this is the module both the Node
  // harness and the browser map-editor already share — a rule about wave
  // composition belongs beside waveStats, not inside one of its two consumers.
  //
  // THREE THINGS THIS RULE IS NOT, because each is easy to get wrong:
  //   1. "Anchor" names the wave-1 and wave-8 SLOTS, not an enemy type. There is
  //      no "anchor enemy".
  //   2. The low-contrast types are SUMMED, not checked individually — three
  //      types at 15% each is a 45% violation, not three passes.
  //   3. It does NOT constrain drake, juggernaut or captain. The drake leading
  //      Snowfall w8 (an ADR-040 exception) and Riverbend w8 (its OWNER map, so
  //      compliance rather than an exception), and the captain leading Mountain
  //      w8, are all outside this rule and must never be flagged.
  //
  // RELAXATION IS OWNED BY ADR-041 D41, which sets the measured figure-ground
  // separation each of these types must hold before this may be loosened — so a
  // future session amends that ADR and edits this constant, rather than fighting
  // an unattributed check. As of ADR-041's addendum (2026-07-26) the condition is
  // NOT met: ghost now passes on all three of its maps, but mini_slime still
  // fails on tidewater. This rule stands.
  const ANCHOR_RULE = {
    MAX_SHARE: 0.30,
    TYPES: ['ghost', 'slime', 'mini_slime'],
    SLOTS: [1, 8]
  };

  window.CTD3SimCore = { runScripted, computeCurves, waveStats, waveStatsByType,
                         ANCHOR_RULE, BUILDS, TICK_MS, MAX_SIM_MS };
})();
