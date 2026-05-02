/* ═══════════════════════════════════════════════════════════════
   Embershore — entities.js
   Entity factories + per-type step. PR1 implements only the player.
   See docs/design/019-embershore-architecture.md §15.
   Exposes window.EmbershoreEntities.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window.EmbershoreWorld;

  function createPlayer(opts) {
    return {
      type: 'player',
      x: opts && opts.x != null ? opts.x : 80,   // logical px
      y: opts && opts.y != null ? opts.y : 72,
      dir: opts && opts.dir ? opts.dir : 'down',
      walkFrame: 0,         // 0 or 1 — alternates per tile traversed
      walkProgress: 0,      // 0..1 within current tile, for animation timing
      moving: false,        // set true on any movement tick
      swingFrames: 0,
      invulnFrames: 0,
      alive: true,
    };
  }

  // PR1 stubs — fleshed out in PR2
  function createNpc(opts) {
    return {
      type: 'npc',
      npcId: opts.npcId,
      x: opts.x, y: opts.y,
      dir: opts.dir || 'down',
      blinkFrame: 0,
      alive: true,
    };
  }
  function createEnemy(opts) {
    return {
      type: 'enemy',
      enemyType: opts.enemyType,
      x: opts.x, y: opts.y,
      dir: opts.dir || 'down',
      hearts: opts.hearts || 1,
      alive: true,
    };
  }
  function createPickup(opts) {
    return {
      type: 'pickup',
      item: opts.item,
      x: opts.x, y: opts.y,
      alive: true,
    };
  }

  // ── Player step: movement + tile collision ───────────────────
  const SPEED = 1.0;  // logical px per tick

  function stepPlayer(state, p, input) {
    if (!p.alive) return;
    if (state.scroll) {
      // During room-scroll, the engine puppeteers the player — entities skip
      return;
    }
    if (p.invulnFrames > 0) p.invulnFrames--;

    let dx = 0, dy = 0;
    const dir = input && input.dir;
    if (dir === 'up')    { dy = -SPEED; p.dir = 'up'; }
    if (dir === 'down')  { dy =  SPEED; p.dir = 'down'; }
    if (dir === 'left')  { dx = -SPEED; p.dir = 'left'; }
    if (dir === 'right') { dx =  SPEED; p.dir = 'right'; }

    p.moving = (dx !== 0 || dy !== 0);

    if (p.moving) {
      // Try X axis
      const nextX = p.x + dx;
      if (canWalkAt(state, nextX, p.y)) p.x = nextX;
      // Try Y axis (separately, so we slide along walls)
      const nextY = p.y + dy;
      if (canWalkAt(state, p.x, nextY)) p.y = nextY;

      // Walk-frame animation: alternate every 8 px traveled
      p.walkProgress += SPEED / 8;
      if (p.walkProgress >= 1) {
        p.walkFrame = 1 - p.walkFrame;
        p.walkProgress -= 1;
      }
    } else {
      p.walkProgress = 0;
      p.walkFrame = 0;  // idle pose
    }
  }

  // Check if the player's bounding box at (cx, cy) lands only on walkable tiles.
  // Player is treated as a 12×12 box (slightly smaller than 16 for forgiving fit).
  function canWalkAt(state, cx, cy) {
    const half = 6;
    const room = W.getRoom(state.roomId);
    if (!room) return false;
    const corners = [
      [cx - half, cy - half],
      [cx + half - 1, cy - half],
      [cx - half, cy + half - 1],
      [cx + half - 1, cy + half - 1],
    ];
    for (const [px, py] of corners) {
      const tx = Math.floor(px / W.TILE);
      const ty = Math.floor(py / W.TILE);
      const tile = W.tileAt(room.tiles, tx, ty);
      if (!W.isWalkable(tile)) return false;
    }
    return true;
  }

  function step(state, ent, input) {
    if (ent.type === 'player') return stepPlayer(state, ent, input);
    // Other entity types stub for PR1 — handled in later steps
  }

  window.EmbershoreEntities = {
    createPlayer: createPlayer,
    createNpc: createNpc,
    createEnemy: createEnemy,
    createPickup: createPickup,
    step: step,
    canWalkAt: canWalkAt,  // exposed for engine room-scroll triggers
  };
})();
