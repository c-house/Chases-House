/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — engine.js
   Pure sim: tower behavior dispatch, projectile sim, wave manager.
   No DOM, no Three.js, no audio. ADR-028 §7, §8, §9.
   Exposes window.CTD3Engine.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const E = () => window.CTD3Entities;
  const M = () => window.CTD3Maps;

  // Constants (Appendix A)
  const HIT_FLASH_MS         = 80;
  const SPLASH_FX_MS         = 350;
  const GOLD_POPUP_MS        = 900;
  const CASTLE_FX_MS         = 350;
  const DEFEAT_FRAMES_DELAY  = 900;
  const AURA_SLOW_FLOOR_MS   = 250;   // Per-tick minimum slow duration (NOT an execution interval)
  const FIXED_STEP_MS        = 1000 / 60;
  const PREP_COUNTDOWN_MS    = 20000; // ADR-036 D4 early-call window (skipped for wave 1)

  // ─── Map baking ──────────────────────────────────────────────
  function bakeMap(map) {
    if (map._baked) return map;
    const segs = [];
    const cum = [];
    let total = 0;
    for (let i = 0; i < map.path.length - 1; i++) {
      const a = map.path[i], b = map.path[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      segs.push(len);
      total += len;
      cum.push(total);
    }
    map.segmentLengths = segs;
    map.cumulativeLengths = cum;
    map.totalLength = total;
    map._baked = true;
    return map;
  }

  function sampleOnPath(map, t) {
    const target = Math.max(0, Math.min(1, t)) * map.totalLength;
    let i = 0;
    while (i < map.cumulativeLengths.length && map.cumulativeLengths[i] < target) i++;
    if (i >= map.path.length - 1) {
      const last = map.path[map.path.length - 1];
      return { x: last.x, z: last.z };
    }
    const segStart = i === 0 ? 0 : map.cumulativeLengths[i - 1];
    const segLen = map.segmentLengths[i];
    const localT = segLen > 0 ? (target - segStart) / segLen : 0;
    const a = map.path[i], b = map.path[i + 1];
    return { x: a.x + (b.x - a.x) * localT, z: a.z + (b.z - a.z) * localT };
  }

  // ─── State factory ───────────────────────────────────────────
  function createState(mapId, difficulty, opts) {
    const map = bakeMap(M().byId(mapId));
    const diff = E().mergedDifficulty(difficulty, map.difficultyOverrides);
    return {
      fsm: 'prepWave',
      paused: false,
      mapId,
      mapDef: map,
      difficulty,
      difficultyMult: diff,

      gold: diff.startGold,
      lives: diff.startLives,
      startingGold: diff.startGold,
      startingLives: diff.startLives,
      goldEarned: 0,
      goldSpent: 0,

      waveIndex: 0,
      waveTotal: map.waves.length,
      waveProgress: null,
      // Early-call countdown (ADR-036 D4). 0 = no bonus window; wave 1's
      // prep (and the tutorial) never starts one — it arms on wave clear.
      prepCountdownMs: 0,
      fastForward: false,
      gameOverDelayMs: 0,
      gameOverTriggered: false,

      towers: [],
      enemies: [],
      projectiles: [],
      effects: [],

      selectedSlotId: null,
      selectedTowerId: null,
      paletteSelection: null,
      hoverSlotId: null,
      cursor: { x: 0, z: 0 },

      tutorialActive: !!(opts && opts.tutorial),
      tutorialStep: opts && opts.tutorial ? 'showPrompt' : 'done',

      events: []
    };
  }

  // ─── place/upgrade/sell return enums (ADR-028 §8) ──────────
  function place(state, slotId, towerType) {
    if (state.fsm !== 'prepWave' && state.fsm !== 'inWave') return 'invalid';
    if (!E().TOWERS[towerType]) return 'invalid';
    const map = state.mapDef;
    const slot = map.buildSlots.find(s => s.id === slotId);
    if (!slot) return 'invalid';
    if (state.towers.some(t => t.slotId === slotId)) return 'occupied';
    const cost = E().TOWERS[towerType].tiers[0].cost;
    if (state.gold < cost) return 'unaffordable';
    const tower = E().makeTower(towerType, slotId, slot);
    state.gold -= cost;
    state.goldSpent += cost;
    state.towers.push(tower);
    state.events.push({ kind: 'place', towerType, towerId: tower.id });
    state.paletteSelection = null;
    state.selectedSlotId = null;
    if (state.tutorialActive && state.tutorialStep !== 'done') {
      state.tutorialStep = 'done';
      state.tutorialActive = false;
    }
    return 'ok';
  }

  function upgrade(state, towerId) {
    const tw = state.towers.find(t => t.id === towerId);
    if (!tw) return 'invalid';
    const def = E().TOWERS[tw.type];
    const next = def.tiers[tw.tier + 1];
    if (!next) return 'maxed';
    if (state.gold < next.cost) return 'unaffordable';
    state.gold -= next.cost;
    state.goldSpent += next.cost;
    tw.tier += 1;
    E().refreshTowerSnapshot(tw);
    state.events.push({ kind: 'upgrade', towerId });
    return 'ok';
  }

  function sell(state, towerId) {
    const idx = state.towers.findIndex(t => t.id === towerId);
    if (idx < 0) return 'invalid';
    const tw = state.towers[idx];
    const refund = E().towerSellValue(tw.type, tw.tier);
    state.gold += refund;
    state.towers.splice(idx, 1);
    if (state.selectedTowerId === towerId) state.selectedTowerId = null;
    state.events.push({ kind: 'sell', towerId });
    return 'ok';
  }

  function sendNextWave(state) {
    if (!canSendNextWave(state)) return 'invalid';
    if (state.prepCountdownMs > 0) {
      const bonus = E().earlyCallBonus(state.prepCountdownMs / 1000, state);
      if (bonus > 0) {
        state.gold += bonus;
        state.goldEarned += bonus;
        state.events.push({ kind: 'earlyCallBonus', amount: bonus });
      }
      state.prepCountdownMs = 0;
    }
    startCurrentWave(state);
    return 'ok';
  }

  function canSendNextWave(state) {
    return state.fsm === 'prepWave' && !state.paused;
  }

  function togglePause(state) { state.paused = !state.paused; }
  function setFastForward(state, on) {
    state.fastForward = on != null ? !!on : !state.fastForward;
  }

  function selectTower(state, towerId) {
    state.selectedTowerId = towerId;
    state.selectedSlotId = null;
    state.paletteSelection = null;
  }
  function selectSlot(state, slotId) {
    state.selectedSlotId = slotId;
    state.selectedTowerId = null;
  }
  function setPaletteSelection(state, type) {
    if (!type || E().TOWERS[type]) state.paletteSelection = type || null;
    state.selectedTowerId = null;
  }

  // ─── Wave management ────────────────────────────────────────
  function startCurrentWave(state) {
    const map = state.mapDef;
    const wave = map.waves[state.waveIndex];
    if (!wave) return;
    const queue = [];
    wave.enemies.forEach(group => {
      for (let i = 0; i < group.count; i++) {
        queue.push({ type: group.type, spawnAtMs: (group.delay || 0) + i * (group.spacing || 0) });
      }
    });
    queue.sort((a, b) => a.spawnAtMs - b.spawnAtMs);
    state.waveProgress = { spawnQueue: queue, elapsedMs: 0 };
    state.fsm = 'inWave';
    state.events.push({ kind: 'waveStart', waveIndex: state.waveIndex, isBoss: !!wave.isBoss });
    state.events.push({ kind: 'phaseTransition', from: 'prepWave', to: 'inWave' });
  }

  function checkWaveClear(state) {
    if (state.fsm !== 'inWave') return;
    if (state.waveProgress && state.waveProgress.spawnQueue.length === 0 && state.enemies.length === 0) {
      const map = state.mapDef;
      const wave = map.waves[state.waveIndex];
      const reward = wave.reward || 0;
      state.gold += reward;
      state.goldEarned += reward;
      state.events.push({ kind: 'waveClear', waveIndex: state.waveIndex });
      state.events.push({ kind: 'phaseTransition', from: 'inWave', to: 'prepWave' });
      state.waveProgress = null;
      if (state.waveIndex >= state.waveTotal - 1) {
        state.fsm = 'wonRun';
        state.events.push({ kind: 'victory' });
      } else {
        state.waveIndex += 1;
        state.fsm = 'prepWave';
        state.prepCountdownMs = PREP_COUNTDOWN_MS;
      }
    }
  }

  // ─── Tick orchestrator ──────────────────────────────────────
  function step(state, dtMs) {
    if (state.paused) return;
    if (state.fsm === 'wonRun' || state.fsm === 'lostRun') return;
    if (state.fsm === 'prepWave' && state.prepCountdownMs > 0) {
      state.prepCountdownMs = Math.max(0, state.prepCountdownMs - dtMs);
    }
    const dtSec = dtMs / 1000;

    stepEnemies(state, dtSec);
    stepTowers(state, dtMs);
    stepProjectiles(state, dtSec);
    stepEffects(state, dtMs);
    if (state.fsm === 'inWave') stepWave(state, dtMs);
    checkWaveClear(state);
    checkLossCondition(state, dtMs);
  }

  // ─── Wave dripper ──────────────────────────────────────────
  function stepWave(state, dtMs) {
    if (!state.waveProgress) return;
    if (state.tutorialActive && state.tutorialStep !== 'done') return;
    state.waveProgress.elapsedMs += dtMs;
    const queue = state.waveProgress.spawnQueue;
    while (queue.length && queue[0].spawnAtMs <= state.waveProgress.elapsedMs) {
      const entry = queue.shift();
      const en = E().makeEnemy(entry.type, state.difficultyMult.hpMult);
      const p0 = sampleOnPath(state.mapDef, 0);
      en.x = p0.x; en.z = p0.z;
      state.enemies.push(en);
    }
  }

  // ─── Enemy movement ─────────────────────────────────────────
  function stepEnemies(state, dtSec) {
    const map = state.mapDef;
    const remove = [];
    for (const en of state.enemies) {
      const def = E().ENEMIES[en.type];
      if (en.slowMs > 0) {
        en.slowMs -= dtSec * 1000;
        if (en.slowMs <= 0) { en.slowMs = 0; en.slowMult = 1.0; }
      }
      if (en.freezeMs > 0) en.freezeMs -= dtSec * 1000;
      if (en.hitFlashMs > 0) en.hitFlashMs -= dtSec * 1000;
      if (def.isBoss) {
        if (en.regenSuppressedMs > 0) {
          en.regenSuppressedMs -= dtSec * 1000;
        } else {
          en.hp = Math.min(en.maxHp, en.hp + en.maxHp * 0.02 * dtSec);
        }
      }
      const moving = en.freezeMs <= 0;
      if (moving) {
        const speed = def.speed * en.slowMult;
        en.pathT += (speed * dtSec) / map.totalLength;
      }
      if (en.pathT >= 1) {
        state.lives -= def.isBoss ? 5 : 1;
        state.events.push({ kind: 'castleHit', enemyType: en.type });
        state.effects.push(E().makeEffect('castleHit', map.castle.x, map.castle.z, { ttlMs: CASTLE_FX_MS, totalTtlMs: CASTLE_FX_MS }));
        remove.push(en.id);
        continue;
      }
      const p = sampleOnPath(map, en.pathT);
      en.x = p.x; en.z = p.z;
    }
    if (remove.length) state.enemies = state.enemies.filter(e => !remove.includes(e.id));
  }

  // ─── BEHAVIOR_HANDLERS dispatch table (review #2 M-1) ──────
  const BEHAVIOR_HANDLERS = {
    projectile: stepProjectileTower,
    aura:       stepAuraTower
  };

  function stepTowers(state, dtMs) {
    for (const tw of state.towers) {
      const handler = BEHAVIOR_HANDLERS[tw.behavior];
      if (handler) handler(state, tw, dtMs);
    }
  }

  function stepProjectileTower(state, tw, dtMs) {
    if (tw.cooldownMs > 0) tw.cooldownMs -= dtMs;
    if (tw.cooldownMs > 0) return;
    const def = E().TOWERS[tw.type];
    const target = pickTarget(state, tw, def);
    if (!target) return;
    fireAt(state, tw, def, target);
    tw.cooldownMs = 1000 / tw.fireRate;
  }

  function stepAuraTower(state, tw /*, dtMs */) {
    // Iterate enemies in radius; apply floor slow.
    const r2 = tw.auraRadius * tw.auraRadius;
    for (const en of state.enemies) {
      const dx = en.x - tw.x, dz = en.z - tw.z;
      if (dx * dx + dz * dz > r2) continue;
      // Aura uses min(slowMult) so the stronger slow always wins; uses max(slowMs)
      // so a longer-acting projectile slow isn't shortened by aura's floor.
      if (en.slowMs < AURA_SLOW_FLOOR_MS) en.slowMs = AURA_SLOW_FLOOR_MS;
      if (tw.auraSlowMult < en.slowMult) en.slowMult = tw.auraSlowMult;
    }
  }

  function pickTarget(state, tw, def) {
    const r2 = tw.range * tw.range;
    let best = null, bestT = -1;
    for (const en of state.enemies) {
      const enDef = E().ENEMIES[en.type];
      if (!E().canTarget(def, enDef)) continue;
      const dx = en.x - tw.x, dz = en.z - tw.z;
      if (dx * dx + dz * dz > r2) continue;
      if (en.pathT > bestT) { best = en; bestT = en.pathT; }
    }
    return best;
  }

  function fireAt(state, tw, def, target) {
    const volley = tw.volley || 1;
    for (let i = 0; i < volley; i++) {
      const aim = leadTarget(state.mapDef, tw, target, tw.projSpeed);
      const proj = E().makeProjectile({
        kind: tw.projKind,
        x: tw.x, y: 0.7, z: tw.z,
        vx: aim.vx, vy: 0, vz: aim.vz,
        ttlMs: 2200,
        damage: tw.damage,
        damageType: tw.damageType,
        splashRadius: tw.splashRadius || 0,
        chainsLeft: tw.chains || 0,
        fromTowerId: tw.id
      });
      state.projectiles.push(proj);
    }
    state.events.push({ kind: 'fire', towerType: tw.type, towerId: tw.id });
  }

  function leadTarget(map, tw, target, projSpeed) {
    const enDef = E().ENEMIES[target.type];
    const effSpeed = enDef.speed * target.slowMult * (target.freezeMs > 0 ? 0 : 1);
    let pred = { x: target.x, z: target.z };
    for (let i = 0; i < 2; i++) {
      const dx = pred.x - tw.x, dz = pred.z - tw.z;
      const dist = Math.hypot(dx, dz);
      const flightSec = dist / projSpeed;
      const futureT = Math.min(1, target.pathT + (effSpeed * flightSec) / map.totalLength);
      pred = sampleOnPath(map, futureT);
    }
    const dx = pred.x - tw.x, dz = pred.z - tw.z;
    const mag = Math.hypot(dx, dz) || 1;
    return { vx: (dx / mag) * projSpeed, vz: (dz / mag) * projSpeed };
  }

  // ─── Projectile sim ─────────────────────────────────────────
  function stepProjectiles(state, dtSec) {
    const remove = [];
    for (const pr of state.projectiles) {
      pr.x += pr.vx * dtSec;
      pr.z += pr.vz * dtSec;
      pr.ttlMs -= dtSec * 1000;
      if (pr.x < -40 || pr.x > 40 || pr.z < -40 || pr.z > 40 || pr.ttlMs <= 0) {
        remove.push(pr.id);
        continue;
      }
      const hit = findHit(state, pr);
      if (!hit) continue;
      handleHit(state, pr, hit, remove);
    }
    if (remove.length) state.projectiles = state.projectiles.filter(p => !remove.includes(p.id));
  }

  function findHit(state, pr) {
    let best = null, bestDist = Infinity;
    for (const en of state.enemies) {
      if (pr.hitIds.has(en.id)) continue;
      const enDef = E().ENEMIES[en.type];
      const r = enDef.sizeWorld;
      const dx = en.x - pr.x, dz = en.z - pr.z;
      const d = Math.hypot(dx, dz);
      if (d < r && d < bestDist) { best = en; bestDist = d; }
    }
    return best;
  }

  function handleHit(state, pr, primary, removeQueue) {
    pr.hitIds.add(primary.id);
    applyHitEffects(state, pr, primary, true);
    if (pr.splashRadius > 0) {
      for (const en of state.enemies) {
        if (en.id === primary.id) continue;
        const dx = en.x - primary.x, dz = en.z - primary.z;
        if (Math.hypot(dx, dz) > pr.splashRadius) continue;
        applyHitEffects(state, pr, en, false);
      }
      state.effects.push(E().makeEffect('splash', primary.x, primary.z, { r: pr.splashRadius, ttlMs: SPLASH_FX_MS, totalTtlMs: SPLASH_FX_MS }));
      removeQueue.push(pr.id);
      return;
    }
    if (pr.chainsLeft > 0) {
      const next = findChainTarget(state, primary, pr.hitIds, 5.0);
      if (next) {
        const dx = next.x - primary.x, dz = next.z - primary.z;
        const mag = Math.hypot(dx, dz) || 1;
        const child = E().makeProjectile({
          kind: pr.kind,
          x: primary.x, y: 0.7, z: primary.z,
          vx: (dx / mag) * 28, vz: (dz / mag) * 28,
          ttlMs: 800,
          damage: Math.round(pr.damage * 0.85),
          damageType: pr.damageType,
          chainsLeft: pr.chainsLeft - 1,
          hitIds: pr.hitIds,
          fromTowerId: pr.fromTowerId
        });
        state.projectiles.push(child);
      }
      removeQueue.push(pr.id);
      return;
    }
    removeQueue.push(pr.id);
  }

  function findChainTarget(state, fromEnemy, hitIds, range) {
    const r2 = range * range;
    let best = null, bestD = Infinity;
    for (const en of state.enemies) {
      if (hitIds.has(en.id)) continue;
      const dx = en.x - fromEnemy.x, dz = en.z - fromEnemy.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      if (d2 < bestD) { best = en; bestD = d2; }
    }
    return best;
  }

  function applyHitEffects(state, pr, en, isPrimary) {
    const dmg = isPrimary ? pr.damage : pr.damage * 0.5;
    E().applyDamage(en, dmg, pr.damageType);
    en.hitFlashMs = HIT_FLASH_MS;
    if (E().ENEMIES[en.type].isBoss) en.regenSuppressedMs = 2000;
    state.events.push({ kind: 'hit', enemyId: en.id, damage: dmg });
    if (en.hp <= 0) killEnemy(state, en);
  }

  function killEnemy(state, en) {
    const def = E().ENEMIES[en.type];
    const paid = E().bountyFor(def, state);
    state.gold += paid;
    state.goldEarned += paid;
    state.effects.push(E().makeEffect('goldPopup', en.x, en.z, {
      text: '+' + paid, ttlMs: GOLD_POPUP_MS, totalTtlMs: GOLD_POPUP_MS
    }));
    state.events.push({ kind: 'kill', enemyType: en.type });
    state.enemies = state.enemies.filter(e => e.id !== en.id);
    // Phase 5 — Slime split-on-death. Fires only on damage-kill (this path),
    // not on castle-reach (engine step's pathT >= 1 branch removes enemies
    // directly, deliberately bypassing killEnemy so MiniSlimes don't spawn
    // at the castle and cost free lives).
    if (def.splitsInto) {
      const splitDef = E().ENEMIES[def.splitsInto];
      if (splitDef) {
        const count = def.splitCount || 2;
        const hpMult = state.difficultyMult ? state.difficultyMult.hpMult : 1;
        for (let i = 0; i < count; i++) {
          const child = E().makeEnemy(def.splitsInto, hpMult);
          child.pathT = en.pathT;
          child.x = en.x; child.y = en.y; child.z = en.z;
          state.enemies.push(child);
        }
      }
    }
  }

  function stepEffects(state, dtMs) {
    if (!state.effects.length) return;
    for (const ef of state.effects) ef.ttlMs -= dtMs;
    state.effects = state.effects.filter(e => e.ttlMs > 0);
  }

  function checkLossCondition(state, dtMs) {
    if (state.lives <= 0 && !state.gameOverTriggered) {
      state.gameOverDelayMs += dtMs;
      if (state.gameOverDelayMs > DEFEAT_FRAMES_DELAY) {
        state.fsm = 'lostRun';
        state.gameOverTriggered = true;
        state.events.push({ kind: 'defeat' });
      }
    }
  }

  function computeScore(state) {
    const base = state.goldEarned - state.goldSpent;
    const livesBonus = Math.max(0, state.lives) * 100;
    const wavesBonus = state.waveIndex * 500;
    return Math.max(0, base + livesBonus + wavesBonus);
  }
  function computeStars(state) {
    if (state.fsm !== 'wonRun') return 0;
    const ratio = state.lives / state.startingLives;
    if (ratio >= 1) return 3;
    if (ratio >= 0.5) return 2;
    return 1;
  }

  window.CTD3Engine = {
    createState, bakeMap, sampleOnPath,
    place, upgrade, sell, sendNextWave, togglePause, setFastForward,
    selectTower, selectSlot, setPaletteSelection,
    canSendNextWave,
    step, computeScore, computeStars,
    BEHAVIOR_HANDLERS,
    AURA_SLOW_FLOOR_MS, FIXED_STEP_MS, DEFEAT_FRAMES_DELAY, PREP_COUNTDOWN_MS
  };
})();
