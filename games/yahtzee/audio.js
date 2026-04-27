// ── Yahtzee · Audio ───────────────────────────────────────────────────
//
// Web Audio bus: source → (sfx | music) → master → destination. Lazy
// AudioContext via ensure(); call resume() inside the first user gesture
// to satisfy autoplay policies. SFX are synthesized (oscillators + a
// short noise burst for dice clicks) — no external sample files. The
// module owns its own localStorage persistence under 'yahtzee-audio'.

(function () {
  'use strict';

  window.Yahtzee = window.Yahtzee || {};

  const PREFS_KEY = 'yahtzee-audio';

  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let muted = false;
  let sfxVolume = 0.55;
  let musicVolume = 0.35;

  // ── Persistence (read on module load, written on any change) ────────

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p.muted === 'boolean') muted = p.muted;
      if (typeof p.sfxVolume === 'number') sfxVolume = clamp01(p.sfxVolume);
      if (typeof p.musicVolume === 'number') musicVolume = clamp01(p.musicVolume);
    } catch (_) { /* ignore */ }
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ muted, sfxVolume, musicVolume }));
    } catch (_) { /* ignore quota */ }
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  // ── AudioContext lifecycle ──────────────────────────────────────────

  function ensure() {
    if (ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return; // browser unsupported — degrade silently
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVolume;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = musicVolume;
    musicBus.connect(master);
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ── Synth primitives ────────────────────────────────────────────────

  function tone(freq, duration, opts) {
    if (!ctx || muted) return;
    opts = opts || {};
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type || 'sine';
    const start = ctx.currentTime + (opts.delay || 0);
    o.frequency.setValueAtTime(freq, start);
    if (opts.frequencyEnd) {
      o.frequency.linearRampToValueAtTime(opts.frequencyEnd, start + duration);
    }
    const peak = opts.gain != null ? opts.gain : 0.4;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + Math.min(0.015, duration * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0008, start + duration);
    o.connect(g);
    g.connect(sfxBus);
    o.start(start);
    o.stop(start + duration + 0.05);
  }

  function noise(duration, opts) {
    if (!ctx || muted) return;
    opts = opts || {};
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type || 'bandpass';
    filter.frequency.value = opts.cutoff || 1500;
    filter.Q.value = opts.q || 1;
    const g = ctx.createGain();
    g.gain.value = opts.gain != null ? opts.gain : 0.3;
    const start = ctx.currentTime + (opts.delay || 0);
    src.connect(filter);
    filter.connect(g);
    g.connect(sfxBus);
    src.start(start);
  }

  // ── SFX inventory ───────────────────────────────────────────────────
  // Each entry is a function that schedules its own envelope on the
  // shared sfx bus. Keep them short — total runtime should not exceed
  // ~1.5s except for `yahtzee` which is the signature moment.

  const SFX = {
    diceRoll: function () {
      noise(0.34, { type: 'bandpass', cutoff: 1100, q: 1.2, gain: 0.45 });
      noise(0.18, { type: 'highpass', cutoff: 2200, gain: 0.18, delay: 0.04 });
    },
    dieLand: function () {
      noise(0.05, { type: 'bandpass', cutoff: 2400, gain: 0.5 });
      tone(180, 0.06, { type: 'square', gain: 0.18 });
    },
    holdSnap: function () {
      tone(880, 0.07, { type: 'square', frequencyEnd: 1320, gain: 0.22 });
      tone(1320, 0.06, { type: 'triangle', gain: 0.16, delay: 0.04 });
    },
    holdRelease: function () {
      tone(660, 0.08, { type: 'square', frequencyEnd: 440, gain: 0.20 });
    },
    hover: function () {
      // Cozy menu blip — soft two-note "tink" with a gentle exponential
      // decay. Tuned warm (E5 + B5, a perfect fifth) and quiet so a quick
      // sweep across rows lands as a wind-chime, not a buzzer.
      tone(659.25, 0.085, { type: 'sine',     gain: 0.075 });
      tone(987.77, 0.065, { type: 'triangle', gain: 0.030, delay: 0.012 });
    },
    nav: function () {
      tone(800, 0.03, { type: 'square', gain: 0.14 });
    },
    confirm: function () {
      tone(1000, 0.07, { type: 'triangle', frequencyEnd: 1600, gain: 0.22 });
    },
    commit: function () {
      // Warm bakelite triad — major chord.
      tone(523.25, 0.45, { type: 'sine', gain: 0.30 });
      tone(659.25, 0.45, { type: 'sine', gain: 0.26, delay: 0.02 });
      tone(783.99, 0.45, { type: 'sine', gain: 0.22, delay: 0.04 });
    },
    upperBonus: function () {
      // Rising flourish — IV → V → I cadence on the upper register.
      const notes = [523.25, 659.25, 783.99, 1046.5];
      for (let i = 0; i < notes.length; i++) {
        tone(notes[i], 0.18, { type: 'triangle', gain: 0.28, delay: i * 0.10 });
      }
      tone(1046.5, 0.5, { type: 'sine', gain: 0.30, delay: 0.42 });
    },
    yahtzee: function () {
      // Triumphant arpeggio + sustained chord — the signature moment.
      const arp = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      for (let i = 0; i < arp.length; i++) {
        tone(arp[i], 0.16, { type: 'triangle', gain: 0.34, delay: i * 0.07 });
      }
      // Sustained chord underneath.
      tone(523.25, 1.4, { type: 'sawtooth', gain: 0.16, delay: 0.42 });
      tone(783.99, 1.4, { type: 'sawtooth', gain: 0.14, delay: 0.42 });
      tone(1046.5, 1.4, { type: 'sine',     gain: 0.22, delay: 0.42 });
      tone(1318.5, 1.0, { type: 'sine',     gain: 0.18, delay: 0.55 });
      // Sparkle.
      noise(0.25, { type: 'highpass', cutoff: 4000, gain: 0.10, delay: 0.42 });
    },
    zeroOut: function () {
      tone(440, 0.22, { type: 'triangle', frequencyEnd: 220, gain: 0.26 });
      tone(330, 0.40, { type: 'triangle', frequencyEnd: 165, gain: 0.22, delay: 0.14 });
    },
    gameOver: function () {
      tone(523.25, 0.30, { type: 'triangle', gain: 0.26 });
      tone(659.25, 0.30, { type: 'triangle', gain: 0.24, delay: 0.20 });
      tone(523.25, 0.55, { type: 'sine',     gain: 0.22, delay: 0.42 });
      tone(783.99, 0.85, { type: 'sine',     gain: 0.30, delay: 0.42 });
    },
    rumbleStart: function () {
      noise(0.18, { type: 'lowpass', cutoff: 220, q: 2, gain: 0.45 });
    }
  };

  function playSFX(name) {
    ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const fn = SFX[name];
    if (fn) fn();
  }

  // ── Volume / mute API ───────────────────────────────────────────────

  function setMuted(b) {
    muted = !!b;
    if (master) master.gain.value = muted ? 0 : 1;
    savePrefs();
  }
  function isMuted() { return muted; }
  function setSfxVolume(v) {
    sfxVolume = clamp01(v);
    if (sfxBus) sfxBus.gain.value = sfxVolume;
    savePrefs();
  }
  function getSfxVolume() { return sfxVolume; }
  function setMusicVolume(v) {
    musicVolume = clamp01(v);
    if (musicBus) musicBus.gain.value = musicVolume;
    savePrefs();
  }
  function getMusicVolume() { return musicVolume; }

  // ── Init ────────────────────────────────────────────────────────────

  loadPrefs();

  window.Yahtzee.Audio = {
    ensure, resume, playSFX,
    setMuted, isMuted, setSfxVolume, getSfxVolume, setMusicVolume, getMusicVolume
  };
})();
