/* ═══════════════════════════════════════════════════════════════════════
   Underhearth — dungeon.js
   Procedural floor generation: rooms-and-corridors, stairs, monster +
   item spawns. Deterministic from the rng parameter — `Math.random` is
   forbidden in this file (lint by grep at review).
   Exposes window.UnderhearthDungeon.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const E = window.UnderhearthEntities;
  if (!E) { console.error('UnderhearthDungeon: missing UnderhearthEntities'); return; }
  const TILE = E.TILE;

  const COLS = 60;
  const ROWS = 20;

  function generate(rng, depth, ghostHint) {
    const tiles = new Uint8Array(COLS * ROWS); // default 0 == WALL
    const rooms = [];

    const target = 5 + Math.floor(rng() * 4); // 5–8 rooms
    let attempts = 0;
    while (rooms.length < Math.max(2, target) && attempts < 250) {
      attempts++;
      const w = 4 + Math.floor(rng() * 6);
      const h = 3 + Math.floor(rng() * 4);
      const x = 1 + Math.floor(rng() * (COLS - w - 2));
      const y = 1 + Math.floor(rng() * (ROWS - h - 2));
      const cand = { x, y, w, h };
      if (rooms.every(r => !overlaps(cand, r, 1))) {
        rooms.push(cand);
        carveRoom(tiles, x, y, w, h);
      }
    }
    if (rooms.length < 2) return null; // caller can re-roll a different seed

    for (let i = 1; i < rooms.length; i++) {
      const a = center(rooms[i - 1]);
      const b = center(rooms[i]);
      carveCorridor(tiles, a.x, a.y, b.x, b.y, rng);
    }

    const playerStart = center(rooms[0]);
    const stairsDown = center(rooms[rooms.length - 1]);
    setTile(tiles, stairsDown.x, stairsDown.y, TILE.STAIRS_DOWN);
    if (depth > 1) setTile(tiles, playerStart.x, playerStart.y, TILE.STAIRS_UP);

    const monsters = [];
    const mTable = E.monsterTable(depth);
    let mid = 0;
    for (let i = 1; i < rooms.length; i++) {
      const count = 1 + Math.floor(rng() * 3);
      for (let j = 0; j < count; j++) {
        const pos = randomFloorIn(rooms[i], tiles, rng);
        if (!pos) continue;
        const kind = pickWeighted(mTable, rng).kind;
        const def = E.monster(kind);
        if (!def) continue;
        monsters.push({
          id: 'm' + depth + '-' + (mid++),
          x: pos.x, y: pos.y,
          kind, hp: def.hp, hpMax: def.hp,
          energy: 0, speed: def.speed, awake: false,
        });
      }
    }

    const items = [];
    let iid = 0;
    const itemCount = 2 + Math.floor(rng() * 3);
    for (let n = 0; n < itemCount; n++) {
      const room = rooms[1 + Math.floor(rng() * (rooms.length - 1))];
      const pos = randomFloorIn(room, tiles, rng);
      if (!pos) continue;
      const itable = E.itemTable(depth);
      const choice = pickWeighted(itable, rng);
      const it = E.item(choice.kind, choice.sub);
      if (!it) continue;
      items.push({
        id: 'i' + depth + '-' + (iid++),
        x: pos.x, y: pos.y,
        kind: it.kind, sub: it.sub,
        qty: it.kind === 'gold' ? 5 + Math.floor(rng() * 30) : 1,
      });
    }

    // Ghost-of-last-death: if this depth matches a saved ghost record, place
    // a corpse at the nearest floor tile to where the player previously died.
    const ghosts = [];
    if (ghostHint && ghostHint.depth === depth) {
      const target = nearestFloor(tiles, ghostHint.x, ghostHint.y);
      if (target) {
        ghosts.push({
          x: target.x, y: target.y,
          items: Array.isArray(ghostHint.items) ? ghostHint.items.slice() : [],
          gold:  ghostHint.gold | 0,
        });
      }
    }

    return {
      cols: COLS, rows: ROWS,
      tiles,
      seen: new Uint8Array(COLS * ROWS),
      monsters, items, ghosts,
      stairsUp: depth > 1 ? playerStart : null,
      stairsDown,
      rooms,
      playerStart,
    };
  }

  function nearestFloor(tiles, ox, oy) {
    if (ox >= 0 && ox < COLS && oy >= 0 && oy < ROWS && getTile(tiles, ox, oy) === TILE.FLOOR) return { x: ox, y: oy };
    for (let r = 1; r < Math.max(COLS, ROWS); r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring at distance r
          const x = ox + dx, y = oy + dy;
          if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) continue;
          if (getTile(tiles, x, y) === TILE.FLOOR) return { x, y };
        }
      }
    }
    return null;
  }

  // ── helpers ────────────────────────────────────────────────────────────
  function overlaps(a, b, pad) {
    return !(a.x + a.w + pad < b.x ||
             b.x + b.w + pad < a.x ||
             a.y + a.h + pad < b.y ||
             b.y + b.h + pad < a.y);
  }
  function center(r) { return { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) }; }
  function setTile(tiles, x, y, t) { tiles[y * COLS + x] = t; }
  function getTile(tiles, x, y)    { return tiles[y * COLS + x]; }

  function carveRoom(tiles, x, y, w, h) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) setTile(tiles, xx, yy, TILE.FLOOR);
    }
  }
  function carveCorridor(tiles, x1, y1, x2, y2, rng) {
    if (rng() < 0.5) {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) setTile(tiles, x, y1, TILE.FLOOR);
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) setTile(tiles, x2, y, TILE.FLOOR);
    } else {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) setTile(tiles, x1, y, TILE.FLOOR);
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) setTile(tiles, x, y2, TILE.FLOOR);
    }
  }
  function randomFloorIn(room, tiles, rng) {
    for (let i = 0; i < 25; i++) {
      const x = room.x + Math.floor(rng() * room.w);
      const y = room.y + Math.floor(rng() * room.h);
      if (getTile(tiles, x, y) === TILE.FLOOR) return { x, y };
    }
    return null;
  }
  function pickWeighted(table, rng) {
    const total = table.reduce((s, r) => s + r.weight, 0);
    let pick = rng() * total;
    for (const r of table) { pick -= r.weight; if (pick <= 0) return r; }
    return table[0];
  }

  window.UnderhearthDungeon = { generate };
})();
