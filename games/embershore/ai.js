/* ═══════════════════════════════════════════════════════════════
   Embershore — ai.js
   Per-enemy behaviors + totem hint resolver + bard verse picker.
   PR1 stub — fleshed out in PR2 (enemies) and PR3 (bard / totems).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function enemyStep(state, enemy) { /* PR2 */ }
  function totemLineFor(state, totem) { return 'the ember-glow remembers.'; }
  function bardVerseFor(state) { return null; }
  function bossStep(state, boss) { /* PR2 */ }
  window.EmbershoreAI = {
    enemyStep: enemyStep,
    totemLineFor: totemLineFor,
    bardVerseFor: bardVerseFor,
    bossStep: bossStep,
  };
})();
