/* ═══════════════════════════════════════════════════════════════
   Solitaire — deal.js
   Seeded shuffle + daily-seed derivation. No deps, deterministic.
   Exposes window.SolitaireDeal.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // SUITS lives in engine.js; we read it at deal time so the canonical
  // ordering stays in one place.
  function suits() { return window.SolitaireEngine.SUITS; }

  // Hash a string to a 32-bit unsigned int (xfnv1a) — used to fold the
  // human-readable seed string into a numeric PRNG seed.
  function xfnv1a(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // mulberry32 — small, fast 32-bit PRNG. Good enough for shuffling 52 cards.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function freshDeck() {
    const deck = [];
    for (const suit of suits()) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ suit, rank, faceUp: false });
      }
    }
    return deck;
  }

  // Fisher-Yates with a seeded PRNG.
  function shuffleSeeded(deck, seed) {
    const rng = mulberry32(xfnv1a(String(seed)));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    return deck;
  }

  function shuffledDeck(seed) {
    return shuffleSeeded(freshDeck(), seed);
  }

  // Daily seed = local-date YYYY-MM-DD. Same day, same deal worldwide.
  function dailySeed(now) {
    const d = now || new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }
  // Numeric "deal number" for display — small int derived from the seed.
  function seedDealNumber(seed) {
    return xfnv1a('deal:' + seed) % 100000;
  }
  // A random per-session seed for the "New deal" button.
  function randomSeed() {
    return 'r-' + Math.random().toString(36).slice(2, 10);
  }

  window.SolitaireDeal = {
    shuffledDeck,
    dailySeed,
    seedDealNumber,
    randomSeed
  };
})();
