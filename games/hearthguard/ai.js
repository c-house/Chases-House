/* ═══════════════════════════════════════════════════════════════
   Hearthguard — ai.js
   Pure. Deterministic enemy intent + movement.
   No randomness. Tie-breaks resolve by (rowAsc, colAsc) of target.
   Exposes window.HearthguardAI.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const S = window.HearthguardState;
  const U = window.HearthguardUnits;

  // Score targets so enemies prefer villagers, then heroes (lowest HP first).
  function targetPriority(unit) {
    const sidePri = unit.side === 'villager' ? 0 : (unit.side === 'hero' ? 1 : 2);
    return sidePri * 1000 + unit.hp;
  }

  // Stable tile sort: row asc, col asc.
  function tileOrderKey(tile) {
    const c = S.tileToCoords(tile);
    return c.row * 100 + c.col;
  }

  // BFS distance from a tile to all reachable tiles, treating occupants as blockers
  // EXCEPT the starting unit (which is allowed to leave its own tile).
  function distancesFrom(state, fromTile, ignoreUnitId) {
    const dist = new Map();
    dist.set(fromTile, 0);
    const queue = [fromTile];
    while (queue.length) {
      const t = queue.shift();
      const d = dist.get(t);
      for (const dir of ['N', 'S', 'E', 'W']) {
        const next = S.shiftTile(t, dir);
        if (!next || dist.has(next)) continue;
        const occ = S.unitAt(state, next);
        if (occ && occ.id !== ignoreUnitId) continue;
        dist.set(next, d + 1);
        queue.push(next);
      }
    }
    return dist;
  }

  // Pick the best target for an enemy: lowest priority score, ties broken by tile order.
  function pickTarget(state, enemy) {
    const candidates = state.units
      .filter(u => u.hp > 0 && u.at && (u.side === 'villager' || u.side === 'hero'));
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const pa = targetPriority(a) - targetPriority(b);
      if (pa !== 0) return pa;
      return tileOrderKey(a.at) - tileOrderKey(b.at);
    });
    return candidates[0];
  }

  // Pick a destination tile for a melee attacker.
  // First preference: a tile within `move` adjacent to target → can attack this turn.
  // Fallback: closest reachable tile to target (walk toward, attack later).
  // Tie-breaks: shorter path, then tile order.
  function pickMeleeDestination(state, enemy, target) {
    const stats = U.statsFor(enemy.type);
    const dist = distancesFrom(state, enemy.at, enemy.id);

    const adj = ['N', 'S', 'E', 'W']
      .map(d => S.shiftTile(target.at, d))
      .filter(t => t != null);

    let best = null;
    for (const t of adj) {
      if (!dist.has(t)) continue;
      const d = dist.get(t);
      if (d > stats.move) continue;
      if (best === null
          || d < best.distance
          || (d === best.distance && tileOrderKey(t) < tileOrderKey(best.tile))) {
        best = { tile: t, distance: d };
      }
    }
    if (best) return best.tile;

    let fallback = null;
    for (const [tile, d] of dist) {
      if (d === 0 || d > stats.move) continue;
      const m = S.tileDistance(tile, target.at);
      if (fallback === null
          || m < fallback.m
          || (m === fallback.m && d < fallback.d)
          || (m === fallback.m && d === fallback.d && tileOrderKey(tile) < tileOrderKey(fallback.tile))) {
        fallback = { tile, d, m };
      }
    }
    return fallback ? fallback.tile : enemy.at;
  }

  // Pick a destination for a ranged attacker:
  // — within move
  // — has line-of-sight to target tile within range
  // — prefer closer to current position (less movement); tie-broken by tile order
  function pickRangedDestination(state, enemy, target) {
    const stats = U.statsFor(enemy.type);
    const dist = distancesFrom(state, enemy.at, enemy.id);

    const candidates = [];
    for (const [tile, d] of dist) {
      if (d > stats.move) continue;
      // Temporarily place enemy at tile to check LOS
      const testState = S.clone(state);
      const e2 = S.unitById(testState, enemy.id);
      if (e2) e2.at = tile;
      const los = S.lineOfSightTiles(testState, tile, stats.range);
      const hits = los.find(entry => entry.tile === target.at);
      if (hits) candidates.push({ tile, distance: d });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return tileOrderKey(a.tile) - tileOrderKey(b.tile);
    });
    return candidates[0].tile;
  }

  // Move enemy to destination (or no-op if same tile).
  function moveEnemyTo(state, enemyId, destTile) {
    const u = S.unitById(state, enemyId);
    if (!u || u.at === destTile) return state;
    const next = S.clone(state);
    S.unitById(next, enemyId).at = destTile;
    return next;
  }

  // Set intent for a melee enemy: targetTile is target's CURRENT tile (the one they
  // can reach from new position). Damage and pushDir per type.
  function setMeleeIntent(state, enemyId, targetTile) {
    const next = S.clone(state);
    const e = S.unitById(next, enemyId);
    const stats = U.statsFor(e.type);
    const dir = S.directionFromTo(e.at, targetTile);
    e.intent = {
      kind: stats.intentKind,
      sourceTile: e.at,
      targetTile,
      damage: stats.damage,
      pushDir: stats.intentKind === 'melee+push' ? dir : null,
    };
    return next;
  }

  function setRangedIntent(state, enemyId, targetTile) {
    const next = S.clone(state);
    const e = S.unitById(next, enemyId);
    const stats = U.statsFor(e.type);
    e.intent = {
      kind: stats.intentKind,
      sourceTile: e.at,
      targetTile,
      damage: stats.damage,
      pushDir: null,
    };
    return next;
  }

  function clearIntent(state, enemyId) {
    const next = S.clone(state);
    const e = S.unitById(next, enemyId);
    if (e) e.intent = null;
    return next;
  }

  // Run one enemy's between-turn pass: pick target → move → set intent.
  function advanceEnemy(state, enemyId) {
    const enemy = S.unitById(state, enemyId);
    if (!enemy || enemy.hp <= 0) return state;

    const target = pickTarget(state, enemy);
    if (!target) return clearIntent(state, enemyId);

    const stats = U.statsFor(enemy.type);
    const isRanged = stats.intentKind === 'ranged';

    let s = state;
    if (isRanged) {
      const dest = pickRangedDestination(s, enemy, target);
      if (dest !== null) {
        s = moveEnemyTo(s, enemyId, dest);
        return setRangedIntent(s, enemyId, target.at);
      }
      // No LOS reachable this turn; walk toward target instead.
      const fallback = pickMeleeDestination(s, enemy, target);
      s = moveEnemyTo(s, enemyId, fallback);
      const los2 = S.lineOfSightTiles(s, fallback, stats.range);
      const hit = los2.find(e => e.tile === target.at);
      return hit
        ? setRangedIntent(s, enemyId, target.at)
        : clearIntent(s, enemyId);
    }

    // Melee or melee+push: walk to an adjacent tile and attack.
    const dest = pickMeleeDestination(s, enemy, target);
    s = moveEnemyTo(s, enemyId, dest);
    // Determine intent target — must be adjacent to dest now.
    const eAfter = S.unitById(s, enemyId);
    if (!S.tilesAdjacent(eAfter.at, target.at)) {
      // Couldn't reach; no attack this turn.
      return clearIntent(s, enemyId);
    }
    return setMeleeIntent(s, enemyId, target.at);
  }

  // Public entry: advance every living enemy. Order is stable by tile.
  function advanceAllEnemies(state) {
    const enemies = state.units
      .filter(u => u.side === 'enemy' && u.hp > 0)
      .slice()
      .sort((a, b) => tileOrderKey(a.at) - tileOrderKey(b.at));

    let s = state;
    for (const e of enemies) {
      s = advanceEnemy(s, e.id);
    }
    return s;
  }

  // Used at mission start: enemies don't move, just pick intents from initial positions.
  function computeInitialIntents(state) {
    const enemies = S.livingEnemies(state)
      .slice()
      .sort((a, b) => tileOrderKey(a.at) - tileOrderKey(b.at));

    let s = state;
    for (const e of enemies) {
      const target = pickTarget(s, e);
      if (!target) { s = clearIntent(s, e.id); continue; }
      const stats = U.statsFor(e.type);
      if (stats.intentKind === 'ranged') {
        const los = S.lineOfSightTiles(s, e.at, stats.range);
        const hit = los.find(entry => entry.tile === target.at);
        s = hit ? setRangedIntent(s, e.id, target.at) : clearIntent(s, e.id);
      } else {
        if (S.tilesAdjacent(e.at, target.at)) {
          s = setMeleeIntent(s, e.id, target.at);
        } else {
          s = clearIntent(s, e.id);
        }
      }
    }
    return s;
  }

  window.HearthguardAI = {
    advanceAllEnemies, advanceEnemy, computeInitialIntents,
    pickTarget, pickMeleeDestination, pickRangedDestination,
  };
})();
