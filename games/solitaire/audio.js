/* ═══════════════════════════════════════════════════════════════
   Solitaire — audio.js
   Synthesized Web Audio SFX. No samples, no music in v1.
   Lazy AudioContext (first-interaction-gated). Mute persisted.
   Exposes window.SolitaireAudio.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.45;
    master.connect(ctx.destination);
    return ctx;
  }
  function resume() {
    if (!ctx) ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.45;
  }
  function isMuted() { return muted; }

  // ── Voice helpers ─────────────────────────────────────────────
  // A "blip" = oscillator with an exponential gain envelope. Cards click
  // and lock with very short tones; the foundation lift uses a chime,
  // and the cascade uses random pitches with tinier envelopes.
  function blip(freq, dur, opts) {
    if (!ctx || muted) return;
    opts = opts || {};
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type || 'triangle';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (opts.toFreq) {
      o.frequency.exponentialRampToValueAtTime(opts.toFreq, ctx.currentTime + dur);
    }
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(opts.gain || 0.18, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  // Two-voice "wood click" — a low thud + high transient. Used for card-down.
  function thud(freq, dur, gain) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + dur);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain || 0.22, ctx.currentTime + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  // ── Public SFX ────────────────────────────────────────────────
  function pick()        { resume(); blip(880, 0.06, { type: 'sine', gain: 0.10 }); }
  function dropLegal()   { resume(); thud(220, 0.10); blip(560, 0.06, { type: 'sine', gain: 0.07 }); }
  function dropIllegal() { resume(); blip(180, 0.18, { type: 'sawtooth', toFreq: 90, gain: 0.18 }); }
  function flip()        { resume(); blip(720, 0.05, { type: 'triangle', toFreq: 460, gain: 0.10 }); }
  function stockDraw()   { resume(); blip(420, 0.06, { type: 'triangle', toFreq: 600, gain: 0.10 }); }
  function stockRecycle(){ resume(); blip(260, 0.18, { type: 'sine', toFreq: 460, gain: 0.14 }); }

  // Foundation place — pitch by foundation count (A→K). Higher rank = brighter.
  function foundation(rank) {
    resume();
    const semis = (rank - 1) * 1.2;
    const f = 440 * Math.pow(2, semis / 12);
    blip(f, 0.16, { type: 'sine', gain: 0.20 });
    setTimeout(() => blip(f * 1.5, 0.10, { type: 'triangle', gain: 0.10 }), 30);
  }

  function hintPulse() { resume(); blip(660, 0.10, { type: 'sine', gain: 0.12 }); }
  function menuMove()  { resume(); blip(520, 0.04, { type: 'square', gain: 0.06 }); }
  function menuConfirm() { resume(); blip(740, 0.10, { type: 'triangle', gain: 0.12 }); }
  function undoSfx()   { resume(); blip(320, 0.10, { type: 'triangle', toFreq: 220, gain: 0.12 }); }

  function cascadeBounce() {
    resume();
    const base = 320 + Math.random() * 600;
    blip(base, 0.08, { type: 'sine', gain: 0.06 });
  }
  function cascadeFinale() {
    resume();
    const root = 440;
    [0, 4, 7, 12].forEach((semi, i) => {
      setTimeout(() => blip(root * Math.pow(2, semi / 12), 0.6, { type: 'sine', gain: 0.18 }), i * 70);
    });
  }

  window.SolitaireAudio = {
    ensure, resume, setMuted, isMuted,
    pick, dropLegal, dropIllegal, flip, stockDraw, stockRecycle,
    foundation, hintPulse, menuMove, menuConfirm, undoSfx,
    cascadeBounce, cascadeFinale
  };
})();
