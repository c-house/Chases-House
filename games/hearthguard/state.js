/* ═══════════════════════════════════════════════════════════════
   Hearthguard — state.js
   Pure. Builders, cloners, queries, geometry helpers.
   Tile addresses are 'A1'..'H8' strings. Internally, (col, row) are
   0-indexed: col 0 = A, row 0 = top.
   Exposes window.HearthguardState.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const COLS = 8;
  const ROWS = 8;
  const COL_LETTERS = 'ABCDEFGH';

  // ── Geometry ─────────────────────────────────────────────────
  function tileToCoords(tile) {
    if (typeof tile !== 'string' || tile.length !== 2) return null;
    const col = COL_LETTERS.indexOf(tile[0]);
    const row = parseInt(tile[1], 10) - 1;
    if (col < 0 || row < 0 || row >= ROWS) return null;
    return { col, row };
  }

  function coordsToTile(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return COL_LETTERS[col] + (row + 1);
  }

  function tileInBounds(tile) {
    return tileToCoords(tile) !== null;
  }

  function tileDistance(a, b) {
    const A = tileToCoords(a);
    const B = tileToCoords(b);
    if (!A || !B) return Infinity;
    return Math.abs(A.col - B.col) + Math.abs(A.row - B.row);
  }

  function tilesAdjacent(a, b) {
    return tileDistance(a, b) === 1;
  }

  // Returns 'N'|'S'|'E'|'W' if from→to is on a straight orthogonal line, else null.
  function directionFromTo(from, to) {
    const A = tileToCoords(from);
    const B = tileToCoords(to);
    if (!A || !B || from === to) return null;
    if (A.col === B.col) return A.row > B.row ? 'N' : 'S';
    if (A.row === B.row) return A.col > B.col ? 'W' : 'E';
    return null;
  }

  function shiftTile(tile, dir, n) {
    const c = tileToCoords(tile);
    if (!c) return null;
    const k = n == null ? 1 : n;
    const dc = dir === 'E' ? k : dir === 'W' ? -k : 0;
    const dr = dir === 'S' ? k : dir === 'N' ? -k : 0;
    return coordsToTile(c.col + dc, c.row + dr);
  }

  function oppositeDir(dir) {
    return { N: 'S', S: 'N', E: 'W', W: 'E' }[dir] || null;
  }

  // Tiles between (exclusive of both endpoints) on a straight line, in order from→to.
  function tilesBetween(from, to) {
    const dir = directionFromTo(from, to);
    if (!dir) return null;
    const dist = tileDistance(from, to);
    const out = [];
    for (let i = 1; i < dist; i++) out.push(shiftTile(from, dir, i));
    return out;
  }

  // ── RNG (seeded, serializable as integer) ────────────────────
  // Mulberry32 — single-int state for trivial cloning.
  function rngNext(seed) {
    let s = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: s };
  }

  function rngInt(seed, max) {
    const r = rngNext(seed);
    return { value: Math.floor(r.value * max), seed: r.seed };
  }

  function rngPick(seed, arr) {
    const r = rngInt(seed, arr.length);
    return { value: arr[r.value], seed: r.seed };
  }

  // ── Queries ──────────────────────────────────────────────────
  function unitAt(state, tile) {
    if (!tile) return null;
    return state.units.find(u => u.at === tile && u.hp > 0) || null;
  }

  function unitById(state, id) {
    return state.units.find(u => u.id === id) || null;
  }

  function unitsBySide(state, side) {
    return state.units.filter(u => u.side === side && u.hp > 0);
  }

  function livingHeroes(state)    { return unitsBySide(state, 'hero'); }
  function livingEnemies(state)   { return unitsBySide(state, 'enemy'); }
  function livingVillagers(state) { return unitsBySide(state, 'villager'); }

  // BFS reachable tiles within max moves, blocked by occupants. Excludes start tile.
  // Returns Map<tile, distance>.
  function reachableTiles(state, fromTile, maxDist) {
    const result = new Map();
    if (!tileInBounds(fromTile) || maxDist <= 0) return result;
    const visited = new Set([fromTile]);
    const queue = [[fromTile, 0]];
    while (queue.length) {
      const [t, d] = queue.shift();
      if (d >= maxDist) continue;
      for (const dir of ['N', 'S', 'E', 'W']) {
        const next = shiftTile(t, dir);
        if (!next || visited.has(next)) continue;
        visited.add(next);
        if (unitAt(state, next)) continue;
        result.set(next, d + 1);
        queue.push([next, d + 1]);
      }
    }
    return result;
  }

  // Tiles a ranged line attack can reach from a position with no blockers in between.
  // For a unit at `from` with range {min, max}, returns the list of orthogonal tiles
  // such that tilesBetween are all empty.
  function lineOfSightTiles(state, fromTile, range) {
    const out = [];
    const min = range.min || 1;
    const max = range.max;
    for (const dir of ['N', 'S', 'E', 'W']) {
      for (let d = 1; d <= max; d++) {
        const t = shiftTile(fromTile, dir, d);
        if (!t) break;
        const occupant = unitAt(state, t);
        if (d >= min) out.push({ tile: t, distance: d, occupant: occupant ? occupant.id : null });
        if (occupant) break;
      }
    }
    return out;
  }

  // ── Cloning ──────────────────────────────────────────────────
  function cloneUnit(u) {
    return {
      ...u,
      intent: u.intent ? { ...u.intent } : null,
    };
  }

  function clone(state) {
    return {
      ...state,
      units: state.units.map(cloneUnit),
      forecasts: state.forecasts.map(f => ({ ...f })),
      pendingPlayerActions: state.pendingPlayerActions.map(a => ({
        ...a,
        ...(a.kind === 'swap' ? { tileA: a.tileA, tileB: a.tileB } : {}),
      })),
      events: state.events.slice(),
      missionScore: state.missionScore ? { ...state.missionScore } : null,
      // missionDef is shared (read-only data); not cloned
    };
  }

  // ── Builders ─────────────────────────────────────────────────
  function createRunState(opts) {
    const seed = (opts && opts.seed != null) ? (opts.seed | 0) : (Date.now() | 0);
    return {
      runScore: 0,
      missionsCompleted: 0,
      runSeed: seed,
      phase: 'title',
      // mission-level fields populated by createMissionState
      missionIndex: -1,
      missionDef: null,
      rngSeed: seed,
      turn: 0,
      maxTurns: 0,
      cols: COLS,
      rows: ROWS,
      units: [],
      forecasts: [],
      selectedUnitId: null,
      pendingPlayerActions: [],
      events: [],
      missionScore: null,
    };
  }

  // Build a fresh mission state from a run state and a mission def.
  // rngSeed forks from runSeed using mission index, so each mission is reproducible
  // but each mission gets its own RNG stream.
  function createMissionState(runState, missionDef, units) {
    const idx = missionDef.index;
    const seedStep = rngNext(runState.runSeed + idx * 1009);
    return {
      ...runState,
      missionIndex: idx,
      missionDef,
      rngSeed: seedStep.seed,
      turn: 1,
      maxTurns: missionDef.maxTurns,
      phase: 'plan',
      cols: missionDef.cols,
      rows: missionDef.rows,
      units,
      forecasts: [],
      selectedUnitId: null,
      pendingPlayerActions: [],
      events: [],
      missionScore: null,
    };
  }

  // ── Action-legality helpers ──────────────────────────────────
  // Used by render (to highlight tiles) and narrate (to enumerate legalActions).
  function legalMovesFor(state, unitId) {
    const u = unitById(state, unitId);
    if (!u || u.hp <= 0 || u.hasMoved) return [];
    if (u.side !== 'hero') return [];
    const stats = (state.unitStats && state.unitStats[u.type]) || u.stats || {};
    const move = stats.move || 0;
    const reach = reachableTiles(state, u.at, move);
    return Array.from(reach.keys());
  }

  // ── Public ───────────────────────────────────────────────────
  window.HearthguardState = {
    COLS, ROWS, COL_LETTERS,
    // geometry
    tileToCoords, coordsToTile, tileInBounds,
    tileDistance, tilesAdjacent, directionFromTo, shiftTile,
    oppositeDir, tilesBetween,
    // rng
    rngNext, rngInt, rngPick,
    // queries
    unitAt, unitById, unitsBySide,
    livingHeroes, livingEnemies, livingVillagers,
    reachableTiles, lineOfSightTiles,
    // cloning
    clone, cloneUnit,
    // builders
    createRunState, createMissionState,
    // legality
    legalMovesFor,
  };
})();
