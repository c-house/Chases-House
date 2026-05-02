/* ═══════════════════════════════════════════════════════════════
   Embershore — dialogue.js
   NPC text data + dialogue-box state machine + {name} interpolation.
   PR1 stub — fleshed out in step 6.
   See docs/design/019-embershore-architecture.md §13.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function start(state, npcId) { /* step 6 */ }
  function advance(state) { /* step 6 */ }
  function isActive(state) { return state && state.dialogue != null; }
  function current(state) { return null; }
  function interpolate(text, state) {
    return String(text || '').replace(/\{name\}/g, (state && state.name) || 'cinder');
  }
  window.EmbershoreDialogue = {
    LINES: {},
    TOTEM_LINES: {},
    BARD_VERSES: {},
    start: start,
    advance: advance,
    isActive: isActive,
    current: current,
    interpolate: interpolate,
  };
})();
