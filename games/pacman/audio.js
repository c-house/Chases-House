(function () {
  'use strict';

  let ctx = null;
  let master = null;
  let gains = {};  // per-channel gains
  let loops = {};  // loop name -> { osc, lfo, stop }
  let enabled = true;
  let masterVolume = 0.6;
  let wakaToggle = 0;
  let introPlayed = false;
  let dyingActive = false;

  function ensure() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = masterVolume;
    master.connect(ctx.destination);
    for (const name of ['siren', 'frightened', 'retreat', 'sfx']) {
      gains[name] = ctx.createGain();
      gains[name].gain.value = 0;
      gains[name].connect(master);
    }
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

  // Schedule a single tone
  function tone(freq, duration, opts) {
    if (!ctx || !enabled) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = (opts && opts.type) || 'square';
    o.frequency.value = freq;
    g.gain.value = 0;
    const now = ctx.currentTime + (opts && opts.delay || 0);
    const attack = 0.005;
    const decay = (opts && opts.release) || 0.03;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime((opts && opts.gain) || 0.25, now + attack);
    g.gain.setValueAtTime((opts && opts.gain) || 0.25, now + Math.max(attack, duration - decay));
    g.gain.linearRampToValueAtTime(0, now + duration);
    o.connect(g);
    g.connect(gains.sfx);
    o.start(now);
    o.stop(now + duration + 0.02);
    if (opts && opts.slideTo) {
      o.frequency.linearRampToValueAtTime(opts.slideTo, now + duration);
    }
  }

  // Intro jingle: short 4-note motif (not copy of original but same flavour)
  function playIntro() {
    if (!ctx || !enabled || introPlayed) return;
    introPlayed = true;
    const notes = [
      [523, 0.12], [659, 0.12], [784, 0.12], [1046, 0.18],
      [784, 0.12], [1046, 0.30],
    ];
    let t = 0;
    for (const [f, d] of notes) {
      tone(f, d, { delay: t, gain: 0.2, type: 'square' });
      t += d + 0.02;
    }
  }

  function playWaka() {
    if (!ctx || !enabled) return;
    wakaToggle = 1 - wakaToggle;
    const f1 = wakaToggle ? 520 : 400;
    const f2 = wakaToggle ? 400 : 520;
    tone(f1, 0.04, { gain: 0.18, type: 'square' });
    tone(f2, 0.04, { delay: 0.04, gain: 0.18, type: 'square' });
  }

  function playPellet() {
    if (!ctx || !enabled) return;
    // low bwoop
    tone(180, 0.10, { gain: 0.25, type: 'square', slideTo: 90 });
    tone(90,  0.10, { delay: 0.10, gain: 0.22, type: 'square', slideTo: 180 });
  }

  function playEatGhost() {
    if (!ctx || !enabled) return;
    const notes = [220, 330, 440, 660, 880];
    notes.forEach((f, i) => tone(f, 0.06, { delay: i * 0.05, gain: 0.25, type: 'square' }));
  }

  function playEatRival() {
    if (!ctx || !enabled) return;
    const notes = [880, 660, 880, 1200];
    notes.forEach((f, i) => tone(f, 0.08, { delay: i * 0.06, gain: 0.28, type: 'square' }));
  }

  function playDeath() {
    if (!ctx || !enabled) return;
    // descending whine ~1.5s
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    const now = ctx.currentTime;
    o.frequency.setValueAtTime(650, now);
    o.frequency.exponentialRampToValueAtTime(80, now + 1.4);
    g.gain.setValueAtTime(0.0, now);
    g.gain.linearRampToValueAtTime(0.3, now + 0.03);
    g.gain.linearRampToValueAtTime(0.0, now + 1.5);
    o.connect(g);
    g.connect(gains.sfx);
    o.start(now);
    o.stop(now + 1.55);
  }

  function playExtraLife() {
    if (!ctx || !enabled) return;
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((f, i) => tone(f, 0.08, { delay: i * 0.06, gain: 0.25, type: 'triangle' }));
  }

  function playBeep(freq) {
    if (!ctx || !enabled) return;
    tone(freq || 880, 0.05, { gain: 0.15, type: 'triangle' });
  }

  function startLoop(name) {
    if (!ctx || !enabled) return;
    if (loops[name]) return;
    if (name === 'siren') startSiren();
    else if (name === 'frightened') startFrightened();
    else if (name === 'retreat') startRetreat();
  }

  function stopLoop(name) {
    const l = loops[name];
    if (!l) return;
    l.stop();
    delete loops[name];
    if (gains[name]) {
      gains[name].gain.cancelScheduledValues(ctx.currentTime);
      gains[name].gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
    }
  }

  function startSiren() {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 120;
    // LFO for warble
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 9;
    lfoGain.gain.value = 14;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    o.connect(gains.siren);
    o.start();
    lfo.start();
    gains.siren.gain.cancelScheduledValues(ctx.currentTime);
    gains.siren.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.05);
    loops.siren = {
      osc: o, lfo,
      setPitch(baseHz) { o.frequency.setTargetAtTime(baseHz, ctx.currentTime, 0.2); },
      stop() { try { o.stop(); lfo.stop(); } catch(_){} },
    };
  }

  function startFrightened() {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 220;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 14;
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    o.connect(gains.frightened);
    o.start(); lfo.start();
    gains.frightened.gain.cancelScheduledValues(ctx.currentTime);
    gains.frightened.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.05);
    loops.frightened = { osc: o, lfo, stop() { try { o.stop(); lfo.stop(); } catch(_){} } };
  }

  function startRetreat() {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 900;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 20;
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    o.connect(gains.retreat);
    o.start(); lfo.start();
    gains.retreat.gain.cancelScheduledValues(ctx.currentTime);
    gains.retreat.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.05);
    loops.retreat = { osc: o, lfo, stop() { try { o.stop(); lfo.stop(); } catch(_){} } };
  }

  function setDotsRatio(ratio) {
    if (!loops.siren) return;
    // Pitch rises as dots run out
    const base = 90 + (1 - ratio) * 140;
    loops.siren.setPitch(base);
  }

  // Called each frame with engine state. Dispatches events + manages loops.
  function sync(state) {
    if (!ctx || !enabled) return;
    // Process events
    for (const ev of state.events) {
      if (ev.type === 'dot') playWaka();
      else if (ev.type === 'pellet') playPellet();
      else if (ev.type === 'eat_ghost') playEatGhost();
      else if (ev.type === 'eat_rival') playEatRival();
      else if (ev.type === 'death') { playDeath(); dyingActive = true; }
      else if (ev.type === 'round_start') { if (!introPlayed) playIntro(); }
    }

    const playing = state.phase === 'playing';
    const anyFright = state.ghosts.some(g => g.mode === 'frightened');
    const anyEaten = state.ghosts.some(g => g.mode === 'eaten');
    const dying = state.phase === 'dying';
    if (!dying) dyingActive = false;

    // Dying: silence all loops
    if (dying) {
      stopLoop('siren');
      stopLoop('frightened');
      stopLoop('retreat');
      return;
    }

    if (!playing) {
      stopLoop('siren');
      stopLoop('frightened');
      stopLoop('retreat');
      return;
    }

    // Retreat takes priority (over frightened)
    if (anyEaten) {
      stopLoop('siren');
      stopLoop('frightened');
      startLoop('retreat');
    } else if (anyFright) {
      stopLoop('siren');
      stopLoop('retreat');
      startLoop('frightened');
    } else {
      stopLoop('frightened');
      stopLoop('retreat');
      startLoop('siren');
      const ratio = state.totalDots ? (state.dotsRemaining / state.totalDots) : 1;
      setDotsRatio(ratio);
    }
  }

  function resetForNewGame() {
    introPlayed = false;
    dyingActive = false;
    wakaToggle = 0;
    stopLoop('siren'); stopLoop('frightened'); stopLoop('retreat');
  }

  window.PacmanAudio = {
    ensure,
    resume,
    setMuted, isMuted,
    setVolume,
    sync,
    playBeep,
    playIntro,
    resetForNewGame,
  };
})();
