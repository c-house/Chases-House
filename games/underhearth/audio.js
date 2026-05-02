/* ═══════════════════════════════════════════════════════════════════════
   Underhearth — audio.js
   Web Audio synthesis bus. ~10 one-shot SFX, all generated in-process —
   no asset files, no loading, no licensing. Trims Pac-Man's pattern by
   dropping music loops (Underhearth has no music in v1 per ADR §7).
   First-input gate: ensure() is idempotent and only creates the context
   once a user gesture has unlocked autoplay.
   Settings persisted to localStorage 'underhearth-settings' (v: 1).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const KEY = 'underhearth-settings';
  const DEFAULTS = { v: 1, muted: false, volume: 0.5 };
  let settings = load();

  let ctx = null;
  let master = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1) return Object.assign({}, DEFAULTS);
      return parsed;
    } catch (_) { return Object.assign({}, DEFAULTS); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {}
  }

  function ensure() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = settings.muted ? 0 : settings.volume;
    master.connect(ctx.destination);
    return ctx;
  }
  function resume() {
    if (!ctx) ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  // ── Synthesis primitives ───────────────────────────────────────────────
  function tone(freq, duration, opts) {
    if (!ctx || settings.muted) return;
    opts = opts || {};
    const o = ctx.createOscillator();
    o.type = opts.type || 'sine';
    const g = ctx.createGain();
    const now = ctx.currentTime;
    const peak = (opts.peak != null ? opts.peak : 0.4);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    if (opts.endFreq != null) {
      o.frequency.setValueAtTime(freq, now);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), now + duration);
    } else {
      o.frequency.value = freq;
    }
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + duration + 0.05);
  }

  function noiseBurst(duration, opts) {
    if (!ctx || settings.muted) return;
    opts = opts || {};
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.7;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter || 'lowpass';
    filter.frequency.value = opts.cutoff || 1200;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    const peak = (opts.peak != null ? opts.peak : 0.3);
    g.gain.setValueAtTime(peak, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  // ── Named SFX dispatch ─────────────────────────────────────────────────
  function play(name, _opts) {
    if (!ctx) ensure();
    if (!ctx || settings.muted) return;
    resume();
    switch (name) {
      case 'footstep':  noiseBurst(0.04, { cutoff: 600, peak: 0.18 }); break;
      case 'hit':       tone(220, 0.10, { type: 'square', peak: 0.35, endFreq: 110 }); break;
      case 'crit':      tone(440, 0.18, { type: 'sawtooth', peak: 0.5, endFreq: 110 }); tone(660, 0.18, { type: 'square', peak: 0.25, endFreq: 220 }); break;
      case 'miss':      noiseBurst(0.06, { cutoff: 2200, peak: 0.2 }); break;
      case 'kill':      tone(330, 0.20, { type: 'triangle', peak: 0.4, endFreq: 80 }); break;
      case 'pickup':    tone(660, 0.08, { type: 'sine', peak: 0.3 }); tone(990, 0.08, { type: 'sine', peak: 0.2 }); break;
      case 'gold':      tone(880, 0.08, { type: 'sine', peak: 0.35 }); tone(1320, 0.10, { type: 'sine', peak: 0.25 }); break;
      case 'quaff':     tone(330, 0.18, { type: 'sine', peak: 0.3, endFreq: 660 }); break;
      case 'read':      tone(440, 0.16, { type: 'triangle', peak: 0.3 }); tone(550, 0.10, { type: 'triangle', peak: 0.2 }); break;
      case 'stairs':    tone(330, 0.15, { type: 'triangle', peak: 0.35, endFreq: 220 }); break;
      case 'heartbeat': tone(80, 0.10, { type: 'sine', peak: 0.6 }); setTimeout(() => tone(60, 0.12, { type: 'sine', peak: 0.45 }), 140); break;
      case 'death':     tone(220, 0.40, { type: 'sawtooth', peak: 0.45, endFreq: 55 }); setTimeout(() => tone(110, 0.60, { type: 'sine', peak: 0.35, endFreq: 35 }), 200); break;
      case 'win':       tone(523, 0.15, { type: 'triangle', peak: 0.4 }); setTimeout(() => tone(659, 0.15, { type: 'triangle', peak: 0.4 }), 130); setTimeout(() => tone(784, 0.30, { type: 'triangle', peak: 0.5 }), 260); break;
      case 'ghost':     tone(220, 0.25, { type: 'sine', peak: 0.3 }); tone(330, 0.30, { type: 'sine', peak: 0.2 }); break;
      case 'identify':  tone(660, 0.12, { type: 'sine', peak: 0.3 }); setTimeout(() => tone(880, 0.20, { type: 'sine', peak: 0.35 }), 100); break;
    }
  }

  function setMuted(m) {
    settings.muted = !!m;
    if (master) master.gain.value = settings.muted ? 0 : settings.volume;
    save();
  }
  function isMuted() { return !!settings.muted; }
  function setVolume(v) {
    settings.volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = settings.muted ? 0 : settings.volume;
    save();
  }
  function getVolume() { return settings.volume; }

  window.UnderhearthAudio = {
    ensure, resume, play,
    setMuted, isMuted, setVolume, getVolume,
  };
})();
