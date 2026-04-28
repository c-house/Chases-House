/* ═══════════════════════════════════════════════════════════════
   Jeopardy — audio.js (ADR-027)
   Plays named cues at game-state edges. Synthesis-first (WebAudio
   OscillatorNode chains shaped to a Stardew-warm timbre — sine
   fundamentals with soft envelopes + gentle harmonics + lowpass).
   If a CC0 file exists at audio/<name>.mp3 it is used instead;
   otherwise the synth fallback fires. Phones stay silent — only the
   TV calls play(); control.html and play.html do not load this file.
   Exposes window.JeopardyAudio.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var ctx = null;
  var masterGain = null;
  var fileCache = {};      // name → HTMLAudioElement
  var fileMissing = {};    // name → true after a file 404s, so we don't retry
  var thinkMusicSource = null; // active 30s FJ loop, so we can stop it

  // Lazy-init AudioContext on first user gesture (browsers require this).
  function getCtx() {
    if (!ctx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.55;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    return ctx;
  }

  // Try a CC0 file first (drop-in upgrade path); fall back to synthesis.
  function tryFile(name) {
    if (fileMissing[name]) return null;
    if (!fileCache[name]) {
      var el = new Audio('audio/' + name + '.mp3');
      el.preload = 'auto';
      el.addEventListener('error', function () { fileMissing[name] = true; });
      fileCache[name] = el;
    }
    return fileCache[name];
  }

  function playFile(name) {
    var el = tryFile(name);
    if (!el || fileMissing[name]) return false;
    try {
      el.currentTime = 0;
      var p = el.play();
      if (p && p.catch) p.catch(function () { fileMissing[name] = true; });
      return true;
    } catch (e) {
      fileMissing[name] = true;
      return false;
    }
  }

  // ── Synthesis primitives ───────────────────────────────────
  // Each builds a small node graph with a "warm" envelope + lowpass,
  // schedules an event, and self-cleans on stop.

  function noteFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  // A single "warm bell" tone: sine fundamental + 3rd-harmonic shimmer,
  // gentle attack + slow release, lowpassed at ~4kHz.
  function bell(c, freq, startAt, duration, vol) {
    var osc = c.createOscillator();
    var osc2 = c.createOscillator();
    var lp = c.createBiquadFilter();
    var g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc2.type = 'sine';
    osc2.frequency.value = freq * 3.01; // detuned 3rd harmonic for shimmer
    lp.type = 'lowpass';
    lp.frequency.value = 3800;
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(vol || 0.25, startAt + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    var sub = c.createGain();
    sub.gain.value = 0.18; // 3rd harmonic at 18% of fundamental
    osc2.connect(sub).connect(g);
    osc.connect(g);
    g.connect(lp).connect(masterGain);
    osc.start(startAt); osc2.start(startAt);
    osc.stop(startAt + duration + 0.05); osc2.stop(startAt + duration + 0.05);
  }

  // Soft sine "thunk" — for incorrect / heavy-foot moments.
  function thunk(c, freq, startAt, duration, vol) {
    var osc = c.createOscillator();
    var lp = c.createBiquadFilter();
    var g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.15, startAt);
    osc.frequency.exponentialRampToValueAtTime(freq, startAt + 0.08);
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(vol || 0.32, startAt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(g).connect(lp).connect(masterGain);
    osc.start(startAt); osc.stop(startAt + duration + 0.05);
  }

  // ── Synth cues (named) ─────────────────────────────────────

  function synthBuzzOpen(c) {
    // Three soft bells — Jeopardy's "doot doot doot" lectern signal,
    // pitched lower + warmer than a UI alert. Uses E5 (76) for clarity.
    var t = c.currentTime;
    bell(c, noteFreq(76), t + 0.00, 0.18, 0.28);
    bell(c, noteFreq(76), t + 0.14, 0.18, 0.28);
    bell(c, noteFreq(76), t + 0.28, 0.22, 0.30);
  }

  function synthBuzzIn(c) {
    // Single short bell — used when host buzz-locks on a player. Quiet.
    bell(c, noteFreq(72), c.currentTime, 0.16, 0.22);
  }

  function synthCorrect(c) {
    // Major triad arpeggio: C5-E5-G5, 60ms per step, warm bells.
    var t = c.currentTime;
    bell(c, noteFreq(72), t + 0.00, 0.20, 0.25);
    bell(c, noteFreq(76), t + 0.07, 0.22, 0.25);
    bell(c, noteFreq(79), t + 0.14, 0.30, 0.30);
  }

  function synthIncorrect(c) {
    // Descending minor 2nd: F4 → E4. Disappointment without harshness.
    var t = c.currentTime;
    thunk(c, noteFreq(65), t + 0.00, 0.32, 0.32);
    thunk(c, noteFreq(64), t + 0.10, 0.42, 0.30);
  }

  function synthClueReveal(c) {
    // Ascending 4-note motif resolving on tonic. Triumphant but soft.
    var t = c.currentTime;
    var notes = [67, 71, 74, 79]; // G4 B4 D5 G5
    notes.forEach(function (n, i) {
      bell(c, noteFreq(n), t + i * 0.08, 0.28, 0.22);
    });
  }

  function synthDailyDouble(c) {
    // Sparkly fanfare: ascending major arpeggio C5-E5-G5-C6 with
    // brighter bell harmonic ratio. Stardew-glittery.
    var t = c.currentTime;
    var notes = [72, 76, 79, 84];
    notes.forEach(function (n, i) {
      bell(c, noteFreq(n), t + i * 0.085, 0.32, 0.28);
      // Glitter — high octave shimmer
      bell(c, noteFreq(n + 12), t + i * 0.085 + 0.04, 0.18, 0.10);
    });
  }

  function synthThemeSting(c) {
    // 3s warm cadence: V → I in C major (G3 chord → C major chord).
    var t = c.currentTime;
    // Bass G3
    bell(c, noteFreq(55), t + 0.00, 1.40, 0.22);
    bell(c, noteFreq(59), t + 0.00, 1.40, 0.18); // B3
    bell(c, noteFreq(62), t + 0.00, 1.40, 0.16); // D4
    // Resolve to C
    bell(c, noteFreq(48), t + 1.20, 2.00, 0.26); // C3
    bell(c, noteFreq(60), t + 1.20, 2.00, 0.22); // C4
    bell(c, noteFreq(64), t + 1.20, 2.00, 0.18); // E4
    bell(c, noteFreq(67), t + 1.20, 2.00, 0.16); // G4
  }

  function synthGameOver(c) {
    // Major resolution — V → I → octave doubling.
    var t = c.currentTime;
    bell(c, noteFreq(55), t + 0.00, 0.55, 0.24);
    bell(c, noteFreq(59), t + 0.00, 0.55, 0.18);
    bell(c, noteFreq(62), t + 0.00, 0.55, 0.16);
    bell(c, noteFreq(48), t + 0.55, 1.40, 0.28);
    bell(c, noteFreq(60), t + 0.55, 1.40, 0.24);
    bell(c, noteFreq(64), t + 0.55, 1.40, 0.20);
    bell(c, noteFreq(67), t + 0.55, 1.40, 0.18);
    bell(c, noteFreq(72), t + 0.55, 1.60, 0.16);
  }

  // 30-second Final Jeopardy "Think!" — Stardew-warm version.
  // Structure mirrors original: slow ticking pulse + 4-bar chord
  // progression looped. Am - F - C - G at ~60 bpm. Returns the
  // last node so we can call .stop() to end early.
  function synthThinkMusic(c) {
    var startTime = c.currentTime;
    var bpm = 60;
    var beat = 60 / bpm; // 1.0s
    var bar = 4 * beat; // 4.0s
    var chords = [
      [57, 60, 64, 69], // Am: A3 C4 E4 A4
      [53, 57, 60, 65], // F:  F3 A3 C4 F4
      [48, 52, 55, 60], // C:  C3 E3 G3 C4
      [55, 59, 62, 67]  // G:  G3 B3 D4 G4
    ];

    // Top-level gain we can ramp down for clean stop.
    var loopGain = c.createGain();
    loopGain.gain.value = 0.85;
    loopGain.connect(masterGain);

    // Schedule two passes (8 bars × ~4s = 32s, enough for the 30s timer).
    for (var pass = 0; pass < 2; pass++) {
      for (var ci = 0; ci < chords.length; ci++) {
        var chordStart = startTime + (pass * 4 + ci) * bar;
        var chord = chords[ci];

        // Bass on beat 1 — warm low bell, longer release
        bellTo(c, loopGain, noteFreq(chord[0] - 12), chordStart, bar * 0.95, 0.22);

        // Pad chord (whole bar) — soft sustained block
        for (var n = 0; n < chord.length; n++) {
          bellTo(c, loopGain, noteFreq(chord[n]), chordStart + 0.05, bar * 0.85, 0.10);
        }

        // Arpeggio on each beat — sparkly upper voice
        for (var b = 0; b < 4; b++) {
          var note = chord[b % chord.length] + 12;
          bellTo(c, loopGain, noteFreq(note), chordStart + b * beat, beat * 0.55, 0.12);
        }

        // Subtle "tick" on each beat — the time-pressure pulse
        for (var t2 = 0; t2 < 4; t2++) {
          tickTo(c, loopGain, chordStart + t2 * beat, 0.04);
        }
      }
    }

    // Return a handle that lets us fade out cleanly.
    return {
      gainNode: loopGain,
      stop: function () {
        var now = c.currentTime;
        try {
          loopGain.gain.cancelScheduledValues(now);
          loopGain.gain.setValueAtTime(loopGain.gain.value, now);
          loopGain.gain.linearRampToValueAtTime(0, now + 0.4);
        } catch (e) {}
        setTimeout(function () { try { loopGain.disconnect(); } catch (e) {} }, 600);
      }
    };
  }

  // bell variant that connects to a custom destination (loopGain)
  function bellTo(c, dest, freq, startAt, duration, vol) {
    var osc = c.createOscillator();
    var osc2 = c.createOscillator();
    var lp = c.createBiquadFilter();
    var g = c.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    osc2.type = 'sine'; osc2.frequency.value = freq * 3.01;
    lp.type = 'lowpass'; lp.frequency.value = 3500;
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(vol || 0.18, startAt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    var sub = c.createGain(); sub.gain.value = 0.14;
    osc2.connect(sub).connect(g);
    osc.connect(g);
    g.connect(lp).connect(dest);
    osc.start(startAt); osc2.start(startAt);
    osc.stop(startAt + duration + 0.05); osc2.stop(startAt + duration + 0.05);
  }

  function tickTo(c, dest, startAt, vol) {
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, startAt);
    osc.frequency.exponentialRampToValueAtTime(1800, startAt + 0.04);
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(vol || 0.04, startAt + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.05);
    osc.connect(g).connect(dest);
    osc.start(startAt); osc.stop(startAt + 0.08);
  }

  var SYNTH_CUES = {
    'buzz-open': synthBuzzOpen,
    'buzz-in': synthBuzzIn,
    'correct': synthCorrect,
    'incorrect': synthIncorrect,
    'clue-reveal': synthClueReveal,
    'daily-double': synthDailyDouble,
    'theme-sting': synthThemeSting,
    'game-over': synthGameOver
  };

  // ── Public API ─────────────────────────────────────────────

  function play(name) {
    if (playFile(name)) return; // CC0 file present and played
    var c = getCtx();
    if (!c) return;
    var fn = SYNTH_CUES[name];
    if (!fn) return;
    fn(c);
  }

  function startThinkMusic() {
    if (thinkMusicSource) return;
    var c = getCtx();
    if (!c) return;
    thinkMusicSource = synthThinkMusic(c);
  }

  function stopThinkMusic() {
    if (thinkMusicSource && thinkMusicSource.stop) {
      thinkMusicSource.stop();
    }
    thinkMusicSource = null;
  }

  // Numeric count-up animation for score chips. rAF loop because
  // textContent is not a CSS property — Web Animations API doesn't fit.
  function cueScoreUpdate(oldScore, newScore, chipEl, formatScore) {
    var start = oldScore || 0;
    var end = newScore || 0;
    if (start === end) return;
    var duration = Math.min(900, Math.max(280, Math.abs(end - start) / 2));
    var startTime = performance.now();
    function step(t) {
      var progress = Math.min(1, (t - startTime) / duration);
      var eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      var current = Math.round(start + (end - start) * eased);
      if (chipEl) chipEl.textContent = formatScore(current);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Pre-warm: bind a one-shot "audio context unlock" on first user
  // interaction so subsequent plays are immediate. Browsers block
  // AudioContext until a user gesture.
  function attachUnlock() {
    function unlock() {
      getCtx();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    }
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }
  attachUnlock();

  window.JeopardyAudio = {
    play: play,
    startThinkMusic: startThinkMusic,
    stopThinkMusic: stopThinkMusic,
    cueScoreUpdate: cueScoreUpdate
  };
})();
