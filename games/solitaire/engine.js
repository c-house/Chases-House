/* ═══════════════════════════════════════════════════════════════
   Solitaire — engine.js
   Pure board state + Klondike rules + undo / redo + scoring.
   No DOM, no audio, no timers. Deterministic given a seed.
   Exposes window.SolitaireEngine.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SUITS = ['spade', 'heart', 'diamond', 'club'];
  const RED_SUITS = { heart: true, diamond: true };

  const SCORE = {
    WASTE_TO_TABLEAU:      5,
    WASTE_TO_FOUNDATION:  10,
    TABLEAU_TO_FOUNDATION: 10,
    FOUNDATION_TO_TABLEAU: -15,
    AUTO_FLIP:             5,
    STD_RECYCLE_PENALTY: -100  // Standard scoring only, after first cycle
  };

  // ── Helpers ────────────────────────────────────────────────────
  function isRed(suit) { return !!RED_SUITS[suit]; }
  function isOppositeColor(a, b) { return isRed(a) !== isRed(b); }
  function rankToStr(r) {
    if (r === 1) return 'A';
    if (r === 11) return 'J';
    if (r === 12) return 'Q';
    if (r === 13) return 'K';
    return String(r);
  }

  // Pile id helpers — string ids drive serialization, DOM lookup, and addressing.
  // Format: 'stock', 'waste', 'foundation-<suit>', 'tableau-<0..6>'
  function pileArray(state, id) {
    if (id === 'stock') return state.stock;
    if (id === 'waste') return state.waste;
    if (id.startsWith('foundation-')) return state.foundations[id.slice(11)];
    if (id.startsWith('tableau-')) return state.tableau[+id.slice(8)];
    return null;
  }
  function topCard(state, id) {
    const a = pileArray(state, id);
    return a && a.length ? a[a.length - 1] : null;
  }
  function isTableau(id)    { return id.startsWith('tableau-'); }
  function isFoundation(id) { return id.startsWith('foundation-'); }

  // ── Snapshot — for undo / redo / persistence ──────────────────
  // 52 cards × ~3 fields is tiny; structuredClone is overkill but works.
  // We use a minimal hand-rolled clone because it preserves performance and
  // gives us explicit control over what's snapshotted.
  function cloneCard(c) { return { suit: c.suit, rank: c.rank, faceUp: c.faceUp }; }
  function snapshot(state) {
    return {
      stock: state.stock.map(cloneCard),
      waste: state.waste.map(cloneCard),
      foundations: {
        spade:   state.foundations.spade.map(cloneCard),
        heart:   state.foundations.heart.map(cloneCard),
        diamond: state.foundations.diamond.map(cloneCard),
        club:    state.foundations.club.map(cloneCard)
      },
      tableau: state.tableau.map(col => col.map(cloneCard)),
      redeals: state.redeals,
      movesCount: state.movesCount,
      score: state.score
    };
  }
  function restoreSnapshot(state, snap) {
    state.stock = snap.stock;
    state.waste = snap.waste;
    state.foundations = snap.foundations;
    state.tableau = snap.tableau;
    state.redeals = snap.redeals;
    state.movesCount = snap.movesCount;
    state.score = snap.score;
  }
  function pushHistory(state) {
    state.undoStack.push(snapshot(state));
    state.redoStack.length = 0;
    if (state.undoStack.length > 500) state.undoStack.shift();
  }

  // ── Setup ──────────────────────────────────────────────────────
  function newGame(deck, settings) {
    // deck is a 52-card array from SolitaireDeal.shuffledDeck(seed); we
    // mutate faceUp during dealing. The caller owns seed/settings.
    const drawSize = settings.drawSize === 3 ? 3 : 1;
    const scoring = settings.scoring || 'standard';
    let redeals;
    if (scoring === 'vegas') redeals = (drawSize === 1) ? 1 : 3;
    else if (settings.redeals === '1') redeals = 1;
    else if (settings.redeals === '3') redeals = 3;
    else redeals = Infinity;

    const state = {
      stock: [], waste: [],
      foundations: { spade: [], heart: [], diamond: [], club: [] },
      tableau: [[], [], [], [], [], [], []],
      drawSize, scoring, redeals,
      movesCount: 0,
      score: scoring === 'vegas' ? -52 : 0,
      seed: settings.seed || null,
      undoStack: [],
      redoStack: [],
      won: false,
      stockCycleCount: 0
    };

    let idx = 0;
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const c = deck[idx++];
        c.faceUp = (row === col);
        state.tableau[col].push(c);
      }
    }
    while (idx < deck.length) {
      const c = deck[idx++];
      c.faceUp = false;
      state.stock.push(c);
    }
    return state;
  }

  // ── Rules ──────────────────────────────────────────────────────
  function canPlaceOnTableau(card, destTop) {
    if (!destTop) return card.rank === 13;            // empty column → king only
    if (!destTop.faceUp) return false;
    return isOppositeColor(card.suit, destTop.suit) && card.rank === destTop.rank - 1;
  }
  function canPlaceOnFoundation(card, foundationCards, foundationSuit) {
    if (card.suit !== foundationSuit) return false;
    if (foundationCards.length === 0) return card.rank === 1;
    return card.rank === foundationCards[foundationCards.length - 1].rank + 1;
  }

  // A run of N cards taken from the bottom of a stack must itself be a
  // legal alternating-color descending sequence — this is the rule clones
  // forget. We check the run *before* checking the destination.
  function isValidRun(cards) {
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i].faceUp) return false;
      if (i > 0) {
        if (!isOppositeColor(cards[i - 1].suit, cards[i].suit)) return false;
        if (cards[i].rank !== cards[i - 1].rank - 1) return false;
      }
    }
    return true;
  }

  // ── Move attempts — mutate state and push history if legal ────
  // Each returns true on success (with history pushed), false on no-op.

  function draw(state) {
    if (state.stock.length === 0) return recycle(state);
    pushHistory(state);
    const n = Math.min(state.drawSize, state.stock.length);
    for (let i = 0; i < n; i++) {
      const c = state.stock.pop();
      c.faceUp = true;
      state.waste.push(c);
    }
    state.movesCount++;
    return true;
  }

  function recycle(state) {
    if (state.waste.length === 0) return false;
    if (state.redeals === 0) return false;
    pushHistory(state);
    if (state.redeals !== Infinity) state.redeals--;
    state.stockCycleCount++;
    while (state.waste.length) {
      const c = state.waste.pop();
      c.faceUp = false;
      state.stock.push(c);
    }
    if (state.scoring === 'standard' && state.stockCycleCount > 1) {
      state.score = Math.max(0, state.score + SCORE.STD_RECYCLE_PENALTY);
    }
    state.movesCount++;
    return true;
  }

  // Move `count` cards from the top of `from` onto top of `to`, if legal.
  // Auto-flips a newly-exposed face-down tableau card.
  function tryMove(state, from, to, count) {
    if (from === to) return false;
    count = count || 1;

    const fromArr = pileArray(state, from);
    if (!fromArr || fromArr.length < count) return false;

    const slice = fromArr.slice(fromArr.length - count);
    if (!isValidRun(slice)) return false;

    // Multi-card moves are only legal between tableau columns
    if (count > 1 && (!isTableau(from) || !isTableau(to))) return false;

    if (isFoundation(to)) {
      if (count !== 1) return false;
      const fdnSuit = to.slice(11);
      if (!canPlaceOnFoundation(slice[0], state.foundations[fdnSuit], fdnSuit)) return false;
    } else if (isTableau(to)) {
      if (!canPlaceOnTableau(slice[0], topCard(state, to))) return false;
    } else {
      return false; // can't move to stock or waste
    }

    // Legal — commit.
    pushHistory(state);
    fromArr.splice(fromArr.length - count, count);
    pileArray(state, to).push(...slice);

    // Score
    if (state.scoring === 'vegas') {
      if (isFoundation(to))   state.score += 5;
      // No other Vegas events. Foundation→tableau costs nothing extra.
    } else { // standard / untimed
      if (from === 'waste' && isTableau(to))      state.score += SCORE.WASTE_TO_TABLEAU;
      if (from === 'waste' && isFoundation(to))   state.score += SCORE.WASTE_TO_FOUNDATION;
      if (isTableau(from) && isFoundation(to))    state.score += SCORE.TABLEAU_TO_FOUNDATION;
      if (isFoundation(from) && isTableau(to))    state.score += SCORE.FOUNDATION_TO_TABLEAU;
    }

    // Auto-flip newly-exposed face-down tableau card
    if (isTableau(from) && fromArr.length > 0 && !fromArr[fromArr.length - 1].faceUp) {
      fromArr[fromArr.length - 1].faceUp = true;
      if (state.scoring !== 'vegas') state.score += SCORE.AUTO_FLIP;
    }

    state.movesCount++;
    state.won = checkWin(state);
    return true;
  }

  // Convenience — given a source pile, find a foundation that accepts its
  // top card and move it. Used by the `A` keyboard shortcut and double-click.
  function tryAutoFoundation(state, from) {
    const top = topCard(state, from);
    if (!top || !top.faceUp) return false;
    const fdnId = 'foundation-' + top.suit;
    return tryMove(state, from, fdnId, 1);
  }

  // ── Win / auto-complete ───────────────────────────────────────
  function checkWin(state) {
    return ['spade', 'heart', 'diamond', 'club']
      .every(s => state.foundations[s].length === 13);
  }

  // Auto-complete is offerable when the stock + waste are empty AND every
  // tableau card is face-up. Then any remaining non-foundation card can
  // be flown up by repeated cheapest-foundation moves.
  function canAutoComplete(state) {
    if (state.won) return false;
    if (state.stock.length || state.waste.length) return false;
    for (const col of state.tableau) {
      for (const c of col) if (!c.faceUp) return false;
    }
    // And there must be at least one card left to move
    for (const col of state.tableau) if (col.length) return true;
    return false;
  }

  // Steps the auto-complete one move at a time so the renderer can animate.
  // Returns the move performed { from, to } or null when done.
  function autoCompleteStep(state) {
    if (!canAutoComplete(state)) return null;
    // Find the smallest-rank movable top across all tableau columns
    let best = null;
    for (let col = 0; col < 7; col++) {
      const t = topCard(state, 'tableau-' + col);
      if (!t) continue;
      const fdn = state.foundations[t.suit];
      const need = fdn.length + 1;
      if (t.rank === need) {
        if (!best || t.rank < best.rank) best = { rank: t.rank, from: 'tableau-' + col, to: 'foundation-' + t.suit };
      }
    }
    if (!best) return null;
    if (tryMove(state, best.from, best.to, 1)) return { from: best.from, to: best.to };
    return null;
  }

  // ── Hint — finds one good move; returns null if only "draw" is left.
  // Priority: tableau→foundation (when it doesn't strand a needed card),
  // waste→foundation, tableau move that frees a face-down card,
  // waste→tableau, draw fallback.
  function findHint(state) {
    // 1. Any tableau top → foundation
    for (let col = 0; col < 7; col++) {
      const t = topCard(state, 'tableau-' + col);
      if (t && t.faceUp) {
        const fdnId = 'foundation-' + t.suit;
        if (canPlaceOnFoundation(t, state.foundations[t.suit], t.suit)) {
          // Avoid stranding: only auto-suggest if rank ≤ 2 (always safe)
          // or if the same-color other foundations are at least one behind.
          if (t.rank <= 2 || foundationsCanSpare(state, t)) {
            return { from: 'tableau-' + col, to: fdnId, count: 1 };
          }
        }
      }
    }
    // 2. Waste → foundation
    const w = topCard(state, 'waste');
    if (w) {
      const fdnId = 'foundation-' + w.suit;
      if (canPlaceOnFoundation(w, state.foundations[w.suit], w.suit)) {
        return { from: 'waste', to: fdnId, count: 1 };
      }
    }
    // 3. Any tableau move that frees a face-down card (whole-run move)
    for (let from = 0; from < 7; from++) {
      const col = state.tableau[from];
      // Find the lowest face-up index in this column
      let firstUp = col.findIndex(c => c.faceUp);
      if (firstUp <= 0) continue; // either empty or no face-down beneath
      const run = col.slice(firstUp);
      if (!isValidRun(run)) continue;
      for (let to = 0; to < 7; to++) {
        if (from === to) continue;
        if (canPlaceOnTableau(run[0], topCard(state, 'tableau-' + to))) {
          return { from: 'tableau-' + from, to: 'tableau-' + to, count: run.length };
        }
      }
    }
    // 4. Waste → tableau
    if (w) {
      for (let to = 0; to < 7; to++) {
        if (canPlaceOnTableau(w, topCard(state, 'tableau-' + to))) {
          return { from: 'waste', to: 'tableau-' + to, count: 1 };
        }
      }
    }
    // 5. Smaller tableau→tableau moves (top card only) that uncover a king-spot
    for (let from = 0; from < 7; from++) {
      const t = topCard(state, 'tableau-' + from);
      if (!t || !t.faceUp) continue;
      for (let to = 0; to < 7; to++) {
        if (from === to) continue;
        if (canPlaceOnTableau(t, topCard(state, 'tableau-' + to))) {
          return { from: 'tableau-' + from, to: 'tableau-' + to, count: 1 };
        }
      }
    }
    // 6. Stock has cards or recycle is allowed
    if (state.stock.length > 0 || (state.waste.length && state.redeals !== 0)) {
      return { from: 'stock', to: 'stock', count: 0, draw: true };
    }
    return null;
  }
  // Heuristic: would moving this card to foundation strand the
  // opposite-color one-rank-below card needed elsewhere? Keep it simple —
  // allow the move if the foundation of the *other* color is within 2.
  function foundationsCanSpare(state, card) {
    const otherColors = isRed(card.suit) ? ['spade', 'club'] : ['heart', 'diamond'];
    const myRank = card.rank;
    const lowest = Math.min(
      state.foundations[otherColors[0]].length,
      state.foundations[otherColors[1]].length
    );
    return lowest >= myRank - 2;
  }

  // ── Undo / redo ────────────────────────────────────────────────
  function undo(state) {
    if (!state.undoStack.length) return false;
    state.redoStack.push(snapshot(state));
    restoreSnapshot(state, state.undoStack.pop());
    state.won = checkWin(state);
    return true;
  }
  function redo(state) {
    if (!state.redoStack.length) return false;
    state.undoStack.push(snapshot(state));
    restoreSnapshot(state, state.redoStack.pop());
    state.won = checkWin(state);
    return true;
  }

  // ── Serialization for localStorage ────────────────────────────
  function serialize(state) {
    return {
      v: 1,
      stock: state.stock,
      waste: state.waste,
      foundations: state.foundations,
      tableau: state.tableau,
      drawSize: state.drawSize,
      scoring: state.scoring,
      redeals: state.redeals === Infinity ? -1 : state.redeals,
      movesCount: state.movesCount,
      score: state.score,
      seed: state.seed,
      stockCycleCount: state.stockCycleCount,
      won: state.won
      // Note: undo/redo stacks are deliberately not persisted across reloads
      // — fresh stacks on reload, classic localStorage convention.
    };
  }
  function deserialize(data) {
    if (!data || data.v !== 1) return null;
    return {
      stock: data.stock,
      waste: data.waste,
      foundations: data.foundations,
      tableau: data.tableau,
      drawSize: data.drawSize,
      scoring: data.scoring,
      redeals: data.redeals === -1 ? Infinity : data.redeals,
      movesCount: data.movesCount,
      score: data.score,
      seed: data.seed,
      stockCycleCount: data.stockCycleCount || 0,
      won: !!data.won,
      undoStack: [],
      redoStack: []
    };
  }

  // Public API — intentionally narrow. Rule helpers (isRed,
  // isOppositeColor, checkWin, foundationsCanSpare) stay private to the
  // engine so callers can't duplicate rule logic outside it.
  window.SolitaireEngine = {
    SUITS,
    newGame,
    draw, recycle, tryMove, tryAutoFoundation,
    canAutoComplete, autoCompleteStep,
    findHint,
    undo, redo,
    serialize, deserialize,
    pileArray, topCard, isTableau, isFoundation,
    canPlaceOnTableau, canPlaceOnFoundation, isValidRun,
    rankToStr
  };
})();
