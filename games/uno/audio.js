/* ═══════════════════════════════════════════════════════════════
   Uno — audio.js
   Procedural Web Audio synthesis. No external samples; the entire
   palette is built from oscillators + a shared noise buffer.

   Why synth: the chases.house Uno aesthetic is graphic-poster /
   1970s-arcade. Recorded samples would feel jarring against the
   styled-DOM card abstraction. Synth also dissolves the CC0
   licensing problem and keeps audio.js a self-contained module
   with zero asset weight.

   Public API:
     ensure()                 lazy AudioContext init
     play(name, opts)         opts: { delay?: ms }
     setMuted(boolean)        persisted to localStorage
     getMuted()
     syncEvents(events[])     dispatches SFX from game events
     testAll()                debug: plays every sound 1s apart

   Exposes window.UnoAudio.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const MUTED_KEY = 'uno_muted';
  const MASTER_VOLUME = 0.55;

  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let enabled = true;

  // ── Lifecycle ───────────────────────────────────────────
  function ensure() {
    if (ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    try {
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = enabled ? MASTER_VOLUME : 0;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }

  // ── Helpers ─────────────────────────────────────────────
  function getNoise() {
    if (noiseBuffer || !ctx) return noiseBuffer;
    const len = Math.floor(ctx.sampleRate * 0.6);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  // Attack-decay envelope. Uses exponential ramps (avoids the click
  // a linear ramp introduces near zero). 0.0001 is the floor target.
  function adEnv(gainNode, t0, attackMs, decayMs, peak) {
    const peakT = t0 + attackMs / 1000;
    const endT  = peakT + decayMs / 1000;
    gainNode.gain.setValueAtTime(0.0001, t0);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), peakT);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endT);
  }

  function chain(/* nodes... */) {
    const nodes = Array.prototype.slice.call(arguments);
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    return nodes[nodes.length - 1];
  }

  // ── Synth: card sounds ──────────────────────────────────

  // The signature card-slap: thwip + thock layered with the 250ms
  // play animation. thwip plays at delay=0 (lift), thock at 220ms
  // (landing) — see syncEvents.
  function synthThwip(t0) {
    const buf = getNoise(); if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.5;
    filter.frequency.setValueAtTime(4200, t0);
    filter.frequency.exponentialRampToValueAtTime(1500, t0 + 0.09);
    const g = ctx.createGain();
    adEnv(g, t0, 4, 80, 0.5);
    chain(src, filter, g, master);
    src.start(t0); src.stop(t0 + 0.12);
  }

  function synthThock(t0) {
    // Pitched body: triangle drop
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(200, t0);
    o.frequency.exponentialRampToValueAtTime(80, t0 + 0.07);
    const og = ctx.createGain();
    adEnv(og, t0, 2, 80, 0.55);
    chain(o, og, master);
    o.start(t0); o.stop(t0 + 0.11);

    // Click texture: lowpass noise burst
    const buf = getNoise(); if (!buf) return;
    const n = ctx.createBufferSource();
    n.buffer = buf;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 700;
    const ng = ctx.createGain();
    adEnv(ng, t0, 1, 35, 0.32);
    chain(n, nf, ng, master);
    n.start(t0); n.stop(t0 + 0.06);
  }

  function synthDraw(t0) {
    const buf = getNoise(); if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(2200, t0);
    filter.frequency.exponentialRampToValueAtTime(800, t0 + 0.13);
    const g = ctx.createGain();
    adEnv(g, t0, 8, 120, 0.36);
    chain(src, filter, g, master);
    src.start(t0); src.stop(t0 + 0.16);
  }

  // ── Synth: action cards ─────────────────────────────────

  // Wild — bell-like dual-sine perfect 5th
  function synthChime(t0) {
    [660, 990].forEach(function (f) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      adEnv(g, t0, 3, 600, 0.32);
      chain(o, g, master);
      o.start(t0); o.stop(t0 + 0.65);
    });
    // Subtle high shimmer
    const sh = ctx.createOscillator();
    sh.type = 'sine';
    sh.frequency.value = 1980;
    const shg = ctx.createGain();
    adEnv(shg, t0, 8, 220, 0.08);
    chain(sh, shg, master);
    sh.start(t0); sh.stop(t0 + 0.25);
  }

  // Reverse — vinyl scratch via playback-rate sweep on noise + highpass sweep
  function synthScratch(t0) {
    const buf = getNoise(); if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(2.2, t0);
    src.playbackRate.exponentialRampToValueAtTime(0.45, t0 + 0.42);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(900, t0);
    filter.frequency.exponentialRampToValueAtTime(200, t0 + 0.42);
    const g = ctx.createGain();
    adEnv(g, t0, 5, 400, 0.38);
    chain(src, filter, g, master);
    src.start(t0); src.stop(t0 + 0.46);
  }

  // Skip — woodblock thunk
  function synthThunk(t0) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(440, t0);
    o.frequency.exponentialRampToValueAtTime(280, t0 + 0.06);
    const g = ctx.createGain();
    adEnv(g, t0, 1, 70, 0.5);
    chain(o, g, master);
    o.start(t0); o.stop(t0 + 0.09);
  }

  // +2 / +4 — escalating square-wave sting
  function synthSting(steps, t0) {
    const freqs = steps === 4 ? [220, 277, 330, 392] : [220, 330];
    const stepS = 0.075;
    freqs.forEach(function (f, i) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = ctx.createGain();
      const t = t0 + i * stepS;
      adEnv(g, t, 4, 70, 0.18);
      chain(o, g, master);
      o.start(t); o.stop(t + 0.09);
    });
  }

  // ── Synth: menus ────────────────────────────────────────
  function synthHover(t0) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 880;
    const g = ctx.createGain();
    adEnv(g, t0, 1, 35, 0.12);
    chain(o, g, master);
    o.start(t0); o.stop(t0 + 0.05);
  }
  function synthConfirm(t0) {
    [440, 660].forEach(function (f, i) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      const t = t0 + i * 0.05;
      adEnv(g, t, 3, 90, 0.22);
      chain(o, g, master);
      o.start(t); o.stop(t + 0.12);
    });
  }
  function synthBack(t0) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(440, t0);
    o.frequency.exponentialRampToValueAtTime(220, t0 + 0.1);
    const g = ctx.createGain();
    adEnv(g, t0, 3, 110, 0.2);
    chain(o, g, master);
    o.start(t0); o.stop(t0 + 0.13);
  }

  // ── Synth: round/match outcomes ─────────────────────────

  // UNO! callout — fast triumphant sawtooth arpeggio C-E-G
  function synthUnoStinger(t0) {
    [523, 659, 784].forEach(function (f, i) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3000;
      const g = ctx.createGain();
      const t = t0 + i * 0.06;
      adEnv(g, t, 3, 120, 0.18);
      chain(o, filter, g, master);
      o.start(t); o.stop(t + 0.14);
    });
  }

  // Round-end — triangle C-G-C with detune-chorus pairs
  function synthFanfare(t0) {
    [523, 784, 1047].forEach(function (f, i) {
      [-7, 7].forEach(function (detune) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = detune;
        const g = ctx.createGain();
        const t = t0 + i * 0.1;
        adEnv(g, t, 4, 200, 0.18);
        chain(o, g, master);
        o.start(t); o.stop(t + 0.22);
      });
    });
  }

  // Match-end — bigger arpeggio + sustained C with vibrato
  function synthCheer(t0) {
    // Quick arpeggio G-C-E-G
    [392, 523, 659, 784].forEach(function (f, i) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      const t = t0 + i * 0.08;
      adEnv(g, t, 3, 140, 0.2);
      chain(o, g, master);
      o.start(t); o.stop(t + 0.16);
    });
    // Sustained high C with vibrato
    const t1 = t0 + 0.34;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 1047;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 14;
    chain(lfo, lfoGain);
    lfoGain.connect(o.detune);
    const g = ctx.createGain();
    adEnv(g, t1, 50, 600, 0.18);
    chain(o, g, master);
    o.start(t1); o.stop(t1 + 0.7);
    lfo.start(t1); lfo.stop(t1 + 0.7);
  }

  // Lose — descending sad sine through lowpass
  function synthDrone(t0) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(220, t0);
    o.frequency.exponentialRampToValueAtTime(110, t0 + 0.6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const g = ctx.createGain();
    adEnv(g, t0, 30, 580, 0.3);
    chain(o, filter, g, master);
    o.start(t0); o.stop(t0 + 0.65);
  }

  // ── Dispatcher ──────────────────────────────────────────
  const SYNTH = {
    'card-thwip':      synthThwip,
    'card-thock':      synthThock,
    'card-draw':       synthDraw,
    'chime-wild':      synthChime,
    'scratch-reverse': synthScratch,
    'thunk-skip':      synthThunk,
    'sting-draw2':     function (t) { synthSting(2, t); },
    'sting-draw4':     function (t) { synthSting(4, t); },
    'menu-hover':      synthHover,
    'menu-confirm':    synthConfirm,
    'menu-back':       synthBack,
    'stinger-uno':     synthUnoStinger,
    'fanfare-round':   synthFanfare,
    'cheer-match':     synthCheer,
    'drone-lose':      synthDrone
  };

  function play(name, opts) {
    if (!enabled || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const fn = SYNTH[name];
    if (!fn) return;
    const delay = (opts && opts.delay) || 0;
    const startAt = ctx.currentTime + delay / 1000;
    try { fn(startAt); } catch (e) { /* swallow — audio errors must never break the game */ }
  }

  function setMuted(m) {
    enabled = !m;
    if (master) master.gain.value = enabled ? MASTER_VOLUME : 0;
    try { localStorage.setItem(MUTED_KEY, m ? '1' : '0'); } catch (e) {}
  }
  function getMuted() { return !enabled; }

  function loadMutedFromStorage() {
    try {
      if (localStorage.getItem(MUTED_KEY) === '1') enabled = false;
    } catch (e) {}
  }

  // Map game events → SFX. One switch.
  function syncEvents(events) {
    if (!events || !events.length) return;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      switch (ev.type) {
        case 'card-played':
          play('card-thwip');
          play('card-thock', { delay: 220 });
          if (ev.card) {
            if (ev.card.value === 'reverse')                           play('scratch-reverse', { delay: 240 });
            if (ev.card.value === 'skip')                              play('thunk-skip',     { delay: 240 });
            if (ev.card.value === 'draw2')                             play('sting-draw2',    { delay: 240 });
            if (ev.card.value === 'wild4')                             play('sting-draw4',    { delay: 240 });
            if (ev.card.color === 'wild' && ev.card.value !== 'wild4') play('chime-wild',     { delay: 240 });
          }
          break;
        case 'card-drawn':
        case 'forced-draw':
          play('card-draw');
          break;
        case 'uno-called':  play('stinger-uno'); break;
        case 'uno-caught':  play('sting-draw2'); break;
        case 'round-end':   play('fanfare-round'); break;
        case 'match-end':   play('cheer-match'); break;
        default: break;
      }
    }
  }

  // Debug — `UnoAudio.testAll()` in DevTools to hear every sound 1s apart.
  function testAll() {
    if (!ctx) ensure();
    const names = Object.keys(SYNTH);
    names.forEach(function (name, i) {
      setTimeout(function () {
        // eslint-disable-next-line no-console
        console.log('[UnoAudio]', name);
        play(name);
      }, i * 1000);
    });
  }

  loadMutedFromStorage();

  window.UnoAudio = {
    ensure: ensure,
    play: play,
    setMuted: setMuted,
    getMuted: getMuted,
    syncEvents: syncEvents,
    testAll: testAll
  };
})();
