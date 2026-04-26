/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense — entities.js
   Static data tables for towers and enemies + factory helpers.
   No engine state, no DOM, no audio. Pure data and predicates.
   Exposes window.CTDEntities.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─── TOWERS ──────────────────────────────────────────────────
  // Each tier carries cumulative stats; cost is *incremental* (the
  // gold paid to reach this tier from the previous). Total invested
  // for a tier-N tower = sum of costs[0..N].
  const TOWERS = {
    archer: {
      name: 'Archer',
      sprite: 't-archer',
      damageType: 'physical',
      targets: 'all',          // archers can hit flying
      tiers: [
        { cost: 50,  damage: 8,  range: 180, fireRate: 1.4, projSpeed: 700, projKind: 'arrow', volley: 1 },
        { cost: 60,  damage: 12, range: 220, fireRate: 1.6, projSpeed: 760, projKind: 'arrow', volley: 1 },
        { cost: 90,  damage: 16, range: 240, fireRate: 1.8, projSpeed: 800, projKind: 'arrow', volley: 2 }
      ]
    },
    cannon: {
      name: 'Cannon',
      sprite: 't-cannon',
      damageType: 'physical',
      targets: 'ground',       // cannons miss flying
      tiers: [
        { cost: 120, damage: 28, range: 170, fireRate: 0.55, projSpeed: 480, projKind: 'cannonball', splashRadius: 50 },
        { cost: 120, damage: 38, range: 190, fireRate: 0.60, projSpeed: 500, projKind: 'cannonball', splashRadius: 70 },
        { cost: 180, damage: 50, range: 210, fireRate: 0.65, projSpeed: 520, projKind: 'cannonball', splashRadius: 90, shrapnel: 4 }
      ]
    },
    mage: {
      name: 'Mage',
      sprite: 't-mage',
      damageType: 'magic',     // ignores armor
      targets: 'all',
      tiers: [
        { cost: 200, damage: 22, range: 200, fireRate: 1.1, projSpeed: 900, projKind: 'magebolt', chains: 0 },
        { cost: 180, damage: 28, range: 220, fireRate: 1.2, projSpeed: 950, projKind: 'magebolt', chains: 1 },
        { cost: 250, damage: 36, range: 240, fireRate: 1.3, projSpeed: 1000, projKind: 'magebolt', chains: 2 }
      ]
    },
    frost: {
      name: 'Frost',
      sprite: 't-frost',
      damageType: 'magic',
      targets: 'all',
      tiers: [
        { cost: 90,  damage: 3,  range: 160, fireRate: 1.0, projSpeed: 700, projKind: 'frostshard',
          slowMs: 1200, slowMult: 0.65, freezeChance: 0 },
        { cost: 80,  damage: 5,  range: 180, fireRate: 1.1, projSpeed: 720, projKind: 'frostshard',
          slowMs: 1500, slowMult: 0.50, freezeChance: 0 },
        { cost: 120, damage: 7,  range: 200, fireRate: 1.2, projSpeed: 740, projKind: 'frostshard',
          slowMs: 1700, slowMult: 0.40, freezeChance: 0.18 }
      ]
    }
  };

  // ─── ENEMIES ─────────────────────────────────────────────────
  const ENEMIES = {
    goblin:    { name: 'Goblin',     sprite: 'e-goblin',    hp: 28,   speed: 75,  armor: 0,    isFlying: false, bounty: 6,   size: 38 },
    orc:       { name: 'Orc',        sprite: 'e-orc',       hp: 110,  speed: 38,  armor: 0,    isFlying: false, bounty: 16,  size: 46 },
    wolfrider: { name: 'Wolf Rider', sprite: 'e-wolfrider', hp: 42,   speed: 140, armor: 0,    isFlying: false, bounty: 14,  size: 48 },
    shielded:  { name: 'Shielded',   sprite: 'e-shielded',  hp: 80,   speed: 50,  armor: 0.65, isFlying: false, bounty: 18,  size: 44 },
    flying:    { name: 'Flying',     sprite: 'e-flying',    hp: 38,   speed: 95,  armor: 0,    isFlying: true,  bounty: 18,  size: 46 },
    boss:      { name: 'Warlord',    sprite: 'e-boss',      hp: 1800, speed: 32,  armor: 0.4,  isFlying: false, bounty: 250, size: 64, isBoss: true }
  };

  // ─── DIFFICULTY SCALING ──────────────────────────────────────
  const DIFFICULTY = {
    easy:   { hpMult: 0.85, startGold: 220, startLives: 18 },
    normal: { hpMult: 1.00, startGold: 180, startLives: 14 },
    hard:   { hpMult: 1.30, startGold: 150, startLives: 10 }
  };

  // ─── HELPERS ─────────────────────────────────────────────────
  function towerTier(type, tierIndex) {
    return TOWERS[type].tiers[tierIndex];
  }

  function towerInvested(type, tierIndex) {
    let total = 0;
    for (let i = 0; i <= tierIndex; i++) total += TOWERS[type].tiers[i].cost;
    return total;
  }

  function towerSellValue(type, tierIndex) {
    return Math.floor(towerInvested(type, tierIndex) * 0.75);
  }

  function canTarget(towerDef, enemyDef) {
    if (enemyDef.isFlying && towerDef.targets === 'ground') return false;
    return true;
  }

  function applyDamage(enemy, dmg, dmgType) {
    let actual = dmg;
    if (dmgType === 'physical') actual = dmg * (1 - (enemy.armor || 0));
    enemy.hp -= actual;
    return actual;
  }

  // ─── FACTORIES ───────────────────────────────────────────────
  let _idCounter = 0;
  function nextId(prefix) { _idCounter++; return prefix + '_' + _idCounter; }

  function makeTower(type, slotId, slotPos) {
    return {
      id: nextId('tw'),
      type,
      tier: 0,
      slotId,
      x: slotPos.x,
      y: slotPos.y,
      cooldownMs: 0,
      lastFireMs: 0
    };
  }

  function makeEnemy(type, hpMult) {
    const def = ENEMIES[type];
    const hp = Math.round(def.hp * (hpMult || 1));
    return {
      id: nextId('en'),
      type,
      hp,
      maxHp: hp,
      pathT: 0,
      x: 0, y: 0,
      slowMs: 0,
      slowMult: 1.0,
      freezeMs: 0,
      regenSuppressedMs: 0
    };
  }

  function makeProjectile(opts) {
    return Object.assign({
      id: nextId('pr'),
      x: 0, y: 0, vx: 0, vy: 0,
      ttlMs: 1500,
      damage: 0,
      damageType: 'physical',
      splashRadius: 0,
      chainsLeft: 0,
      hitIds: new Set(),
      kind: 'arrow',
      slowMs: 0,
      slowMult: 1.0,
      freezeChance: 0,
      fromTowerId: null
    }, opts || {});
  }

  function makeEffect(kind, x, y, opts) {
    return Object.assign({ id: nextId('fx'), kind, x, y, ttlMs: 900 }, opts || {});
  }

  window.CTDEntities = {
    TOWERS, ENEMIES, DIFFICULTY,
    towerTier, towerInvested, towerSellValue,
    canTarget, applyDamage,
    makeTower, makeEnemy, makeProjectile, makeEffect
  };
})();
