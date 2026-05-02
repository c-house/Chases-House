/* ═══════════════════════════════════════════════════════════════
   Asteroids — render.js
   Canvas-2D vector strokes with phosphor glow. Reads state but never
   writes it. HUD is DOM (ui.js owns it) — render does NOT write text.
   Exposes window.AsteroidsRender.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const E = window.AsteroidsEntities;

  // Phosphor palette (canvas-internal — distinct from site Warm Hearth tokens).
  const PHOSPHOR       = '#f0f0e6';
  const PHOSPHOR_GLOW  = 'rgba(240, 240, 230, 0.55)';
  const PHOSPHOR_AMBER = '#ffb44a';
  const AMBER_GLOW     = 'rgba(255, 180, 74, 0.55)';

  let canvas = null;
  let ctx = null;
  let W = 0, H = 0;
  let reducedMotion = false;
  let shakeOffsetX = 0, shakeOffsetY = 0;

  function K() { return window.AsteroidsGame.CONSTANTS; }

  function init(opts) {
    canvas = opts.canvas;
    ctx = canvas.getContext('2d');
    W = canvas.width;
    H = canvas.height;
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function width()  { return W; }
  function height() { return H; }

  // Begin-of-frame: phosphor decay clear + screen-shake translate.
  // Reduced motion: hard clear, no shake.
  function beginFrame(state) {
    if (reducedMotion) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      shakeOffsetX = shakeOffsetY = 0;
    } else {
      ctx.fillStyle = `rgba(0, 0, 0, ${K().PHOSPHOR_FADE_ALPHA})`;
      ctx.fillRect(0, 0, W, H);
      // shake: random offset scaled by current shakeAmp; decay per frame
      const amp = (state && state.shakeAmp) || 0;
      if (amp > 0.1) {
        shakeOffsetX = (Math.random() - 0.5) * 2 * amp;
        shakeOffsetY = (Math.random() - 0.5) * 2 * amp;
      } else {
        shakeOffsetX = shakeOffsetY = 0;
      }
    }
    ctx.save();
    ctx.translate(shakeOffsetX, shakeOffsetY);
    setStroke();
  }

  function endFrame() {
    ctx.restore();
  }

  function setStroke() {
    ctx.strokeStyle = PHOSPHOR;
    ctx.lineWidth = K().LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = K().SHADOW_BLUR;
    ctx.shadowColor = PHOSPHOR_GLOW;
  }

  function setStrokeAmber() {
    ctx.strokeStyle = PHOSPHOR_AMBER;
    ctx.shadowColor = AMBER_GLOW;
  }

  // Hard clear — used when entering a new scene to wipe phosphor trail.
  function hardClear() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ── primitives ────────────────────────────────────────────

  function drawAsteroid(a, t) {
    const verts = E.asteroidWorldVerts(a, t);
    ctx.beginPath();
    for (let i = 0; i < verts.length; i++) {
      if (i === 0) ctx.moveTo(verts[i].x, verts[i].y);
      else ctx.lineTo(verts[i].x, verts[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawShip(s) {
    if (!s.alive) return;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle + Math.PI / 2);  // ship art points up at 0; engine angle is along X
    // outline: nose at (0,-18), back-corners (±13,14), notch (0,9)
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(13, 14);
    ctx.lineTo(0, 9);
    ctx.lineTo(-13, 14);
    ctx.closePath();
    ctx.stroke();
    // thrust flame: small triangle behind notch, flickers
    if (s.thrust && Math.random() < 0.55) {
      ctx.beginPath();
      ctx.moveTo(-7, 10);
      ctx.lineTo(0, 22 + Math.random() * 5);
      ctx.lineTo(7, 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Invuln blink — render every other ~6 frames to skip the ship.
  // Caller decides via t-based gating; we just draw with reduced alpha.
  function drawShipShadowy(s, t) {
    if (!s.alive) return;
    // Blink: on for 100ms, off for 100ms, repeating
    const phase = Math.floor(t * 5) % 2;  // 5 Hz
    if (phase === 0) return;
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawShip(s);
    ctx.restore();
  }

  function drawBullet(b) {
    const alpha = 1 - (b.distTraveled / b.maxDist);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 0.5, 0, Math.PI * 2);
    ctx.fillStyle = b.owner === 'ufo' ? PHOSPHOR_AMBER : PHOSPHOR;
    ctx.shadowColor = b.owner === 'ufo' ? AMBER_GLOW : PHOSPHOR_GLOW;
    ctx.fill();
    ctx.restore();
  }

  function drawUFO(u) {
    const small = u.tier === 1;  // index 1 = small in UFO_TIERS
    ctx.save();
    ctx.translate(u.x, u.y);
    if (small) {
      ctx.scale(0.7, 0.7);
      setStrokeAmber();
    }
    // top dome
    ctx.beginPath();
    ctx.moveTo(-10, -4); ctx.lineTo(-6, -10);
    ctx.lineTo(6, -10); ctx.lineTo(10, -4);
    ctx.closePath();
    ctx.stroke();
    // center belt
    ctx.beginPath();
    ctx.moveTo(-22, 0); ctx.lineTo(22, 0);
    ctx.stroke();
    // lower hull
    ctx.beginPath();
    ctx.moveTo(-22, 0); ctx.lineTo(-12, 6);
    ctx.lineTo(12, 6);  ctx.lineTo(22, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawParticle(p) {
    const alpha = 1 - (p.age / p.maxAge);
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.beginPath();
    ctx.moveTo(-p.len / 2, 0);
    ctx.lineTo(p.len / 2, 0);
    ctx.stroke();
    ctx.restore();
  }

  // Hyperspace / extra-life flash — full-canvas rectangle at low alpha,
  // additive over the phosphor decay clear. Caller decides duration via
  // state.flashFrames decrement.
  function flash(intensity) {
    if (reducedMotion) return;
    if (!intensity || intensity <= 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);  // ignore shake
    ctx.fillStyle = `rgba(240, 240, 230, ${0.35 * intensity})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Reduced-motion accessor for game logic that wants to gate behavior.
  function prefersReducedMotion() { return reducedMotion; }

  window.AsteroidsRender = {
    init: init,
    width: width, height: height,
    beginFrame: beginFrame, endFrame: endFrame,
    hardClear: hardClear,
    drawAsteroid: drawAsteroid,
    drawShip: drawShip, drawShipShadowy: drawShipShadowy,
    drawBullet: drawBullet, drawUFO: drawUFO, drawParticle: drawParticle,
    flash: flash,
    prefersReducedMotion: prefersReducedMotion
  };
})();
