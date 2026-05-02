/**
 * Fishing — game.js
 *
 * State machine + render + input dispatch for the cozy arcade-fishing game
 * specified in ADR-020. Replaces scene.js.
 *
 * Architecture (per ADR-020 §9):
 *   - window.Fishing namespace, IIFE
 *   - Single-state-machine: title → casting → waiting → strike → reeling → reveal
 *   - Pause / shop / help / settings are stack overlays that freeze the underlying tick
 *   - Canvas 2D with imageSmoothingEnabled = false (visible canvas at 320×180,
 *     CSS upscales via image-rendering: pixelated)
 *   - requestAnimationFrame + fixed-timestep accumulator at 60 Hz
 *   - Mulberry32 seeded RNG for daily-seed branches; Math.random for cosmetic only
 *
 * Reads: window.FishingFish (species), window.FishingAudio (synthesized cues),
 *        window.SharedGamepad (gamepad polling per ADR-016).
 */
(function () {
  'use strict';

  // ─── Canvas + virtual resolution ────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const W = canvas.width;     // 320
  const H = canvas.height;    // 180
  const HORIZON = 80;

  // ─── Palette (absorbed from scene.js) ───────────────────────────
  const C = {
    skyTop:    '#1d3147', terracotta:'#b05a3a', sunCore:   '#c8943e',
    sunGlow:   '#e8b04a', sunDeep:   '#8a5418',
    nearshore: '#3e6a8f', midwater:  '#2a4a6b', deepwater: '#1d3147',
    shimmer:   '#7fb0d4',
    hillsBack: '#2f4a2c', hillsMid:  '#4a6b3a', hillsFront:'#6b8a4a',
    woodLight: '#a06828', woodMid:   '#6b4818', woodDark:  '#4a3210', woodDeep:  '#2a1a08',
    rod:       '#5a3818', rodTip:    '#a06828', line:      '#1a1410',
    bobberHi:  '#e8b04a', bobberLo:  '#b05a3a',
    cream:     '#f0e6d3',
    firefly:   '#ffe9a8', fireflyDim:'#a06828',
    night:     '#0a0a0b',
    catchZone: '#ffd86b', catchZoneStripe: '#7a4a18',
    fishSilhouette: '#1a2638',
    tensionLow: '#6b8a4a', tensionMid: '#c8943e', tensionHigh: '#b05a3a',
    progressFill: '#7fb0d4',
  };

  // ─── Geometry constants ─────────────────────────────────────────
  const SUN = { cx: 86, cy: HORIZON, r: 16 };
  const ROD_BASE = { x: 244, y: 134 };
  const ROD_TIP_REST = { x: 156, y: 90 };          // idle pose (no cast)
  const BOBBER_WAIT_X = 156;                        // x while waiting for strike
  const BANNER_POS_Y = 14;
  const CAST_NEAR_X = 220;                          // bobber lands here on charge=0
  const CAST_FAR_X = 32;                            // bobber lands here on charge=1
  const WATER_SURFACE_Y = HORIZON + 16;             // y where bobber sits during wait

  // ─── Off-screen background (built once) ─────────────────────────
  const bg = document.createElement('canvas');
  bg.width = W; bg.height = H;
  const bctx = bg.getContext('2d');
  bctx.imageSmoothingEnabled = false;

  // ─── Banner (built once) ────────────────────────────────────────
  const banner = document.createElement('canvas');
  const btx = banner.getContext('2d');
  btx.imageSmoothingEnabled = false;

  // ─── Pixel helpers ──────────────────────────────────────────────
  function px(c, x, y, color) { c.fillStyle = color; c.fillRect(x | 0, y | 0, 1, 1); }
  function rect(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(x | 0, y | 0, w, h); }
  function bayer2(x, y) { return [[0, 2], [3, 1]][y & 1][x & 1] / 4; }
  function ditherY(c, x, y, w, h, top, bot) {
    for (let yy = 0; yy < h; yy++) {
      const t = yy / Math.max(1, h - 1);
      for (let xx = 0; xx < w; xx++) {
        c.fillStyle = bayer2(xx, yy) < t ? bot : top;
        c.fillRect(x + xx, y + yy, 1, 1);
      }
    }
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ─── Mulberry32 seeded RNG ──────────────────────────────────────
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function todayInt() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function todayString() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dd}`;
  }

  // ─── Persistent state ───────────────────────────────────────────
  const STORAGE_KEY = 'fishing-state';
  const G = {
    cash: 0,
    upgrades: { rod: 1, lure: 1, line: 1 },
    bestiary: [],   // array of fish IDs (Set serializes poorly)
    settings: {
      dailySeedOn: true,
      strikeWindowMs: 800,    // ADR easy = 1500
      reducedMotionUI: false, // user toggle (in addition to OS preference)
      colorblind: false,      // turns on diagonal stripe always (it's on by default already; this also boosts contrast)
      audioMaster: 0.7,
      audioSfx: 0.85,
    },
    lifetime: {
      casts: 0,
      catches: 0,
      snapped: 0,
      coachShown: { cast: false, strike: false, reel: false },
      bestRarity: 0,
      consecutiveFails: 0,
    },
    konamiUnlocked: false,

    // Today's session (not persisted)
    todayCatches: [],
    daySeed: todayInt(),
    castCount: 0,

    // Live runtime
    state: 'title',
    overlay: null, // null | 'paused' | 'shop' | 'help' | 'settings'
    helpStep: 0,

    shake: 0,
    shakeUntil: 0,
    dim: 0,
    dimTarget: 0,
    flash: 0,

    charge: 0,
    charging: false,
    bobberX: BOBBER_WAIT_X,
    bobberY: WATER_SURFACE_Y,

    // Cast in flight
    castFromX: 0, castFromY: 0,
    castToX: 0, castToY: 0,
    castStart: 0, castDur: 0,
    castDepth: 1,

    // Wait
    waitStart: 0,
    strikeAt: 0,

    // Strike
    strikeStart: 0,
    strikeReacted: false,
    bobberJerk: 0,

    // Reel
    fish: null,
    fishX: 0, fishVel: 0,
    fishDartUntil: 0,
    fishPausedUntil: 0,
    catchPos: 0.5, catchVel: 0,
    catchHalfWidth: 0,
    tension: 0,
    progress: 0,
    reelTickAcc: 0,
    reelStartedAt: 0,
    reelLostFish: null,

    // Catch reveal
    caughtFish: null,
    caughtLength: 0,
    caughtCash: 0,

    // Attract
    attractTimer: 0,
    attractActive: false,
    attractPhase: 0,

    // Miss state (after missed strike)
    missUntil: 0,

    // Time
    now: 0,
    worldTime: 0,
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.cash != null) G.cash = data.cash;
      if (data.upgrades) Object.assign(G.upgrades, data.upgrades);
      if (Array.isArray(data.bestiary)) G.bestiary = data.bestiary.slice();
      if (data.settings) Object.assign(G.settings, data.settings);
      if (data.lifetime) {
        Object.assign(G.lifetime, data.lifetime);
        if (data.lifetime.coachShown) Object.assign(G.lifetime.coachShown, data.lifetime.coachShown);
      }
      if (typeof data.konamiUnlocked === 'boolean') G.konamiUnlocked = data.konamiUnlocked;
    } catch (_) {}
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        cash: G.cash,
        upgrades: G.upgrades,
        bestiary: G.bestiary,
        settings: G.settings,
        lifetime: G.lifetime,
        konamiUnlocked: G.konamiUnlocked,
      }));
    } catch (_) {}
  }

  // ─── HUD wiring ─────────────────────────────────────────────────
  const hudCash = document.getElementById('hud-cash');
  const hudBest = document.getElementById('hud-best');
  const hudSeed = document.getElementById('hud-seed');
  function refreshHUD() {
    if (hudCash) hudCash.textContent = String(G.cash);
    if (hudBest) hudBest.textContent = G.lifetime.bestRarity ? '★'.repeat(G.lifetime.bestRarity) : '—';
    if (hudSeed) {
      hudSeed.textContent = G.settings.dailySeedOn ? todayString() : 'random';
      hudSeed.classList.toggle('muted', !G.settings.dailySeedOn);
    }
  }

  // ─── Static background painters ────────────────────────────────
  function paintSky() {
    rect(bctx, 0, 0, W, 8, C.skyTop);
    ditherY(bctx, 0, 8, W, 14, C.skyTop, C.terracotta);
    rect(bctx, 0, 22, W, 12, C.terracotta);
    ditherY(bctx, 0, 34, W, 14, C.terracotta, C.sunCore);
    rect(bctx, 0, 48, W, 18, C.sunCore);
    ditherY(bctx, 0, 66, W, 10, C.sunCore, C.sunGlow);
    rect(bctx, 0, 76, W, 4, C.sunGlow);
  }
  function paintSun() {
    const { cx, cy, r } = SUN;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        const x = cx + dx, y = cy + dy;
        if (y >= HORIZON) continue;
        if (d > r) continue;
        let color;
        if (d < r - 5) color = C.sunGlow;
        else if (d < r - 2) color = C.sunCore;
        else color = bayer2(x, y) < 0.5 ? C.sunCore : C.sunDeep;
        px(bctx, x, y, color);
      }
    }
    rect(bctx, cx - 3, cy - 8, 6, 2, '#ffe6a0');
    rect(bctx, cx - 5, cy - 6, 10, 2, C.sunGlow);
  }
  function paintSunReflection() {
    const { cx } = SUN;
    const yStart = HORIZON, yEnd = 130;
    for (let y = yStart; y < yEnd; y++) {
      const t = (y - yStart) / (yEnd - yStart);
      const halfW = Math.max(1, Math.round(8 * (1 - t * 0.7)));
      for (let dx = -halfW; dx <= halfW; dx++) {
        const x = cx + dx;
        const b = bayer2(x, y);
        if (t < 0.15) px(bctx, x, y, b < 0.7 ? C.sunGlow : C.sunCore);
        else if (t < 0.4 && b < 0.5 + (t - 0.15) * 1.2) px(bctx, x, y, C.sunCore);
        else if (t < 0.7 && b < 0.4) px(bctx, x, y, C.sunDeep);
        else if (b < 0.25) px(bctx, x, y, C.sunDeep);
      }
    }
  }
  function silhouette(seed, baselineY, amp, period) {
    const pts = [];
    for (let x = -2; x < W + 4; x++) {
      const a = Math.sin(x / period + seed) * 0.6;
      const b = Math.sin(x / (period * 0.43) + seed * 1.7) * 0.3;
      const j = Math.sin(x * 1.9 + seed * 4.1) * 0.1;
      const h = Math.round(amp * (a + b + j + 1) * 0.5);
      pts.push({ x, y: baselineY - h });
    }
    return pts;
  }
  function paintHills() {
    const farPts = silhouette(11.3, HORIZON - 1, 9, 38);
    bctx.fillStyle = C.hillsBack;
    for (const p of farPts) bctx.fillRect(p.x, p.y, 1, HORIZON - p.y);
    const midPts = silhouette(7.7, HORIZON - 0, 6, 24);
    for (const p of midPts) {
      bctx.fillStyle = C.hillsMid;  bctx.fillRect(p.x, p.y, 1, 2);
      bctx.fillStyle = C.hillsFront; bctx.fillRect(p.x, p.y + 2, 1, HORIZON - p.y - 2);
    }
  }
  function paintWater() {
    rect(bctx, 0, HORIZON, W, 14, C.nearshore);
    ditherY(bctx, 0, HORIZON + 14, W, 8, C.nearshore, C.midwater);
    rect(bctx, 0, HORIZON + 22, W, 26, C.midwater);
    ditherY(bctx, 0, HORIZON + 48, W, 8, C.midwater, C.deepwater);
    rect(bctx, 0, HORIZON + 56, W, H - (HORIZON + 56), C.deepwater);
    for (let x = 0; x < W; x++) {
      px(bctx, x, HORIZON, bayer2(x, HORIZON) < 0.55 ? C.sunGlow : C.sunCore);
    }
  }
  function paintDock() {
    const dx = 200, dy = 130, dEnd = W;
    rect(bctx, dx, dy - 1, dEnd - dx, 1, C.woodMid);
    rect(bctx, dx, dy, dEnd - dx, 4, C.woodLight);
    rect(bctx, dx, dy + 4, dEnd - dx, 1, C.woodMid);
    rect(bctx, dx, dy + 5, dEnd - dx, 3, C.woodLight);
    rect(bctx, dx, dy + 8, dEnd - dx, 1, C.woodMid);
    rect(bctx, dx, dy + 9, dEnd - dx, 5, C.woodMid);
    ditherY(bctx, dx, dy + 14, dEnd - dx, 6, C.woodMid, C.woodDark);
    rect(bctx, dx, dy + 20, dEnd - dx, 12, C.woodDark);
    for (let x = dx + 14; x < dEnd; x += 28) rect(bctx, x, dy, 1, 9, C.woodMid);
    for (const sx of [dx + 6, dx + 38, dx + 70]) {
      rect(bctx, sx, dy + 8, 3, H - (dy + 8), C.woodDark);
      rect(bctx, sx, dy + 8, 1, H - (dy + 8), C.woodDeep);
    }
    for (const sx of [dx + 7, dx + 39, dx + 71]) {
      for (let yy = 0; yy < 18; yy++) {
        if (bayer2(sx, HORIZON + yy) < 0.5 - yy * 0.02) px(bctx, sx, HORIZON + yy, C.woodDark);
      }
    }
    for (let i = 0; i < 14; i++) {
      const gx = dx + 4 + i * 8 + ((i * 13) & 7);
      const gy = dy + ((i * 5) & 7);
      if (gy < dy + 9 && gx < dEnd - 1) px(bctx, gx, gy, C.woodDeep);
    }
    rect(bctx, dx + 24, dy + 1, 2, 2, C.woodDeep);
    px(bctx, dx + 24, dy + 1, C.woodMid);
  }

  // ─── Banner ─────────────────────────────────────────────────────
  const F5x7 = {
    F: ['11111','10000','10000','11110','10000','10000','10000'],
    I: ['11111','00100','00100','00100','00100','00100','11111'],
    S: ['01111','10000','10000','01110','00001','00001','11110'],
    H: ['10001','10001','10001','11111','10001','10001','10001'],
    N: ['10001','11001','10101','10011','10011','10001','10001'],
    G: ['01110','10001','10000','10111','10001','10001','01110'],
  };
  function buildBanner() {
    const word = 'FISHING', lw = 5, lh = 7, gap = 1, scale = 2;
    const innerW = word.length * (lw + gap) - gap;
    banner.width = innerW * scale + 4;
    banner.height = lh * scale + 4;
    btx.imageSmoothingEnabled = false;
    function stamp(ox, oy, color) {
      btx.fillStyle = color;
      let cur = ox;
      for (const ch of word) {
        const g = F5x7[ch];
        for (let yy = 0; yy < lh; yy++)
          for (let xx = 0; xx < lw; xx++)
            if (g[yy][xx] === '1') btx.fillRect(cur + xx * scale, oy + yy * scale, scale, scale);
        cur += (lw + gap) * scale;
      }
    }
    for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2], [1, 0], [0, 1], [2, 1], [1, 2]])
      stamp(dx, dy, C.woodDeep);
    stamp(2, 3, C.woodDark);
    stamp(1, 1, C.sunCore);
    btx.fillStyle = C.sunGlow;
    let cur = 1;
    for (const ch of word) {
      const g = F5x7[ch];
      for (let xx = 0; xx < 5; xx++) if (g[0][xx] === '1') btx.fillRect(cur + xx * 2, 1, 2, 2);
      cur += 12;
    }
  }

  function buildBg() { paintSky(); paintHills(); paintSun(); paintWater(); paintSunReflection(); paintDock(); }

  // ─── Animated ambient layers ────────────────────────────────────
  const SHIMMER_POSITIONS = [
    [[ 18, 92], [ 42, 96], [ 70, 90], [ 96, 94], [124, 91], [148, 95], [172, 92], [188, 100], [ 28,108], [ 60,112], [ 88,116], [114,108], [138,114], [168,110], [192,118]],
    [[ 22, 93], [ 50, 97], [ 76, 91], [102, 95], [128, 92], [156, 96], [180, 93], [196,101], [ 36,109], [ 68,113], [ 96,117], [120,109], [144,115], [176,111], [196,119]],
    [[ 26, 92], [ 56, 96], [ 82, 90], [108, 94], [134, 91], [160, 95], [184, 92], [194,100], [ 42,108], [ 74,112], [102,116], [126,108], [150,114], [180,110], [192,118]],
    [[ 30, 93], [ 60, 97], [ 88, 91], [112, 95], [140, 92], [164, 96], [180, 93], [192,101], [ 50,109], [ 80,113], [108,117], [132,109], [156,115], [184,111], [194,119]],
  ];
  function drawShimmer(now) {
    const f = Math.floor(now / 220) & 3;
    ctx.fillStyle = C.shimmer;
    for (const [x, y] of SHIMMER_POSITIONS[f]) ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = C.nearshore;
    const opp = SHIMMER_POSITIONS[(f + 2) & 3];
    for (let i = 0; i < 4; i++) { const [x, y] = opp[i * 3]; ctx.fillRect(x, y, 1, 1); }
  }
  function drawSunHighlightDrift(now) {
    const period = 90 * 1000;
    const phase = (now % period) / period;
    const arc = phase * Math.PI;
    const x = Math.round(SUN.cx + Math.cos(arc) * 9);
    const y = Math.round(SUN.cy - 4 + Math.sin(arc) * -3);
    if (y < HORIZON) px(ctx, x, y, '#ffffff');
  }
  function drawFireflies(now, reduced) {
    if (reduced) return;
    const pos = [
      { ox: 110, oy: 152, ax: 14, ay: -32, period: 6800, off: 0 },
      { ox:  72, oy: 158, ax: 10, ay: -42, period: 8200, off: 1800 },
      { ox: 184, oy: 150, ax: 18, ay: -38, period: 7400, off: 3200 },
      { ox: 138, oy: 160, ax: 12, ay: -50, period: 9100, off:  900 },
    ];
    for (const p of pos) {
      const phase = ((now + p.off) % p.period) / p.period;
      const x = Math.round(p.ox + Math.sin(phase * Math.PI * 2) * p.ax);
      const y = Math.round(p.oy + phase * p.ay);
      if (x > 198 && y < 134) continue;
      const flicker = Math.sin(now / 90 + p.off);
      const color = flicker > 0.0 ? C.firefly : C.fireflyDim;
      px(ctx, x, y, color);
      if (flicker > 0.4) {
        const glow = '#5a4818';
        if (bayer2(x - 1, y) < 0.5) px(ctx, x - 1, y, glow);
        if (bayer2(x + 1, y) < 0.5) px(ctx, x + 1, y, glow);
      }
    }
  }
  function drawTitleBanner(now, reduced) {
    const dy = reduced ? 0 : Math.round(Math.sin(now / 1800) * 0.6);
    const bx = Math.round((W - banner.width) / 2);
    const by = BANNER_POS_Y + dy;
    ctx.drawImage(banner, bx, by);
    // Subtitle: bumped to 8px with a chunky drop-shadow stamp so it reads against the orange dither
    ctx.font = '8px "Pixelify Sans", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const subY = by + banner.height + 2;
    const subText = '~ dusk on the dock ~';
    // Outline stamp (8 directions) for readability over busy dithered sky
    ctx.fillStyle = C.woodDeep;
    for (const [ox, oy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]) {
      ctx.fillText(subText, W / 2 + ox, subY + oy);
    }
    ctx.fillStyle = C.cream;
    ctx.fillText(subText, W / 2, subY);
  }

  // ─── Bresenham line ─────────────────────────────────────────────
  function drawLine(x0, y0, x1, y1, color) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    ctx.fillStyle = color;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0, s = 1000;
    while (s-- > 0) {
      ctx.fillRect(x, y, 1, 1);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 <  dx) { err += dx; y += sy; }
    }
  }

  // ─── Rod, bobber, ripples (state-aware) ─────────────────────────
  function drawRod(now, tipX, tipY) {
    drawLine(ROD_BASE.x, ROD_BASE.y, tipX, tipY, C.rod);
    drawLine(ROD_BASE.x, ROD_BASE.y - 1, tipX, tipY - 1, C.rod);
    drawLine(ROD_BASE.x - 2, ROD_BASE.y, tipX - 1, tipY, C.rodTip);
    rect(ctx, tipX - 1, tipY - 1, 2, 2, C.rodTip);
    rect(ctx, ROD_BASE.x - 4, ROD_BASE.y - 3, 4, 4, C.woodMid);
    rect(ctx, ROD_BASE.x - 3, ROD_BASE.y - 2, 2, 2, C.woodLight);
  }
  function drawLineToBobber(tipX, tipY, bx, by) {
    drawLine(tipX, tipY, bx + 1, by, C.line);
  }
  function drawBobber(bx, by, jerk) {
    rect(ctx, bx + 1, by - 2, 1, 2, C.woodDark);
    rect(ctx, bx, by, 4, 2, C.bobberHi);
    px(ctx, bx, by, C.cream);
    rect(ctx, bx, by + 2, 4, 1, C.woodDeep);
    rect(ctx, bx, by + 3, 4, 2, C.bobberLo);
    rect(ctx, bx, by + 5, 4, 1, C.deepwater);
    if (jerk) {
      // sideways tilt: shift top half ±1
      ctx.fillStyle = C.bobberHi;
      ctx.fillRect(bx + jerk, by - 1, 4, 1);
    }
  }
  function drawRipplesAt(now, cx, cy, period, baseRadius) {
    const pd = period || 4500;
    for (let i = 0; i < 3; i++) {
      const phase = ((now + i * (pd / 3)) % pd) / pd;
      const r = (baseRadius || 3) + phase * 22;
      const alpha = 1 - phase;
      if (alpha < 0.15) continue;
      const ry = Math.max(1, r * 0.34);
      ctx.fillStyle = phase < 0.4 ? C.shimmer : phase < 0.75 ? C.nearshore : C.midwater;
      const samples = Math.max(8, Math.floor(r * 1.2));
      for (let s = 0; s < samples; s++) {
        const a = (s / samples) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(a) * r);
        const y = Math.round(cy + Math.sin(a) * ry);
        if (y >= HORIZON && y < H && x >= 0 && x < W) ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // ─── Charge meter (during cast charge) ──────────────────────────
  function drawChargeMeter(charge) {
    // Below the dock area, top-right-ish, small wood-frame meter
    const mx = 220, my = 122, mw = 90, mh = 5;
    rect(ctx, mx - 1, my - 1, mw + 2, mh + 2, C.woodDeep);
    rect(ctx, mx, my, mw, mh, C.woodMid);
    const fill = Math.round(mw * charge);
    rect(ctx, mx, my, fill, mh, C.sunGlow);
    // Tick marks at quartiles (depth tier boundaries)
    for (let q = 1; q < 4; q++) {
      const tx = mx + Math.round((mw * q) / 4);
      px(ctx, tx, my - 1, C.cream);
      px(ctx, tx, my + mh, C.cream);
    }
    // Label
    ctx.font = '5px "Pixelify Sans", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = C.cream;
    ctx.fillText('CHARGE', mx, my - 8);
  }

  // ─── Cast trajectory (during cast in flight) ────────────────────
  function castPos(t01) {
    // Parabolic arc from castFrom → castTo with apex above
    const x = lerp(G.castFromX, G.castToX, t01);
    const y0 = lerp(G.castFromY, G.castToY, t01);
    const apex = -28 * Math.sin(t01 * Math.PI);
    return { x, y: y0 + apex };
  }

  // ─── Reel-bar UI ────────────────────────────────────────────────
  // Layout (virtual coords):
  //   panel: x=20..300, y=58..122 (centered)
  //   tension: y=64..70 (horizontal, full panel width)
  //   reel-bar: x=24..296, y=80..98 (interaction zone)
  //   progress: y=104..110
  const REEL = {
    panelX: 20, panelY: 58, panelW: 280, panelH: 64,
    tensionY: 64, tensionH: 6,
    barX: 28, barY: 80, barW: 264, barH: 18,
    progressY: 104, progressH: 6,
  };
  function drawReelPanel(now) {
    // Panel frame (wood)
    rect(ctx, REEL.panelX - 1, REEL.panelY - 1, REEL.panelW + 2, REEL.panelH + 2, C.woodDeep);
    rect(ctx, REEL.panelX, REEL.panelY, REEL.panelW, REEL.panelH, '#241a0e');
    // Inner frame line
    for (let x = REEL.panelX; x < REEL.panelX + REEL.panelW; x++) {
      px(ctx, x, REEL.panelY, C.woodMid);
      px(ctx, x, REEL.panelY + REEL.panelH - 1, C.woodMid);
    }
    for (let y = REEL.panelY; y < REEL.panelY + REEL.panelH; y++) {
      px(ctx, REEL.panelX, y, C.woodMid);
      px(ctx, REEL.panelX + REEL.panelW - 1, y, C.woodMid);
    }
    // Tension label
    ctx.font = '6px "Pixelify Sans", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = C.cream;
    ctx.fillText('LINE', REEL.panelX + 4, REEL.tensionY);
    // Tension bar
    const tx = REEL.panelX + 30, tw = REEL.panelW - 36;
    rect(ctx, tx, REEL.tensionY, tw, REEL.tensionH, C.woodDark);
    const fillW = Math.round(tw * G.tension);
    let tcolor = G.tension < 0.5 ? C.tensionLow : G.tension < 0.8 ? C.tensionMid : C.tensionHigh;
    rect(ctx, tx, REEL.tensionY, fillW, REEL.tensionH, tcolor);
    // Tension warning flash
    if (G.tension > 0.85 && (Math.floor(now / 100) & 1)) {
      rect(ctx, tx, REEL.tensionY, tw, REEL.tensionH, C.tensionHigh);
    }

    // Reel-bar background
    rect(ctx, REEL.barX, REEL.barY, REEL.barW, REEL.barH, '#0e1828');
    // Reel-bar border
    for (let x = REEL.barX; x < REEL.barX + REEL.barW; x++) {
      px(ctx, x, REEL.barY, C.woodMid);
      px(ctx, x, REEL.barY + REEL.barH - 1, C.woodMid);
    }
    for (let y = REEL.barY; y < REEL.barY + REEL.barH; y++) {
      px(ctx, REEL.barX, y, C.woodMid);
      px(ctx, REEL.barX + REEL.barW - 1, y, C.woodMid);
    }

    // Catch-zone (vertical band) — colorblind-safe diagonal stripe pattern
    const czWidthPx = Math.round(G.catchHalfWidth * 2 * REEL.barW);
    const czCenterX = REEL.barX + Math.round(G.catchPos * REEL.barW);
    const czLeft = clamp(czCenterX - czWidthPx / 2, REEL.barX + 1, REEL.barX + REEL.barW - czWidthPx - 1);
    // Outline
    rect(ctx, czLeft - 1, REEL.barY + 1, czWidthPx + 2, REEL.barH - 2, C.catchZoneStripe);
    // Diagonal stripe fill: pattern based on (x + y) % 4
    for (let yy = REEL.barY + 1; yy < REEL.barY + REEL.barH - 1; yy++) {
      for (let xx = czLeft; xx < czLeft + czWidthPx; xx++) {
        const stripe = (xx + yy) & 3;
        ctx.fillStyle = stripe < 2 ? C.catchZone : C.catchZoneStripe;
        ctx.fillRect(xx, yy, 1, 1);
      }
    }

    // Fish silhouette
    if (G.fish && G.fish.sprite) {
      const fishX = REEL.barX + Math.round(G.fishX * REEL.barW);
      const sw = G.fish.sprite[0].length, sh = G.fish.sprite.length;
      const fx = Math.round(fishX - sw / 2);
      const fy = Math.round(REEL.barY + REEL.barH / 2 - sh / 2);
      ctx.fillStyle = C.fishSilhouette;
      for (let yy = 0; yy < sh; yy++) {
        const row = G.fish.sprite[yy];
        for (let xx = 0; xx < sw; xx++) {
          if (row[xx] !== '.') ctx.fillRect(fx + xx, fy + yy, 1, 1);
        }
      }
    }

    // Progress label + bar
    ctx.fillStyle = C.cream;
    ctx.fillText('CATCH', REEL.panelX + 4, REEL.progressY);
    const px2 = REEL.panelX + 30, pw = REEL.panelW - 36;
    rect(ctx, px2, REEL.progressY, pw, REEL.progressH, C.woodDark);
    const pfill = Math.round(pw * G.progress);
    rect(ctx, px2, REEL.progressY, pfill, REEL.progressH, C.progressFill);
  }

  // ─── Coach mark renderer ────────────────────────────────────────
  function drawCoach(text, x, y) {
    ctx.font = '7px "Pixelify Sans", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const w = ctx.measureText(text).width;
    rect(ctx, x - w / 2 - 3, y - 2, w + 6, 12, C.woodDeep);
    rect(ctx, x - w / 2 - 2, y - 1, w + 4, 10, C.woodMid);
    ctx.fillStyle = C.cream;
    ctx.fillText(text, x, y);
  }

  // ─── Catch portrait (paints the modal canvas) ───────────────────
  function paintCatchPortrait(fish) {
    const pc = document.getElementById('catch-portrait-canvas');
    if (!pc || !fish) return;
    const c = pc.getContext('2d');
    c.imageSmoothingEnabled = false;

    // Painted backdrop: vertical dusk-water gradient via dither (matches game palette)
    for (let y = 0; y < pc.height; y++) {
      const t = y / pc.height;
      for (let x = 0; x < pc.width; x++) {
        const b = ((x + y) & 1) * 0.5;
        let color;
        if (b + t < 0.35) color = C.nearshore;
        else if (b + t < 0.75) color = C.midwater;
        else color = C.deepwater;
        c.fillStyle = color;
        c.fillRect(x, y, 1, 1);
      }
    }
    // A few shimmer dots scattered in the backdrop
    c.fillStyle = C.shimmer;
    for (const [sx, sy] of [[6, 8], [42, 14], [56, 30], [14, 36], [50, 6]]) {
      if (sx < pc.width && sy < pc.height) c.fillRect(sx, sy, 1, 1);
    }

    const sprite = fish.sprite, sw = sprite[0].length, sh = sprite.length;
    // Scale up to fill ~85% of the portrait so the fish reads as the subject (was 8px padding)
    const scale = Math.max(1, Math.floor(Math.min((pc.width * 0.92) / sw, (pc.height * 0.78) / sh)));
    const ox = Math.floor((pc.width - sw * scale) / 2);
    const oy = Math.floor((pc.height - sh * scale) / 2);

    // Drop shadow under the fish (chunky, two-pixel offset)
    c.fillStyle = 'rgba(10, 10, 11, 0.45)';
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++)
        if (sprite[y][x] !== '.')
          c.fillRect(ox + x * scale + 2, oy + y * scale + 2, scale, scale);

    // Body fill (rarity-tinted)
    const bodyColor = fish.rarity >= 5 ? '#e8b04a' : fish.rarity >= 4 ? '#b05a3a' : fish.rarity >= 3 ? '#7fb0d4' : '#3e6a8f';
    const highlightColor = fish.rarity >= 5 ? '#fff8e8' : fish.rarity >= 4 ? '#e8b04a' : fish.rarity >= 3 ? '#b3d4eb' : '#7fb0d4';
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const ch = sprite[y][x];
        if (ch === '.') continue;
        c.fillStyle = ch === '#' ? bodyColor : highlightColor;
        c.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    }
    // Eye
    if (fish.eye) {
      c.fillStyle = C.woodDeep;
      c.fillRect(ox + fish.eye[0] * scale, oy + fish.eye[1] * scale, Math.max(1, scale - 1), Math.max(1, scale - 1));
    }
    // Bubbles drifting up from the fish (scaled with sprite)
    c.fillStyle = C.shimmer;
    const bubX = ox + sw * scale;
    c.fillRect(bubX - 2, oy - 4, 1, 1);
    c.fillRect(bubX - 6, oy - 8, 1, 1);
    c.fillRect(bubX, oy - 12, 1, 1);
  }

  // ─── Input ──────────────────────────────────────────────────────
  const input = {
    pressed: {},      // Set of keys currently held
    primaryDown: false,
    leftDown: false,
    rightDown: false,
    primaryEdge: false,    // rising edge this tick
    primaryReleaseEdge: false,
    pauseEdge: false,
    shopEdge: false,
    konami: [],            // last 10 keys for Konami code
  };
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

  function isFormInput(t) { return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'); }

  function onKeyDown(e) {
    if (isFormInput(e.target)) return;
    // Konami detector
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    input.konami.push(k);
    if (input.konami.length > 10) input.konami.shift();
    if (input.konami.length === 10 && input.konami.every((v, i) => v === KONAMI[i])) {
      G.konamiUnlocked = true;
      saveState();
      input.konami = [];
    }
    if (e.repeat) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (!input.primaryDown) input.primaryEdge = true;
      input.primaryDown = true;
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      input.leftDown = true;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      input.rightDown = true;
    } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      input.pauseEdge = true;
      e.preventDefault();
    } else if (e.key === 'Tab') {
      input.shopEdge = true;
      e.preventDefault();
    }
    // Audio unlock on first interaction
    if (window.FishingAudio && !window.FishingAudio.isUnlocked()) window.FishingAudio.resume();
  }
  function onKeyUp(e) {
    if (isFormInput(e.target)) return;
    if (e.key === ' ') {
      if (input.primaryDown) input.primaryReleaseEdge = true;
      input.primaryDown = false;
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      input.leftDown = false;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      input.rightDown = false;
    }
  }

  // Mouse input
  let mouseDown = false;
  let mouseVX = 0; // mouse virtual-X for catchPos override during reel
  function onMouseDown(e) {
    if (e.button !== 0) return;
    if (!input.primaryDown) input.primaryEdge = true;
    input.primaryDown = true;
    mouseDown = true;
    if (window.FishingAudio && !window.FishingAudio.isUnlocked()) window.FishingAudio.resume();
  }
  function onMouseUp(e) {
    if (e.button !== 0) return;
    if (mouseDown) input.primaryReleaseEdge = true;
    input.primaryDown = false;
    mouseDown = false;
  }
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const fracX = (e.clientX - rect.left) / rect.width;
    mouseVX = clamp(fracX, 0, 1);
  }

  // Touch input
  let touchActive = false;
  function onTouchStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t) return;
    if (!input.primaryDown) input.primaryEdge = true;
    input.primaryDown = true;
    touchActive = true;
    const rect = canvas.getBoundingClientRect();
    mouseVX = clamp((t.clientX - rect.left) / rect.width, 0, 1);
    if (window.FishingAudio && !window.FishingAudio.isUnlocked()) window.FishingAudio.resume();
  }
  function onTouchMove(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t) return;
    const rect = canvas.getBoundingClientRect();
    mouseVX = clamp((t.clientX - rect.left) / rect.width, 0, 1);
  }
  function onTouchEnd(e) {
    e.preventDefault();
    if (touchActive) input.primaryReleaseEdge = true;
    input.primaryDown = false;
    touchActive = false;
  }

  // Gamepad polling (per tick)
  let gamepadConnected = -1;
  function pollGamepad() {
    if (!window.SharedGamepad) return;
    const pads = window.SharedGamepad.listGamepads();
    if (pads.length === 0) { gamepadConnected = -1; return; }
    const idx = pads[0].index;
    gamepadConnected = idx;
    const SG = window.SharedGamepad;
    if (SG.consumeButtonPress(idx, SG.BUTTONS.A)) {
      input.primaryEdge = true;
      input.primaryDown = true;
    } else {
      // poll held state via raw API
      const list = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = list[idx];
      if (pad && pad.buttons[SG.BUTTONS.A]) {
        const wasDown = input.primaryDown;
        const isDown = pad.buttons[SG.BUTTONS.A].pressed;
        if (wasDown && !isDown) input.primaryReleaseEdge = true;
        input.primaryDown = isDown;
      }
    }
    if (SG.consumeButtonPress(idx, SG.BUTTONS.B)) input.shopEdge = true;
    if (SG.consumeButtonPress(idx, SG.BUTTONS.START)) input.pauseEdge = true;
    // Direction (used for catchPos in reel state)
    const dir = SG.getDirection(idx);
    input.leftDown = (dir === 'left') || input.leftDown;
    input.rightDown = (dir === 'right') || input.rightDown;
    // Konami: B+A press records 'b' / 'a' too (so controller-only easter egg works after d-pad sequence on keyboard)
  }

  function clearEdges() {
    input.primaryEdge = false;
    input.primaryReleaseEdge = false;
    input.pauseEdge = false;
    input.shopEdge = false;
  }

  // ─── Overlay management (DOM) ───────────────────────────────────
  const overlayElems = {
    title:  document.getElementById('title-overlay'),
    paused: document.getElementById('pause-overlay'),
    catch:  document.getElementById('catch-overlay'),
    shop:   document.getElementById('shop-overlay'),
    help:   document.getElementById('help-overlay'),
  };
  function showOverlay(name) {
    for (const k of Object.keys(overlayElems)) {
      const el = overlayElems[k];
      if (!el) continue;
      el.hidden = (k !== name);
    }
  }
  function hideAllOverlays() {
    for (const k of Object.keys(overlayElems)) {
      if (overlayElems[k]) overlayElems[k].hidden = true;
    }
  }
  function showSettingsPanel() {
    // Convert pause overlay into a settings layout (toggles + sliders)
    const ov = overlayElems.paused;
    if (!ov) return;
    ov.hidden = false;
    const panel = ov.querySelector('.panel');
    if (!panel) return;
    panel.innerHTML = `
      <h2 class="panel-title">Settings</h2>
      <div class="panel-row" style="gap: 0;">
        <label class="settings-row">
          <span class="label-text">Daily seed</span>
          <input type="checkbox" class="pixel-check" id="set-daily" ${G.settings.dailySeedOn ? 'checked' : ''}>
        </label>
        <label class="settings-row">
          <span class="label-text">Strike window</span>
          <select class="pixel-select" id="set-strike">
            <option value="800" ${G.settings.strikeWindowMs===800?'selected':''}>800ms (default)</option>
            <option value="1500" ${G.settings.strikeWindowMs===1500?'selected':''}>1500ms (easy)</option>
          </select>
        </label>
        <label class="settings-row">
          <span class="label-text">Reduced motion</span>
          <input type="checkbox" class="pixel-check" id="set-reduced" ${G.settings.reducedMotionUI ? 'checked' : ''}>
        </label>
        <label class="settings-row">
          <span class="label-text">High-contrast catch zone</span>
          <input type="checkbox" class="pixel-check" id="set-cb" ${G.settings.colorblind ? 'checked' : ''}>
        </label>
        <label class="settings-row">
          <span class="label-text">Master volume</span>
          <input type="range" class="pixel-range" id="set-vol" min="0" max="100" value="${Math.round(G.settings.audioMaster*100)}">
        </label>
      </div>
      <div class="panel-row horizontal" style="margin-top: 0.9rem;">
        <button class="plank-btn primary" type="button" data-action="settings-back">Back</button>
      </div>`;
    panel.querySelector('#set-daily').addEventListener('change', (e) => {
      G.settings.dailySeedOn = e.target.checked;
      G.daySeed = G.settings.dailySeedOn ? todayInt() : (Date.now() & 0x7fffffff);
      saveState(); refreshHUD();
    });
    panel.querySelector('#set-strike').addEventListener('change', (e) => {
      G.settings.strikeWindowMs = parseInt(e.target.value, 10) || 800;
      saveState();
    });
    panel.querySelector('#set-reduced').addEventListener('change', (e) => {
      G.settings.reducedMotionUI = e.target.checked; saveState();
    });
    panel.querySelector('#set-cb').addEventListener('change', (e) => {
      G.settings.colorblind = e.target.checked; saveState();
    });
    panel.querySelector('#set-vol').addEventListener('input', (e) => {
      G.settings.audioMaster = (e.target.value | 0) / 100;
      if (window.FishingAudio) window.FishingAudio.setVolume('master', G.settings.audioMaster);
    });
    panel.querySelector('[data-action=settings-back]').addEventListener('click', () => {
      buildPausePanel(); // restore the standard pause buttons
      saveState();
    });
  }
  function buildPausePanel() {
    const ov = overlayElems.paused;
    if (!ov) return;
    const panel = ov.querySelector('.panel');
    if (!panel) return;
    panel.innerHTML = `
      <h2 class="panel-title">Paused</h2>
      <div class="panel-row">
        <button class="plank-btn primary" type="button" data-action="resume">Resume</button>
        <button class="plank-btn" type="button" data-action="settings">Settings</button>
        <button class="plank-btn" type="button" data-action="help">How to Play</button>
        <button class="plank-btn" type="button" data-action="quit">Quit to Title</button>
      </div>
      <p class="panel-hint">Esc · P · Start to resume</p>`;
    wireDataActions(panel);
  }
  function buildHelpPanel(step) {
    const ov = overlayElems.help;
    if (!ov) return;
    const panel = ov.querySelector('.panel');
    if (!panel) return;
    const STEPS = [
      { illust: 'HOLD · CHARGE · RELEASE', text: 'Hold Space, click, or tap to charge your cast. Let go to send the bobber out.' },
      { illust: 'WAIT · WATCH', text: 'When the bobber jerks, react fast. Press Space, click, or tap to set the hook.' },
      { illust: 'TRACK · DON\'T LET TENSION FILL', text: 'Use ← / → or A / D to keep the gold zone over the fish. Line snaps if tension fills.' },
    ];
    const s = STEPS[step] || STEPS[0];
    panel.innerHTML = `
      <p class="help-step">Step ${step + 1} of ${STEPS.length}</p>
      <div class="help-illust">[ ${s.illust} ]</div>
      <p class="help-text">${s.text}</p>
      <div class="panel-row horizontal" style="margin-top: 0.9rem;">
        <button class="plank-btn" type="button" data-action="help-skip">Skip</button>
        <button class="plank-btn primary" type="button" data-action="help-next">${step + 1 >= STEPS.length ? 'Done' : 'Next'}</button>
      </div>`;
    wireDataActions(panel);
  }
  function wireDataActions(root) {
    root.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleAction(btn.getAttribute('data-action'));
      });
    });
  }

  // ─── Action handler (modal buttons) ─────────────────────────────
  function handleAction(action) {
    if (window.FishingAudio) window.FishingAudio.play('menu_confirm');
    switch (action) {
      case 'resume':
        G.overlay = null; hideAllOverlays();
        if (G.state === 'title') showOverlay('title');
        break;
      case 'settings':
        G.overlay = 'settings'; showSettingsPanel();
        break;
      case 'help':
        G.overlay = 'help'; G.helpStep = 0; buildHelpPanel(0); showOverlay('help');
        break;
      case 'help-next':
        G.helpStep++;
        if (G.helpStep >= 3) {
          G.overlay = null; hideAllOverlays();
          if (G.state === 'title') showOverlay('title');
        } else {
          buildHelpPanel(G.helpStep);
        }
        break;
      case 'help-skip':
        G.overlay = null; hideAllOverlays();
        if (G.state === 'title') showOverlay('title');
        break;
      case 'quit':
        transition('title');
        G.overlay = null; buildPausePanel(); showOverlay('title');
        break;
      case 'continue':
        G.overlay = null; hideAllOverlays();
        transition('casting');
        break;
      case 'copy-result':
        copyResultCard();
        break;
      case 'buy-rod':   buyUpgrade('rod'); break;
      case 'buy-lure':  buyUpgrade('lure'); break;
      case 'buy-line':  buyUpgrade('line'); break;
      case 'close-shop':
        G.overlay = null; hideAllOverlays();
        break;
      case 'settings-back':
        buildPausePanel();
        break;
    }
  }

  // ─── Shop ───────────────────────────────────────────────────────
  // ADR: "12 buy-decisions over the lifetime of an account = the long-arc progression"
  // Tier 1 → 2 → 3 → 4 prices per track (trio totals 270/520/930 over the run)
  const TIER_PRICES = { rod:  [60, 180, 460], lure: [80, 220, 540], line: [50, 140, 380] };
  function priceFor(track) {
    const tier = G.upgrades[track] || 1;
    if (tier >= 4) return null;
    return TIER_PRICES[track][tier - 1];
  }
  function buyUpgrade(track) {
    const cost = priceFor(track);
    if (cost == null || G.cash < cost) {
      if (window.FishingAudio) window.FishingAudio.play('menu_back');
      return;
    }
    G.cash -= cost;
    G.upgrades[track] = (G.upgrades[track] || 1) + 1;
    if (window.FishingAudio) window.FishingAudio.play('coin');
    saveState(); refreshHUD(); refreshShop();
  }
  function refreshShop() {
    const cashEl = document.getElementById('shop-cash');
    if (cashEl) cashEl.textContent = String(G.cash);
    const cards = document.querySelectorAll('.shop-card');
    const tracks = ['rod', 'lure', 'line'];
    cards.forEach((card, i) => {
      const track = tracks[i];
      const tier = G.upgrades[track] || 1;
      const pips = card.querySelectorAll('.tier-pip');
      pips.forEach((p, idx) => {
        if (idx < tier) p.classList.add('filled');
        else p.classList.remove('filled');
      });
      const priceEl = card.querySelector('.shop-card-price');
      const buyBtn = card.querySelector('[data-action]');
      const cost = priceFor(track);
      if (cost == null) {
        if (priceEl) priceEl.textContent = 'MAX';
        if (buyBtn) { buyBtn.disabled = true; buyBtn.style.opacity = '0.5'; buyBtn.textContent = '—'; }
      } else {
        if (priceEl) priceEl.textContent = String(cost);
        if (buyBtn) {
          buyBtn.disabled = G.cash < cost;
          buyBtn.style.opacity = G.cash < cost ? '0.5' : '1';
          buyBtn.textContent = 'Buy';
        }
      }
    });
  }

  // ─── Catch reveal DOM population ────────────────────────────────
  function populateCatchReveal() {
    const f = G.caughtFish;
    if (!f) return;
    document.getElementById('catch-name').textContent = f.name;
    document.getElementById('catch-length').textContent = `${G.caughtLength.toFixed(1)}"`;
    document.getElementById('catch-depth').textContent = `tier ${f.tier}`;
    const stars = document.getElementById('catch-stars');
    // Render stars as spans so we can stagger-animate them per ADR §11 ("the surprise")
    stars.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.className = i < f.rarity ? 'star' : 'star empty';
      s.textContent = i < f.rarity ? '★' : '☆';
      stars.appendChild(s);
    }
    stars.setAttribute('aria-label', `Rarity ${f.rarity} of 5`);
    document.getElementById('catch-cash').textContent = `${G.caughtCash} coins`;
    // Mark portrait as rare (rarity ≥ 4) so the gold-shine sweep fires
    const portrait = document.querySelector('.catch-portrait');
    if (portrait) portrait.classList.toggle('is-rare', f.rarity >= 4);
    paintCatchPortrait(f);
  }
  function copyResultCard() {
    // Wordle-style emoji grid of today's catches
    const RARITY_TO_EMOJI = ['⬜','🟦','🟩','🟨','🟧','🟥']; // by rarity 0..5
    const lines = [
      `Fishing — ${todayString()}`,
      `${G.todayCatches.length} catch${G.todayCatches.length === 1 ? '' : 'es'}`,
      G.todayCatches.map(c => RARITY_TO_EMOJI[c.rarity] || '⬜').join(''),
      `${G.cash} coins`,
      'chases.house/games/fishing-game/',
    ];
    const text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        if (window.FishingAudio) window.FishingAudio.play('menu_confirm');
      });
    }
  }

  // ─── Strike timing & fish selection (seeded RNG) ────────────────
  function seededRng(castIndex) {
    return mulberry32((G.daySeed * 7919 + castIndex * 1217) >>> 0);
  }
  // Exponential-ish wait: mean = base + decay*castCount (longer waits later)
  function nextStrikeDelayMs(rng) {
    const base = 1.6;       // minimum
    const mean = 2.6 + Math.min(2.5, G.lifetime.catches * 0.2);
    const u = Math.max(0.05, rng());
    return Math.round((base + (-Math.log(u)) * mean) * 1000);
  }
  function rollFish(rng, depth) {
    const pool = window.FishingFish.poolForDepthTier(depth);
    if (pool.length === 0) return null;
    // Konami easter egg: 1-in-30 chance after unlock to spawn Loch Ness
    if (G.konamiUnlocked && rng() < 1/30) {
      const ln = window.FishingFish.getById('lochness');
      if (ln) return ln;
    }
    // Lure-tier weights: tier 1 favors rarity 1-2, tier 4 evens it out
    const lure = G.upgrades.lure || 1;
    const weights = pool.map(f => {
      // Base rarity weight: lower rarity = more common (1 → 1.0, 5 → 0.04)
      const baseR = Math.pow(0.45, f.rarity - 1);
      // Lure shifts toward higher rarity: tier 1 = baseR; tier 4 = boosted
      const lureBias = 1 + (lure - 1) * 0.7 * (f.rarity - 1);
      return Math.max(0.001, baseR * lureBias);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  // ─── State machine ──────────────────────────────────────────────
  let states; // forward-declared

  function transition(name) {
    if (states[G.state] && states[G.state].exit) states[G.state].exit();
    G.state = name;
    if (states[name] && states[name].enter) states[name].enter();
  }

  states = {
    title: {
      enter() {
        showOverlay('title');
        G.attractTimer = 0;
        G.attractActive = false;
      },
      exit() { hideAllOverlays(); },
      tick(dt) {
        G.attractTimer += dt;
        if (!G.attractActive && G.attractTimer > 6) {
          G.attractActive = true;
          G.attractPhase = 0;
        }
        if (G.attractActive) {
          G.attractPhase += dt;
          if (G.attractPhase > 2.4) {
            G.attractActive = false;
            G.attractTimer = 0;
          }
        }
        // Pressing primary on title → start a cast
        if (input.primaryEdge) {
          if (window.FishingAudio) window.FishingAudio.resume();
          transition('casting');
          // Begin charging immediately if still held
          if (input.primaryDown) {
            G.charging = true;
            G.charge = 0;
            if (window.FishingAudio) window.FishingAudio.startCharge();
          }
        }
        if (input.shopEdge) { G.overlay = 'shop'; refreshShop(); showOverlay('shop'); }
      },
      render(now) {
        const reduced = isReducedMotion();
        // Title attract (silhouette of a fish strike + bend)
        const tipX = ROD_TIP_REST.x;
        const baseDy = reduced ? 0 : Math.round(Math.sin(now / 700) * 0.8);
        let tipY = ROD_TIP_REST.y + baseDy;
        let bobberX = BOBBER_WAIT_X;
        let jerk = 0;
        if (G.attractActive) {
          // Phases: 0..0.5 jerk, 0.5..1.5 bend, 1.5..2.4 release
          if (G.attractPhase < 0.5) {
            jerk = Math.floor(G.attractPhase * 12) & 1 ? -1 : 1;
          } else if (G.attractPhase < 1.5) {
            tipY += Math.round(Math.sin((G.attractPhase - 0.5) * Math.PI) * 5);
            bobberX += Math.round(Math.sin((G.attractPhase - 0.5) * Math.PI) * 8);
            jerk = (Math.floor(G.attractPhase * 8) & 1) ? -1 : 1;
          }
        }
        drawRipplesAt(now, bobberX + 1, WATER_SURFACE_Y + 4, 4500, 3);
        drawRod(now, tipX, tipY);
        drawLineToBobber(tipX, tipY, bobberX, WATER_SURFACE_Y);
        drawBobber(bobberX, WATER_SURFACE_Y, jerk);
        drawFireflies(now, reduced);
        drawTitleBanner(now, reduced);
      },
    },

    casting: {
      enter() {
        showCoachMaybe('cast');
        if (input.primaryDown) {
          G.charging = true;
          G.charge = 0;
          if (window.FishingAudio) window.FishingAudio.startCharge();
        } else {
          G.charging = false;
          G.charge = 0;
        }
      },
      exit() {
        if (window.FishingAudio) window.FishingAudio.stopCharge();
      },
      tick(dt) {
        if (input.shopEdge) { G.overlay = 'shop'; refreshShop(); showOverlay('shop'); return; }
        if (input.pauseEdge) { G.overlay = 'paused'; showOverlay('paused'); return; }

        if (input.primaryEdge && !G.charging) {
          G.charging = true;
          G.charge = 0;
          if (window.FishingAudio) window.FishingAudio.startCharge();
        }
        if (G.charging) {
          G.charge = clamp(G.charge + dt / 1.0, 0, 1); // 1.0s to fully charge
          if (input.primaryReleaseEdge || !input.primaryDown) {
            // Release → cast
            const charge = G.charge;
            G.charging = false;
            if (window.FishingAudio) window.FishingAudio.stopCharge();
            if (window.FishingAudio) window.FishingAudio.play('cast_release');
            // Determine depth tier and cast distance
            const maxDepth = G.upgrades.rod;
            const depth = clamp(Math.ceil(charge * maxDepth + 0.0001) || 1, 1, 4);
            G.castDepth = depth;
            G.castFromX = ROD_TIP_REST.x;
            G.castFromY = ROD_TIP_REST.y;
            G.castToX = Math.round(lerp(CAST_NEAR_X, CAST_FAR_X, charge));
            G.castToY = WATER_SURFACE_Y;
            G.castStart = G.now;
            G.castDur = 600;     // ms for the arc
            G.lifetime.casts++;
            G.castCount++;
            transition('casting_arc');
          }
        }
      },
      render(now) {
        const reduced = isReducedMotion();
        const tipX = ROD_TIP_REST.x;
        const tipY = ROD_TIP_REST.y + (reduced ? 0 : Math.round(Math.sin(now / 700) * 0.8));
        drawRod(now, tipX, tipY);
        // Bobber held at rod tip until charge release
        drawBobber(tipX - 2, tipY + 1, 0);
        drawFireflies(now, reduced);
        drawTitleBanner(now, reduced);
        if (G.charging) drawChargeMeter(G.charge);
        // Coach mark
        if (!G.lifetime.coachShown.cast && !G.charging) {
          drawCoach('Hold to charge', W / 2, 60);
        }
      },
    },

    // Bobber arcs from rod tip into water; transitions to waiting on landing
    casting_arc: {
      enter() {},
      tick(dt) {
        const t = (G.now - G.castStart) / G.castDur;
        if (t >= 1) {
          G.bobberX = G.castToX;
          G.bobberY = G.castToY;
          if (window.FishingAudio) window.FishingAudio.play('splash');
          markCoachSeen('cast');
          transition('waiting');
        }
      },
      render(now) {
        const reduced = isReducedMotion();
        const t = clamp((now - G.castStart) / G.castDur, 0, 1);
        const p = castPos(t);
        const tipX = ROD_TIP_REST.x;
        const tipY = ROD_TIP_REST.y - Math.round(t * 6); // slight bend during cast
        drawRod(now, tipX, tipY);
        // Line from rod tip to flying bobber
        drawLine(tipX, tipY, p.x | 0, p.y | 0, C.line);
        drawBobber(p.x | 0, p.y | 0, 0);
        drawFireflies(now, reduced);
      },
    },

    waiting: {
      enter() {
        G.waitStart = G.now;
        const rng = seededRng(G.castCount);
        G.strikeAt = G.now + nextStrikeDelayMs(rng);
        if (input.primaryEdge) input.primaryEdge = false;
      },
      exit() {},
      tick(dt) {
        if (input.pauseEdge) { G.overlay = 'paused'; showOverlay('paused'); return; }
        if (input.shopEdge) { G.overlay = 'shop'; refreshShop(); showOverlay('shop'); return; }

        // Strike fires at strikeAt
        if (G.now >= G.strikeAt) {
          // Pick the fish for this strike (seeded)
          const rng = seededRng(G.castCount * 31 + 17);
          G.fish = rollFish(rng, G.castDepth);
          if (!G.fish) { transition('casting'); return; }
          transition('strike');
          return;
        }

        // Reel-in early: pressing primary while waiting just retrieves; back to casting
        if (input.primaryEdge) {
          transition('casting');
          return;
        }
      },
      render(now) {
        const reduced = isReducedMotion();
        // Static rod (rod tip slightly bent down from line tension)
        const tipY = ROD_TIP_REST.y + 1 + (reduced ? 0 : Math.round(Math.sin(now / 700) * 0.5));
        drawRod(now, ROD_TIP_REST.x, tipY);
        drawRipplesAt(now, G.bobberX + 1, G.bobberY + 4, 4500, 3);
        drawLineToBobber(ROD_TIP_REST.x, tipY, G.bobberX, G.bobberY);
        const idleBob = reduced ? 0 : Math.round(Math.sin(now / 800) * 0.6);
        drawBobber(G.bobberX, G.bobberY + idleBob, 0);
        drawFireflies(now, reduced);
        // Subtle hint while waiting
        if (now - G.waitStart > 1500 && now - G.waitStart < 4000) {
          drawCoach('quietly waiting…', W / 2, 30);
        }
      },
    },

    strike: {
      enter() {
        G.strikeStart = G.now;
        G.strikeReacted = false;
        G.shake = 1;
        G.shakeUntil = G.now + 80;
        if (window.FishingAudio) window.FishingAudio.play('strike_thump');
        if (window.FishingAudio) window.FishingAudio.play('bobber_jerk');
        if (gamepadConnected >= 0 && window.SharedGamepad) {
          window.SharedGamepad.rumble(gamepadConnected, { duration: 120, strongMagnitude: 0.4, weakMagnitude: 0.7 });
        }
        showCoachMaybe('strike');
      },
      exit() {},
      tick(dt) {
        const elapsed = G.now - G.strikeStart;
        if (input.primaryEdge) {
          G.strikeReacted = true;
          markCoachSeen('strike');
          transition('reeling');
          return;
        }
        if (elapsed > G.settings.strikeWindowMs) {
          // Missed the strike
          G.lifetime.consecutiveFails++;
          G.missUntil = G.now + 1200;
          transition('miss');
          return;
        }
      },
      render(now) {
        const reduced = isReducedMotion();
        const elapsed = now - G.strikeStart;
        const jerk = (Math.floor(elapsed / 60) & 1) ? -1 : 1;
        const tipY = ROD_TIP_REST.y + 4 + jerk; // rod bent
        drawRod(now, ROD_TIP_REST.x, tipY);
        drawRipplesAt(now, G.bobberX + 1, G.bobberY + 4, 1200, 4);
        drawLineToBobber(ROD_TIP_REST.x, tipY, G.bobberX + jerk, G.bobberY);
        drawBobber(G.bobberX + jerk, G.bobberY + (jerk * 1), jerk);
        drawFireflies(now, reduced);
        // Coach mark
        if (!G.lifetime.coachShown.strike) drawCoach('Press to hook!', W / 2, 30);
      },
    },

    miss: {
      enter() {},
      exit() {},
      tick(dt) {
        if (G.now > G.missUntil) {
          transition('casting');
        }
      },
      render(now) {
        const reduced = isReducedMotion();
        drawRod(now, ROD_TIP_REST.x, ROD_TIP_REST.y);
        drawRipplesAt(now, G.bobberX + 1, G.bobberY + 4, 4500, 3);
        drawLineToBobber(ROD_TIP_REST.x, ROD_TIP_REST.y, G.bobberX, G.bobberY);
        drawBobber(G.bobberX, G.bobberY, 0);
        drawFireflies(now, reduced);
        ctx.font = '7px "Pixelify Sans", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = C.woodDeep;
        ctx.fillText('the fish slipped away.', W / 2 + 1, 28);
        ctx.fillStyle = C.cream;
        ctx.fillText('the fish slipped away.', W / 2, 27);
      },
    },

    reeling: {
      enter() {
        // Determine catch-zone width based on rod tier (+ adaptive assist)
        const rod = G.upgrades.rod || 1;
        let halfFrac = ({ 1: 0.07, 2: 0.10, 3: 0.13, 4: 0.17 }[rod]);
        if (G.lifetime.consecutiveFails >= 3) halfFrac *= 1.15; // adaptive assist
        G.catchHalfWidth = halfFrac;
        G.catchPos = 0.5;
        G.catchVel = 0;
        G.fishX = 0.5;
        G.fishVel = 0;
        G.fishDartUntil = 0;
        G.fishPausedUntil = 0;
        G.tension = 0;
        G.progress = 0;
        G.reelTickAcc = 0;
        G.reelStartedAt = G.now;
        G.dimTarget = 0.6;
        showCoachMaybe('reel');
      },
      exit() { G.dimTarget = 0; },
      tick(dt) {
        if (input.pauseEdge) { G.overlay = 'paused'; showOverlay('paused'); return; }

        // ── Catch-zone movement ────────────────────────────────────
        if (mouseDown || touchActive) {
          // Mouse/touch: snap toward mouseVX (smoothed)
          G.catchPos = lerp(G.catchPos, mouseVX, Math.min(1, dt * 12));
          G.catchVel = 0;
        } else {
          const ACC = 4.0, FRICT = 6.0, MAX = 1.6;
          if (input.leftDown) G.catchVel -= ACC * dt;
          else if (input.rightDown) G.catchVel += ACC * dt;
          else G.catchVel *= Math.exp(-FRICT * dt);
          G.catchVel = clamp(G.catchVel, -MAX, MAX);
          G.catchPos += G.catchVel * dt;
          if (G.catchPos < G.catchHalfWidth) {
            G.catchPos = G.catchHalfWidth;
            G.catchVel = Math.abs(G.catchVel) * 0.3;
          }
          if (G.catchPos > 1 - G.catchHalfWidth) {
            G.catchPos = 1 - G.catchHalfWidth;
            G.catchVel = -Math.abs(G.catchVel) * 0.3;
          }
        }

        // ── Fish AI ───────────────────────────────────────────────
        const fish = G.fish.ai;
        // Spook multiplier when catch-zone is dead-on
        const dist = Math.abs(G.fishX - G.catchPos);
        const aligned = dist < G.catchHalfWidth;
        const spookMul = aligned ? fish.spookMul : 1.0;
        // Pause logic
        if (G.now < G.fishPausedUntil) {
          G.fishVel *= Math.exp(-3 * dt);
        } else if (G.now < G.fishDartUntil) {
          // Dart in progress
        } else {
          // Decide next behavior
          const r = Math.random();
          if (r < fish.pauseProb * (aligned ? 1.4 : 1.0)) {
            G.fishVel = 0;
            G.fishPausedUntil = G.now + 300 + Math.random() * 500;
          } else if (r < fish.pauseProb + fish.dartFreq * dt * 0.5) {
            // Dart!
            const reverse = Math.random() < fish.reversalPref;
            const sign = reverse ? -Math.sign(G.fishVel || (Math.random() - 0.5)) : Math.sign(G.fishVel || (Math.random() - 0.5));
            G.fishVel = sign * (fish.dartSpeed / 200) * spookMul;
            G.fishDartUntil = G.now + 200 + Math.random() * 300;
          } else {
            // Drift toward middle
            const driftSign = G.fishX < 0.5 ? 1 : -1;
            G.fishVel += driftSign * (fish.baseSpeed / 600) * dt * 60;
            G.fishVel = clamp(G.fishVel, -fish.baseSpeed / 100, fish.baseSpeed / 100);
          }
        }
        G.fishX += G.fishVel * dt;
        if (G.fishX < 0.05) { G.fishX = 0.05; G.fishVel = Math.abs(G.fishVel) * 0.5; }
        if (G.fishX > 0.95) { G.fishX = 0.95; G.fishVel = -Math.abs(G.fishVel) * 0.5; }

        // ── Tension + progress ────────────────────────────────────
        const lineTier = G.upgrades.line || 1;
        const tensionMul = ({ 1: 1.0, 2: 0.85, 3: 0.7, 4: 0.55 }[lineTier]);
        if (aligned) {
          G.progress = clamp(G.progress + 0.42 * dt, 0, 1);
          G.tension = clamp(G.tension - 0.30 * dt, 0, 1);
        } else {
          G.progress = clamp(G.progress - 0.18 * dt, 0, 1);
          G.tension = clamp(G.tension + 0.50 * tensionMul * dt, 0, 1);
        }

        // ── Reel-tick SFX cadence ────────────────────────────────
        G.reelTickAcc += dt;
        if (G.reelTickAcc > 0.18 && aligned && window.FishingAudio) {
          G.reelTickAcc = 0;
          window.FishingAudio.play('reel_tick');
        }
        // Tension warning at 75%+ once every ~0.4s
        if (G.tension > 0.75) {
          if (G.reelTickAcc > 0.4 && window.FishingAudio) {
            G.reelTickAcc = 0;
            window.FishingAudio.play('reel_warn');
          }
          if (G.tension > 0.9 && gamepadConnected >= 0 && window.SharedGamepad) {
            window.SharedGamepad.rumble(gamepadConnected, { duration: 80, strongMagnitude: 0.6, weakMagnitude: 0.3 });
          }
        }

        // ── Resolve ───────────────────────────────────────────────
        if (G.progress >= 1) {
          // Caught!
          markCoachSeen('reel');
          G.lifetime.consecutiveFails = 0;
          G.lifetime.catches++;
          if (G.fish.rarity > G.lifetime.bestRarity) G.lifetime.bestRarity = G.fish.rarity;
          if (!G.bestiary.includes(G.fish.id)) G.bestiary.push(G.fish.id);
          G.caughtFish = G.fish;
          G.caughtLength = lerp(G.fish.length[0], G.fish.length[1], 0.3 + Math.random() * 0.7);
          G.caughtCash = G.fish.cash;
          G.cash += G.caughtCash;
          G.todayCatches.push({ id: G.fish.id, rarity: G.fish.rarity, length: G.caughtLength, cash: G.caughtCash });
          if (window.FishingAudio) window.FishingAudio.play('catch_land');
          if (G.fish.rarity >= 4 && window.FishingAudio) setTimeout(() => window.FishingAudio.play('rare_sting'), 200);
          saveState(); refreshHUD();
          transition('reveal');
          return;
        }
        if (G.tension >= 1) {
          // Snap!
          G.lifetime.snapped++;
          G.lifetime.consecutiveFails++;
          G.reelLostFish = G.fish;
          if (window.FishingAudio) window.FishingAudio.play('line_snap');
          if (gamepadConnected >= 0 && window.SharedGamepad) {
            window.SharedGamepad.rumble(gamepadConnected, { duration: 200, strongMagnitude: 0.7, weakMagnitude: 0.4 });
          }
          saveState();
          G.missUntil = G.now + 2200;
          transition('snap');
          return;
        }
      },
      render(now) {
        const reduced = isReducedMotion();
        // Render world dimmed
        if (G.dimTarget > 0) {
          ctx.fillStyle = `rgba(10, 10, 11, ${G.dimTarget})`;
          ctx.fillRect(0, 0, W, H);
        }
        // Show rod bent significantly
        const bend = 6 + Math.round(Math.sin(now / 200) * 1);
        drawRod(now, ROD_TIP_REST.x, ROD_TIP_REST.y + bend);
        drawLineToBobber(ROD_TIP_REST.x, ROD_TIP_REST.y + bend, G.bobberX, G.bobberY);
        // Reel panel
        drawReelPanel(now);
        // Coach
        if (!G.lifetime.coachShown.reel) drawCoach('Keep gold zone over fish', W / 2, REEL.panelY - 8);
      },
    },

    snap: {
      enter() {},
      exit() {},
      tick(dt) {
        if (G.now > G.missUntil) {
          transition('casting');
        }
      },
      render(now) {
        const reduced = isReducedMotion();
        // Slow-mo dive of the lost fish silhouette
        const elapsed = now - (G.missUntil - 2200);
        const t = clamp(elapsed / 2200, 0, 1);
        // Rod recoil
        const recoilY = Math.round(Math.sin((1 - t) * 8) * (1 - t) * 4);
        drawRod(now, ROD_TIP_REST.x, ROD_TIP_REST.y - recoilY);
        // Show snapped line drifting
        const lineEndY = G.bobberY + Math.round(t * 30);
        drawLine(ROD_TIP_REST.x, ROD_TIP_REST.y - recoilY, G.bobberX + 1, lineEndY, C.line);
        // Ghost silhouette diving
        if (G.reelLostFish) {
          const sprite = G.reelLostFish.sprite;
          const sw = sprite[0].length, sh = sprite.length;
          const fx = G.bobberX - sw / 2 + Math.sin(t * 3) * 8;
          const fy = G.bobberY + 4 + t * 60;
          ctx.fillStyle = `rgba(26, 38, 56, ${0.7 * (1 - t)})`;
          for (let yy = 0; yy < sh; yy++)
            for (let xx = 0; xx < sw; xx++)
              if (sprite[yy][xx] !== '.') ctx.fillRect((fx + xx) | 0, (fy + yy) | 0, 1, 1);
        }
        drawFireflies(now, reduced);
        // "closest you got" message
        ctx.font = '7px "Pixelify Sans", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = C.woodDeep;
        const msg = G.reelLostFish ? `the line snapped — ${G.reelLostFish.name} got away` : 'the line snapped';
        ctx.fillText(msg, W / 2 + 1, 26);
        ctx.fillStyle = C.cream;
        ctx.fillText(msg, W / 2, 25);
      },
    },

    reveal: {
      enter() {
        populateCatchReveal();
        showOverlay('catch');
      },
      exit() { hideAllOverlays(); },
      tick(dt) {
        if (input.primaryEdge && !G.overlay) {
          // Modal handles continue via button click; rapid-dismiss with primary too
          handleAction('continue');
        }
      },
      render(now) {
        const reduced = isReducedMotion();
        // Render dimmed world, rod returning to rest
        ctx.fillStyle = 'rgba(10, 10, 11, 0.6)';
        ctx.fillRect(0, 0, W, H);
        drawRod(now, ROD_TIP_REST.x, ROD_TIP_REST.y);
        drawRipplesAt(now, G.bobberX + 1, G.bobberY + 4, 3500, 3);
        drawLineToBobber(ROD_TIP_REST.x, ROD_TIP_REST.y, G.bobberX, G.bobberY);
        drawBobber(G.bobberX, G.bobberY, 0);
        drawFireflies(now, reduced);
      },
    },
  };

  // ─── Coach mark plumbing ────────────────────────────────────────
  function showCoachMaybe(_kind) { /* shown via render based on coachShown */ }
  function markCoachSeen(kind) {
    if (G.lifetime.coachShown[kind]) return;
    G.lifetime.coachShown[kind] = true;
    saveState();
  }

  // ─── Reduced-motion check ──────────────────────────────────────
  let osReducedMotion = false;
  if (window.matchMedia) {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    osReducedMotion = m.matches;
    if (m.addEventListener) m.addEventListener('change', e => { osReducedMotion = e.matches; });
  }
  function isReducedMotion() { return osReducedMotion || G.settings.reducedMotionUI; }

  // ─── Main loop ──────────────────────────────────────────────────
  const TICK_HZ = 60;
  const TICK_MS = 1000 / TICK_HZ;
  let accumulator = 0;
  let lastFrameTime = 0;

  function frame(now) {
    G.now = now;
    let dt = lastFrameTime ? now - lastFrameTime : TICK_MS;
    lastFrameTime = now;
    if (dt > 100) dt = 100;
    accumulator += dt;

    pollGamepad();

    while (accumulator >= TICK_MS) {
      // pauseEdge has dual meaning (open vs close). Route once per tick based on
      // overlay state at the start: if an overlay is open, close it; otherwise let
      // the active state.tick decide whether pauseEdge opens the pause menu.
      if (input.pauseEdge && G.overlay) {
        G.overlay = null;
        hideAllOverlays();
        if (G.state === 'title') showOverlay('title');
        input.pauseEdge = false;  // consume so state.tick doesn't re-open
      } else if (!G.overlay) {
        const cur = states[G.state];
        if (cur && cur.tick) cur.tick(TICK_MS / 1000);
        G.worldTime += TICK_MS / 1000;
      }
      clearEdges();
      accumulator -= TICK_MS;
    }

    render();
    requestAnimationFrame(frame);
  }

  function render() {
    const reduced = isReducedMotion();
    const shake = G.shake && G.now < G.shakeUntil;
    if (!shake) G.shake = 0;
    const sx = shake && !reduced ? Math.round((Math.random() - 0.5) * 4) : 0;
    const sy = shake && !reduced ? Math.round((Math.random() - 0.5) * 4) : 0;

    ctx.save();
    if (sx || sy) ctx.translate(sx, sy);

    // Static bg
    ctx.drawImage(bg, 0, 0);
    // Common ambient
    drawShimmer(G.now);
    drawSunHighlightDrift(G.now);

    // State-specific render
    const cur = states[G.state];
    if (cur && cur.render) cur.render(G.now);

    ctx.restore();
  }

  // ─── Bind data-action buttons (catch / shop / help) ─────────────
  function bindStaticActions() {
    document.querySelectorAll('[data-action]').forEach((btn) => {
      // Only bind if not already wired (rebuilds happen for pause/help panels)
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleAction(btn.getAttribute('data-action'));
      });
    });
  }

  // ─── Init ───────────────────────────────────────────────────────
  function init() {
    loadState();
    refreshHUD();
    buildBg();
    buildBanner();

    if (window.FishingAudio) {
      window.FishingAudio.setVolume('master', G.settings.audioMaster);
      window.FishingAudio.setVolume('sfx', G.settings.audioSfx);
    }
    if (window.SharedGamepad) {
      window.SharedGamepad.init({});
    }

    bindStaticActions();

    // Wire input listeners
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    // Start in title
    transition('title');
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose a tiny diagnostic surface for verification (used by Chrome DevTools MCP runs).
  // No production caller depends on this — safe to read but do not write game state via it.
  window.Fishing = window.Fishing || {};
  window.Fishing._debug = function () {
    return {
      state: G.state, overlay: G.overlay,
      cash: G.cash, upgrades: { ...G.upgrades },
      lifetime: { ...G.lifetime, coachShown: { ...G.lifetime.coachShown } },
      charging: G.charging, charge: G.charge,
      tension: G.tension, progress: G.progress,
      catchPos: G.catchPos, fishX: G.fishX,
      fish: G.fish ? G.fish.id : null,
      caughtFish: G.caughtFish ? G.caughtFish.id : null,
      todayCatches: G.todayCatches.length,
      input: { ...input, konami: input.konami.length },
    };
  };
  window.Fishing._injectInput = function (key, value) { input[key] = value; };
  window.Fishing._reset = function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  };
})();
