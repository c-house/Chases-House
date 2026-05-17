/* ═══════════════════════════════════════════════════════════════
   Shared — storage.js
   localStorage helpers used across multiple games on the site.
   safeGet returns the default on missing keys silently, and on
   parse errors logs a console.warn before returning the default.
   safeSet swallows quota/serialize errors and returns a boolean.
   See docs/adr/028-castle-tower-defense-3d.md §14.
   Exposes window.SharedStorage.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function safeGet(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[storage] safeGet failed for', key, e);
      return defaultValue;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[storage] safeSet failed for', key, e);
      return false;
    }
  }

  window.SharedStorage = { safeGet, safeSet };
})();
