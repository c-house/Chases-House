/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense — audio.js
   Web Audio API. Master gain → musicGain + sfxGain. Lazy buffer
   load, graceful no-op when files missing or context unavailable.
   Pacman precedent: games/pacman/audio.js.
   Exposes window.CTDAudio.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // 12 SFX + 1 BGM. File paths are relative to index.html.
  // Missing files = warn-once + silent — game stays playable.
  const SAMPLES = {
    arrow_loose:  'audio/arrow_loose.wav',
    magic_zap:    'audio/magic_zap.wav',
    cannon_thud:  'audio/cannon_thud.wav',
    frost_shimmer:'audio/frost_shimmer.wav',
    gold_pickup:  'audio/gold_pickup.wav',
    enemy_death:  'audio/enemy_death.wav',
    castle_hit:   'audio/castle_hit.wav',
    wave_start:   'audio/wave_start.wav',
    wave_clear:   'audio/wave_clear.wav',
    victory:      'audio/victory.wav',
    defeat:       'audio/defeat.wav',
    ui_click:     'audio/ui_click.wav',
    bgm_loop:     'audio/bgm_loop.mp3'
  };

  let ctx = null;
  let master = null;
  let musicGain = null, sfxGain = null;
  const buffers = {};
  const warned = {};

  let musicVolume = 0.4;
  let sfxVolume   = 0.8;
  let musicMuted = false;
  let sfxMuted   = false;
  let bgmSource = null;
  let bgmRequested = false;

  function ensure() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 1.0;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = musicMuted ? 0 : musicVolume;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = sfxMuted ? 0 : sfxVolume;
    sfxGain.connect(master);
    loadAll();
    return ctx;
  }

  function loadAll() {
    Object.entries(SAMPLES).forEach(([name, url]) => {
      fetch(url)
        .then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error('http ' + r.status)))
        .then(ab => ctx.decodeAudioData(ab))
        .then(buf => { buffers[name] = buf; if (name === 'bgm_loop' && bgmRequested) startBGM(); })
        .catch(err => {
          if (!warned[name]) {
            console.warn('[ctd-audio] missing or failed sample:', name, '->', url);
            warned[name] = true;
          }
        });
    });
  }

  function resume() {
    if (!ctx) ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function play(name, opts) {
    ensure();
    if (!ctx || sfxMuted) return;
    const buf = buffers[name];
    if (!buf) return;
    const o = opts || {};
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate || 1.0;
    let dest = sfxGain;
    if (o.gain != null) {
      const g = ctx.createGain();
      g.gain.value = o.gain;
      g.connect(sfxGain);
      dest = g;
    }
    src.connect(dest);
    src.start(0);
  }

  function startBGM() {
    bgmRequested = true;
    ensure();
    if (!ctx) return;
    const buf = buffers.bgm_loop;
    if (!buf) return;
    if (bgmSource) try { bgmSource.stop(); } catch (e) {}
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(musicGain);
    src.start(0);
    bgmSource = src;
  }

  function stopBGM() {
    bgmRequested = false;
    if (bgmSource) {
      try { bgmSource.stop(); } catch (e) {}
      bgmSource = null;
    }
  }

  function setMusicVolume(v) {
    musicVolume = Math.max(0, Math.min(1, v));
    if (musicGain && !musicMuted) musicGain.gain.value = musicVolume;
  }
  function setSfxVolume(v) {
    sfxVolume = Math.max(0, Math.min(1, v));
    if (sfxGain && !sfxMuted) sfxGain.gain.value = sfxVolume;
  }
  function setMusicMuted(m) {
    musicMuted = !!m;
    if (musicGain) musicGain.gain.value = musicMuted ? 0 : musicVolume;
  }
  function setSfxMuted(m) {
    sfxMuted = !!m;
    if (sfxGain) sfxGain.gain.value = sfxMuted ? 0 : sfxVolume;
  }

  // ─── Event-driven mapping from engine events to SFX ─────────
  function flushEvents(events) {
    if (!events || !events.length) return;
    for (const ev of events) {
      switch (ev.kind) {
        case 'fire':
          if (ev.towerType === 'archer') play('arrow_loose');
          else if (ev.towerType === 'cannon') play('cannon_thud');
          else if (ev.towerType === 'mage')   play('magic_zap');
          else if (ev.towerType === 'frost')  play('frost_shimmer');
          break;
        case 'kill':       play('enemy_death'); play('gold_pickup', { gain: 0.6 }); break;
        case 'castleHit':  play('castle_hit'); break;
        case 'waveStart':  play('wave_start'); break;
        case 'waveClear':  play('wave_clear'); break;
        case 'place':
        case 'upgrade':
        case 'sell':
        case 'uiClick':    play('ui_click', { gain: 0.5 }); break;
        case 'victory':    play('victory'); break;
        case 'defeat':     play('defeat'); break;
      }
    }
  }

  function getState() {
    return { musicVolume, sfxVolume, musicMuted, sfxMuted };
  }

  window.CTDAudio = {
    ensure, resume,
    play, startBGM, stopBGM,
    setMusicVolume, setSfxVolume,
    setMusicMuted, setSfxMuted,
    flushEvents, getState
  };
})();
