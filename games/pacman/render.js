(function () {
  'use strict';

  const M = window.PacmanMaze;
  const E = window.PacmanEngine;
  const TILE = E.TILE;              // engine units (8)
  const SCALE = 3;                  // render pixels per engine unit
  const TILE_PX = TILE * SCALE;     // 24 render px per tile
  const BOARD_W = M.COLS * TILE_PX; // 672
  const BOARD_H = M.ROWS * TILE_PX; // 744
  const HUD_H = 56;
  const CANVAS_W = BOARD_W;
  const CANVAS_H = BOARD_H + HUD_H;

  const COLOR_BG = '#000000';
  const COLOR_WALL_OUTER = '#2121DE';
  const COLOR_WALL_INNER = '#4A4AFF';
  const COLOR_DOT = '#FFB897';
  const COLOR_GATE = '#FFB8FF';
  const COLOR_TEXT = '#FFFFFF';
  const COLOR_READY = '#FFFF00';
  const COLOR_GAME_OVER = '#FF0000';
  const GHOST_FRIGHT_BODY = '#2121FF';
  const GHOST_FRIGHT_FLASH = '#FFFFFF';
  const GHOST_FRIGHT_FEATURE = '#FFFFFF';
  const GHOST_FRIGHT_FEATURE_FLASH = '#FF0000';

  const DIR_ANGLE = {
    right: 0,
    down: Math.PI / 2,
    left: Math.PI,
    up: -Math.PI / 2,
    none: 0,
  };

  function ex(e) { return e.x * SCALE; }
  function ey(e) { return e.y * SCALE + HUD_H; }  // HUD occupies top

  let wallBaked = null;

  function bakeWalls(state) {
    const cv = document.createElement('canvas');
    cv.width = BOARD_W;
    cv.height = BOARD_H;
    const c = cv.getContext('2d');
    c.fillStyle = COLOR_BG;
    c.fillRect(0, 0, BOARD_W, BOARD_H);

    // Helper: is tile at (x,y) a wall-like boundary? Gate is also a drawable boundary.
    const isWall = (x, y) => {
      if (y < 0 || y >= M.ROWS) return true;
      if (x < 0 || x >= M.COLS) return (y === M.TUNNEL_ROW) ? false : true;
      return state.tiles[y * M.COLS + x] === M.WALL;
    };

    // For each wall tile, draw 2-pass outline (outer + inner) on edges facing non-wall.
    const drawEdge = (x, y, edge, color, inset, lineWidth) => {
      c.strokeStyle = color;
      c.lineWidth = lineWidth;
      c.lineCap = 'round';
      const x0 = x * TILE_PX, y0 = y * TILE_PX;
      const x1 = x0 + TILE_PX, y1 = y0 + TILE_PX;
      c.beginPath();
      if (edge === 'up')    { c.moveTo(x0 - 0.5, y0 + inset); c.lineTo(x1 + 0.5, y0 + inset); }
      if (edge === 'down')  { c.moveTo(x0 - 0.5, y1 - inset); c.lineTo(x1 + 0.5, y1 - inset); }
      if (edge === 'left')  { c.moveTo(x0 + inset, y0 - 0.5); c.lineTo(x0 + inset, y1 + 0.5); }
      if (edge === 'right') { c.moveTo(x1 - inset, y0 - 0.5); c.lineTo(x1 - inset, y1 + 0.5); }
      c.stroke();
    };

    // Pass 1: outer royal blue thick line, inset 3px
    for (let y = 0; y < M.ROWS; y++) {
      for (let x = 0; x < M.COLS; x++) {
        if (!isWall(x, y)) continue;
        if (!isWall(x, y - 1)) drawEdge(x, y, 'up',    COLOR_WALL_OUTER, 3, 3);
        if (!isWall(x, y + 1)) drawEdge(x, y, 'down',  COLOR_WALL_OUTER, 3, 3);
        if (!isWall(x - 1, y)) drawEdge(x, y, 'left',  COLOR_WALL_OUTER, 3, 3);
        if (!isWall(x + 1, y)) drawEdge(x, y, 'right', COLOR_WALL_OUTER, 3, 3);
      }
    }
    // Pass 2: inner lighter highlight, inset 6px, thinner
    for (let y = 0; y < M.ROWS; y++) {
      for (let x = 0; x < M.COLS; x++) {
        if (!isWall(x, y)) continue;
        if (!isWall(x, y - 1)) drawEdge(x, y, 'up',    COLOR_WALL_INNER, 6, 1);
        if (!isWall(x, y + 1)) drawEdge(x, y, 'down',  COLOR_WALL_INNER, 6, 1);
        if (!isWall(x - 1, y)) drawEdge(x, y, 'left',  COLOR_WALL_INNER, 6, 1);
        if (!isWall(x + 1, y)) drawEdge(x, y, 'right', COLOR_WALL_INNER, 6, 1);
      }
    }

    // Ghost-house gate: pink horizontal bar on tiles flagged GATE
    for (let y = 0; y < M.ROWS; y++) {
      for (let x = 0; x < M.COLS; x++) {
        if (state.tiles[y * M.COLS + x] !== M.GATE) continue;
        c.fillStyle = COLOR_GATE;
        c.fillRect(x * TILE_PX - 0.5, y * TILE_PX + TILE_PX / 2 - 1, TILE_PX + 1, 3);
      }
    }

    wallBaked = cv;
  }

  function drawDots(ctx, state) {
    for (let y = 0; y < M.ROWS; y++) {
      for (let x = 0; x < M.COLS; x++) {
        const v = state.tiles[y * M.COLS + x];
        if (v === M.DOT) {
          ctx.fillStyle = COLOR_DOT;
          ctx.fillRect(
            x * TILE_PX + TILE_PX / 2 - 2,
            y * TILE_PX + TILE_PX / 2 - 2 + HUD_H,
            4, 4,
          );
        } else if (v === M.PELLET) {
          const blink = Math.floor(state.tick / 12) % 2 === 0;
          if (!blink) continue;
          ctx.fillStyle = COLOR_DOT;
          ctx.beginPath();
          ctx.arc(
            x * TILE_PX + TILE_PX / 2,
            y * TILE_PX + TILE_PX / 2 + HUD_H,
            6, 0, Math.PI * 2,
          );
          ctx.fill();
        }
      }
    }
  }

  function drawPac(ctx, pac, state) {
    const px = ex(pac), py = ey(pac);
    const r = TILE_PX * 0.7;

    if (!pac.alive && state.phase === 'dying' && state.dyingPacId === pac.id) {
      // Death animation: mouth opens wide then collapses
      const t = (state.tick - pac.deathFrame) / E.DYING_FRAMES;
      if (t < 0.85) {
        const angle = t * Math.PI; // 0 → 180° per half, full cycle 0..π
        ctx.fillStyle = pac.color;
        ctx.beginPath();
        const base = DIR_ANGLE[pac.lastDir || 'left'] - Math.PI / 2;
        ctx.moveTo(px, py);
        ctx.arc(px, py, r, base + angle, base + 2 * Math.PI - angle);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }

    if (!pac.alive) return;

    // Mouth animation
    let mouth = Math.abs(Math.sin(pac.animFrame * 0.25)) * (Math.PI / 3.5);
    if (pac.dir === 'none') mouth = 0.02;
    const facing = DIR_ANGLE[pac.lastDir || pac.dir || 'right'];

    ctx.fillStyle = pac.color;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, r, facing + mouth, facing - mouth + Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    // "Rival-eater" outline during pellet in battle mode
    if (pac.canEatRivals) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, r + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawGhost(ctx, ghost, state) {
    const gx = ex(ghost), gy = ey(ghost);
    const r = TILE_PX * 0.7;

    const frightened = ghost.mode === 'frightened';
    const eaten = ghost.mode === 'eaten';
    const framesLeft = ghost.frightenedUntil - state.tick;
    const flashing = frightened && framesLeft < E.FRIGHT_FLASH_FRAMES && Math.floor(state.tick / 12) % 2 === 0;

    const bodyColor = eaten ? null
      : frightened
        ? (flashing ? GHOST_FRIGHT_FLASH : GHOST_FRIGHT_BODY)
        : ghost.color;

    const featureColor = eaten ? null
      : frightened
        ? (flashing ? GHOST_FRIGHT_FEATURE_FLASH : GHOST_FRIGHT_FEATURE)
        : null;

    if (!eaten) {
      ctx.fillStyle = bodyColor;
      // Dome: upper half
      ctx.beginPath();
      ctx.arc(gx, gy - 2, r, Math.PI, Math.PI * 2);
      // Body rectangle down to skirt top
      ctx.lineTo(gx + r, gy + r - 3);
      // Skirt: 4-bump animation
      const phase = Math.floor(state.tick / 8) % 2;
      const bumps = 4;
      const w = (r * 2) / bumps;
      for (let i = 0; i < bumps; i++) {
        const bx = gx + r - i * w;
        const bxMid = bx - w / 2;
        const bxEnd = bx - w;
        const bumpY = (i % 2 === phase) ? gy + r : gy + r - 5;
        ctx.lineTo(bxMid, bumpY);
        ctx.lineTo(bxEnd, gy + r - 3);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Eyes (drawn for normal, frightened, and eaten states)
    const eyeDir = DIR_ANGLE[ghost.dir || 'left'];
    const edx = Math.cos(eyeDir), edy = Math.sin(eyeDir);
    const eyeOffsetX = 5, eyeOffsetY = -4, pupilOffset = 2.5;

    if (frightened) {
      // Eyes become a little face: two dots for eyes + W mouth
      ctx.fillStyle = featureColor;
      ctx.fillRect(gx - 6, gy - 3, 3, 3);
      ctx.fillRect(gx + 3, gy - 3, 3, 3);
      // W mouth
      ctx.strokeStyle = featureColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gx - 7, gy + 5);
      ctx.lineTo(gx - 4, gy + 2);
      ctx.lineTo(gx - 1, gy + 5);
      ctx.lineTo(gx + 2, gy + 2);
      ctx.lineTo(gx + 5, gy + 5);
      ctx.lineTo(gx + 7, gy + 2);
      ctx.stroke();
    } else {
      // Whites
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(gx - eyeOffsetX, gy + eyeOffsetY, 4, 0, Math.PI * 2);
      ctx.arc(gx + eyeOffsetX, gy + eyeOffsetY, 4, 0, Math.PI * 2);
      ctx.fill();
      // Pupils
      ctx.fillStyle = '#2121FF';
      ctx.beginPath();
      ctx.arc(gx - eyeOffsetX + edx * pupilOffset, gy + eyeOffsetY + edy * pupilOffset, 2, 0, Math.PI * 2);
      ctx.arc(gx + eyeOffsetX + edx * pupilOffset, gy + eyeOffsetY + edy * pupilOffset, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Human-controlled ghost indicator
    if (ghost.controlledBy === 'human') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(gx, gy, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEatGhostPopup(ctx, ev) {
    ctx.fillStyle = '#00FFFF';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(ev.points), ev.x * SCALE, ev.y * SCALE + HUD_H);
  }

  function drawHUD(ctx, state) {
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, CANVAS_W, HUD_H);

    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textBaseline = 'top';

    // Per-pac scores
    const pacs = state.pacs;
    const sectionW = CANVAS_W / Math.max(pacs.length + 1, 2);

    for (let i = 0; i < pacs.length; i++) {
      const p = pacs[i];
      ctx.textAlign = 'center';
      ctx.fillStyle = p.color;
      const label = pacs.length === 1 ? '1UP' : `P${i + 1}`;
      ctx.fillText(label, sectionW * i + sectionW / 2, 6);
      ctx.fillStyle = COLOR_TEXT;
      ctx.fillText(String(state.scores[p.id] || 0).padStart(6, '0'), sectionW * i + sectionW / 2, 26);
    }

    // Lives / level indicator on the right
    ctx.textAlign = 'right';
    ctx.fillStyle = COLOR_TEXT;
    if (state.lives != null) {
      ctx.fillText(`LIVES ${state.lives}`, CANVAS_W - 12, 6);
    }
    ctx.fillText(`LV ${state.level}`, CANVAS_W - 12, 26);
  }

  function drawReady(ctx, state) {
    ctx.font = '18px "Press Start 2P", monospace';
    ctx.fillStyle = COLOR_READY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('READY!', BOARD_W / 2, HUD_H + TILE_PX * 17.5);
  }

  function drawGameOver(ctx, state) {
    ctx.font = '18px "Press Start 2P", monospace';
    ctx.fillStyle = COLOR_GAME_OVER;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let label = 'GAME OVER';
    if (state.gameOverReason === 'last_standing' && state.winnerId != null) {
      label = `P${state.winnerId + 1} WINS`;
      ctx.fillStyle = state.pacs[state.winnerId]?.color || COLOR_READY;
    } else if (state.config.win === 'mostDotsWhenCleared' && state.winnerId != null) {
      label = `P${state.winnerId + 1} WINS`;
      ctx.fillStyle = state.pacs[state.winnerId]?.color || COLOR_READY;
    } else if (state.phase === 'level_clear') {
      label = 'LEVEL CLEAR!';
      ctx.fillStyle = COLOR_READY;
    }
    ctx.fillText(label, BOARD_W / 2, HUD_H + TILE_PX * 17.5);
  }

  let canvas = null;
  let ctx = null;

  function init(canvasEl) {
    canvas = canvasEl;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    wallBaked = null;
  }

  function render(state) {
    if (!ctx) return;
    if (!wallBaked) bakeWalls(state);

    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.drawImage(wallBaked, 0, HUD_H);

    drawDots(ctx, state);

    for (const g of state.ghosts) drawGhost(ctx, g, state);
    for (const p of state.pacs) drawPac(ctx, p, state);

    // Eat-ghost popups (in-frame transient)
    for (const ev of state.events) {
      if (ev.type === 'eat_ghost') drawEatGhostPopup(ctx, ev);
    }

    drawHUD(ctx, state);

    if (state.phase === 'ready') drawReady(ctx, state);
    if (state.phase === 'game_over' || state.phase === 'level_clear') drawGameOver(ctx, state);
  }

  window.PacmanRender = {
    init,
    render,
    CANVAS_W, CANVAS_H, BOARD_W, BOARD_H, HUD_H, TILE_PX, SCALE,
  };
})();
