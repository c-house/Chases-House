/* ═══════════════════════════════════════════════════════════════
   Asteroids — audio.js
   Pure Web Audio synthesis. Pac-Man-derived bus structure (master →
   sfxBus + beatBus + sirenBus). Replaces sample-buffer playback with
   oscillators and noise buffers + envelopes.

   sync(state) drains state.events (review fix #1: ONLY audio drains).
   Manages two periodic-tone loops: heartbeat (tempo lerps with wave
   completion) and UFO siren (active when any UFO exists).

   Mute persistence is OWNED BY ui.js (not audio.js) — matches Pac-Man.
   Exposes window.AsteroidsAudio.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let ctx = null;
  let master = null;
  let sfxBus = null;
  let beatBus = null;
  let sirenBus = null;
  let enabled = true;
  let masterVolume = 0.7;
  let noiseBuffer = null;        // 1s of white noise — reusable
  let brownNoiseBuffer = null;   // 1s of brown noise (lower-frequency content)

  // Heartbeat state (driven from sync(state))
  let beatPhase = 0;
  let beatNoteIndex = 0;
  let lastSyncTs = null;

  // UFO siren state
  let sirenOsc = null;
  let sirenLFO = null;
  let sirenLFOGain = null;
  let sirenActive = false;

  function K() { return window.AsteroidsGame.CONSTANTS; }

  function ensure() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = enabled ? masterVolume : 0;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();   sfxBus.gain.value = 1.0;   sfxBus.connect(master);
    beatBus = ctx.createGain();  beatBus.gain.value = 1.0;  beatBus.connect(master);
    sirenBus = ctx.createGain(); sirenBus.gain.value = 0;   sirenBus.connect(master);
    noiseBuffer = makeWhiteNoiseBuffer(1.0);
    brownNoiseBuffer = makeBrownNoiseBuffer(1.0);
    return ctx;
  }

  function resume() {
    if (!ctx) ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(m) {
    enabled = !m;
    if (master) master.gain.value = enabled ? masterVolume : 0;
  }
  function isMuted() { return !enabled; }
  function setVolume(v) {
    masterVolume = Math.max(0, Math.min(1, v));
    if (master && enabled) master.gain.value = masterVolume;
  }

  // ── noise buffers ─────────────────────────────────────────
  function makeWhiteNoiseBuffer(seconds) {
    const sampleRate = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sampleRate * seconds, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function makeBrownNoiseBuffer(seconds) {
    const sampleRate = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sampleRate * seconds, sampleRate);
    const data = buf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;  // gain-up to compensate for the LP filtering
    }
    return buf;
  }

  // ── envelope helpers ──────────────────────────────────────
  // Quick attack (5ms) + linear release for one-shot SFX.
  function envelopedGain(peak, durationS, attackS) {
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    const a = attackS != null ? attackS : 0.005;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.linearRampToValueAtTime(0, t0 + durationS);
    return g;
  }

  function safeStop(node, when) {
    try { node.stop(when); } catch (_) {}
  }

  // ── one-shot synth recipes ────────────────────────────────

  // fire — sawtooth 880 Hz → 220 Hz exp, 80 ms
  function playFire() {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.08);
    const g = envelopedGain(0.32, 0.08);
    osc.connect(g); g.connect(sfxBus);
    osc.start(t0); safeStop(osc, t0 + 0.1);
  }

  // ufoFire — slightly bassier square wave
  function playUfoFire() {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, t0);
    osc.frequency.exponentialRampToValueAtTime(80, t0 + 0.1);
    const g = envelopedGain(0.24, 0.1);
    osc.connect(g); g.connect(sfxBus);
    osc.start(t0); safeStop(osc, t0 + 0.12);
  }

  // thrust — short brown-noise burst through bandpass @ 250 Hz
  let lastThrustTs = -Infinity;
  function playThrust() {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime;
    if (t0 - lastThrustTs < 0.06) return;  // rate-limit
    lastThrustTs = t0;
    const src = ctx.createBufferSource();
    src.buffer = brownNoiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 250;
    filter.Q.value = 2;
    const g = envelopedGain(0.18, 0.06);
    src.connect(filter); filter.connect(g); g.connect(sfxBus);
    src.start(t0); safeStop(src, t0 + 0.08);
  }

  // asteroid break — noise burst, bandpass tuned per tier
  // tierName: 'large' | 'medium' | 'small'
  function playAsteroidBreak(tierName) {
    if (!ctx || !enabled) return;
    const tuning = {
      large:  { hz: 200, decay: 0.25, peak: 0.45 },
      medium: { hz: 350, decay: 0.18, peak: 0.40 },
      small:  { hz: 600, decay: 0.12, peak: 0.35 }
    }[tierName] || { hz: 350, decay: 0.18, peak: 0.40 };
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = tuning.hz;
    filter.Q.value = 1.5;
    const g = envelopedGain(tuning.peak, tuning.decay);
    src.connect(filter); filter.connect(g); g.connect(sfxBus);
    src.start(t0); safeStop(src, t0 + tuning.decay + 0.02);
  }

  // ship explode — combined brown noise + descending square 200→40 Hz over 600ms
  function playShipExplode() {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime;
    // noise component
    const src = ctx.createBufferSource();
    src.buffer = brownNoiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 150; f.Q.value = 1.0;
    const ng = envelopedGain(0.5, 0.8, 0.01);
    src.connect(f); f.connect(ng); ng.connect(sfxBus);
    src.start(t0); safeStop(src, t0 + 0.85);
    // descending square
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.6);
    const og = envelopedGain(0.3, 0.6, 0.01);
    osc.connect(og); og.connect(sfxBus);
    osc.start(t0); safeStop(osc, t0 + 0.62);
  }

  function playUfoExplode() {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = brownNoiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 250; f.Q.value = 1.2;
    const ng = envelopedGain(0.42, 0.5, 0.01);
    src.connect(f); f.connect(ng); ng.connect(sfxBus);
    src.start(t0); safeStop(src, t0 + 0.55);
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(280, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.4);
    const og = envelopedGain(0.26, 0.4, 0.01);
    osc.connect(og); og.connect(sfxBus);
    osc.start(t0); safeStop(osc, t0 + 0.42);
  }

  // hyperspace — sine sweep 110 → 1100 Hz with vibrato (5 Hz LFO ±20 Hz)
  function playHyperspace() {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t0);
    osc.frequency.exponentialRampToValueAtTime(1100, t0 + 0.2);
    // vibrato LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 5;
    const lfoG = ctx.createGain(); lfoG.gain.value = 20;
    lfo.connect(lfoG); lfoG.connect(osc.frequency);
    const g = envelopedGain(0.3, 0.22);
    osc.connect(g); g.connect(sfxBus);
    osc.start(t0); lfo.start(t0);
    safeStop(osc, t0 + 0.24); safeStop(lfo, t0 + 0.24);
  }

  // extra life — 3-note arpeggio
  function playExtraLife() {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime;
    const notes = [660, 880, 1320];
    for (let i = 0; i < notes.length; i++) {
      const start = t0 + i * 0.085;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = notes[i];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.22, start + 0.005);
      g.gain.linearRampToValueAtTime(0, start + 0.08);
      osc.connect(g); g.connect(sfxBus);
      osc.start(start); safeStop(osc, start + 0.1);
    }
  }

  // ── heartbeat (loop) ──────────────────────────────────────
  // Two-note alternating thump driven from sync(state). Tempo lerps
  // BEAT_INTERVAL_MAX_S → BEAT_INTERVAL_MIN_S based on wave depletion.
  function tickHeartbeat(state, dtRealSeconds) {
    if (!ctx || !enabled) return;
    if (state.scene !== 'playing') {
      beatPhase = 0; beatNoteIndex = 0;
      return;
    }
    if (state.asteroidsAtWaveStart <= 0) return;
    const remaining = state.asteroids.length;
    const cleared = state.asteroidsAtWaveStart - remaining;
    const t = Math.min(1, Math.max(0, cleared / state.asteroidsAtWaveStart));
    // lerp from MAX (sparse) to MIN (full clear pressure)
    const interval = K().BEAT_INTERVAL_MAX_S
      + (K().BEAT_INTERVAL_MIN_S - K().BEAT_INTERVAL_MAX_S) * t;

    beatPhase += dtRealSeconds;
    if (beatPhase >= interval) {
      beatPhase = 0;
      const hz = beatNoteIndex === 0 ? K().BEAT_LOW_HZ : K().BEAT_HIGH_HZ;
      beatNoteIndex = 1 - beatNoteIndex;
      thumpNote(hz);
    }
  }

  function thumpNote(hz) {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.45, t0 + 0.005);
    g.gain.linearRampToValueAtTime(0, t0 + 0.08);
    osc.connect(g); g.connect(beatBus);
    osc.start(t0); safeStop(osc, t0 + 0.1);
  }

  // ── UFO siren (loop) ──────────────────────────────────────
  function startSiren() {
    if (!ctx || sirenActive) return;
    sirenActive = true;
    const t0 = ctx.currentTime;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 440;
    sirenLFO = ctx.createOscillator();
    sirenLFO.type = 'sawtooth';
    sirenLFO.frequency.value = 4;
    sirenLFOGain = ctx.createGain();
    sirenLFOGain.gain.value = 60;
    sirenLFO.connect(sirenLFOGain); sirenLFOGain.connect(sirenOsc.frequency);
    sirenOsc.connect(sirenBus);
    sirenOsc.start(t0); sirenLFO.start(t0);
    sirenBus.gain.cancelScheduledValues(t0);
    sirenBus.gain.linearRampToValueAtTime(0.18, t0 + 0.08);
  }

  function stopSiren() {
    if (!ctx || !sirenActive) return;
    sirenActive = false;
    const t0 = ctx.currentTime;
    sirenBus.gain.cancelScheduledValues(t0);
    sirenBus.gain.linearRampToValueAtTime(0, t0 + 0.08);
    const osc = sirenOsc, lfo = sirenLFO;
    sirenOsc = null; sirenLFO = null; sirenLFOGain = null;
    setTimeout(() => { safeStop(osc); safeStop(lfo); }, 120);
  }

  // ── sync — drains state.events, manages loops ────────────
  function sync(state) {
    // Always drain events to prevent unbounded accumulation while muted (C4).
    if (state.events && state.events.length) {
      if (ctx && enabled) {
        for (const ev of state.events) {
          if (ev.type === 'fire') playFire();
          else if (ev.type === 'thrust') playThrust();
          else if (ev.type === 'asteroidBreak') playAsteroidBreak(ev.tierName);
          else if (ev.type === 'shipExplode') playShipExplode();
          else if (ev.type === 'ufoExplode') playUfoExplode();
          else if (ev.type === 'ufoFire') playUfoFire();
          else if (ev.type === 'hyperspace') playHyperspace();
          else if (ev.type === 'extraLife') playExtraLife();
        }
      }
      state.events.length = 0;
    }

    if (!ctx || !enabled) return;

    // Real-time delta for heartbeat tempo (independent of game tick rate)
    const now = performance.now();
    const dtReal = lastSyncTs == null ? 0 : (now - lastSyncTs) / 1000;
    lastSyncTs = now;

    // UFO siren — active when any UFO is on screen and we're playing
    const wantSiren = state.scene === 'playing' && !!state.ufo;
    if (wantSiren && !sirenActive) startSiren();
    else if (!wantSiren && sirenActive) stopSiren();

    // Heartbeat tick (also stops between waves / pause / not playing)
    tickHeartbeat(state, dtReal);
  }

  // For UI sounds outside the game loop (menu confirm, etc.)
  function playEvent(type) {
    if (type === 'fire') playFire();
    else if (type === 'extraLife') playExtraLife();
  }

  function resetForNewGame() {
    beatPhase = 0; beatNoteIndex = 0;
    lastSyncTs = null;
    stopSiren();
  }

  window.AsteroidsAudio = {
    ensure: ensure, resume: resume,
    setMuted: setMuted, isMuted: isMuted, setVolume: setVolume,
    sync: sync, playEvent: playEvent, resetForNewGame: resetForNewGame
  };
})();
