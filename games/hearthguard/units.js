/* ═══════════════════════════════════════════════════════════════
   Hearthguard — units.js
   Pure. Unit-type catalog + ability functions.
   Each ability: (state, unitId, params) → { state, events }.
   Never mutates input state.
   Exposes window.HearthguardUnits.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const S = window.HearthguardState;

  const TYPES = Object.freeze({
    knight: {
      side: 'hero', hp: 3, move: 2,
      action: 'push', range: { min: 1, max: 1 },
      glyphId: 'hg-knight', label: 'Knight',
    },
    archer: {
      side: 'hero', hp: 2, move: 3,
      action: 'pull', range: { min: 1, max: 4 },
      glyphId: 'hg-archer', label: 'Archer',
    },
    mage: {
      side: 'hero', hp: 2, move: 2,
      action: 'swap', range: { min: 1, max: 3 },
      glyphId: 'hg-mage', label: 'Mage',
    },
    goblin: {
      side: 'enemy', hp: 1, move: 3,
      intentKind: 'melee', damage: 1,
      glyphId: 'hg-goblin', label: 'Goblin',
    },
    troll: {
      side: 'enemy', hp: 3, move: 2,
      intentKind: 'melee+push', damage: 2,
      glyphId: 'hg-troll', label: 'Troll',
    },
    'goblin-archer': {
      side: 'enemy', hp: 1, move: 2,
      intentKind: 'ranged', damage: 1,
      range: { min: 1, max: 3 },
      glyphId: 'hg-goblin-archer', label: 'Goblin Archer',
    },
    villager: {
      side: 'villager', hp: 1, move: 0,
      glyphId: 'hg-villager', label: 'Villager',
    },
  });

  function statsFor(type) {
    return TYPES[type] || null;
  }

  function makeUnit(type, at, opts) {
    const stats = statsFor(type);
    if (!stats) throw new Error('Unknown unit type: ' + type);
    return {
      id: (opts && opts.id) || (type + '-' + ((opts && opts.n) || 1)),
      type, side: stats.side, at,
      hp: stats.hp, maxHp: stats.hp,
      hasMoved: false, hasActed: false,
      intent: null,
    };
  }

  // ── Damage / death ───────────────────────────────────────────
  // Pure: state in, { state, events } out. No-op if unit already dead.
  function applyDamage(state, unitId, dmg, cause) {
    const events = [];
    const u = S.unitById(state, unitId);
    if (!u || u.hp <= 0 || dmg <= 0) return { state, events };

    const next = S.clone(state);
    const u2 = S.unitById(next, unitId);
    const prevHp = u2.hp;
    u2.hp = Math.max(0, prevHp - dmg);
    events.push({ kind: 'damage', unitId, dmg, hp: u2.hp, cause: cause || null });

    if (u2.hp === 0) {
      const deathTile = u2.at;
      u2.at = null;
      events.push({ kind: 'death', unitId, type: u2.type, side: u2.side, at: deathTile });
    }

    return { state: next, events };
  }

  // Move a unit one tile in direction, with collision rules.
  // Wall: 1 dmg to pushed unit, no movement.
  // Occupied: 1 dmg to pushed unit AND 1 dmg to blocker, no movement (collision).
  // Empty: free movement.
  function applyShove(state, unitId, dir) {
    const u = S.unitById(state, unitId);
    if (!u || u.hp <= 0) return { state, events: [] };

    const newTile = S.shiftTile(u.at, dir);

    if (!newTile) {
      const r = applyDamage(state, unitId, 1, { kind: 'wall' });
      return {
        state: r.state,
        events: [{ kind: 'collision-wall', unitId, dir, at: u.at }, ...r.events],
      };
    }

    const blocker = S.unitAt(state, newTile);
    if (blocker) {
      const r1 = applyDamage(state, unitId, 1, { kind: 'collision', other: blocker.id });
      const r2 = applyDamage(r1.state, blocker.id, 1, { kind: 'collision', other: unitId });
      return {
        state: r2.state,
        events: [
          { kind: 'collision', a: unitId, b: blocker.id, at: newTile, blockedAt: u.at },
          ...r1.events, ...r2.events,
        ],
      };
    }

    const next = S.clone(state);
    const u2 = S.unitById(next, unitId);
    u2.at = newTile;
    return {
      state: next,
      events: [{ kind: 'move', unitId, from: u.at, to: newTile, cause: 'shove' }],
    };
  }

  // ── Hero abilities ───────────────────────────────────────────
  // Each marks hasActed (and hasMoved for move). Caller is responsible for
  // legality checks; these functions assume the action is legal.

  function applyMove(state, unitId, toTile) {
    const u = S.unitById(state, unitId);
    if (!u || u.hp <= 0) return { state, events: [] };
    if (u.at === toTile) {
      const next = S.clone(state);
      S.unitById(next, unitId).hasMoved = true;
      return { state: next, events: [] };
    }
    const next = S.clone(state);
    const u2 = S.unitById(next, unitId);
    const from = u2.at;
    u2.at = toTile;
    u2.hasMoved = true;
    return {
      state: next,
      events: [{ kind: 'move', unitId, from, to: toTile, cause: 'plan' }],
    };
  }

  // Knight push: target is on an adjacent tile; push it 1 tile away from knight.
  function applyPush(state, unitId, targetTile) {
    const u = S.unitById(state, unitId);
    if (!u) return { state, events: [] };
    const dir = S.directionFromTo(u.at, targetTile);
    if (!dir) return { state, events: [] };

    let s = S.clone(state);
    S.unitById(s, unitId).hasActed = true;
    const events = [{ kind: 'plan-action', unitId, action: 'push', target: targetTile }];

    const target = S.unitAt(s, targetTile);
    if (!target) {
      events.push({ kind: 'attack-whiff', attackerId: unitId, targetTile });
      return { state: s, events };
    }
    events.push({ kind: 'attack', attackerId: unitId, targetTile, kind2: 'push' });
    const r = applyShove(s, target.id, dir);
    return { state: r.state, events: events.concat(r.events) };
  }

  // Archer pull: target on an orthogonal line within range, with no intervening units.
  // Pull target 1 tile toward archer.
  function applyPull(state, unitId, targetTile) {
    const u = S.unitById(state, unitId);
    if (!u) return { state, events: [] };
    const dir = S.directionFromTo(u.at, targetTile);
    if (!dir) return { state, events: [] };
    const pullDir = S.oppositeDir(dir);

    let s = S.clone(state);
    S.unitById(s, unitId).hasActed = true;
    const events = [{ kind: 'plan-action', unitId, action: 'pull', target: targetTile }];

    const target = S.unitAt(s, targetTile);
    if (!target) {
      events.push({ kind: 'attack-whiff', attackerId: unitId, targetTile });
      return { state: s, events };
    }
    events.push({ kind: 'attack', attackerId: unitId, targetTile, kind2: 'pull' });
    const r = applyShove(s, target.id, pullDir);
    return { state: r.state, events: events.concat(r.events) };
  }

  // Mage swap: two adjacent tiles, both within mage's range, both occupied → swap.
  function applySwap(state, unitId, tileA, tileB) {
    let s = S.clone(state);
    S.unitById(s, unitId).hasActed = true;
    const events = [{ kind: 'plan-action', unitId, action: 'swap', tileA, tileB }];

    const a = S.unitAt(s, tileA);
    const b = S.unitAt(s, tileB);
    if (!a || !b) {
      events.push({ kind: 'attack-whiff', attackerId: unitId, targetTile: tileA });
      return { state: s, events };
    }

    const aId = a.id, bId = b.id;
    S.unitById(s, aId).at = tileB;
    S.unitById(s, bId).at = tileA;
    events.push({ kind: 'swap', unitId, aId, bId, tileA, tileB });
    return { state: s, events };
  }

  // ── Legality enumeration ─────────────────────────────────────
  // Returns the list of legal ACTION targets for this hero (NOT including moves).
  // Moves are enumerated by State.legalMovesFor.
  function legalActionTargets(state, unitId) {
    const u = S.unitById(state, unitId);
    if (!u || u.hp <= 0 || u.hasActed || u.side !== 'hero') return [];
    const t = statsFor(u.type);
    if (!t) return [];
    const out = [];

    if (t.action === 'push') {
      for (const dir of ['N', 'S', 'E', 'W']) {
        const tile = S.shiftTile(u.at, dir);
        if (!tile) continue;
        const occ = S.unitAt(state, tile);
        if (occ && occ.id !== unitId) {
          out.push({ kind: 'push', unitId, targetTile: tile });
        }
      }
    } else if (t.action === 'pull') {
      const los = S.lineOfSightTiles(state, u.at, t.range);
      for (const entry of los) {
        if (entry.occupant && entry.occupant !== unitId) {
          out.push({ kind: 'pull', unitId, targetTile: entry.tile });
        }
      }
    } else if (t.action === 'swap') {
      // All pairs of adjacent tiles within range, both occupied.
      const max = t.range.max;
      const seenPair = new Set();
      for (let dc = -max; dc <= max; dc++) {
        for (let dr = -max; dr <= max; dr++) {
          if (Math.abs(dc) + Math.abs(dr) > max || (dc === 0 && dr === 0)) continue;
          const c = S.tileToCoords(u.at);
          const tileA = S.coordsToTile(c.col + dc, c.row + dr);
          if (!tileA) continue;
          const a = S.unitAt(state, tileA);
          if (!a) continue;
          for (const dir of ['N', 'S', 'E', 'W']) {
            const tileB = S.shiftTile(tileA, dir);
            if (!tileB) continue;
            if (S.tileDistance(u.at, tileB) > max) continue;
            const b = S.unitAt(state, tileB);
            if (!b) continue;
            const key = [tileA, tileB].sort().join('|');
            if (seenPair.has(key)) continue;
            seenPair.add(key);
            out.push({ kind: 'swap', unitId, tileA, tileB });
          }
        }
      }
    }
    return out;
  }

  // ── Public ───────────────────────────────────────────────────
  window.HearthguardUnits = {
    TYPES, statsFor, makeUnit,
    applyDamage, applyShove,
    applyMove, applyPush, applyPull, applySwap,
    legalActionTargets,
  };
})();
