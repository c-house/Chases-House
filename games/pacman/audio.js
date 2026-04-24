(function () {
  'use strict';

  const SAMPLES = {
    waka: 'sounds/waka.wav',
    pellet: 'sounds/pellet.wav',
    eat_ghost: 'sounds/eat_ghost.wav',
    eat_rival: 'sounds/eat_rival.wav',
    death: 'sounds/death.wav',
    intro: 'sounds/intro.wav',
    extra_life: 'sounds/extra_life.wav',
    siren_loop: 'sounds/siren_loop.wav',
    frightened_loop: 'sounds/frightened_loop.wav',
    retreat_loop: 'sounds/retreat_loop.wav',
  };

  let ctx = null;
  let master = null;
  let gains = {};
  const buffers = {};
  let loops = {};
  let enabled = true;
  let masterVolume = 0.6;
  let introPlayed = false;
  let wakaToggle = 0;

  function ensure() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = masterVolume;
    master.connect(ctx.destination);
    gains.sfx = ctx.createGain();
    gains.sfx.gain.value = 1.0;
    gains.sfx.connect(master);
    for (const name of ['siren', 'frightened', 'retreat']) {
      gains[name] = ctx.createGain();
      gains[name].gain.value = 0;
      gains[name].connect(master);
    }
    loadAll();
    return ctx;
  }

  function loadAll() {
    for (const [name, url] of Object.entries(SAMPLES)) {
      fetch(url)
        .then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
        .then(ab => ctx.decodeAudioData(ab))
        .then(buf => { buffers[name] = buf; })
        .catch(e => { console.warn('Pacman audio: failed to load', name, e); });
    }
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

  function playSample(name, opts) {
    if (!ctx || !enabled) return;
    const buf = buffers[name];
    if (!buf) return;
    const o = opts || {};
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate || 1.0;
    const g = ctx.createGain();
    g.gain.value = o.gain != null ? o.gain : 0.6;
    src.connect(g);
    g.connect(gains.sfx);
    src.start();
  }

  function playIntro() {
    if (introPlayed) return;
    introPlayed = true;
    playSample('intro', { gain: 0.55 });
  }

  function playBeep() {
    // Alternate pitch on each call for a "waka-waka" flavor
    wakaToggle = 1 - wakaToggle;
    playSample('waka', { gain: 0.35, rate: wakaToggle ? 1.0 : 0.85 });
  }

  function startLoop(name, sampleName, volume) {
    if (!ctx || !enabled) return;
    if (loops[name]) return;
    const buf = buffers[sampleName];
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(gains[name]);
    src.start();
    gains[name].gain.cancelScheduledValues(ctx.currentTime);
    gains[name].gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.08);
    loops[name] = {
      source: src,
      setRate(rate) { src.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.25); },
      stop() { try { src.stop(); } catch (_) {} },
    };
  }

  function stopLoop(name) {
    const l = loops[name];
    if (!l) return;
    delete loops[name];
    const g = gains[name];
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
    setTimeout(() => l.stop(), 120);
  }

  function setDotsRatio(ratio) {
    if (!loops.siren) return;
    loops.siren.setRate(1.0 + (1 - ratio) * 0.6);
  }

  function sync(state) {
    if (!ctx || !enabled) return;
    for (const ev of state.events) {
      if (ev.type === 'dot') playBeep();
      else if (ev.type === 'pellet') playSample('pellet', { gain: 0.6 });
      else if (ev.type === 'eat_ghost') playSample('eat_ghost', { gain: 0.7 });
      else if (ev.type === 'eat_rival') playSample('eat_rival', { gain: 0.7 });
      else if (ev.type === 'death') playSample('death', { gain: 0.75 });
      else if (ev.type === 'round_start') { if (!introPlayed) playIntro(); }
    }

    const playing = state.phase === 'playing';
    const anyFright = state.ghosts.some(g => g.mode === 'frightened');
    const anyEaten = state.ghosts.some(g => g.mode === 'eaten');
    const dying = state.phase === 'dying';

    if (dying || !playing) {
      stopLoop('siren');
      stopLoop('frightened');
      stopLoop('retreat');
      return;
    }

    if (anyEaten) {
      stopLoop('siren');
      stopLoop('frightened');
      startLoop('retreat', 'retreat_loop', 0.3);
    } else if (anyFright) {
      stopLoop('siren');
      stopLoop('retreat');
      startLoop('frightened', 'frightened_loop', 0.32);
    } else {
      stopLoop('frightened');
      stopLoop('retreat');
      startLoop('siren', 'siren_loop', 0.22);
      const ratio = state.totalDots ? (state.dotsRemaining / state.totalDots) : 1;
      setDotsRatio(ratio);
    }
  }

  function resetForNewGame() {
    introPlayed = false;
    wakaToggle = 0;
    stopLoop('siren');
    stopLoop('frightened');
    stopLoop('retreat');
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
