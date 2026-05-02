/* ═══════════════════════════════════════════════════════════════════════
   Underhearth — storage.js
   Persistence helpers — three localStorage stores:
     underhearth-run       mid-run save (full state, byte-identical resume)
     underhearth-memorial  top-20 death records, split into free / daily
     underhearth-ghost     single most-recent death's loot (depth/x/y/items/gold)
   All stores are version-tagged ({v: 1, ...}); on version mismatch the
   helper returns null/default (caller falls back) and the next write
   re-tags. Audio settings have their own helpers in audio.js.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const VERSION       = 1;
  const RUN_KEY       = 'underhearth-run';
  const MEMORIAL_KEY  = 'underhearth-memorial';
  const GHOST_KEY     = 'underhearth-ghost';
  const TOP_N         = 20;

  // ── Generic helpers ────────────────────────────────────────────────────
  function readJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== VERSION) return null;
      return parsed;
    } catch (_) { return null; }
  }
  function writeJSON(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(Object.assign({ v: VERSION }, obj))); }
    catch (_) { /* quota / private mode → silently skip */ }
  }
  function clearKey(key) { try { localStorage.removeItem(key); } catch (_) {} }

  // ── Run save / load ────────────────────────────────────────────────────
  // Uint8Array fields (floor.tiles, floor.seen) round-trip through plain
  // arrays — JSON cannot serialize typed arrays directly.
  function saveRun(state) {
    if (!state) return;
    writeJSON(RUN_KEY, stripNonSerializable(state));
  }
  function loadRun() {
    const raw = readJSON(RUN_KEY);
    return raw ? rebuildTypedArrays(raw) : null;
  }
  function clearRun() { clearKey(RUN_KEY); }

  function stripNonSerializable(s) {
    return Object.assign({}, s, {
      floor: s.floor ? Object.assign({}, s.floor, {
        tiles: Array.from(s.floor.tiles),
        seen:  Array.from(s.floor.seen),
      }) : null,
    });
  }
  function rebuildTypedArrays(s) {
    if (s && s.floor) {
      s.floor.tiles = new Uint8Array(s.floor.tiles);
      s.floor.seen  = new Uint8Array(s.floor.seen);
    }
    return s;
  }

  // ── Memorial ───────────────────────────────────────────────────────────
  function loadMemorial() {
    const raw = readJSON(MEMORIAL_KEY);
    if (!raw) return { v: VERSION, free: [], daily: [] };
    return { v: VERSION, free: raw.free || [], daily: raw.daily || [] };
  }
  function saveMemorial(mem) {
    writeJSON(MEMORIAL_KEY, { free: mem.free || [], daily: mem.daily || [] });
  }
  function recordDeath(record) {
    const mem = loadMemorial();
    const list = record.daily ? mem.daily : mem.free;
    list.push(record);
    list.sort(compareDeath);
    if (list.length > TOP_N) list.length = TOP_N;
    saveMemorial(mem);
  }
  function compareDeath(a, b) {
    if (!!a.win !== !!b.win) return a.win ? -1 : 1; // wins first
    if (a.depth !== b.depth) return b.depth - a.depth; // deeper first
    if (a.turns !== b.turns) return a.turns - b.turns; // fewer turns first
    return (b.ts || 0) - (a.ts || 0);                  // newer first
  }
  function clearMemorial() { clearKey(MEMORIAL_KEY); }

  // ── Ghost-of-last-death (one record, overwritten each death) ───────────
  function saveGhost(g) {
    if (!g) return;
    writeJSON(GHOST_KEY, g);
  }
  function loadGhost() {
    return readJSON(GHOST_KEY);
  }
  function clearGhost() { clearKey(GHOST_KEY); }

  window.UnderhearthStorage = {
    saveRun, loadRun, clearRun,
    loadMemorial, recordDeath, clearMemorial,
    saveGhost, loadGhost, clearGhost,
  };
})();
