/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — entities.js
   Static data tables + factories + predicates. No engine state.
   See ADR-028 §6 (data schemas) and §11 (TOWER_FIRE_SFX).
   Exposes window.CTD3Entities.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─── TOWERS ──────────────────────────────────────────────────
  // Behavior tag drives engine BEHAVIOR_HANDLERS dispatch (ADR-028 §7).
  // Aura towers use auraRadius + auraSlowMult; projectile towers use range/damage/etc.
  const TOWERS = {
    ranger: {
      name: 'Ranger',
      behavior: 'projectile',
      damageType: 'physical',
      targets: 'all',
      // Tier damage/cost shaped per ADR-036 D3(a): DPS-per-cumulative-gold
      // rises modestly with tier (T3 ~1.2x T1) instead of the launch-era
      // dip-then-spike that made Ranger T3 strictly dominant.
      tiers: [
        { cost: 50,  damage: 8,  range: 7.5, fireRate: 1.4, projSpeed: 24, projKind: 'arrow',     volley: 1 },
        { cost: 60,  damage: 16, range: 9.0, fireRate: 1.6, projSpeed: 26, projKind: 'arrow',     volley: 1 },
        { cost: 105, damage: 16, range: 10,  fireRate: 1.8, projSpeed: 28, projKind: 'arrow',     volley: 2 }
      ]
    },
    catapult: {
      name: 'Catapult',
      behavior: 'projectile',
      damageType: 'physical',
      targets: 'ground',
      tiers: [
        { cost: 120, damage: 28, range: 7.0, fireRate: 0.55, projSpeed: 16, projKind: 'cannonball', splashRadius: 2.0 },
        { cost: 110, damage: 52, range: 8.0, fireRate: 0.60, projSpeed: 17, projKind: 'cannonball', splashRadius: 2.8 },
        { cost: 150, damage: 90, range: 9.0, fireRate: 0.65, projSpeed: 18, projKind: 'cannonball', splashRadius: 3.5 }
      ]
    },
    mage: {
      name: 'Mage',
      behavior: 'projectile',
      damageType: 'magic',
      targets: 'all',
      tiers: [
        { cost: 200, damage: 22, range: 8.0, fireRate: 1.1, projSpeed: 30, projKind: 'magebolt', chains: 0 },
        { cost: 160, damage: 39, range: 9.0, fireRate: 1.2, projSpeed: 32, projKind: 'magebolt', chains: 1 },
        { cost: 210, damage: 65, range: 10,  fireRate: 1.3, projSpeed: 34, projKind: 'magebolt', chains: 2 }
      ]
    },
    warden: {
      name: 'Warden',
      behavior: 'aura',
      tiers: [
        { cost: 90,  auraRadius: 6.0, auraSlowMult: 0.65 },
        { cost: 80,  auraRadius: 7.0, auraSlowMult: 0.50 },
        { cost: 120, auraRadius: 8.0, auraSlowMult: 0.40 }
      ]
    }
  };

  // ─── TOWER_FIRE_SFX (ADR-028 §11) ────────────────────────────
  // Declarative event→SFX map. Warden = null because aura towers emit no fire event.
  const TOWER_FIRE_SFX = {
    ranger:   'ranger_fire',
    catapult: 'cannon_fire',
    mage:     'mage_fire',
    warden:   null
  };

  // ─── ENEMIES ─────────────────────────────────────────────────
  // sizeWorld is the world-unit radius for hit detection. Conditional archetypes
  // (shielded, skirmisher, captain) may drop in Phase 1 per ADR-028 §3.
  const ENEMIES = {
    footman:    { name: 'Footman',    hp: 28,   speed: 2.5, armor: 0,    isFlying: false, bounty: 6,   sizeWorld: 0.5 },
    heavy:      { name: 'Heavy',      hp: 110,  speed: 1.3, armor: 0,    isFlying: false, bounty: 16,  sizeWorld: 0.7 },
    runner:     { name: 'Runner',     hp: 42,   speed: 4.5, armor: 0,    isFlying: false, bounty: 14,  sizeWorld: 0.55 },
    shielded:   { name: 'Shielded',   hp: 80,   speed: 1.7, armor: 0.65, isFlying: false, bounty: 18,  sizeWorld: 0.6 },
    skirmisher: { name: 'Skirmisher', hp: 38,   speed: 3.2, armor: 0,    isFlying: true,  bounty: 18,  sizeWorld: 0.55 },
    captain:    { name: 'Captain',    hp: 1800, speed: 1.1, armor: 0.4,  isFlying: false, bounty: 250, sizeWorld: 1.0, isBoss: true },

    // Phase 5 of editor-promotion plan — 3 new types from WC3 / Element TD /
    // Wintermaul / DotA TD canon. Visuals fall back to footman mesh until
    // Blender-sourced GLBs land in assets/models/enemy_<name>.glb.
    juggernaut: { name: 'Juggernaut', hp: 600,  speed: 1.2, armor: 0.2,  isFlying: false, bounty: 90,  sizeWorld: 0.85 },
    slime:      { name: 'Slime',      hp: 60,   speed: 2.0, armor: 0,    isFlying: false, bounty: 8,   sizeWorld: 0.6,  splitsInto: 'mini_slime', splitCount: 2 },
    mini_slime: { name: 'Mini Slime', hp: 22,   speed: 2.6, armor: 0,    isFlying: false, bounty: 4,   sizeWorld: 0.4 },
    ghost:      { name: 'Ghost',      hp: 55,   speed: 3.0, armor: 0,    isFlying: true,  bounty: 22,  sizeWorld: 0.55, spectralCharges: 2 }
  };

  // ─── DIFFICULTY (ADR-028 §3: 2 tiers, not 3) ─────────────────
  // bountyMult couples reward to risk (ADR-036 D3/lesson 2, ETD-style):
  // spirited's +35% HP and lean start are offset by paying more per kill,
  // instead of compounding punishment on both axes.
  const DIFFICULTY = {
    quiet:    { hpMult: 0.85, startGold: 220, startLives: 18, bountyMult: 1.0 },
    spirited: { hpMult: 1.15, startGold: 180, startLives: 12, bountyMult: 1.25 }
  };

  // Per-map difficulty overrides (Phase 3 of editor-promotion plan).
  // Canonical merge helper consumed by BOTH engine.createState and the
  // editor's live preview pane — no inlined overlay logic anywhere else.
  // `overrides` shape: { quiet?: {hpMult?, startGold?, startLives?, bountyMult?},
  //                       spirited?: {hpMult?, startGold?, startLives?, bountyMult?} }
  // Blank fields inherit canonical DIFFICULTY[difficulty] values.
  function mergedDifficulty(difficulty, overrides) {
    const base = DIFFICULTY[difficulty] || DIFFICULTY.quiet;
    const o = (overrides && overrides[difficulty]) || {};
    return {
      hpMult:     (o.hpMult     != null) ? o.hpMult     : base.hpMult,
      startGold:  (o.startGold  != null) ? o.startGold  : base.startGold,
      startLives: (o.startLives != null) ? o.startLives : base.startLives,
      bountyMult: (o.bountyMult != null) ? o.bountyMult : base.bountyMult
    };
  }

  // Single payout site (ADR-036 lesson 7): every bounty the engine pays
  // flows through here so difficulty coupling — and any future bounty
  // curve — applies in exactly one place. Pre-run states (no difficultyMult)
  // fall back to the raw table value.
  function bountyFor(enemyDef, state) {
    const mult = (state && state.difficultyMult && state.difficultyMult.bountyMult != null)
      ? state.difficultyMult.bountyMult : 1;
    return Math.max(1, Math.round(enemyDef.bounty * mult));
  }

  // ─── HELPERS ─────────────────────────────────────────────────
  function towerInvested(type, tierIndex) {
    let total = 0;
    for (let i = 0; i <= tierIndex; i++) total += TOWERS[type].tiers[i].cost;
    return total;
  }
  function towerSellValue(type, tierIndex) {
    return Math.floor(towerInvested(type, tierIndex) * 0.75);
  }
  function canTarget(towerDef, enemyDef) {
    if (towerDef.behavior !== 'projectile') return false;
    if (enemyDef.isFlying && towerDef.targets === 'ground') return false;
    return true;
  }
  function applyDamage(enemy, dmg, dmgType) {
    // Ghost spectralCharges: first 2 projectile hits negated (Wintermaul-style
    // anti-tower micro). Phase 5 of editor-promotion plan.
    if (enemy.spectralCharges && enemy.spectralCharges > 0) {
      enemy.spectralCharges--;
      return 0;
    }
    let actual = dmg;
    if (dmgType === 'physical') actual = dmg * (1 - (enemy.armor || 0));
    enemy.hp -= actual;
    return actual;
  }

  // ─── refreshTowerSnapshot (ADR-028 §7 M-3) ────────────────────
  // Single source of truth for the snapshot. Called by makeTower (initial)
  // AND engine.upgrade (tier bump). Copies presentation+gameplay props from
  // the TOWERS table onto the tower entity so scene.js reads them directly.
  function refreshTowerSnapshot(tower) {
    const def = TOWERS[tower.type];
    const tier = def.tiers[tower.tier];
    if (def.behavior === 'projectile') {
      tower.range        = tier.range;
      tower.fireRate     = tier.fireRate;
      tower.damage       = tier.damage;
      tower.damageType   = def.damageType;
      tower.projSpeed    = tier.projSpeed;
      tower.projKind     = tier.projKind;
      tower.splashRadius = tier.splashRadius || 0;
      tower.chains       = tier.chains || 0;
      tower.volley       = tier.volley || 1;
      // Clear aura-only fields
      tower.auraRadius   = 0;
      tower.auraSlowMult = 1;
    } else if (def.behavior === 'aura') {
      tower.auraRadius   = tier.auraRadius;
      tower.auraSlowMult = tier.auraSlowMult;
      // Clear projectile-only fields
      tower.range = tower.fireRate = tower.damage = tower.projSpeed = tower.splashRadius = tower.chains = tower.volley = 0;
    }
  }

  // ─── FACTORIES ───────────────────────────────────────────────
  let _idCounter = 0;
  function nextId(prefix) { _idCounter++; return prefix + '_' + _idCounter; }

  function makeTower(type, slotId, slotPos) {
    const def = TOWERS[type];
    const tower = {
      id: nextId('tw'),
      type,
      behavior: def.behavior,
      tier: 0,
      slotId,
      x: slotPos.x, y: 0, z: slotPos.z,
      cooldownMs: 0,
      lastFireMs: 0,
      sceneRef: null
    };
    refreshTowerSnapshot(tower);
    return tower;
  }

  function makeEnemy(type, hpMult) {
    const def = ENEMIES[type];
    const hp = Math.round(def.hp * (hpMult || 1));
    const en = {
      id: nextId('en'),
      type,
      hp,
      maxHp: hp,
      pathT: 0,
      x: 0, y: 0, z: 0,
      slowMs: 0,
      slowMult: 1.0,
      freezeMs: 0,
      hitFlashMs: 0,
      regenSuppressedMs: 0,
      sceneRef: null
    };
    // Phase 5 — Ghost-type per-spawn shield counter (first 2 projectile hits negated).
    if (def.spectralCharges) en.spectralCharges = def.spectralCharges;
    // Armor: pre-Phase-5 makeEnemy never copied def.armor onto the entity, so
    // applyDamage's `enemy.armor` read was always undefined and Shielded (0.65)
    // and Captain (0.4) had been taking full physical damage all along. Fixing
    // here makes Shielded/Captain genuinely tanky and enables Juggernaut's 0.2.
    en.armor = def.armor || 0;
    return en;
  }

  function makeProjectile(opts) {
    return Object.assign({
      id: nextId('pr'),
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
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
      fromTowerId: null,
      sceneRef: null
    }, opts || {});
  }

  function makeEffect(kind, x, z, opts) {
    return Object.assign({
      id: nextId('fx'),
      kind, x, y: 0, z,
      ttlMs: 900,
      totalTtlMs: 900
    }, opts || {});
  }

  window.CTD3Entities = {
    TOWERS, ENEMIES, DIFFICULTY, TOWER_FIRE_SFX,
    mergedDifficulty, bountyFor,
    towerInvested, towerSellValue, canTarget, applyDamage,
    refreshTowerSnapshot,
    makeTower, makeEnemy, makeProjectile, makeEffect
  };
})();
