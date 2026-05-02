/* ═══════════════════════════════════════════════════════════════
   Asteroids — game.js
   Terminal bootstrap. Owns:
     - CONSTANTS (the single tunable knob block)
     - state object (single source of truth)
     - RAF tick with fixed-timestep accumulator
     - step(): physics orchestration, collision, wave progression
     - localStorage high-score load/save
     - first-user-gesture audio gate
     - meta-key handling (P, M, R, Esc)

   Per review fix #1: render reads state directly; only audio drains state.events.
   Per review fix #2: input.js owns fire/hyperspace cooldowns.
   Per review fix #3: bind screen is a state-machine state, polled from ui.js.
   Per review fix #4: Math.random() called directly; v2 daily-seed to replace.
   Per review fix #5: AST_TIERS / UFO_TIERS as data arrays.
   Per review fix #6: ui.js handles overlay flow; game.js orchestrates only.

   Exposes window.AsteroidsGame.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ═════════════ CONSTANTS ═════════════════════════════════════
  const CONSTANTS = Object.freeze({
    // Display / timing
    CANVAS_W: 1024, CANVAS_H: 768,
    FIXED_STEP_MS: 1000 / 60, MAX_STEPS_PER_FRAME: 3, MAX_DT_MS: 250,

    // Ship physics
    SHIP_ROTATE_RAD_PER_S: 4.71,                    // ≈270 deg/s
    SHIP_THRUST_ACCEL: 280,
    SHIP_MAX_VEL: 360,
    SHIP_DRAG: 0.999,
    SHIP_RADIUS: 12,
    SHIP_INVULN_S: 2.0,
    SHIP_RESPAWN_CLEAR_RADIUS: 100,
    FORCE_RESPAWN_S: 5.0,

    // Bullets
    BULLET_SPEED: 600, BULLET_TTL_DIST: 720,
    BULLET_MAX_PER_SHIP: 4, BULLET_COOLDOWN_S: 0.15,
    BULLET_RADIUS: 2,

    // Hyperspace
    HYPERSPACE_COOLDOWN_S: 1.0,
    HYPERSPACE_EXPLODE_CHANCE: 0.08,
    HYPERSPACE_FLASH_FRAMES: 8,

    // Asteroid tiers (review fix #5)
    AST_TIERS: [
      { name: 'large',  radius: 60, speed: [30, 60],   score: 20,  vertCount: [11, 12] },
      { name: 'medium', radius: 35, speed: [60, 100],  score: 50,  vertCount: [10, 11] },
      { name: 'small',  radius: 18, speed: [80, 150],  score: 100, vertCount: [9, 10]  }
    ],
    AST_VERT_OFFSET: [0.65, 1.05],
    AST_BREATHE_AMP: 0.05,

    // UFO tiers (review fix #5)
    UFO_TIERS: [
      { name: 'large', speed: 100, score: 200,  radius: 18, aimInaccuracyRad: 0.6,  spawnAfterScore: 0    },
      { name: 'small', speed: 140, score: 1000, radius: 14, aimInaccuracyRad: 0.05, spawnAfterScore: 5000 }
    ],
    UFO_SPAWN_INTERVAL_S: [12, 25],
    UFO_BULLET_SPEED: 350, UFO_BULLET_COOLDOWN_S: 1.4,

    // Wave progression
    WAVE_COUNT: w => Math.min(11, 4 + 2 * w),
    WAVE_CLEAR_DELAY_S: 1.5,

    // Heartbeat
    BEAT_INTERVAL_MIN_S: 0.45, BEAT_INTERVAL_MAX_S: 1.4,
    BEAT_LOW_HZ: 110, BEAT_HIGH_HZ: 165,

    // Lives & scoring
    STARTING_LIVES: 3,
    EXTRA_LIFE_EVERY: 10000,
    HIGHSCORE_TOP_N: 10,

    // Particles
    SHIP_EXPLODE_PARTICLE_COUNT: 14,
    ASTEROID_BREAK_PARTICLE_COUNT: 6,
    UFO_EXPLODE_PARTICLE_COUNT: 10,
    HYPERSPACE_PARTICLE_COUNT: 8,
    PARTICLE_LIFE_S: [0.6, 1.2],

    // Render / feel
    PHOSPHOR_FADE_ALPHA: 0.18,
    LINE_WIDTH: 1.6,
    SHADOW_BLUR: 8,
    SCREEN_SHAKE_DECAY: 0.85,
    HIT_PAUSE_FRAMES: 5  // 5 ticks = ~83ms at 60Hz
  });

  // Expose CONSTANTS early so other modules can read it via window.AsteroidsGame.CONSTANTS
  window.AsteroidsGame = { CONSTANTS: CONSTANTS };

  // ═════════════ MODULE REFS (after script load order is satisfied) ════
  const P  = window.AsteroidsPhysics;
  const E  = window.AsteroidsEntities;
  const I  = window.AsteroidsInput;
  const Au = window.AsteroidsAudio;
  const R  = window.AsteroidsRender;
  // ui.js loads AFTER game.js (MA7) — bind U lazily inside init().
  let U = null;

  const HS_KEY = 'asteroids-highscores';

  // ═════════════ STATE ═════════════════════════════════════════
  let state = null;
  let canvas = null;
  let accumulator = 0;
  let lastTs = 0;
  let extraLifeTier = 0;       // how many extra lives have been awarded
  let lastBulletTime = { 1: -Infinity, 2: -Infinity };  // throttle aside from input cooldown

  function freshState() {
    return {
      scene: 'title',
      tickCount: 0,
      events: [],
      coop: false,
      wave: 0,
      asteroidsAtWaveStart: 0,
      waveClearTimer: 0,
      score: 0,
      hitPauseFrames: 0,
      shakeAmp: 0,
      flashFrames: 0,
      players: [],
      asteroids: [],
      bullets: [],
      ufo: null,
      ufoSpawnTimer: 0,
      particles: [],
      hsEntry: null
    };
  }

  function makePlayer(slot) {
    return {
      slot: slot,
      ship: null,
      lives: CONSTANTS.STARTING_LIVES,
      lifeStatus: 'waiting',     // 'alive' | 'waiting' | 'out'
      respawnTimer: 0,
      forceRespawnTimer: 0,
      bulletCount: 0,
      input: { scheme: null, gamepadIndex: null }
    };
  }

  // ═════════════ INIT / BOOT ═══════════════════════════════════
  function init() {
    U = window.AsteroidsUI;  // Resolve now that ui.js has loaded (MA7).
    canvas = document.getElementById('game');
    R.init({ canvas: canvas });
    U.init();
    I.init({ onKey: handleKey });

    state = freshState();
    setScene('title');

    // Title screen "Press Space" — listen for any key to enter menu
    // (handled via handleKey routing; nothing extra needed)

    lastTs = performance.now();
    requestAnimationFrame(tick);
  }

  // ═════════════ SCENE TRANSITIONS ══════════════════════════════
  function setScene(name) {
    state.scene = name;
    R.hardClear();  // wipe phosphor trail between scenes
    U.setScene(name, state);
    if (name === 'hsentry') U.enterHsEntry(state);
  }

  function startNewGame(coop) {
    state = freshState();
    state.coop = coop;
    state.players = [makePlayer(1)];
    if (coop) state.players.push(makePlayer(2));

    // SOLO defaults: P1 keyboard arrows; gamepad auto-attaches if pressed mid-play
    if (!coop) {
      state.players[0].input.scheme = 'arrows';
      I.claimInput(1, { kind: 'keyboard', scheme: 'arrows' });
      enterPlaying();
    } else {
      // CO-OP: enter bind screen; players choose their inputs
      I.releaseAll();
      setScene('bind');
    }

    Au.ensure();
    Au.resume();
    Au.resetForNewGame();
    extraLifeTier = 0;
  }

  function enterPlaying() {
    state.wave = 1;
    spawnWave(state.wave);
    for (const p of state.players) {
      p.lifeStatus = 'alive';
      p.ship = E.makeShip({ slot: p.slot, x: CONSTANTS.CANVAS_W / 2, y: CONSTANTS.CANVAS_H / 2 });
    }
    setScene('playing');
  }

  function pauseGame()  { if (state.scene === 'playing') setScene('paused'); }
  function resumeFromPause() { if (state.scene === 'paused') setScene('playing'); }
  function restartFromPause() {
    const coop = state.coop;
    startNewGame(coop);
  }
  function quitToTitle() {
    I.releaseAll();
    state = freshState();
    setScene('title');
  }

  // ═════════════ TICK LOOP ═════════════════════════════════════
  function tick(ts) {
    const dt = Math.min(CONSTANTS.MAX_DT_MS, ts - lastTs);
    lastTs = ts;
    accumulator += dt;
    let steps = 0;
    while (accumulator >= CONSTANTS.FIXED_STEP_MS && steps < CONSTANTS.MAX_STEPS_PER_FRAME) {
      const dtSec = CONSTANTS.FIXED_STEP_MS / 1000;
      I.tickCooldowns(dtSec);

      if (state.scene === 'playing' && state.hitPauseFrames === 0) {
        step(dtSec);
      } else if (state.hitPauseFrames > 0) {
        state.hitPauseFrames--;
      } else if (state.scene === 'bind') {
        U.updateBindScreen(state);
      } else if (state.scene === 'title' || state.scene === 'gameover' || state.scene === 'hstable') {
        // decorative scenes: drift asteroids + particles for ambience
        decorativeStep(dtSec);
      }

      Au.sync(state);
      accumulator -= CONSTANTS.FIXED_STEP_MS;
      steps++;
    }

    // Per real frame: render + HUD
    R.beginFrame(state);
    drawScene();
    R.flash(state.flashFrames > 0 ? state.flashFrames / CONSTANTS.HYPERSPACE_FLASH_FRAMES : 0);
    R.endFrame();
    if (state.flashFrames > 0) state.flashFrames--;
    state.shakeAmp *= CONSTANTS.SCREEN_SHAKE_DECAY;
    U.updateHUD(state);

    requestAnimationFrame(tick);
  }

  // ═════════════ STEP — physics + collision + waves ════════════
  function step(dt) {
    state.tickCount++;

    // Players: read intent → update ship → handle fire/hyperspace
    for (const p of state.players) {
      if (p.lifeStatus === 'alive' && p.ship) {
        const intent = I.getIntent(p.slot);
        E.updateShip(p.ship, intent, dt, state);
        if (intent.thrust) state.events.push({ type: 'thrust' });

        if (I.consumeFire(p.slot) && p.bulletCount < CONSTANTS.BULLET_MAX_PER_SHIP) {
          fireBullet(p);
        }
        if (I.consumeHyperspace(p.slot)) {
          const result = E.hyperspace(p.ship);
          state.events.push({ type: 'hyperspace' });
          state.flashFrames = CONSTANTS.HYPERSPACE_FLASH_FRAMES;
          spawnHyperspaceParticles(p.ship.x, p.ship.y);
          if (result === 'explode') killShip(p);
        }
      } else if (p.lifeStatus === 'waiting') {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.forceRespawnTimer += dt;
          if (centerIsClear() || p.forceRespawnTimer >= CONSTANTS.FORCE_RESPAWN_S) {
            respawnShip(p);
          }
        }
      }
    }

    // SOLO: auto-attach gamepad if pressed
    if (!state.coop && state.players[0]) {
      const p1 = state.players[0];
      if (p1.input.gamepadIndex == null) {
        const idx = I.pollUnclaimedGamepadIndex();
        if (idx >= 0) {
          // Re-claim slot 1 with both keyboard AND gamepad — keyboard already claimed,
          // so we ALSO bind a gamepad source. For simplicity, replace with gamepad if
          // gamepad button was pressed (player can switch back by pressing keyboard).
          p1.input.gamepadIndex = idx;
          I.claimInput(1, { kind: 'gamepad', gamepadIndex: idx });
        }
      }
    }

    // Update asteroids
    for (const a of state.asteroids) E.updateAsteroid(a, dt);

    // Update bullets (filter expired)
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      if (!E.updateBullet(state.bullets[i], dt)) {
        // decrement owner's bullet count
        decrementBulletCount(state.bullets[i].owner);
        state.bullets.splice(i, 1);
      }
    }

    // Update particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      if (!E.updateParticle(state.particles[i], dt)) state.particles.splice(i, 1);
    }

    // Update UFO
    if (state.ufo) {
      if (!E.updateUFO(state.ufo, dt, state)) state.ufo = null;
    }

    // Collisions
    handleCollisions();

    // UFO spawning
    maybeSpawnUFO(dt);

    // Wave clear?
    if (state.asteroids.length === 0 && state.waveClearTimer <= 0) {
      state.waveClearTimer = CONSTANTS.WAVE_CLEAR_DELAY_S;
    }
    if (state.waveClearTimer > 0) {
      state.waveClearTimer -= dt;
      if (state.waveClearTimer <= 0 && state.asteroids.length === 0) {
        state.wave++;
        spawnWave(state.wave);
      }
    }

    // Check for extra-life award
    checkExtraLife();

    // Game over?
    const allOut = state.players.every(p => p.lifeStatus === 'out');
    if (allOut) {
      if (isHighScore(state.score)) {
        setScene('hsentry');
      } else {
        setScene('gameover');
      }
    }
  }

  function decorativeStep(dt) {
    // Run a lightweight ambient update so attract/gameover scenes have motion
    if (state.scene === 'title' && state.asteroids.length === 0) {
      // Ensure attract has at least one large asteroid drifting
      state.asteroids.push(E.makeAsteroid({
        x: CONSTANTS.CANVAS_W / 2, y: CONSTANTS.CANVAS_H / 2,
        vx: 0, vy: 0, tier: 0
      }));
    }
    for (const a of state.asteroids) E.updateAsteroid(a, dt);
    for (let i = state.particles.length - 1; i >= 0; i--) {
      if (!E.updateParticle(state.particles[i], dt)) state.particles.splice(i, 1);
    }
  }

  // ═════════════ FIRING / HYPERSPACE ═══════════════════════════
  function fireBullet(p) {
    const ship = p.ship;
    const owner = p.slot === 1 ? 'p1' : 'p2';
    state.bullets.push(E.makeBullet({
      x: ship.x + Math.cos(ship.angle) * 18,
      y: ship.y + Math.sin(ship.angle) * 18,
      vx: ship.vx + Math.cos(ship.angle) * CONSTANTS.BULLET_SPEED,
      vy: ship.vy + Math.sin(ship.angle) * CONSTANTS.BULLET_SPEED,
      owner: owner
    }));
    p.bulletCount++;
    state.events.push({ type: 'fire' });
  }

  function spawnHyperspaceParticles(x, y) {
    for (const part of E.makeDebrisFan(x, y, CONSTANTS.HYPERSPACE_PARTICLE_COUNT)) {
      state.particles.push(part);
    }
  }

  // ═════════════ COLLISIONS ════════════════════════════════════
  function decrementBulletCount(owner) {
    const idx = owner === 'p1' ? 0 : owner === 'p2' ? 1 : -1;
    if (idx >= 0 && state.players[idx]) state.players[idx].bulletCount--;
  }

  function handleCollisions() {
    // Bullet vs asteroid
    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
      const b = state.bullets[bi];
      let hit = false;
      for (let ai = state.asteroids.length - 1; ai >= 0; ai--) {
        const a = state.asteroids[ai];
        if (P.circleHit(b.x, b.y, a.x, a.y, b.radius, a.radius)) {
          applyBulletHit(a, b, bi, ai);
          hit = true;
          break;
        }
      }
      if (hit) continue;
      // Bullet vs UFO (only player bullets)
      if (state.ufo && b.owner !== 'ufo') {
        if (P.circleHit(b.x, b.y, state.ufo.x, state.ufo.y, b.radius, state.ufo.radius)) {
          state.score += CONSTANTS.UFO_TIERS[state.ufo.tier].score;
          state.events.push({ type: 'ufoExplode' });
          state.shakeAmp = Math.max(state.shakeAmp, 6);
          for (const part of E.makeDebrisFan(state.ufo.x, state.ufo.y, CONSTANTS.UFO_EXPLODE_PARTICLE_COUNT)) {
            state.particles.push(part);
          }
          state.ufo = null;
          // remove the bullet
          decrementBulletCount(b.owner);
          state.bullets.splice(bi, 1);
        }
      }
    }

    // UFO bullet / asteroid vs ship
    for (const p of state.players) {
      if (p.lifeStatus !== 'alive' || !p.ship) continue;
      const ship = p.ship;
      if (ship.invulnTimer > 0) continue;
      // Ship vs asteroid
      for (const a of state.asteroids) {
        if (P.circleHit(ship.x, ship.y, a.x, a.y, CONSTANTS.SHIP_RADIUS, a.radius)) {
          // Refine via point-in-polygon for accuracy
          const verts = E.asteroidWorldVerts(a, performance.now() / 1000);
          if (P.pointInPolygon(ship.x, ship.y, verts) ||
              P.circleHit(ship.x, ship.y, a.x, a.y, CONSTANTS.SHIP_RADIUS - 4, a.radius)) {
            killShip(p);
            // Also break the asteroid that hit us
            applyAsteroidHit(a, state.asteroids.indexOf(a));
            break;
          }
        }
      }
      if (p.lifeStatus !== 'alive') continue;
      // Ship vs UFO
      if (state.ufo &&
          P.circleHit(ship.x, ship.y, state.ufo.x, state.ufo.y, CONSTANTS.SHIP_RADIUS, state.ufo.radius)) {
        killShip(p);
        // UFO also dies in the collision
        state.events.push({ type: 'ufoExplode' });
        for (const part of E.makeDebrisFan(state.ufo.x, state.ufo.y, CONSTANTS.UFO_EXPLODE_PARTICLE_COUNT)) {
          state.particles.push(part);
        }
        state.ufo = null;
        continue;
      }
      // Ship vs UFO bullet
      for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
        const b = state.bullets[bi];
        if (b.owner !== 'ufo') continue;
        if (P.circleHit(ship.x, ship.y, b.x, b.y, CONSTANTS.SHIP_RADIUS, b.radius)) {
          killShip(p);
          state.bullets.splice(bi, 1);
          break;
        }
      }
    }
  }

  function applyBulletHit(a, b, bulletIdx, astIdx) {
    state.score += CONSTANTS.AST_TIERS[a.tier].score;
    state.events.push({ type: 'asteroidBreak', tierName: CONSTANTS.AST_TIERS[a.tier].name });
    for (const part of E.makeDebrisFan(a.x, a.y, CONSTANTS.ASTEROID_BREAK_PARTICLE_COUNT)) {
      state.particles.push(part);
    }
    const fragments = E.splitAsteroid(a);
    state.asteroids.splice(astIdx, 1);
    for (const f of fragments) state.asteroids.push(f);
    // remove bullet + decrement owner count
    decrementBulletCount(b.owner);
    state.bullets.splice(bulletIdx, 1);
  }

  function applyAsteroidHit(a, astIdx) {
    if (astIdx < 0) return;
    state.events.push({ type: 'asteroidBreak', tierName: CONSTANTS.AST_TIERS[a.tier].name });
    for (const part of E.makeDebrisFan(a.x, a.y, CONSTANTS.ASTEROID_BREAK_PARTICLE_COUNT)) {
      state.particles.push(part);
    }
    const fragments = E.splitAsteroid(a);
    state.asteroids.splice(astIdx, 1);
    for (const f of fragments) state.asteroids.push(f);
  }

  function killShip(p) {
    if (p.lifeStatus !== 'alive') return;
    state.events.push({ type: 'shipExplode' });
    state.shakeAmp = R.prefersReducedMotion() ? 0 : Math.max(state.shakeAmp, 10);
    if (p.ship) {
      for (const part of E.makeDebrisFan(p.ship.x, p.ship.y, CONSTANTS.SHIP_EXPLODE_PARTICLE_COUNT)) {
        state.particles.push(part);
      }
      p.ship.alive = false;
    }
    p.lives--;
    if (p.lives > 0) {
      p.lifeStatus = 'waiting';
      p.respawnTimer = 1.5;
      // Hit-pause is the brief between-death-and-respawn freeze; only fires if the round continues.
      state.hitPauseFrames = R.prefersReducedMotion() ? 0 : CONSTANTS.HIT_PAUSE_FRAMES;
    } else {
      p.lifeStatus = 'out';
      // Final death — no hit-pause; let the scene transition fire immediately.
    }
  }

  function respawnShip(p) {
    p.ship = E.makeShip({ slot: p.slot, x: CONSTANTS.CANVAS_W / 2, y: CONSTANTS.CANVAS_H / 2 });
    p.lifeStatus = 'alive';
    p.bulletCount = 0;
    p.forceRespawnTimer = 0;
  }

  function centerIsClear() {
    const cx = CONSTANTS.CANVAS_W / 2, cy = CONSTANTS.CANVAS_H / 2;
    for (const a of state.asteroids) {
      const dx = a.x - cx, dy = a.y - cy;
      if (dx * dx + dy * dy < (CONSTANTS.SHIP_RESPAWN_CLEAR_RADIUS + a.radius) ** 2) return false;
    }
    if (state.ufo) {
      const dx = state.ufo.x - cx, dy = state.ufo.y - cy;
      if (dx * dx + dy * dy < (CONSTANTS.SHIP_RESPAWN_CLEAR_RADIUS + state.ufo.radius) ** 2) return false;
    }
    return true;
  }

  // ═════════════ WAVE / UFO SPAWNING ═══════════════════════════
  function spawnWave(n) {
    const count = CONSTANTS.WAVE_COUNT(n);
    state.asteroidsAtWaveStart = count;
    state.waveClearTimer = 0;
    const cx = CONSTANTS.CANVAS_W / 2, cy = CONSTANTS.CANVAS_H / 2;
    const safeRadius = CONSTANTS.SHIP_RESPAWN_CLEAR_RADIUS + 100;
    const tier = 0;  // all spawn as large
    for (let i = 0; i < count; i++) {
      // Spawn at edges, away from center
      let x, y, tries = 0;
      do {
        x = Math.random() * CONSTANTS.CANVAS_W;  // rng:v2-daily-seed will replace
        y = Math.random() * CONSTANTS.CANVAS_H;  // rng:v2-daily-seed will replace
        tries++;
      } while (((x - cx) ** 2 + (y - cy) ** 2 < safeRadius * safeRadius) && tries < 8);
      const angle = Math.random() * Math.PI * 2;  // rng:v2-daily-seed will replace
      const speed = P.randRange(CONSTANTS.AST_TIERS[tier].speed[0], CONSTANTS.AST_TIERS[tier].speed[1]);
      state.asteroids.push(E.makeAsteroid({
        x: x, y: y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        tier: tier
      }));
    }
    // Reset UFO timer for the new wave
    state.ufoSpawnTimer = P.randRange(CONSTANTS.UFO_SPAWN_INTERVAL_S[0], CONSTANTS.UFO_SPAWN_INTERVAL_S[1]);
  }

  function maybeSpawnUFO(dt) {
    if (state.ufo) return;
    state.ufoSpawnTimer -= dt;
    if (state.ufoSpawnTimer > 0) return;
    // Pick tier: small UFO above its score gate, otherwise large
    let tier = 0;
    if (state.score >= CONSTANTS.UFO_TIERS[1].spawnAfterScore && Math.random() < 0.4) {
      tier = 1;  // rng:v2-daily-seed will replace
    }
    state.ufo = E.makeUFO({ tier: tier });
    state.ufoSpawnTimer = P.randRange(CONSTANTS.UFO_SPAWN_INTERVAL_S[0], CONSTANTS.UFO_SPAWN_INTERVAL_S[1]);
  }

  function checkExtraLife() {
    const earned = Math.floor(state.score / CONSTANTS.EXTRA_LIFE_EVERY);
    if (earned > extraLifeTier) {
      extraLifeTier = earned;
      // Award to all players (shared score, but each gets +1 life)
      for (const p of state.players) p.lives++;
      state.events.push({ type: 'extraLife' });
    }
  }

  // ═════════════ DRAW SCENE ════════════════════════════════════
  function drawScene() {
    const t = performance.now() / 1000;
    // Always draw entities (even on overlay scenes — overlay covers them)
    for (const a of state.asteroids) R.drawAsteroid(a, t);
    for (const b of state.bullets) R.drawBullet(b);
    for (const p of state.players) {
      if (!p.ship) continue;
      if (p.ship.invulnTimer > 0) R.drawShipShadowy(p.ship, t);
      else R.drawShip(p.ship);
    }
    if (state.ufo) R.drawUFO(state.ufo);
    for (const part of state.particles) R.drawParticle(part);
  }

  // ═════════════ STORAGE ═══════════════════════════════════════
  function loadHighScores() {
    try {
      const raw = localStorage.getItem(HS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function saveHighScore(entry) {
    const list = loadHighScores();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    list.length = Math.min(list.length, CONSTANTS.HIGHSCORE_TOP_N);
    try { localStorage.setItem(HS_KEY, JSON.stringify(list)); } catch (_) {}
  }

  function isHighScore(score) {
    if (score <= 0) return false;
    const list = loadHighScores();
    return list.length < CONSTANTS.HIGHSCORE_TOP_N
      || score > (list[list.length - 1] ? list[list.length - 1].score : 0);
  }

  function computeRank(score) {
    const list = loadHighScores();
    let i = 0;
    while (i < list.length && list[i].score >= score) i++;
    return i;
  }

  // ═════════════ KEY HANDLER (meta + scene-specific) ═══════════
  function handleKey(e) {
    if (e.repeat) return;
    const code = e.code;

    // Global meta keys
    if (code === 'KeyM') {
      U.toggleMute();
      return;
    }

    if (state.scene === 'title') {
      if (code === 'Space' || code === 'Enter') {
        // Read which mode button is currently active (defaults to SOLO)
        const coopBtn = document.querySelector('#overlay-title .mode-btn[data-active="true"]');
        const coop = coopBtn && coopBtn.textContent.trim() === 'CO-OP';
        startNewGame(coop);
      } else if (code === 'ArrowLeft' || code === 'ArrowRight') {
        // Toggle SOLO ↔ CO-OP
        const btns = document.querySelectorAll('#overlay-title .mode-btn');
        const activeIdx = Array.from(btns).findIndex(b => b.dataset.active === 'true');
        const nextIdx = (activeIdx + 1) % btns.length;
        btns.forEach((b, i) => b.dataset.active = (i === nextIdx) ? 'true' : 'false');
      }
      return;
    }

    if (state.scene === 'bind') {
      if (code === 'Enter') {
        const p1Bound = state.players[0] && (state.players[0].input.scheme || state.players[0].input.gamepadIndex != null);
        const p2Bound = !state.coop || (state.players[1] && (state.players[1].input.scheme || state.players[1].input.gamepadIndex != null));
        if (p1Bound && p2Bound) enterPlaying();
      } else if (code === 'Escape') {
        I.releaseAll();
        setScene('title');
      }
      return;
    }

    if (state.scene === 'playing') {
      if (code === 'KeyP' || code === 'Escape') pauseGame();
      return;
    }

    if (state.scene === 'paused') {
      if (code === 'KeyP' || code === 'Escape') resumeFromPause();
      else if (code === 'KeyR') restartFromPause();
      return;
    }

    if (state.scene === 'gameover') {
      if (code === 'KeyR' || code === 'Enter') startNewGame(state.coop);
      else if (code === 'Space') setScene('hstable');
      else if (code === 'Escape') quitToTitle();
      return;
    }

    if (state.scene === 'hsentry') {
      const done = U.updateHsEntry(state, code);
      if (done) {
        const e2 = state.hsEntry;
        const initials = e2.initials.join('');
        const date = new Date();
        const dateStr = String(date.getMonth() + 1).padStart(2, '0') + '·' + String(date.getDate()).padStart(2, '0');
        saveHighScore({ initials: initials, score: state.score, wave: state.wave, date: dateStr });
        setScene('hstable');
      }
      return;
    }

    if (state.scene === 'hstable') {
      if (code === 'Space' || code === 'Enter' || code === 'Escape') quitToTitle();
      return;
    }
  }

  // ═════════════ PUBLIC API ════════════════════════════════════
  // Re-attach the public surface (CONSTANTS already exposed at top of file)
  window.AsteroidsGame = Object.assign(window.AsteroidsGame, {
    init: init,
    startNewGame: startNewGame,
    pauseGame: pauseGame,
    resumeFromPause: resumeFromPause,
    restartFromPause: restartFromPause,
    quitToTitle: quitToTitle,
    loadHighScores: loadHighScores,
    saveHighScore: saveHighScore,
    isHighScore: isHighScore,
    computeRank: computeRank,
    getState: () => state
  });
})();
