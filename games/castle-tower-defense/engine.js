/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense — engine.js
   Pure state mutation: wave manager, economy, lives, collision,
   targeting, projectile sim. No DOM, no audio, no input.
   Exposes window.CTDEngine.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const E = () => window.CTDEntities;
  const M = () => window.CTDMaps;
  const HIT_FLASH_MS    = 80;
  const SPLASH_FX_MS    = 350;
  const GOLD_POPUP_MS   = 900;
  const CASTLE_FX_MS    = 350;
  const EARLY_WAVE_BONUS = 5;
  const DEFEAT_FRAMES_DELAY = 900; // small grace before showing game-over

  // ─── Map baking ──────────────────────────────────────────────
  function bakeMap(map) {
    if (map._baked) return map;
    const segs = [];
    const cum = [];
    let total = 0;
    for (let i = 0; i < map.path.length - 1; i++) {
      const a = map.path[i], b = map.path[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
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
    if (i >= map.path.length - 1) return { x: map.path[map.path.length - 1].x, y: map.path[map.path.length - 1].y };
    const segStart = i === 0 ? 0 : map.cumulativeLengths[i - 1];
    const segLen = map.segmentLengths[i];
    const localT = segLen > 0 ? (target - segStart) / segLen : 0;
    const a = map.path[i], b = map.path[i + 1];
    return { x: a.x + (b.x - a.x) * localT, y: a.y + (b.y - a.y) * localT };
  }

  // ─── State factory ───────────────────────────────────────────
  function createState(mapId, difficulty, opts) {
    const map = bakeMap(M().byId(mapId));
    const diff = E().DIFFICULTY[difficulty];
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
      earlyBonusEligible: true,
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
      cursor: { x: 600, y: 320 },

      tutorialActive: !!(opts && opts.tutorial),
      tutorialStep: opts && opts.tutorial ? 'showPrompt' : 'done',

      events: []
    };
  }

  // ─── Mutations: build / upgrade / sell ──────────────────────
  function place(state, slotId, towerType) {
    if (state.fsm !== 'prepWave' && state.fsm !== 'inWave') return false;
    if (!E().TOWERS[towerType]) return false;
    const map = state.mapDef;
    const slot = map.buildSlots.find(s => s.id === slotId);
    if (!slot) return false;
    if (state.towers.some(t => t.slotId === slotId)) return false;   // occupied
    const cost = E().TOWERS[towerType].tiers[0].cost;
    if (state.gold < cost) return false;
    const tower = E().makeTower(towerType, slotId, slot);
    state.gold -= cost;
    state.goldSpent += cost;
    state.towers.push(tower);
    state.events.push({ kind: 'place', towerType, towerId: tower.id });
    state.paletteSelection = null;
    state.selectedSlotId = null;

    // Tutorial: first place dismisses tutorial
    if (state.tutorialActive && state.tutorialStep !== 'done') {
      state.tutorialStep = 'done';
      state.tutorialActive = false;
    }
    return true;
  }

  function upgrade(state, towerId) {
    const tw = state.towers.find(t => t.id === towerId);
    if (!tw) return false;
    const def = E().TOWERS[tw.type];
    const next = def.tiers[tw.tier + 1];
    if (!next) return false;
    if (state.gold < next.cost) return false;
    state.gold -= next.cost;
    state.goldSpent += next.cost;
    tw.tier += 1;
    state.events.push({ kind: 'upgrade', towerId });
    return true;
  }

  function sell(state, towerId) {
    const idx = state.towers.findIndex(t => t.id === towerId);
    if (idx < 0) return false;
    const tw = state.towers[idx];
    const refund = E().towerSellValue(tw.type, tw.tier);
    state.gold += refund;
    state.towers.splice(idx, 1);
    if (state.selectedTowerId === towerId) state.selectedTowerId = null;
    state.events.push({ kind: 'sell', towerId });
    return true;
  }

  function sendNextWave(state) {
    if (state.fsm !== 'prepWave') return false;
    if (state.earlyBonusEligible) {
      state.gold += EARLY_WAVE_BONUS;
      state.goldEarned += EARLY_WAVE_BONUS;
    }
    startCurrentWave(state);
    return true;
  }

  function togglePause(state) {
    state.paused = !state.paused;
  }

  function setFastForward(state, on) {
    state.fastForward = on != null ? !!on : !state.fastForward;
  }

  // ─── Wave management ────────────────────────────────────────
  function startCurrentWave(state) {
    const map = state.mapDef;
    const wave = map.waves[state.waveIndex];
    if (!wave) return;
    // Flatten groups into a sorted spawnQueue
    const queue = [];
    wave.enemies.forEach(group => {
      for (let i = 0; i < group.count; i++) {
        queue.push({ type: group.type, spawnAtMs: (group.delay || 0) + i * (group.spacing || 0) });
      }
    });
    queue.sort((a, b) => a.spawnAtMs - b.spawnAtMs);
    state.waveProgress = { spawnQueue: queue, elapsedMs: 0 };
    state.fsm = 'inWave';
    state.earlyBonusEligible = false;
    state.events.push({ kind: 'waveStart', waveIndex: state.waveIndex, isBoss: !!wave.isBoss });
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
      state.waveProgress = null;
      if (state.waveIndex >= state.waveTotal - 1) {
        state.fsm = 'wonRun';
        state.events.push({ kind: 'victory' });
      } else {
        state.waveIndex += 1;
        state.fsm = 'prepWave';
        state.earlyBonusEligible = true;
      }
    }
  }

  // ─── Tick: orchestrator ─────────────────────────────────────
  function step(state, dtMs) {
    if (state.paused) return;
    if (state.fsm === 'wonRun' || state.fsm === 'lostRun') return;
    const dtSec = dtMs / 1000;

    stepEnemies(state, dtSec);
    stepTowers(state, dtMs, dtSec);
    stepProjectiles(state, dtSec);
    stepEffects(state, dtMs);
    if (state.fsm === 'inWave') stepWave(state, dtMs);
    checkWaveClear(state);
    checkLossCondition(state, dtMs);
  }

  // ─── Wave spawn dripper ─────────────────────────────────────
  function stepWave(state, dtMs) {
    if (!state.waveProgress) return;
    if (state.tutorialActive && state.tutorialStep !== 'done') return;  // gate spawning
    state.waveProgress.elapsedMs += dtMs;
    const queue = state.waveProgress.spawnQueue;
    while (queue.length && queue[0].spawnAtMs <= state.waveProgress.elapsedMs) {
      const entry = queue.shift();
      const en = E().makeEnemy(entry.type, state.difficultyMult.hpMult);
      const p0 = sampleOnPath(state.mapDef, 0);
      en.x = p0.x; en.y = p0.y;
      state.enemies.push(en);
    }
  }

  // ─── Enemy movement ─────────────────────────────────────────
  function stepEnemies(state, dtSec) {
    const map = state.mapDef;
    const remove = [];
    for (let i = 0; i < state.enemies.length; i++) {
      const en = state.enemies[i];
      const def = E().ENEMIES[en.type];
      // tick slow / freeze / regen-suppression / hit-flash timers
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
      // movement
      const moving = en.freezeMs <= 0;
      if (moving) {
        const speed = def.speed * en.slowMult;
        en.pathT += (speed * dtSec) / map.totalLength;
      }
      if (en.pathT >= 1) {
        // reached castle
        state.lives -= def.isBoss ? 5 : 1;
        state.events.push({ kind: 'castleHit', enemyType: en.type });
        state.effects.push(E().makeEffect('castleHit', map.castle.x, map.castle.y, { ttlMs: CASTLE_FX_MS, totalTtlMs: CASTLE_FX_MS }));
        remove.push(en.id);
        continue;
      }
      const p = sampleOnPath(map, en.pathT);
      en.x = p.x; en.y = p.y;
    }
    if (remove.length) {
      state.enemies = state.enemies.filter(e => !remove.includes(e.id));
    }
  }

  // ─── Tower targeting + firing ───────────────────────────────
  function stepTowers(state, dtMs, dtSec) {
    for (const tw of state.towers) {
      if (tw.cooldownMs > 0) tw.cooldownMs -= dtMs;
      if (tw.cooldownMs > 0) continue;
      const def = E().TOWERS[tw.type];
      const tier = def.tiers[tw.tier];
      const target = pickTarget(state, tw, def, tier);
      if (!target) continue;
      fireAt(state, tw, def, tier, target);
      tw.cooldownMs = 1000 / tier.fireRate;
    }
  }

  function pickTarget(state, tw, def, tier) {
    const r2 = tier.range * tier.range;
    let best = null;
    let bestT = -1;
    for (const en of state.enemies) {
      const enDef = E().ENEMIES[en.type];
      if (!E().canTarget(def, enDef)) continue;
      const dx = en.x - tw.x, dy = en.y - tw.y;
      if (dx * dx + dy * dy > r2) continue;
      // furthest along path = highest pathT
      if (en.pathT > bestT) { best = en; bestT = en.pathT; }
    }
    return best;
  }

  function fireAt(state, tw, def, tier, target) {
    const volley = tier.volley || 1;
    for (let i = 0; i < volley; i++) {
      const angleJitter = volley > 1 ? (i - (volley - 1) / 2) * 0.08 : 0;
      const aim = leadTarget(state.mapDef, tw, target, tier.projSpeed, angleJitter);
      const proj = E().makeProjectile({
        kind: tier.projKind,
        x: tw.x, y: tw.y - 18,                 // fire from upper window
        vx: aim.vx, vy: aim.vy,
        ttlMs: 2200,
        damage: tier.damage,
        damageType: def.damageType,
        splashRadius: tier.splashRadius || 0,
        chainsLeft: tier.chains || 0,
        slowMs: tier.slowMs || 0,
        slowMult: tier.slowMult || 1.0,
        freezeChance: tier.freezeChance || 0,
        fromTowerId: tw.id,
        shrapnel: tier.shrapnel || 0
      });
      state.projectiles.push(proj);
    }
    state.events.push({ kind: 'fire', towerType: tw.type });
  }

  function leadTarget(map, tw, target, projSpeed, angleJitter) {
    const enDef = E().ENEMIES[target.type];
    const effSpeed = enDef.speed * target.slowMult * (target.freezeMs > 0 ? 0 : 1);
    let pred = { x: target.x, y: target.y };
    for (let i = 0; i < 2; i++) {
      const dx = pred.x - tw.x, dy = pred.y - tw.y;
      const dist = Math.hypot(dx, dy);
      const flightSec = dist / projSpeed;
      const futureT = Math.min(1, target.pathT + (effSpeed * flightSec) / map.totalLength);
      pred = sampleOnPath(map, futureT);
    }
    let dx = pred.x - tw.x, dy = pred.y - tw.y;
    let mag = Math.hypot(dx, dy) || 1;
    let nx = dx / mag, ny = dy / mag;
    if (angleJitter) {
      const c = Math.cos(angleJitter), s = Math.sin(angleJitter);
      const rx = nx * c - ny * s, ry = nx * s + ny * c;
      nx = rx; ny = ry;
    }
    return { vx: nx * projSpeed, vy: ny * projSpeed };
  }

  // ─── Projectile sim + collision ─────────────────────────────
  function stepProjectiles(state, dtSec) {
    const remove = [];
    for (const pr of state.projectiles) {
      pr.x += pr.vx * dtSec;
      pr.y += pr.vy * dtSec;
      pr.ttlMs -= dtSec * 1000;
      // out of field?
      if (pr.x < -40 || pr.x > 1240 || pr.y < -40 || pr.y > 680 || pr.ttlMs <= 0) {
        remove.push(pr.id);
        continue;
      }
      // collide against enemies
      const hit = findHit(state, pr);
      if (!hit) continue;
      handleHit(state, pr, hit, remove);
    }
    if (remove.length) {
      state.projectiles = state.projectiles.filter(p => !remove.includes(p.id));
    }
  }

  function findHit(state, pr) {
    let best = null;
    let bestDist = Infinity;
    for (const en of state.enemies) {
      if (pr.hitIds.has(en.id)) continue;
      const enDef = E().ENEMIES[en.type];
      const r = enDef.size * 0.45;
      const dx = en.x - pr.x, dy = en.y - pr.y;
      const d = Math.hypot(dx, dy);
      if (d < r && d < bestDist) { best = en; bestDist = d; }
    }
    return best;
  }

  function handleHit(state, pr, primary, removeQueue) {
    pr.hitIds.add(primary.id);
    applyHitEffects(state, pr, primary, true);

    if (pr.splashRadius > 0) {
      // Splash radius — damage all other enemies in range at half damage
      for (const en of state.enemies) {
        if (en.id === primary.id) continue;
        const dx = en.x - primary.x, dy = en.y - primary.y;
        if (Math.hypot(dx, dy) > pr.splashRadius) continue;
        applyHitEffects(state, pr, en, false);
      }
      state.effects.push(E().makeEffect('splash', primary.x, primary.y, { r: pr.splashRadius, ttlMs: SPLASH_FX_MS, totalTtlMs: SPLASH_FX_MS }));
      removeQueue.push(pr.id);
      return;
    }

    if (pr.chainsLeft > 0) {
      // Chain to nearest unhit enemy within a short range of current hit
      const next = findChainTarget(state, primary, pr.hitIds, 220);
      if (next) {
        const dx = next.x - primary.x, dy = next.y - primary.y;
        const mag = Math.hypot(dx, dy) || 1;
        const child = E().makeProjectile({
          kind: pr.kind,
          x: primary.x, y: primary.y,
          vx: (dx / mag) * 800, vy: (dy / mag) * 800,
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

    // Single-target: project consumed
    removeQueue.push(pr.id);
  }

  function findChainTarget(state, fromEnemy, hitIds, range) {
    const r2 = range * range;
    let best = null, bestD = Infinity;
    for (const en of state.enemies) {
      if (hitIds.has(en.id)) continue;
      const dx = en.x - fromEnemy.x, dy = en.y - fromEnemy.y;
      const d2 = dx * dx + dy * dy;
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
    if (pr.slowMs && pr.slowMs > 0) {
      en.slowMs = Math.max(en.slowMs, pr.slowMs);
      en.slowMult = Math.min(en.slowMult, pr.slowMult);
    }
    if (pr.freezeChance && Math.random() < pr.freezeChance) {
      en.freezeMs = 800;
    }
    state.events.push({ kind: 'hit', enemyId: en.id, damage: dmg });
    if (en.hp <= 0) killEnemy(state, en);
  }

  function killEnemy(state, en) {
    const def = E().ENEMIES[en.type];
    state.gold += def.bounty;
    state.goldEarned += def.bounty;
    state.effects.push(E().makeEffect('goldPopup', en.x, en.y - 22, {
      text: '+' + def.bounty, ttlMs: GOLD_POPUP_MS, totalTtlMs: GOLD_POPUP_MS
    }));
    state.events.push({ kind: 'kill', enemyType: en.type });
    state.enemies = state.enemies.filter(e => e.id !== en.id);
  }

  // ─── Effects decay ──────────────────────────────────────────
  function stepEffects(state, dtMs) {
    if (!state.effects.length) return;
    for (const ef of state.effects) ef.ttlMs -= dtMs;
    state.effects = state.effects.filter(e => e.ttlMs > 0);
  }

  // ─── Loss condition with small delay (lets last hit play) ──
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

  // ─── Selection helpers (UI-driven) ──────────────────────────
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

  // Score: goldEarned - goldSpent + lives * 100, plus 500 per wave cleared
  function computeScore(state) {
    const base = state.goldEarned - state.goldSpent;
    const livesBonus = Math.max(0, state.lives) * 100;
    const wavesBonus = state.waveIndex * 500;
    return Math.max(0, base + livesBonus + wavesBonus);
  }

  // Stars: 3 = no lives lost; 2 = ≥half; 1 = survived
  function computeStars(state) {
    if (state.fsm !== 'wonRun') return 0;
    const ratio = state.lives / state.startingLives;
    if (ratio >= 1) return 3;
    if (ratio >= 0.5) return 2;
    return 1;
  }

  window.CTDEngine = {
    createState, bakeMap, sampleOnPath,
    place, upgrade, sell, sendNextWave, togglePause, setFastForward,
    selectTower, selectSlot, setPaletteSelection,
    step, computeScore, computeStars,
    EARLY_WAVE_BONUS
  };
})();
