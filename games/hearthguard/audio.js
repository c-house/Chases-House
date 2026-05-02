/* ═══════════════════════════════════════════════════════════════
   Hearthguard — audio.js
   Effectful. Web Audio synthesis. 16 short one-shot SFX matched
   to the parchment-quiet aesthetic — pencil taps, sword on shield,
   parchment rustle. No music. Mute via single master gain node.
   AudioContext deferred to first user gesture (per browser
   autoplay policy). Persists mute via localStorage.
   Exposes window.HearthguardAudio.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let ctx = null;
  let master = null;
  let muted = false;

  try {
    muted = localStorage.getItem('hearthguard-muted') === '1';
  } catch (e) {}

  function ensure() {
    if (ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(b) {
    muted = !!b;
    try { localStorage.setItem('hearthguard-muted', muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.value = muted ? 0 : 0.7;
  }

  function isMuted() { return muted; }

  // Short tone with envelope. freq optional sweep via freqEnd.
  function tone(opts) {
    if (!ctx) return;
    const t0 = opts.t0 != null ? opts.t0 : ctx.currentTime;
    const attack = opts.attack != null ? opts.attack : 0.005;
    const hold   = opts.hold   != null ? opts.hold   : 0;
    const decay  = opts.decay  != null ? opts.decay  : 0.08;
    const gain   = opts.gain   != null ? opts.gain   : 0.25;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.freqEnd != null) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(0.01, opts.freqEnd),
        t0 + attack + hold + decay);
    }
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.setValueAtTime(gain, t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + decay);

    osc.connect(g); g.connect(master);
    osc.start(t0);
    osc.stop(t0 + attack + hold + decay + 0.05);
  }

  // White noise burst with optional filter.
  function noise(opts) {
    if (!ctx) return;
    const t0 = opts.t0 != null ? opts.t0 : ctx.currentTime;
    const dur  = opts.duration != null ? opts.duration : 0.08;
    const gain = opts.gain     != null ? opts.gain     : 0.20;

    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    let chain = src;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter.type || 'bandpass';
      f.frequency.value = opts.filter.freq || 1000;
      f.Q.value = opts.filter.Q != null ? opts.filter.Q : 1;
      src.connect(f); chain = f;
    }
    chain.connect(g); g.connect(master);

    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ── 16 SFX ───────────────────────────────────────────────────
  function cursorMove() {
    if (!ctx) return;
    tone({ freq: 1500, type: 'triangle', attack: 0.002, decay: 0.025, gain: 0.05 });
  }

  function unitSelect() {
    if (!ctx) return;
    noise({ duration: 0.10, gain: 0.10, filter: { type: 'highpass', freq: 2000 }});
  }

  function moveConfirm() {
    if (!ctx) return;
    tone({ freq: 90, type: 'square', attack: 0.002, decay: 0.07, gain: 0.16 });
    noise({ duration: 0.04, gain: 0.05, filter: { type: 'lowpass', freq: 600 }, t0: ctx.currentTime + 0.005 });
  }

  function knightStrike() {
    if (!ctx) return;
    noise({ duration: 0.02, gain: 0.16, filter: { type: 'bandpass', freq: 800, Q: 0.5 }});
    tone({ freq: 220, freqEnd: 80, type: 'square', attack: 0.001, decay: 0.18, gain: 0.28 });
  }

  function archerShot() {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise({ duration: 0.012, gain: 0.10, filter: { type: 'highpass', freq: 1500 }, t0: t });
    tone({ freq: 1200, freqEnd: 700, type: 'triangle', attack: 0.001, decay: 0.06, gain: 0.10, t0: t });
    noise({ duration: 0.16, gain: 0.08, filter: { type: 'bandpass', freq: 600, Q: 1.5 }, t0: t + 0.04 });
  }

  function mageSwap() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone({ freq: 600,  type: 'triangle', attack: 0.005, decay: 0.25, gain: 0.10, t0: t });
    tone({ freq: 800,  type: 'triangle', attack: 0.005, decay: 0.25, gain: 0.09, t0: t });
    tone({ freq: 1200, type: 'triangle', attack: 0.01,  decay: 0.20, gain: 0.05, t0: t + 0.06 });
  }

  function enemyMelee() {
    if (!ctx) return;
    noise({ duration: 0.04, gain: 0.16, filter: { type: 'lowpass', freq: 400 }});
    tone({ freq: 110, freqEnd: 60, type: 'square', attack: 0.005, decay: 0.20, gain: 0.20 });
  }

  function enemyRanged() {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise({ duration: 0.12, gain: 0.10, filter: { type: 'bandpass', freq: 800, Q: 1 }, t0: t });
    tone({ freq: 90, type: 'square', attack: 0.003, decay: 0.10, gain: 0.16, t0: t + 0.10 });
  }

  function hitHero() {
    if (!ctx) return;
    tone({ freq: 100, type: 'square', attack: 0.003, decay: 0.12, gain: 0.28 });
    noise({ duration: 0.04, gain: 0.08, filter: { type: 'lowpass', freq: 200 }});
  }

  function hitEnemy() {
    if (!ctx) return;
    noise({ duration: 0.01, gain: 0.16 });
    tone({ freq: 250, freqEnd: 150, type: 'square', attack: 0.001, decay: 0.07, gain: 0.22 });
  }

  function villagerFall() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone({ freq: 380, freqEnd: 180, type: 'triangle', attack: 0.02, decay: 0.6,  gain: 0.20, t0: t });
    tone({ freq: 760,                type: 'triangle', attack: 0.02, decay: 0.4,  gain: 0.05, t0: t + 0.005 });
  }

  function missionWin() {
    if (!ctx) return;
    const notes = [523, 659, 784, 1047];
    const t0 = ctx.currentTime;
    notes.forEach((f, i) => {
      tone({ freq: f, type: 'triangle', attack: 0.005, decay: 0.18, gain: 0.16, t0: t0 + i * 0.13 });
    });
  }

  function runWin() {
    if (!ctx) return;
    const notes = [523, 659, 784, 1047, 784, 659, 784, 1047];
    const t0 = ctx.currentTime;
    notes.forEach((f, i) => {
      tone({ freq: f, type: 'triangle', attack: 0.005, decay: 0.13, gain: 0.14, t0: t0 + i * 0.10 });
    });
    tone({ freq: 784,  type: 'triangle', attack: 0.02, decay: 0.8, gain: 0.09, t0: t0 + 0.85 });
    tone({ freq: 1047, type: 'triangle', attack: 0.02, decay: 0.8, gain: 0.09, t0: t0 + 0.85 });
  }

  function runLose() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    tone({ freq: 440, freqEnd: 350, type: 'triangle', attack: 0.01, decay: 0.4, gain: 0.18, t0: t0 });
    tone({ freq: 350, freqEnd: 277, type: 'triangle', attack: 0.01, decay: 0.6, gain: 0.16, t0: t0 + 0.30 });
  }

  function menuConfirm() {
    if (!ctx) return;
    noise({ duration: 0.08, gain: 0.08, filter: { type: 'highpass', freq: 1500 }});
    tone({ freq: 600, type: 'triangle', attack: 0.005, decay: 0.05, gain: 0.06, t0: ctx.currentTime + 0.02 });
  }

  function invalidAction() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone({ freq: 140, type: 'square', attack: 0.003, decay: 0.05, gain: 0.16, t0: t });
    tone({ freq: 100, type: 'square', attack: 0.003, decay: 0.04, gain: 0.10, t0: t + 0.04 });
  }

  window.HearthguardAudio = {
    ensure, resume, setMuted, isMuted,
    cursorMove, unitSelect, moveConfirm,
    knightStrike, archerShot, mageSwap,
    enemyMelee, enemyRanged,
    hitHero, hitEnemy, villagerFall,
    missionWin, runWin, runLose,
    menuConfirm, invalidAction,
  };
})();
