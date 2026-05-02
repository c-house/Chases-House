/* ═══════════════════════════════════════════════════════════════
   Uno — ai.js
   Bot strategies. Pure-function: chooseAction(playerIdx, state, difficulty).
   No module state. All decisions are deterministic given inputs.
   Exposes window.UnoAI.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const COLORS = ['red', 'yellow', 'green', 'blue'];

  const DIFFICULTY_CONFIG = {
    easy:   { holdWilds: false, blockLeader: false, useColorMemory: false, autoUnoCatch: 0.3, lookahead: 0 },
    normal: { holdWilds: true,  blockLeader: true,  useColorMemory: false, autoUnoCatch: 0.7, lookahead: 0 },
    hard:   { holdWilds: true,  blockLeader: true,  useColorMemory: true,  autoUnoCatch: 0.9, lookahead: 1 }
  };

  function getDifficultyConfig(name) {
    return DIFFICULTY_CONFIG[name] || DIFFICULTY_CONFIG.normal;
  }

  function isPlayable(card, top, currentColor) {
    if (!top) return true;
    if (card.color === 'wild') return true;
    if (card.color === currentColor) return true;
    if (card.value === top.value && top.color !== 'wild') return true;
    return false;
  }

  function getPlayable(hand, state) {
    const top = state.discard[state.discard.length - 1];
    if (state.drawStack > 0) {
      // Only same-value stacks
      return hand.filter((c) => c.value === state.stackingValue);
    }
    return hand.filter((c) => isPlayable(c, top, state.currentColor));
  }

  function colorCounts(hand) {
    const c = { red: 0, yellow: 0, green: 0, blue: 0 };
    hand.forEach((card) => { if (card.color !== 'wild') c[card.color]++; });
    return c;
  }

  function dominantColor(hand) {
    const c = colorCounts(hand);
    let best = null, max = -1;
    COLORS.forEach((col) => { if (c[col] > max) { best = col; max = c[col]; } });
    return best || 'red';
  }

  // ── Heuristic scoring ───────────────────────────────────
  function scorePlay(card, state, hand, cfg) {
    let s = 0;

    // 1. Going-out bonus — overrides everything
    if (hand.length === 1) return 1000;

    // 2. Dump high-value cards (Easy doesn't care)
    if (cfg.holdWilds) {
      // Wilds are saved for emergencies; penalize playing them
      if (card.color === 'wild') s -= 18;
    }
    s += card.points * 0.5;

    // 3. Block the leader: if next player has ≤2 cards, prefer color change / disruptors
    if (cfg.blockLeader) {
      const nextIdx = (state.turnIndex + state.direction + state.players.length) % state.players.length;
      const nextHandSize = state.hands[nextIdx].length;
      if (nextHandSize <= 2) {
        if (card.value === 'skip')    s += 18;
        if (card.value === 'reverse' && state.players.length > 2) s += 14;
        if (card.value === 'draw2')   s += 22;
        if (card.value === 'wild4')   s += 30;
        // Color-change wild against leader is strong
        if (card.color === 'wild' && card.value === 'wild') s += 8;
      }
    }

    // 4. Color memory: dump lesser-played colors first (Hard only)
    if (cfg.useColorMemory) {
      const ownCounts = colorCounts(hand);
      if (card.color !== 'wild' && ownCounts[card.color] === 1) {
        // Last of this color — dump now to avoid being color-locked
        s += 4;
      }
    }

    // 5. Stacking continuation
    if (state.drawStack > 0 && card.value === state.stackingValue) s += 12;

    return s;
  }

  function chooseAction(playerIdx, state, difficulty) {
    const cfg = getDifficultyConfig(difficulty);
    const hand = state.hands[playerIdx];
    const playable = getPlayable(hand, state);

    if (playable.length === 0) {
      return { type: 'draw' };
    }

    // Score each playable card
    const scored = playable.map((card) => ({
      card: card,
      score: scorePlay(card, state, hand, cfg)
    }));

    // Sort highest first; in lookahead Hard tier, evaluate top 3 with a 1-ply rollout
    scored.sort((a, b) => b.score - a.score);
    let best = scored[0];

    if (cfg.lookahead > 0 && scored.length > 1) {
      // Simple 1-ply: prefer plays that leave the next player without a same-color match
      const nextIdx = (state.turnIndex + state.direction + state.players.length) % state.players.length;
      const nextHand = state.hands[nextIdx];
      scored.slice(0, 3).forEach((entry) => {
        const newColor = entry.card.color === 'wild' ? dominantColor(hand) : entry.card.color;
        const newTop = entry.card;
        const nextPlayable = nextHand.filter((c) => isPlayable(c, newTop, newColor));
        if (nextPlayable.length === 0) entry.score += 25;
      });
      scored.sort((a, b) => b.score - a.score);
      best = scored[0];
    }

    const action = { type: 'play', cardId: best.card.id };
    if (best.card.color === 'wild') action.chosenColor = dominantColor(hand);
    return action;
  }

  window.UnoAI = {
    chooseAction: chooseAction,
    getDifficultyConfig: getDifficultyConfig
  };
})();
