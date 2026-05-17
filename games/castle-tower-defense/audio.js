/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — audio.js
   Web Audio bus: master → music + sfx + ambient. Declarative
   event→SFX dispatch via TOWER_FIRE_SFX. ADR-028 §5, §11.
   Exposes window.CTD3Audio.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Kenney audio packs ship .ogg — see assets/LICENSE.txt for per-file mapping.
  // BGM + ambient deferred to a follow-up: graceful no-op when missing.
  const SAMPLES = {
    ui_click:        'assets/audio/ui_click.ogg',
    ui_back:         'assets/audio/ui_back.ogg',
    build_place:     'assets/audio/build_place.ogg',
    sell:            'assets/audio/sell.ogg',
    upgrade:         'assets/audio/upgrade.ogg',
    ranger_fire:     'assets/audio/ranger_fire.ogg',
    cannon_fire:     'assets/audio/cannon_fire.ogg',
    mage_fire:       'assets/audio/mage_fire.ogg',
    enemy_hit:       'assets/audio/enemy_hit.ogg',
    enemy_death:     'assets/audio/enemy_death.ogg',
    castle_hit:      'assets/audio/castle_hit.ogg',
    wave_start_horn: 'assets/audio/wave_start_horn.ogg',
    wave_clear:      'assets/audio/wave_clear.ogg',
    bgm_loop:        'assets/audio/bgm_loop.ogg',
    ambient_loop:    'assets/audio/ambient_loop.ogg'
  };

  let ctx = null;
  let master = null, musicGain = null, sfxGain = null, ambientGain = null;
  const buffers = {};
  const warned = {};

  let musicVolume   = 0.40;
  let sfxVolume     = 0.80;
  let ambientVolume = 0.25;       // sub-channel under music gain target
  let musicMuted = false, sfxMuted = false;
  let bgmSource = null, ambientSource = null;
  let bgmRequested = false, ambientRequested = false;

  function ensure() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain(); master.gain.value = 1.0; master.connect(ctx.destination);
    musicGain   = ctx.createGain(); musicGain.gain.value   = musicMuted ? 0 : musicVolume;   musicGain.connect(master);
    sfxGain     = ctx.createGain(); sfxGain.gain.value     = sfxMuted ? 0 : sfxVolume;       sfxGain.connect(master);
    ambientGain = ctx.createGain(); ambientGain.gain.value = musicMuted ? 0 : (ambientVolume * musicVolume); ambientGain.connect(master);
    loadAll();
    return ctx;
  }

  function loadAll() {
    Object.entries(SAMPLES).forEach(([name, url]) => {
      fetch(url)
        .then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error('http ' + r.status)))
        .then(ab => ctx.decodeAudioData(ab))
        .then(buf => {
          buffers[name] = buf;
          if (name === 'bgm_loop' && bgmRequested) startBGM();
          if (name === 'ambient_loop' && ambientRequested) startAmbient();
        })
        .catch(() => {
          if (!warned[name]) {
            console.warn('[ctd3-audio] missing sample:', name, '->', url);
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
      const g = ctx.createGain(); g.gain.value = o.gain; g.connect(sfxGain);
      dest = g;
    }
    src.connect(dest);
    src.start(0);
  }

  function startBGM() {
    bgmRequested = true; ensure();
    if (!ctx) return;
    const buf = buffers.bgm_loop; if (!buf) return;
    if (bgmSource) try { bgmSource.stop(); } catch (e) {}
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true; src.connect(musicGain); src.start(0);
    bgmSource = src;
  }
  function stopBGM() {
    bgmRequested = false;
    if (bgmSource) { try { bgmSource.stop(); } catch (e) {} bgmSource = null; }
  }
  function startAmbient() {
    ambientRequested = true; ensure();
    if (!ctx) return;
    const buf = buffers.ambient_loop; if (!buf) return;
    if (ambientSource) try { ambientSource.stop(); } catch (e) {}
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true; src.connect(ambientGain); src.start(0);
    ambientSource = src;
  }
  function stopAmbient() {
    ambientRequested = false;
    if (ambientSource) { try { ambientSource.stop(); } catch (e) {} ambientSource = null; }
  }

  function setMusicVolume(v) {
    musicVolume = Math.max(0, Math.min(1, v));
    if (musicGain && !musicMuted) musicGain.gain.value = musicVolume;
    if (ambientGain && !musicMuted) ambientGain.gain.value = ambientVolume * musicVolume;
  }
  function setSfxVolume(v) {
    sfxVolume = Math.max(0, Math.min(1, v));
    if (sfxGain && !sfxMuted) sfxGain.gain.value = sfxVolume;
  }
  function setAmbientVolume(v) {
    ambientVolume = Math.max(0, Math.min(1, v));
    if (ambientGain && !musicMuted) ambientGain.gain.value = ambientVolume * musicVolume;
  }
  function setMusicMuted(m) {
    musicMuted = !!m;
    if (musicGain) musicGain.gain.value = musicMuted ? 0 : musicVolume;
    if (ambientGain) ambientGain.gain.value = musicMuted ? 0 : (ambientVolume * musicVolume);
  }
  function setSfxMuted(m) {
    sfxMuted = !!m;
    if (sfxGain) sfxGain.gain.value = sfxMuted ? 0 : sfxVolume;
  }

  // ─── Event → SFX dispatch (ADR-028 §11 — declarative table) ─
  function flushEvents(events) {
    if (!events || !events.length) return;
    const TOWER_FIRE_SFX = (window.CTD3Entities && window.CTD3Entities.TOWER_FIRE_SFX) || {};
    for (const ev of events) {
      switch (ev.kind) {
        case 'place':      play('build_place'); break;
        case 'upgrade':    play('upgrade'); break;
        case 'sell':       play('sell'); break;
        case 'fire': {
          const sfx = TOWER_FIRE_SFX[ev.towerType];
          if (sfx) play(sfx);
          break;
        }
        case 'hit':        play('enemy_hit', { gain: 0.5 }); break;
        case 'kill':       play('enemy_death'); break;
        case 'castleHit':  play('castle_hit'); break;
        case 'waveStart':  play('wave_start_horn'); break;
        case 'waveClear':  play('wave_clear'); break;
        case 'victory':    play('wave_clear', { rate: 0.85 }); break;
        case 'defeat':     play('castle_hit', { rate: 0.7 }); break;
        // phaseTransition is consumed by lighting only (ADR-028 §9, m-1)
      }
    }
  }

  function getState() { return { musicVolume, sfxVolume, ambientVolume, musicMuted, sfxMuted }; }

  window.CTD3Audio = {
    ensure, resume, play,
    startBGM, stopBGM, startAmbient, stopAmbient,
    setMusicVolume, setSfxVolume, setAmbientVolume,
    setMusicMuted, setSfxMuted,
    flushEvents, getState
  };
})();
