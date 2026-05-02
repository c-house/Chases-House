/* ═══════════════════════════════════════════════════════════════════════
   Underhearth — engine.js
   Turn engine: player intents, monster AI, FOV. Phase-1 ships a
   placeholder Bresenham-LOS FOV; Phase 2 swaps in symmetric
   shadowcasting. Energy/speed system is implemented from day one but
   only exercises one tier of speed (mons 80 vs player 100) until Phase 2
   adds spells/boots/potions that move it.
   Exposes window.UnderhearthEngine.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const E = window.UnderhearthEntities;
  if (!E) { console.error('UnderhearthEngine: missing UnderhearthEntities'); return; }
  const TILE = E.TILE;

  // ── Public API ──────────────────────────────────────────────────────────

  function executePlayerTurn(state, intent, rng) {
    const events = [];
    if (state.fsm !== 'playing') return { events };
    const p = state.player;

    if (intent.kind === 'move') {
      const nx = p.x + intent.dx;
      const ny = p.y + intent.dy;
      const t = getTile(state, nx, ny);
      if (t == null) return { events };

      // Bump-attack: if a monster is on the destination, attack it.
      const monster = state.floor.monsters.find(m => m.x === nx && m.y === ny);
      if (monster) {
        const mDef = E.monster(monster.kind);
        const cls = E.classBase(state.cls);
        const roll = 1 + Math.floor(rng.next() * 20); // d20
        const total = roll + cls.attackBonus;
        const crit = roll === 20;
        const fumble = roll === 1;
        if (fumble || (!crit && total < mDef.defense)) {
          events.push({ kind: 'miss', target: 'monster', label: mDef.label, attacker: 'player' });
        } else {
          let dmg = 1 + Math.floor(rng.next() * cls.dmgDie); // class damage die
          if (crit) dmg *= 2;
          monster.hp -= dmg;
          events.push({ kind: 'hit', target: 'monster', label: mDef.label, dmg, crit, attacker: 'player' });
          if (monster.hp <= 0) {
            state.floor.monsters = state.floor.monsters.filter(m => m !== monster);
            events.push({ kind: 'kill', label: mDef.label });
          }
        }
        state.turn++;
        return { events };
      }

      // Walking
      if (t === TILE.WALL) {
        events.push({ kind: 'bump' });
        return { events }; // wall bump is free (does not consume a turn)
      }
      p.x = nx; p.y = ny;

      // Ghost-of-last-death corpse: auto-loot everything.
      if (state.floor.ghosts) {
        const ghost = state.floor.ghosts.find(g => g.x === nx && g.y === ny);
        if (ghost) {
          if (ghost.gold) {
            state.gold += ghost.gold;
            events.push({ kind: 'pickup-gold', qty: ghost.gold });
          }
          for (const it of (ghost.items || [])) {
            if (it.kind === 'gold') {
              state.gold += it.qty || 1;
              events.push({ kind: 'pickup-gold', qty: it.qty || 1 });
              continue;
            }
            const stack = state.inv.find(s => s.kind === it.kind && s.sub === it.sub);
            if (stack) stack.qty = (stack.qty || 1) + (it.qty || 1);
            else state.inv.push({ uid: 'g' + state.turn + '-' + state.inv.length, kind: it.kind, sub: it.sub, qty: it.qty || 1 });
            events.push({ kind: 'pickup', label: E.itemDisplayName(state, { kind: it.kind, sub: it.sub, qty: it.qty }) });
          }
          state.floor.ghosts = state.floor.ghosts.filter(g => g !== ghost);
          events.push({ kind: 'ghost-found' });
        }
      }

      // Auto-pickup gold; flag other items.
      const item = state.floor.items.find(i => i.x === nx && i.y === ny);
      if (item) {
        if (item.kind === 'gold') {
          state.gold += (item.qty || 1);
          state.floor.items = state.floor.items.filter(i => i !== item);
          events.push({ kind: 'pickup-gold', qty: item.qty });
        } else {
          events.push({ kind: 'item-here', label: E.itemDisplayName(state, item) });
        }
      }

      // Stairs feedback — descent is a separate intent (>) but flag the player.
      if (t === TILE.STAIRS_DOWN) events.push({ kind: 'on-stairs-down' });

      state.turn++;
      p.hunger = Math.max(0, p.hunger - 1);
      return { events };
    }

    if (intent.kind === 'wait') {
      state.turn++;
      p.hunger = Math.max(0, p.hunger - 1);
      return { events };
    }

    if (intent.kind === 'descend') {
      const t = getTile(state, p.x, p.y);
      if (t === TILE.STAIRS_DOWN) {
        events.push({ kind: 'descend', toDepth: state.depth + 1 });
      } else {
        events.push({ kind: 'no-stairs' });
      }
      return { events };
    }

    if (intent.kind === 'pickup') {
      const item = state.floor.items.find(i => i.x === p.x && i.y === p.y);
      if (!item) { events.push({ kind: 'nothing-here' }); return { events }; }
      // Stack potions/scrolls of the same alias, otherwise add new row.
      const stack = state.inv.find(s => s.kind === item.kind && s.sub === item.sub);
      if (stack && (item.kind === 'potion' || item.kind === 'scroll' || item.kind === 'gold')) {
        stack.qty = (stack.qty || 1) + (item.qty || 1);
      } else {
        state.inv.push({ uid: 'inv-' + state.turn + '-' + state.inv.length, kind: item.kind, sub: item.sub, qty: item.qty || 1 });
      }
      state.floor.items = state.floor.items.filter(i => i !== item);
      events.push({ kind: 'pickup', label: E.itemDisplayName(state, item) });
      state.turn++;
      return { events };
    }

    if (intent.kind === 'use') {
      return useItem(state, intent.uid, rng);
    }

    if (intent.kind === 'drop') {
      const idx = state.inv.findIndex(it => it.uid === intent.uid);
      if (idx < 0) { events.push({ kind: 'no-such-item' }); return { events }; }
      const it = state.inv[idx];
      state.inv.splice(idx, 1);
      state.floor.items.push({
        id: 'd' + state.turn + '-' + idx,
        x: p.x, y: p.y,
        kind: it.kind, sub: it.sub, qty: it.qty || 1,
      });
      events.push({ kind: 'drop', label: E.itemDisplayName(state, it) });
      state.turn++;
      return { events };
    }

    return { events };
  }

  // ── Inventory operations ───────────────────────────────────────────────
  function useItem(state, uid, rng) {
    const events = [];
    const idx = state.inv.findIndex(it => it.uid === uid);
    if (idx < 0) { events.push({ kind: 'no-such-item' }); return { events }; }
    const it = state.inv[idx];

    if (it.kind === 'potion') {
      const alias = it.sub;
      const eff = state.ids.potions[alias];
      const beforeName = E.itemDisplayName(state, it);
      // Identify on use.
      state.ids.discovered.potions[alias] = true;
      const afterName = E.itemDisplayName(state, it);
      events.push({ kind: 'quaff', alias, label: beforeName });
      applyPotionEffect(state, eff, alias, events, rng);
      events.push({ kind: 'identified', alias, eff, label: afterName });
      // Decrement qty / remove
      it.qty = (it.qty || 1) - 1;
      if (it.qty <= 0) state.inv.splice(idx, 1);
      state.turn++;
      return { events };
    }

    if (it.kind === 'scroll') {
      const alias = it.sub;
      const eff = state.ids.scrolls[alias];
      const beforeName = E.itemDisplayName(state, it);
      state.ids.discovered.scrolls[alias] = true;
      const afterName = E.itemDisplayName(state, it);
      events.push({ kind: 'read', alias, label: beforeName });
      applyScrollEffect(state, eff, alias, events, rng);
      events.push({ kind: 'identified', alias, eff, label: afterName });
      it.qty = (it.qty || 1) - 1;
      if (it.qty <= 0) state.inv.splice(idx, 1);
      state.turn++;
      return { events };
    }

    events.push({ kind: 'cant-use', label: it.kind });
    return { events };
  }

  function applyPotionEffect(state, eff, alias, events, rng) {
    const p = state.player;
    if (eff === 'heal') {
      const amount = 4 + Math.floor(rng.next() * 8); // 1d8 + 4
      p.hp = Math.min(p.hpMax, p.hp + amount);
      events.push({ kind: 'eff-heal', amount });
    } else if (eff === 'paralysis') {
      // For Phase 2, paralysis simply skips your next 3 turns by giving monsters extra energy.
      for (const m of state.floor.monsters) m.energy += 200;
      events.push({ kind: 'eff-paralysis' });
    } else if (eff === 'haste') {
      p.statuses.push({ kind: 'hasted', turnsLeft: 12 });
      events.push({ kind: 'eff-haste' });
    } else if (eff === 'might') {
      p.statuses.push({ kind: 'mighty', turnsLeft: 20 });
      events.push({ kind: 'eff-might' });
    } else {
      events.push({ kind: 'eff-fizzle' });
    }
  }

  function applyScrollEffect(state, eff, alias, events, rng) {
    const p = state.player;
    if (eff === 'mapping') {
      // Reveal the layout (walls + stairs) of the floor, but not monsters/items.
      const cols = state.floor.cols, rows = state.floor.rows;
      for (let i = 0; i < cols * rows; i++) {
        if (state.floor.seen[i] === 0) state.floor.seen[i] = 1;
      }
      events.push({ kind: 'eff-mapping' });
    } else if (eff === 'teleport') {
      // Move player to a random floor tile.
      const cols = state.floor.cols, rows = state.floor.rows;
      for (let attempt = 0; attempt < 100; attempt++) {
        const x = Math.floor(rng.next() * cols);
        const y = Math.floor(rng.next() * rows);
        if (canMoveTo(state, x, y)) { p.x = x; p.y = y; break; }
      }
      events.push({ kind: 'eff-teleport' });
    } else if (eff === 'identify') {
      // Identify all unidentified potions/scrolls in inventory.
      let count = 0;
      for (const inv of state.inv) {
        if (inv.kind === 'potion' && !state.ids.discovered.potions[inv.sub]) {
          state.ids.discovered.potions[inv.sub] = true; count++;
        }
        if (inv.kind === 'scroll' && !state.ids.discovered.scrolls[inv.sub]) {
          state.ids.discovered.scrolls[inv.sub] = true; count++;
        }
      }
      events.push({ kind: 'eff-identify', count });
    } else if (eff === 'confuse') {
      p.statuses.push({ kind: 'confused', turnsLeft: 10 });
      events.push({ kind: 'eff-confuse' });
    } else {
      events.push({ kind: 'eff-fizzle' });
    }
  }

  function executeMonsterTurns(state, rng) {
    const events = [];
    if (state.fsm !== 'playing') return { events };
    const p = state.player;
    const cls = E.classBase(state.cls);

    for (const m of state.floor.monsters.slice()) {
      m.energy += m.speed;
      // Loop in case the monster has accumulated >1 turn (faster than player).
      while (m.energy >= 100 && p.hp > 0) {
        m.energy -= 100;
        const def = E.monster(m.kind);
        if (!def) continue;

        const dx = Math.sign(p.x - m.x);
        const dy = Math.sign(p.y - m.y);
        const dist = Math.max(Math.abs(p.x - m.x), Math.abs(p.y - m.y));

        if (dist <= def.awakeRadius) m.awake = true;
        if (!m.awake) continue;

        // Adjacent → attack roll
        if (dist <= 1) {
          const roll = 1 + Math.floor(rng.next() * 20);
          const crit = roll === 20;
          if (roll === 1 || (!crit && roll + 3 < cls.defense)) {
            events.push({ kind: 'miss', target: 'player', label: def.label, attacker: m.kind });
          } else {
            let dmg = def.dmg;
            if (crit) dmg *= 2;
            p.hp -= dmg;
            events.push({ kind: 'hit', target: 'player', label: def.label, dmg, crit, attacker: m.kind });
            if (p.hp <= 0) {
              events.push({ kind: 'death', cause: m.kind, label: def.label });
              return { events };
            }
          }
          continue;
        }

        // Step toward player (Chebyshev). Try diagonal, then cardinal fallbacks.
        if (canMoveTo(state, m.x + dx, m.y + dy)) { m.x += dx; m.y += dy; continue; }
        if (dx !== 0 && canMoveTo(state, m.x + dx, m.y)) { m.x += dx; continue; }
        if (dy !== 0 && canMoveTo(state, m.x, m.y + dy)) { m.y += dy; continue; }
      }
    }
    return { events };
  }

  // Symmetric recursive shadowcasting (Albert Ford 2019 / Adam Milazzo lineage).
  // Reference: https://www.albertford.com/shadowcasting/
  // Per-quadrant scan with rational-slope intervals; tiles are revealed when they
  // are walls or when symmetric (within the slope range). Symmetric = "I see X iff
  // X sees me" — the canonical roguelike correctness property the Bresenham FOV
  // failed in edge cases.
  function computeFOV(state, ox, oy, radius) {
    const cols = state.floor.cols, rows = state.floor.rows;
    const vis = new Uint8Array(cols * rows);
    vis[oy * cols + ox] = 1;

    // Four quadrants: N (row up), S (row down), E (row right), W (row left).
    const QUADS = [
      { rdx: 0, rdy: -1, cdx: 1, cdy:  0 },
      { rdx: 0, rdy:  1, cdx: 1, cdy:  0 },
      { rdx: 1, rdy:  0, cdx: 0, cdy:  1 },
      { rdx:-1, rdy:  0, cdx: 0, cdy:  1 },
    ];

    function transform(q, depth, col) {
      return { x: ox + q.rdx * depth + q.cdx * col,
               y: oy + q.rdy * depth + q.cdy * col };
    }
    function isWall(x, y) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return true;
      return state.floor.tiles[y * cols + x] === TILE.WALL;
    }
    function reveal(x, y) {
      if (x >= 0 && y >= 0 && x < cols && y < rows) vis[y * cols + x] = 1;
    }
    function slope(depth, col) { return (2 * col - 1) / (2 * depth); }
    function inRadius(depth, col) { return depth * depth + col * col <= radius * radius + radius; }

    function scan(q, depth, startSlope, endSlope) {
      if (depth > radius) return;
      const minCol = Math.floor(depth * startSlope + 0.5);
      const maxCol = Math.ceil(depth * endSlope - 0.5);
      let prevTile = null; // null | 'wall' | 'floor'
      for (let col = minCol; col <= maxCol; col++) {
        const { x, y } = transform(q, depth, col);
        const wall = isWall(x, y);
        const floorTile = !wall;
        const symmetric = col >= depth * startSlope && col <= depth * endSlope;
        if ((wall || symmetric) && inRadius(depth, col)) reveal(x, y);
        if (prevTile === 'wall'  && floorTile) startSlope = slope(depth, col);
        if (prevTile === 'floor' && wall)      scan(q, depth + 1, startSlope, slope(depth, col));
        prevTile = wall ? 'wall' : 'floor';
      }
      if (prevTile === 'floor') scan(q, depth + 1, startSlope, endSlope);
    }

    for (const q of QUADS) scan(q, 1, -1, 1);
    return vis;
  }

  function canMoveTo(state, x, y) {
    const t = getTile(state, x, y);
    if (t == null || t === TILE.WALL) return false;
    if (state.player.x === x && state.player.y === y) return false;
    if (state.floor.monsters.some(m => m.x === x && m.y === y)) return false;
    return true;
  }

  function getTile(state, x, y) {
    if (x < 0 || y < 0 || x >= state.floor.cols || y >= state.floor.rows) return null;
    return state.floor.tiles[y * state.floor.cols + x];
  }

  window.UnderhearthEngine = {
    executePlayerTurn, executeMonsterTurns,
    computeFOV, canMoveTo, getTile,
    useItem,
  };
})();
