/* ═══════════════════════════════════════════════════════════════
   Asteroids — entities.js
   Factories + per-tick update functions for Ship, Asteroid, Bullet,
   UFO, Particle. Plain functions; mutate in place; return false to
   signal removal. Reads CONSTANTS via window.AsteroidsGame.CONSTANTS
   (game.js owns it).
   Exposes window.AsteroidsEntities.

   Note: Math.random() is called directly throughout. The v2 daily-seed
   ADR will replace these call sites — they are tagged with the
   "rng:v2-daily-seed will replace" comment to make them grep-able.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const P = window.AsteroidsPhysics;

  function K() { return window.AsteroidsGame.CONSTANTS; }

  // ── factories ─────────────────────────────────────────────

  function makeShip(opts) {
    return {
      type: 'ship',
      slot: opts.slot,
      x: opts.x, y: opts.y,
      vx: 0, vy: 0,
      angle: opts.angle != null ? opts.angle : -Math.PI / 2, // up
      thrust: false,
      invulnTimer: K().SHIP_INVULN_S,
      hyperspaceFlash: 0,
      alive: true
    };
  }

  function makeAsteroid(opts) {
    const tier = opts.tier;                                // index into AST_TIERS
    const tierDef = K().AST_TIERS[tier];
    const N = Math.floor(P.randRange(tierDef.vertCount[0], tierDef.vertCount[1] + 1));  // rng:v2-daily-seed will replace
    const verts = [];
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2;
      const offset = P.randRange(K().AST_VERT_OFFSET[0], K().AST_VERT_OFFSET[1]);  // rng:v2-daily-seed will replace
      verts.push({ angle: angle, baseR: tierDef.radius * offset });
    }
    return {
      type: 'asteroid',
      tier: tier,
      x: opts.x, y: opts.y,
      vx: opts.vx, vy: opts.vy,
      radius: tierDef.radius,
      rotation: opts.rotation != null ? opts.rotation : Math.random() * Math.PI * 2,  // rng:v2-daily-seed will replace
      angVel: opts.angVel != null ? opts.angVel : (Math.random() - 0.5) * 0.4,        // rng:v2-daily-seed will replace
      verts: verts,
      breathePhase: Math.random() * Math.PI * 2  // rng:v2-daily-seed will replace
    };
  }

  function makeBullet(opts) {
    return {
      type: 'bullet',
      x: opts.x, y: opts.y,
      vx: opts.vx, vy: opts.vy,
      owner: opts.owner,           // 'p1' | 'p2' | 'ufo'
      distTraveled: 0,
      maxDist: opts.maxDist != null ? opts.maxDist : K().BULLET_TTL_DIST,
      radius: K().BULLET_RADIUS
    };
  }

  function makeUFO(opts) {
    const tier = opts.tier;
    const tierDef = K().UFO_TIERS[tier];
    const fromLeft = Math.random() < 0.5;  // rng:v2-daily-seed will replace
    const y = P.randRange(80, K().CANVAS_H - 80);  // rng:v2-daily-seed will replace
    return {
      type: 'ufo',
      tier: tier,
      x: fromLeft ? -30 : K().CANVAS_W + 30,
      y: y,
      vx: (fromLeft ? 1 : -1) * tierDef.speed,
      vy: 0,
      radius: tierDef.radius,
      fireCooldown: K().UFO_BULLET_COOLDOWN_S,
      driftCooldown: P.randRange(1.5, 3.5),  // rng:v2-daily-seed will replace
      driftDir: 0
    };
  }

  function makeParticle(opts) {
    return {
      type: 'particle',
      x: opts.x, y: opts.y,
      vx: opts.vx, vy: opts.vy,
      rot: opts.rot != null ? opts.rot : Math.random() * Math.PI * 2,  // rng:v2-daily-seed will replace
      rotV: opts.rotV != null ? opts.rotV : (Math.random() - 0.5) * 2.5,  // rng:v2-daily-seed will replace
      len: opts.len != null ? opts.len : P.randRange(8, 16),  // rng:v2-daily-seed will replace
      age: 0,
      maxAge: opts.maxAge != null ? opts.maxAge : P.randRange(K().PARTICLE_LIFE_S[0], K().PARTICLE_LIFE_S[1])  // rng:v2-daily-seed will replace
    };
  }

  // Radial fan of debris emanating from a center point.
  function makeDebrisFan(x, y, count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;  // rng:v2-daily-seed will replace
      const speed = P.randRange(40, 90);  // rng:v2-daily-seed will replace
      out.push(makeParticle({
        x: x, y: y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed
      }));
    }
    return out;
  }

  // ── update functions ──────────────────────────────────────

  // updateShip — applies intent to physics; mutates ship + state.
  // intent shape: { rotate: -1|0|1, thrust: bool }
  // Fire/hyperspace are handled by game.js calling Input.consumeFire/Hyperspace
  // directly (input.js owns those cooldowns); this function only drives
  // rotation + thrust + drift + invuln-timer.
  function updateShip(ship, intent, dt, state) {
    if (!ship.alive) return;
    if (ship.invulnTimer > 0) ship.invulnTimer -= dt;
    if (ship.hyperspaceFlash > 0) ship.hyperspaceFlash--;

    if (intent.rotate) {
      ship.angle += intent.rotate * K().SHIP_ROTATE_RAD_PER_S * dt;
    }

    ship.thrust = !!intent.thrust;
    if (ship.thrust) {
      ship.vx += Math.cos(ship.angle) * K().SHIP_THRUST_ACCEL * dt;
      ship.vy += Math.sin(ship.angle) * K().SHIP_THRUST_ACCEL * dt;
      // soft cap via direct clamp at max velocity
      const sp = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
      if (sp > K().SHIP_MAX_VEL) {
        ship.vx = ship.vx / sp * K().SHIP_MAX_VEL;
        ship.vy = ship.vy / sp * K().SHIP_MAX_VEL;
      }
    }

    // drag (very mild; ~0.965/s effective rate)
    ship.vx *= K().SHIP_DRAG;
    ship.vy *= K().SHIP_DRAG;

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    P.wrapEntity(ship, K().CANVAS_W, K().CANVAS_H);
  }

  // Trigger hyperspace on a ship. Returns 'ok' | 'explode'.
  // Game.js calls this when Input.consumeHyperspace(slot) returns true.
  function hyperspace(ship) {
    ship.x = P.randRange(40, K().CANVAS_W - 40);  // rng:v2-daily-seed will replace
    ship.y = P.randRange(40, K().CANVAS_H - 40);  // rng:v2-daily-seed will replace
    ship.vx = 0; ship.vy = 0;
    ship.hyperspaceFlash = K().HYPERSPACE_FLASH_FRAMES;
    return Math.random() < K().HYPERSPACE_EXPLODE_CHANCE ? 'explode' : 'ok';  // rng:v2-daily-seed will replace
  }

  function updateAsteroid(a, dt) {
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rotation += a.angVel * dt;
    P.wrapEntity(a, K().CANVAS_W, K().CANVAS_H);
  }

  // returns false when bullet should be removed
  function updateBullet(b, dt) {
    const dx = b.vx * dt, dy = b.vy * dt;
    b.x += dx; b.y += dy;
    b.distTraveled += Math.sqrt(dx * dx + dy * dy);
    P.wrapEntity(b, K().CANVAS_W, K().CANVAS_H);
    return b.distTraveled < b.maxDist;
  }

  // UFO AI — drift horizontally with occasional vertical change of heading;
  // fire periodically aimed at the nearest live ship with tier-specific inaccuracy.
  function updateUFO(ufo, dt, state) {
    ufo.x += ufo.vx * dt;
    ufo.y += ufo.vy * dt;
    // exit screen — return false to remove
    if (ufo.x < -50 || ufo.x > K().CANVAS_W + 50) return false;
    // wrap vertically
    ufo.y = P.wrap(ufo.y, K().CANVAS_H);

    // occasional vertical drift change
    ufo.driftCooldown -= dt;
    if (ufo.driftCooldown <= 0) {
      ufo.driftDir = Math.random() < 0.5 ? -1 : (Math.random() < 0.5 ? 0 : 1);  // rng:v2-daily-seed will replace
      ufo.vy = ufo.driftDir * K().UFO_TIERS[ufo.tier].speed * 0.5;
      ufo.driftCooldown = P.randRange(1.5, 3.5);  // rng:v2-daily-seed will replace
    }

    // fire at nearest living ship
    ufo.fireCooldown -= dt;
    if (ufo.fireCooldown <= 0) {
      const target = nearestLivingShip(state, ufo.x, ufo.y);
      if (target) {
        const inacc = K().UFO_TIERS[ufo.tier].aimInaccuracyRad;
        const aimAngle = Math.atan2(target.y - ufo.y, target.x - ufo.x)
          + (Math.random() - 0.5) * 2 * inacc;  // rng:v2-daily-seed will replace
        state.bullets.push(makeBullet({
          x: ufo.x, y: ufo.y,
          vx: Math.cos(aimAngle) * K().UFO_BULLET_SPEED,
          vy: Math.sin(aimAngle) * K().UFO_BULLET_SPEED,
          owner: 'ufo',
          maxDist: K().BULLET_TTL_DIST
        }));
        state.events.push({ type: 'ufoFire' });
      }
      ufo.fireCooldown = K().UFO_BULLET_COOLDOWN_S;
    }

    return true;
  }

  function nearestLivingShip(state, x, y) {
    let best = null, bestD = Infinity;
    for (const p of state.players) {
      if (!p || !p.ship || !p.ship.alive) continue;
      const dx = p.ship.x - x, dy = p.ship.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = p.ship; }
    }
    return best;
  }

  function updateParticle(p, dt) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.rotV * dt;
    // mild deceleration
    p.vx *= 0.985; p.vy *= 0.985;
    p.age += dt;
    return p.age < p.maxAge;
  }

  // Split an asteroid into two of the next tier down.
  // Returns array of new asteroids (empty for smallest tier).
  function splitAsteroid(a) {
    const nextTier = a.tier + 1;
    if (nextTier >= K().AST_TIERS.length) return [];
    const tierDef = K().AST_TIERS[nextTier];
    const out = [];
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2;  // rng:v2-daily-seed will replace
      const speed = P.randRange(tierDef.speed[0], tierDef.speed[1]);  // rng:v2-daily-seed will replace
      out.push(makeAsteroid({
        x: a.x, y: a.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        tier: nextTier
      }));
    }
    return out;
  }

  // Resolve an asteroid's vertices into absolute world coordinates,
  // including current rotation + per-vertex breathe. Used by physics
  // collision (point-in-polygon) and by render.js for drawing.
  function asteroidWorldVerts(a, t) {
    const out = new Array(a.verts.length);
    for (let i = 0; i < a.verts.length; i++) {
      const v = a.verts[i];
      const breathe = 1 + K().AST_BREATHE_AMP * Math.sin(t * 1.5 + a.breathePhase + i * 0.7);
      const r = v.baseR * breathe;
      const ang = v.angle + a.rotation;
      out[i] = { x: a.x + Math.cos(ang) * r, y: a.y + Math.sin(ang) * r };
    }
    return out;
  }

  window.AsteroidsEntities = {
    makeShip: makeShip,
    makeAsteroid: makeAsteroid,
    makeBullet: makeBullet,
    makeUFO: makeUFO,
    makeParticle: makeParticle,
    makeDebrisFan: makeDebrisFan,
    updateShip: updateShip,
    hyperspace: hyperspace,
    updateAsteroid: updateAsteroid,
    updateBullet: updateBullet,
    updateUFO: updateUFO,
    updateParticle: updateParticle,
    splitAsteroid: splitAsteroid,
    asteroidWorldVerts: asteroidWorldVerts
  };
})();
