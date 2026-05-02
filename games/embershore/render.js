/* ═══════════════════════════════════════════════════════════════
   Embershore — render.js
   Canvas 2D drawing — tilemap baking, sprites, HUD, room-scroll.
   PR1 generates placeholder sprite atlases programmatically.
   When real PNGs ship, replace generateAtlases() with Image() loads —
   draw call sites do not change.
   See docs/design/019-embershore-architecture.md §6, §10.
   Exposes window.EmbershoreRender.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const W = window.EmbershoreWorld;
  const E = window.EmbershoreEngine;

  // ── Geometry constants ──────────────────────────────────────
  const SCALE = 4;
  const TILE_PX = W.TILE * SCALE;        // 64
  const ROOM_W = W.COLS * W.TILE;         // 160 logical
  const ROOM_H = W.ROWS * W.TILE;         // 144 logical
  const CANVAS_W = ROOM_W * SCALE;        // 640
  const CANVAS_H = ROOM_H * SCALE;        // 576

  let ctx = null;
  let canvas = null;

  // ── Atlas storage ───────────────────────────────────────────
  // Each atlas = HTMLCanvasElement holding the placeholder art at native scale.
  const atlases = {};   // { terrain, player, npcs, enemies, items, effects }
  const bakedRooms = {};  // { [roomId]: HTMLCanvasElement (160×144 logical) }

  // ── Public init ─────────────────────────────────────────────
  function init(canvasEl) {
    canvas = canvasEl;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    generateAtlases();   // synchronous — programmatic placeholders
  }

  // ── Programmatic placeholder atlases ────────────────────────
  // PR1: every atlas is a Canvas element painted at native 16×16.
  // PR2+: replace with Image() loads of real PNGs.
  function makeAtlas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function generateAtlases() {
    atlases.terrain = generateTerrainAtlas();
    atlases.player  = generatePlayerAtlas();
    // Stubs (small empty canvases) — populated in later steps
    atlases.npcs = makeAtlas(128, 16);
    atlases.enemies = makeAtlas(128, 16);
    atlases.items = makeAtlas(128, 16);
    atlases.effects = makeAtlas(128, 16);
  }

  // Tile atlas — one tile per index, 16×16 each, in a single row.
  // Index → tile type: matches W.TILES values.
  function generateTerrainAtlas() {
    const w = 16 * 16;  // 16 tile slots
    const c = makeAtlas(w, 16);
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;

    // Slot 0 EMPTY — fully transparent (skip)
    // Slot 1 SAND — warm tan with subtle stipple
    paintSandTile(cx, W.TILES.SAND * 16, 0);
    // Slot 2 GRASS
    paintGrassTile(cx, W.TILES.GRASS * 16, 0);
    // Slot 3 WATER
    paintWaterTile(cx, W.TILES.WATER * 16, 0);
    // Slot 4 STONE
    paintStoneTile(cx, W.TILES.STONE * 16, 0);
    // Slot 5 BUSH
    paintBushTile(cx, W.TILES.BUSH * 16, 0);
    // Slot 6 TOTEM
    paintTotemTile(cx, W.TILES.TOTEM * 16, 0);
    // Slot 7 INN
    paintInnTile(cx, W.TILES.INN * 16, 0);
    // Slot 8 FIRE
    paintFireTile(cx, W.TILES.FIRE * 16, 0);

    return c;
  }

  function paintSandTile(cx, x, y) {
    // 4-color sand ramp
    cx.fillStyle = '#d4b478';
    cx.fillRect(x, y, 16, 16);
    // Stipple darker dots
    cx.fillStyle = '#a06828';
    [[3,5],[10,2],[12,9],[5,12],[14,13],[7,7]].forEach(([px,py]) => {
      cx.fillRect(x+px, y+py, 1, 1);
    });
    // Lighter highlight
    cx.fillStyle = '#f0e6d3';
    [[6,4],[11,11],[2,10]].forEach(([px,py]) => {
      cx.fillRect(x+px, y+py, 1, 1);
    });
  }
  function paintGrassTile(cx, x, y) {
    cx.fillStyle = '#8a9a6e';
    cx.fillRect(x, y, 16, 16);
    cx.fillStyle = '#6a7d5a';
    [[2,3],[7,5],[11,2],[4,9],[13,11],[9,13]].forEach(([px,py]) => {
      cx.fillRect(x+px, y+py, 2, 1);
    });
    cx.fillStyle = '#c4cfa0';
    [[5,2],[10,8],[3,12]].forEach(([px,py]) => {
      cx.fillRect(x+px, y+py, 1, 1);
    });
  }
  function paintWaterTile(cx, x, y) {
    cx.fillStyle = '#3a5266';
    cx.fillRect(x, y, 16, 16);
    cx.fillStyle = '#6a8499';
    cx.fillRect(x, y, 16, 8);
    // Light wave-line highlights
    cx.fillStyle = '#b8c8d4';
    cx.fillRect(x+2, y+4, 4, 1);
    cx.fillRect(x+9, y+10, 5, 1);
    cx.fillRect(x+1, y+13, 3, 1);
  }
  function paintStoneTile(cx, x, y) {
    cx.fillStyle = '#6b5a48';
    cx.fillRect(x, y, 16, 16);
    cx.fillStyle = '#9a8e7a';
    cx.fillRect(x+1, y+1, 14, 2);
    cx.fillRect(x+1, y+1, 2, 14);
    cx.fillStyle = '#2a2018';
    cx.fillRect(x+13, y+1, 2, 14);
    cx.fillRect(x+1, y+13, 14, 2);
    // Subtle texture
    cx.fillStyle = '#d6c4a8';
    cx.fillRect(x+5, y+5, 1, 1);
    cx.fillRect(x+9, y+8, 1, 1);
  }
  function paintBushTile(cx, x, y) {
    // Sand background
    paintSandTile(cx, x, y);
    // Bush ball on top
    cx.fillStyle = '#6a7d5a';
    cx.beginPath();
    cx.arc(x+8, y+9, 6, 0, Math.PI*2);
    cx.fill();
    cx.fillStyle = '#8a9a6e';
    cx.beginPath();
    cx.arc(x+6, y+7, 3, 0, Math.PI*2);
    cx.fill();
    cx.fillStyle = '#38442b';
    cx.fillRect(x+3, y+12, 1, 2);
    cx.fillRect(x+12, y+12, 1, 2);
  }
  function paintTotemTile(cx, x, y) {
    paintSandTile(cx, x, y);
    cx.fillStyle = '#6b5a48';
    cx.fillRect(x+5, y+3, 6, 11);
    cx.fillStyle = '#9a8e7a';
    cx.fillRect(x+5, y+3, 1, 11);
    cx.fillStyle = '#2a2018';
    cx.fillRect(x+10, y+3, 1, 11);
    // Ember-glow eye
    cx.fillStyle = '#e8b04a';
    cx.fillRect(x+7, y+6, 2, 1);
    cx.fillRect(x+7, y+9, 2, 1);
  }
  function paintInnTile(cx, x, y) {
    paintSandTile(cx, x, y);
    // Simple house silhouette
    cx.fillStyle = '#a06828';
    cx.fillRect(x+2, y+8, 12, 6);
    cx.fillStyle = '#5a3618';
    // Roof
    cx.beginPath();
    cx.moveTo(x+1, y+8);
    cx.lineTo(x+8, y+2);
    cx.lineTo(x+15, y+8);
    cx.closePath();
    cx.fill();
    // Door
    cx.fillStyle = '#2e1f10';
    cx.fillRect(x+7, y+10, 2, 4);
    // Window
    cx.fillStyle = '#e8b04a';
    cx.fillRect(x+4, y+10, 2, 2);
  }
  function paintFireTile(cx, x, y) {
    paintSandTile(cx, x, y);
    // Logs
    cx.fillStyle = '#5a3618';
    cx.fillRect(x+3, y+12, 10, 2);
    cx.fillRect(x+4, y+11, 8, 1);
    // Flame
    cx.fillStyle = '#a06828';
    cx.fillRect(x+6, y+7, 4, 4);
    cx.fillStyle = '#e8b04a';
    cx.fillRect(x+7, y+6, 2, 4);
    cx.fillStyle = '#faf3e6';
    cx.fillRect(x+7, y+8, 2, 1);
  }

  // Player atlas — 8 cols × 4 rows so we can index into walk frames per dir.
  // Layout: per dir (0=down, 1=up, 2=left, 3=right), 8 frames in row.
  // Frames: 0=idle, 1=walk_a, 2=walk_b, 3=swing, 4=fall, 5=flutter, 6=blink, 7=spare
  function generatePlayerAtlas() {
    const c = makeAtlas(8 * 16, 4 * 16);
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    const dirs = ['down','up','left','right'];
    for (let d = 0; d < 4; d++) {
      const dir = dirs[d];
      paintPlayerFrame(cx, 0*16, d*16, dir, 'idle');
      paintPlayerFrame(cx, 1*16, d*16, dir, 'walk_a');
      paintPlayerFrame(cx, 2*16, d*16, dir, 'walk_b');
      paintPlayerFrame(cx, 3*16, d*16, dir, 'swing');
      paintPlayerFrame(cx, 5*16, d*16, dir, 'flutter');
    }
    return c;
  }

  function paintPlayerFrame(cx, x, y, dir, frame) {
    // Body — terracotta tunic
    const tunic = '#b05a3a';
    const tunicShade = '#5a3618';
    const skin = '#d4b478';
    const skinShade = '#a06828';
    const hairColor = '#5a3618';

    // Head (4×4)
    cx.fillStyle = skin;
    cx.fillRect(x+6, y+2, 4, 4);
    // Hair top
    cx.fillStyle = hairColor;
    cx.fillRect(x+5, y+1, 6, 2);
    // Tunic body (6×8)
    cx.fillStyle = tunic;
    cx.fillRect(x+5, y+6, 6, 7);
    // Tunic shading
    cx.fillStyle = tunicShade;
    cx.fillRect(x+5, y+12, 6, 1);
    // Legs
    cx.fillStyle = '#a06828';

    // Frame variations by walk
    let lx1 = 6, lx2 = 9, ly1 = 13, ly2 = 13;
    if (frame === 'walk_a') { ly1 = 13; ly2 = 14; }
    if (frame === 'walk_b') { ly1 = 14; ly2 = 13; }
    cx.fillRect(x+lx1, y+ly1, 1, 2);
    cx.fillRect(x+lx2, y+ly2, 1, 2);

    // Direction-specific face cue
    cx.fillStyle = skinShade;
    if (dir === 'down') {
      cx.fillRect(x+7, y+4, 1, 1);  // left eye
      cx.fillRect(x+8, y+4, 1, 1);  // right eye
    } else if (dir === 'up') {
      // No face — just hair coverage
      cx.fillStyle = hairColor;
      cx.fillRect(x+5, y+2, 6, 2);
    } else if (dir === 'left') {
      cx.fillRect(x+6, y+4, 1, 1);
    } else if (dir === 'right') {
      cx.fillRect(x+9, y+4, 1, 1);
    }

    // Sword swing — extra blade pixel in front
    if (frame === 'swing') {
      cx.fillStyle = '#faf3e6';
      if (dir === 'down')  cx.fillRect(x+7, y+14, 2, 2);
      if (dir === 'up')    cx.fillRect(x+7, y, 2, 2);
      if (dir === 'left')  cx.fillRect(x, y+8, 2, 2);
      if (dir === 'right') cx.fillRect(x+14, y+8, 2, 2);
    }

    // Tunic flutter — single pixel hem detail
    if (frame === 'flutter') {
      cx.fillStyle = '#5a3618';
      cx.fillRect(x+11, y+12, 1, 1);
    }
  }

  // ── Tilemap baking ──────────────────────────────────────────
  function bakeRoom(roomId) {
    const room = W.getRoom(roomId);
    if (!room) return null;
    const c = makeAtlas(ROOM_W, ROOM_H);
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    // Default fill: sand
    cx.fillStyle = '#d4b478';
    cx.fillRect(0, 0, ROOM_W, ROOM_H);
    // Draw each tile
    for (let ty = 0; ty < W.ROWS; ty++) {
      for (let tx = 0; tx < W.COLS; tx++) {
        const tile = room.tiles[ty * W.COLS + tx];
        if (tile === W.TILES.EMPTY || tile === W.TILES.SAND) continue;  // already filled
        cx.drawImage(atlases.terrain, tile * 16, 0, 16, 16, tx * 16, ty * 16, 16, 16);
      }
    }
    bakedRooms[roomId] = c;
    return c;
  }

  function getBakedRoom(roomId) {
    return bakedRooms[roomId] || bakeRoom(roomId);
  }

  function invalidateRoom(roomId) {
    delete bakedRooms[roomId];
  }

  // ── Render ──────────────────────────────────────────────────
  function render(state, alpha) {
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#0a0a0b';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (state.scroll) {
      drawScrollingRooms(state);
    } else {
      drawRoom(state, state.roomId, 0, 0);
      drawEntities(state, 0, 0);
      drawPlayer(state, 0, 0);
    }

    drawHUD(state);
  }

  function drawRoom(state, roomId, offsetXLogical, offsetYLogical) {
    const baked = getBakedRoom(roomId);
    if (!baked) return;
    ctx.drawImage(
      baked,
      0, 0, ROOM_W, ROOM_H,
      offsetXLogical * SCALE, offsetYLogical * SCALE,
      ROOM_W * SCALE, ROOM_H * SCALE
    );
  }

  function drawScrollingRooms(state) {
    const scr = state.scroll;
    const easing = E.getEasing();
    const t = easing.fn(Math.min(1, scr.frame / scr.totalFrames));
    let fromOffsetX = 0, fromOffsetY = 0;
    let toOffsetX = 0, toOffsetY = 0;
    if (scr.dir === 'right') {
      fromOffsetX = -t * ROOM_W;
      toOffsetX = ROOM_W - t * ROOM_W;
    } else if (scr.dir === 'left') {
      fromOffsetX = t * ROOM_W;
      toOffsetX = -ROOM_W + t * ROOM_W;
    } else if (scr.dir === 'down') {
      fromOffsetY = -t * ROOM_H;
      toOffsetY = ROOM_H - t * ROOM_H;
    } else if (scr.dir === 'up') {
      fromOffsetY = t * ROOM_H;
      toOffsetY = -ROOM_H + t * ROOM_H;
    }

    drawRoom(state, scr.from, fromOffsetX, fromOffsetY);
    drawRoom(state, scr.to,   toOffsetX,   toOffsetY);

    // Player draws relative to the 'from' room frame.
    drawPlayer(state, fromOffsetX, fromOffsetY);
  }

  function drawEntities(state, offsetX, offsetY) {
    // PR1: entities array is empty. PR2+ z-sorts by .y and draws here.
  }

  function drawPlayer(state, offsetXLogical, offsetYLogical) {
    const p = state.player;
    if (!p.alive) return;
    const dirRow = { down: 0, up: 1, left: 2, right: 3 }[p.dir] || 0;
    let frameCol = 0;
    if (p.swingFrames > 0) frameCol = 3;
    else if (p.moving) frameCol = (p.walkFrame === 0) ? 1 : 2;
    else frameCol = 0;
    // Sprite anchored at center; logical px → render px
    const sx = (p.x - 8 + offsetXLogical) * SCALE;
    const sy = (p.y - 8 + offsetYLogical) * SCALE;
    ctx.drawImage(
      atlases.player,
      frameCol * 16, dirRow * 16, 16, 16,
      sx, sy, 16 * SCALE, 16 * SCALE
    );
  }

  // ── HUD ─────────────────────────────────────────────────────
  function drawHUD(state) {
    const flashing = state.hudFlashFrames > 0;
    const opacity = flashing ? 1.0 : 0.7;
    ctx.save();
    ctx.globalAlpha = opacity;

    // Hearts row — top-left
    const heartSize = 8 * SCALE;  // 32 render px
    const heartGap  = 2 * SCALE;
    const heartsX = 8 * SCALE;
    const heartsY = 8 * SCALE;
    for (let i = 0; i < state.hearts.max; i++) {
      drawHeart(heartsX + i * (heartSize + heartGap), heartsY, i < state.hearts.current);
    }

    // Found counter — below hearts
    const counterY = heartsY + heartSize + 6 * SCALE;
    drawCoinIcon(heartsX, counterY);
    ctx.fillStyle = '#faf3e6';
    ctx.font = (5 * SCALE) + "px 'Press Start 2P', monospace";
    ctx.textBaseline = 'top';
    const padded = String(state.rupees).padStart(3, '0');
    ctx.fillText(padded, heartsX + 7 * SCALE, counterY + 1 * SCALE);

    ctx.restore();
  }

  function drawHeart(x, y, full) {
    const sz = 8 * SCALE;  // 32px
    const half = sz / 2;
    if (full) {
      // Ember-glow bead
      const grad = ctx.createRadialGradient(x + half * 0.7, y + half * 0.7, 1, x + half, y + half, half);
      grad.addColorStop(0, '#f5d491');
      grad.addColorStop(0.5, '#e8b04a');
      grad.addColorStop(1, '#a06828');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x + half, y + half, half - 2, 0, Math.PI*2);
      ctx.fill();
      // Glow halo
      ctx.fillStyle = 'rgba(245, 212, 145, 0.25)';
      ctx.beginPath();
      ctx.arc(x + half, y + half, half, 0, Math.PI*2);
      ctx.fill();
    } else {
      // Empty ring
      ctx.strokeStyle = '#5c5347';
      ctx.lineWidth = 1.5 * SCALE;
      ctx.beginPath();
      ctx.arc(x + half, y + half, half - 2, 0, Math.PI*2);
      ctx.stroke();
    }
  }

  function drawCoinIcon(x, y) {
    // Small ember-glow diamond
    const sz = 5 * SCALE;
    ctx.save();
    ctx.translate(x + sz/2, y + sz/2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#e8b04a';
    ctx.fillRect(-sz/2, -sz/2, sz, sz);
    ctx.fillStyle = '#a06828';
    ctx.fillRect(-sz/2, sz/4, sz, sz/4);
    ctx.restore();
  }

  function cameraOffset(state) {
    // PR1: camera is always at 0,0 — viewport == single room. PR2 may parallax.
    return { x: 0, y: 0 };
  }

  window.EmbershoreRender = {
    init: init,
    render: render,
    bakeRoom: bakeRoom,
    invalidateRoom: invalidateRoom,
    cameraOffset: cameraOffset,
    CANVAS_W: CANVAS_W,
    CANVAS_H: CANVAS_H,
    SCALE: SCALE,
    TILE_PX: TILE_PX,
  };
})();
