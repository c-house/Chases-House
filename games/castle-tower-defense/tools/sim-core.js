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
  function waveStats(wave, hpMult) {
    const ENEMIES = E().ENEMIES;
    let hp = 0, bounty = 0, count = 0;
    for (const gDef of wave.enemies) {
      let def = ENEMIES[gDef.type];
      if (!def) continue;
      let n = gDef.count;
      const seen = new Set();
      while (def) {
        if (seen.has(def)) {
          throw new Error('ENEMIES splitsInto cycle reached from "' + gDef.type + '" — fix entities.js');
        }
        seen.add(def);
        hp += n * Math.round(def.hp * hpMult);
        bounty += n * def.bounty;
        count += n;
        const child = def.splitsInto && ENEMIES[def.splitsInto];
        n = child ? n * (def.splitCount || 2) : 0;
        def = child || null;
      }
    }
    return { hp, bounty, count, income: bounty + (wave.reward || 0) };
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
  function runScripted(map, difficulty, build, opts) {
    const engine = Eng();
    const policy = POLICIES[build];
    if (!policy) throw new Error('unknown scripted build "' + build + '"');
    const slowCall = !!(opts && opts.slowCall);
    const savedMaps = window.CTD3Maps;
    window.CTD3Maps = { byId: (id) => (id === map.id ? map : null) };
    try {
      const state = engine.createState(map.id, difficulty);
      const kills = {};
      let elapsed = 0;
      while (state.fsm !== 'wonRun' && state.fsm !== 'lostRun' && elapsed < MAX_SIM_MS) {
        policy(state);
        if (engine.canSendNextWave(state) && (!slowCall || state.prepCountdownMs <= 0)) {
          engine.sendNextWave(state);
        }
        engine.step(state, TICK_MS);
        for (const ev of state.events) if (ev.kind === 'kill') kills[ev.enemyType] = (kills[ev.enemyType] || 0) + 1;
        state.events.length = 0;
        elapsed += TICK_MS;
      }
      return {
        won: state.fsm === 'wonRun',
        timedOut: elapsed >= MAX_SIM_MS,
        lives: state.lives,
        gold: state.gold,
        goldEarned: state.goldEarned,
        wavesCleared: state.fsm === 'wonRun' ? state.waveTotal : state.waveIndex,
        simSec: Math.round(elapsed / 1000),
        kills
      };
    } finally {
      window.CTD3Maps = savedMaps;
    }
  }

  window.CTD3SimCore = { runScripted, computeCurves, waveStats, BUILDS, TICK_MS, MAX_SIM_MS };
})();
