/**
 * Fishing — audio bus with procedurally synthesized cues.
 *
 * v1 ships without bundled wav files. Every cue is generated via Web Audio
 * primitives (oscillators, filtered noise, envelopes). Avoids any IP risk
 * and keeps the build static. ADR-020 §7 explicitly allows chiptune-leaning
 * menu blips and basic synthesis for water/splash (filtered noise, not 8-bit).
 *
 * Music is intentionally absent in v1. The bus is wired so a CC0 loop can be
 * dropped in later by setting SAMPLES.music_loop and calling startMusic().
 *
 * Public API (window.FishingAudio):
 *   resume()              — call from a user gesture to unlock the AudioContext.
 *   play(name, opts?)     — fire a cue. opts: { volume, pitch }.
 *   startCharge() / stopCharge() — start/stop the charge-tone drone.
 *   setVolume(bus, value) — bus ∈ {master, sfx}; value 0..1.
 *   isUnlocked()          — true once a user gesture has resumed the context.
 */
(function () {
  'use strict';

  let ctx = null;
  let master = null;
  const gains = {};
  let unlocked = false;
  const volumes = { master: 0.7, sfx: 0.85 };

  let chargeOsc = null;
  let chargeGain = null;

  function ensureCtx() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = volumes.master;
    master.connect(ctx.destination);
    gains.sfx = ctx.createGain();
    gains.sfx.gain.value = volumes.sfx;
    gains.sfx.connect(master);
    return ctx;
  }

  function resume() {
    ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
  }

  // ── Synth primitives ─────────────────────────────────────────
  function envGain(start, attack, decay, peak, sustain) {
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + attack + decay);
    return g;
  }

  function quickEnv(peak, attack, decay) {
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  function noiseBuffer(duration) {
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── Cue implementations ──────────────────────────────────────

  function fireBlip(freq, duration, type, peak) {
    const osc = ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    const env = quickEnv(peak || 0.18, 0.005, duration);
    osc.connect(env).connect(gains.sfx);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  function fireSweep(f0, f1, duration, type, peak) {
    const osc = ctx.createOscillator();
    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(f0, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), ctx.currentTime + duration);
    const env = quickEnv(peak || 0.2, 0.005, duration);
    osc.connect(env).connect(gains.sfx);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  function fireNoise(duration, lowpass, peak, attack) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(duration + 0.1);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const env = quickEnv(peak || 0.3, attack || 0.01, duration);
    src.connect(filter).connect(env).connect(gains.sfx);
    src.start();
    src.stop(ctx.currentTime + duration + 0.1);
  }

  function fireSplash() {
    // Filtered noise burst with a quick lowpass sweep for a plosive splash
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.4);
    const env = quickEnv(0.32, 0.005, 0.4);
    src.connect(filter).connect(env).connect(gains.sfx);
    src.start();
    src.stop(ctx.currentTime + 0.5);
  }

  function fireCoin() {
    // Two quick rising blips
    fireBlip(660, 0.06, 'square', 0.16);
    setTimeout(() => fireBlip(880, 0.10, 'square', 0.20), 65);
  }

  function fireCatchLand() {
    // Triumphant short three-note sting
    const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
    notes.forEach((f, i) => {
      setTimeout(() => fireBlip(f, 0.15, 'triangle', 0.18), i * 90);
    });
  }

  function fireRareSting() {
    // Higher, longer sparkle
    const notes = [880, 1108.73, 1318.51, 1760]; // A5 C#6 E6 A6
    notes.forEach((f, i) => {
      setTimeout(() => fireBlip(f, 0.18, 'triangle', 0.16), i * 70);
    });
  }

  function fireStrikeThump() {
    // Low thump (sub-bass click) + filtered noise crack
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.18);
    const env = quickEnv(0.45, 0.003, 0.20);
    osc.connect(env).connect(gains.sfx);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    fireNoise(0.05, 1200, 0.12, 0.001);
  }

  function fireLineSnap() {
    // High-pitched twang with rapid downward sweep
    fireSweep(1800, 200, 0.18, 'sawtooth', 0.22);
    fireNoise(0.08, 4000, 0.10, 0.001);
  }

  function fireReelTick() {
    fireBlip(660, 0.025, 'square', 0.06);
  }

  function fireReelWarn() {
    fireBlip(420, 0.10, 'sawtooth', 0.18);
  }

  function fireMenuMove() { fireBlip(440, 0.04, 'square', 0.10); }
  function fireMenuConfirm() { fireBlip(660, 0.06, 'square', 0.14); setTimeout(() => fireBlip(880, 0.08, 'square', 0.14), 50); }
  function fireMenuBack() { fireBlip(330, 0.06, 'square', 0.12); }

  function fireBobberJerk() {
    // Quick wood-knock — short low blip
    fireBlip(180, 0.05, 'sine', 0.18);
  }

  function fireCastRelease() {
    // Whip: quick high-to-low noise sweep with filter motion
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.18);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 8;
    filter.frequency.setValueAtTime(3000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.16);
    const env = quickEnv(0.22, 0.005, 0.15);
    src.connect(filter).connect(env).connect(gains.sfx);
    src.start();
    src.stop(ctx.currentTime + 0.2);
  }

  // Continuous charge tone — held while the player charges a cast.
  function startCharge() {
    if (!unlocked || chargeOsc) return;
    chargeOsc = ctx.createOscillator();
    chargeOsc.type = 'sine';
    chargeOsc.frequency.setValueAtTime(220, ctx.currentTime);
    chargeOsc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 1.2);
    chargeGain = ctx.createGain();
    chargeGain.gain.setValueAtTime(0, ctx.currentTime);
    chargeGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.05);
    chargeOsc.connect(chargeGain).connect(gains.sfx);
    chargeOsc.start();
  }

  function stopCharge() {
    if (!chargeOsc) return;
    const t = ctx.currentTime;
    chargeGain.gain.cancelScheduledValues(t);
    chargeGain.gain.setValueAtTime(chargeGain.gain.value, t);
    chargeGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    chargeOsc.stop(t + 0.08);
    chargeOsc = null;
    chargeGain = null;
  }

  // ── Cue dispatch ─────────────────────────────────────────────
  const CUES = {
    cast_release:  fireCastRelease,
    splash:        fireSplash,
    strike_thump:  fireStrikeThump,
    bobber_jerk:   fireBobberJerk,
    reel_tick:     fireReelTick,
    reel_warn:     fireReelWarn,
    line_snap:     fireLineSnap,
    catch_land:    fireCatchLand,
    rare_sting:    fireRareSting,
    menu_move:     fireMenuMove,
    menu_confirm:  fireMenuConfirm,
    menu_back:     fireMenuBack,
    coin:          fireCoin,
  };

  function play(name) {
    if (!unlocked) return;
    const fn = CUES[name];
    if (fn) fn();
  }

  function setVolume(bus, value) {
    const v = Math.max(0, Math.min(1, value));
    volumes[bus] = v;
    if (!ctx) return;
    if (bus === 'master' && master) master.gain.value = v;
    else if (gains[bus]) gains[bus].gain.value = v;
  }

  function isUnlocked() { return unlocked; }

  // Music API — no-op in v1; here for forward compat.
  function startMusic() { /* placeholder until a CC0 loop is bundled */ }
  function stopMusic()  { /* placeholder */ }

  window.FishingAudio = {
    resume, play, startCharge, stopCharge,
    startMusic, stopMusic,
    setVolume, isUnlocked,
  };
})();
