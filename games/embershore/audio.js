/* ═══════════════════════════════════════════════════════════════
   Embershore — audio.js
   Web Audio init, sample loading, music + SFX. Mirrors games/pacman/audio.js.
   PR1 stub — actual buses wired in step 5.
   See docs/design/019-embershore-architecture.md §11.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const noop = function () {};
  window.EmbershoreAudio = {
    ensure: noop,
    resume: noop,
    loadAll: function () { return Promise.resolve(); },
    setMuted: noop,
    isMuted: function () { return false; },
    setVolume: noop,
    sync: noop,
    play: noop,
    resetForNewSession: noop,
  };
})();
