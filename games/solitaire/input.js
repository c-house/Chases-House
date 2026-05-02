/* ═══════════════════════════════════════════════════════════════
   Solitaire — input.js
   Pointer drag-drop, click-tap, keyboard, gamepad polling.
   Routes user intent to game.js via the actions object.
   Exposes window.SolitaireInput.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const DRAG_THRESHOLD = 6;   // px before pointerdown becomes a drag
  const PAD = () => window.SharedGamepad;
  const RENDER = () => window.SolitaireRender;
  const ENGINE = () => window.SolitaireEngine;

  let actions = null;     // bound by init()
  let stateRef = null;    // game.js calls setState() each tick

  // ── Drag bookkeeping ──────────────────────────────────────────
  let drag = null;        // { startX, startY, pointerId, fromPile, fromIdx,
                          //   els, ghosts, currentTarget, count }

  // ── Click-tap selection (mobile-first fallback) ───────────────
  let selection = null;   // { fromPile, count, els }

  // ── Keyboard cursor ───────────────────────────────────────────
  // 11 piles in order: stock, waste, F0..F3, T0..T6
  const PILE_ORDER = ['stock', 'waste',
    'foundation-spade', 'foundation-heart', 'foundation-diamond', 'foundation-club',
    'tableau-0', 'tableau-1', 'tableau-2', 'tableau-3', 'tableau-4', 'tableau-5', 'tableau-6'];
  let kbFocusIdx = 6;     // start on tableau-0

  // ── Gamepad polling ──────────────────────────────────────────
  let padRaf = 0;
  let padDirCooldown = 0;

  // ── init / state plumbing ─────────────────────────────────────
  function init(boundActions) {
    actions = boundActions;
    bindPointerHandlers();
    bindClickHandlers();
    bindKeyboardHandlers();
    bindGamepad();
  }
  function setState(s) { stateRef = s; }

  // ── Pointer drag-drop ─────────────────────────────────────────
  function bindPointerHandlers() {
    const table = document.getElementById('table');
    if (!table) return;
    table.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerDown(e) {
    if (!stateRef || stateRef.won) return;
    const cardEl = e.target.closest('.card');
    const pileEl = e.target.closest('.pile');

    // Stock — click anywhere on the stock pile (face-down card OR the empty
    // recycle slot) draws immediately. Never enters drag mode.
    if (pileEl && pileEl.classList.contains('pile-stock')) {
      actions.draw();
      return;
    }

    if (!cardEl) {
      // Click on a pile-slot — used by tap-to-place an existing selection.
      if (pileEl && selection) tryPlaceSelection(pileIdOf(pileEl));
      return;
    }
    const info = cardLocator(cardEl);
    if (!info) return;
    const { pileId, idxFromTop, count } = info;

    // Face-down tableau cards aren't movable — ignore.
    if (cardEl.classList.contains('face-down')) return;

    // Multi-card pickup is allowed only from tableau when the run starting
    // here is itself a valid run.
    if (pileId.startsWith('tableau-') && count > 1) {
      const col = ENGINE().pileArray(stateRef, pileId);
      const slice = col.slice(col.length - count);
      if (!ENGINE().isValidRun(slice)) return;
    }

    drag = {
      pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      curX: e.clientX, curY: e.clientY,
      fromPile: pileId,
      cardEl,
      els: [],
      ghosts: [],
      moved: false,
      count
    };
    cardEl.setPointerCapture && cardEl.setPointerCapture(e.pointerId);
  }

  // From a card element, derive { pileId, idxFromTop, count of cards beneath it }
  function cardLocator(cardEl) {
    const pileEl = cardEl.closest('.pile');
    if (!pileEl) return null;
    const pileId = pileIdOf(pileEl);
    const cards = Array.from(pileEl.querySelectorAll('.card'));
    const idx = cards.indexOf(cardEl);
    if (idx === -1) return null;
    // Number of cards from the chosen card to the top of the pile (inclusive)
    const count = cards.length - idx;
    return { pileId, idxFromTop: count - 1, count };
  }

  function pileIdOf(pileEl) {
    if (pileEl.classList.contains('pile-stock')) return 'stock';
    if (pileEl.classList.contains('pile-waste')) return 'waste';
    if (pileEl.dataset.suit) return 'foundation-' + pileEl.dataset.suit;
    if (pileEl.dataset.col) return 'tableau-' + pileEl.dataset.col;
    return null;
  }

  function onPointerMove(e) {
    if (!drag) return;
    drag.curX = e.clientX; drag.curY = e.clientY;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) startDrag();

    // Translate the tilted card(s). Head gets the full tilt + bigger scale;
    // trail cards (drag.els[1..]) follow with a softer tilt and smaller scale
    // so the eye reads the head as "the one being grabbed".
    const tilt = Math.max(-6, Math.min(6, dx * 0.06));
    drag.cardEl.style.setProperty('--tilt', tilt.toFixed(1) + 'deg');
    drag.cardEl.style.transform =
      'translate(' + dx + 'px,' + dy + 'px) rotate(' + tilt.toFixed(1) + 'deg) scale(1.04)';
    for (let i = 1; i < drag.els.length; i++) {
      drag.els[i].style.transform =
        'translate(' + dx + 'px,' + dy + 'px) rotate(' + (tilt * 0.6).toFixed(1) + 'deg) scale(1.03)';
    }

    // Live drop-target preview
    const overPile = pileUnderPoint(e.clientX, e.clientY);
    const overId = overPile ? pileIdOf(overPile) : null;
    if (overId && overId !== drag.fromPile && isLegalDrop(overId)) {
      RENDER().highlightDropTarget(overId);
      drag.currentTarget = overId;
    } else {
      RENDER().clearDropTargets();
      drag.currentTarget = null;
    }
  }

  function startDrag() {
    drag.moved = true;
    const pileEl = drag.cardEl.closest('.pile');
    const allCards = Array.from(pileEl.querySelectorAll('.card'));
    const startIdx = allCards.indexOf(drag.cardEl);
    drag.els = allCards.slice(startIdx);   // includes the head + trail
    drag.cardEl.classList.add('dragging');
    for (let i = 1; i < drag.els.length; i++) drag.els[i].classList.add('dragging-trail');
  }

  function onPointerUp(e) {
    if (!drag) return;
    const wasDrag = drag.moved;
    const fromPile = drag.fromPile;
    const target = drag.currentTarget;

    // Reset any drag styles regardless of outcome
    for (const el of drag.els) {
      el.classList.remove('dragging', 'dragging-trail');
      el.style.transform = '';
      el.style.setProperty('--tilt', '');
    }
    RENDER().clearDropTargets();

    if (wasDrag) {
      if (target && target !== fromPile) {
        const ok = actions.move(fromPile, target, drag.count);
        if (!ok && drag.cardEl) RENDER().flashIllegal(drag.cardEl);
      } else {
        // Dropped over no valid target — just snap back (visual only)
      }
    } else {
      // Treat as a tap
      handleTap(fromPile, drag.count, drag.cardEl);
    }
    drag = null;
  }

  function pileUnderPoint(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const p = el.closest && el.closest('.pile');
      if (p) return p;
    }
    return null;
  }

  function isLegalDrop(toPile) {
    if (!drag || !stateRef) return false;
    if (drag.count > 1 && !toPile.startsWith('tableau-')) return false;
    const fromArr = ENGINE().pileArray(stateRef, drag.fromPile);
    if (!fromArr || fromArr.length < drag.count) return false;
    const slice = fromArr.slice(fromArr.length - drag.count);
    if (toPile.startsWith('foundation-')) {
      if (drag.count !== 1) return false;
      const suit = toPile.slice(11);
      return ENGINE().canPlaceOnFoundation(slice[0], stateRef.foundations[suit], suit);
    }
    if (toPile.startsWith('tableau-')) {
      const dest = ENGINE().topCard(stateRef, toPile);
      return ENGINE().canPlaceOnTableau(slice[0], dest);
    }
    return false;
  }

  // ── Click-tap fallback ────────────────────────────────────────
  // Clicking a card without dragging: try auto-foundation; else select for tap-to-place.
  // Clicking the stock: draw.
  function handleTap(pileId, count, cardEl) {
    if (pileId === 'stock') { actions.draw(); return; }
    // If something is already selected and we tap a different pile, try place
    if (selection && pileId !== selection.fromPile) {
      tryPlaceSelection(pileId);
      return;
    }
    // No selection yet — try the auto-foundation shortcut on a single card
    if (count === 1) {
      const top = ENGINE().topCard(stateRef, pileId);
      if (top && top.faceUp && actions.autoFoundation(pileId)) return;
    }
    // Otherwise enter selection mode
    setSelection(pileId, count);
  }

  function setSelection(pileId, count) {
    clearSelection();
    const pileEl = RENDER().pileElement(pileId);
    if (!pileEl) return;
    const cards = Array.from(pileEl.querySelectorAll('.card'));
    const startIdx = Math.max(0, cards.length - count);
    const els = cards.slice(startIdx);
    if (!els.length) return;
    selection = { fromPile: pileId, count, els };
    for (const el of els) el.classList.add('hint'); // reuse hint pulse for "selected"
  }
  function clearSelection() {
    if (!selection) return;
    for (const el of selection.els) el && el.classList.remove('hint');
    selection = null;
  }
  function tryPlaceSelection(toPile) {
    if (!selection) return;
    const ok = actions.move(selection.fromPile, toPile, selection.count);
    if (!ok) {
      const el = selection.els[0];
      if (el) RENDER().flashIllegal(el);
    }
    clearSelection();
  }

  function bindClickHandlers() {
    // Action buttons (Menu, Settings, Undo, Redo, Hint, Mute, …)
    document.body.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action]');
      if (!t) return;
      const action = t.dataset.action;
      if (typeof actions[action] === 'function') {
        actions[action](t, e);
      }
    });

    // Settings inputs
    document.querySelectorAll('input[name="diff"]').forEach(r =>
      r.addEventListener('change', () => actions.setDifficulty(r.value)));
    document.querySelectorAll('input[name="draw"]').forEach(r =>
      r.addEventListener('change', () => actions.setRawSetting('drawSize', +r.value)));
    document.querySelectorAll('input[name="redeal"]').forEach(r =>
      r.addEventListener('change', () => actions.setRawSetting('redeals', r.value)));
    document.querySelectorAll('input[name="score"]').forEach(r =>
      r.addEventListener('change', () => actions.setRawSetting('scoring', r.value)));
    const fc = document.getElementById('opt-four-color');
    if (fc) fc.addEventListener('change', () => actions.toggleFourColor(fc.checked));
    const snd = document.getElementById('opt-sound');
    if (snd) snd.addEventListener('change', () => actions.toggleSound(snd.checked));
  }

  // ── Keyboard ──────────────────────────────────────────────────
  function bindKeyboardHandlers() {
    document.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key;

      if (k === ' ' || k === 'Enter') {
        if (kbFocusIdx === 0) { e.preventDefault(); actions.draw(); return; }
        const pile = PILE_ORDER[kbFocusIdx];
        if (selection) { tryPlaceSelection(pile); e.preventDefault(); return; }
        if (pile.startsWith('tableau-') || pile === 'waste' || pile.startsWith('foundation-')) {
          const top = ENGINE().topCard(stateRef, pile);
          if (top) {
            // Single-card select (for keyboard, multi-pickup uses Shift+Up/Down — out of scope v1)
            setSelection(pile, 1);
            e.preventDefault();
            return;
          }
        }
      }
      if (k === 'Escape') {
        if (selection) { clearSelection(); e.preventDefault(); return; }
        actions.openMenu();
        e.preventDefault();
        return;
      }
      if (k === 'u' || k === 'U' || (e.ctrlKey && k === 'z')) { actions.undo(); e.preventDefault(); return; }
      if ((e.ctrlKey && (k === 'y' || k === 'Z')) || k === 'r') { actions.redo(); e.preventDefault(); return; }
      if (k === 'h' || k === 'H') { actions.hint(); e.preventDefault(); return; }
      if (k === 'n' || k === 'N') { actions.newGame(); e.preventDefault(); return; }
      if (k === 'a' || k === 'A') {
        // Auto-foundation the focused pile, or the waste if focused on stock
        const pile = kbFocusIdx === 0 ? 'waste' : PILE_ORDER[kbFocusIdx];
        if (pile.startsWith('foundation-')) return;
        actions.autoFoundation(pile);
        e.preventDefault();
        return;
      }
      if (k >= '1' && k <= '7') {
        kbFocusIdx = 6 + (+k - 1);
        actions.focusPile(PILE_ORDER[kbFocusIdx]);
        e.preventDefault();
        return;
      }
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
        kbFocusIdx = nextFocus(kbFocusIdx, k);
        actions.focusPile(PILE_ORDER[kbFocusIdx]);
        e.preventDefault();
      }
    });
  }

  // Movement model: the keyboard cursor walks a logical lattice.
  // Up/Down hops between the top row (stock/waste/foundations) and the tableau row.
  function nextFocus(idx, key) {
    const top = idx <= 5;
    if (key === 'ArrowLeft')  return Math.max(0, idx - 1);
    if (key === 'ArrowRight') return Math.min(PILE_ORDER.length - 1, idx + 1);
    if (key === 'ArrowDown' && top) return 6;
    if (key === 'ArrowUp' && !top)  return 0;
    return idx;
  }

  // ── Gamepad ───────────────────────────────────────────────────
  function bindGamepad() {
    const SG = PAD();
    if (!SG) return;
    SG.init({
      onConnect: () => { /* no toast for solo game */ },
      onDisconnect: () => { /* no-op */ }
    });
    pollLoop();
  }
  function pollLoop() {
    const SG = PAD();
    if (!SG) return;
    const pads = SG.listGamepads();
    if (pads.length) {
      const pi = pads[0].index;
      // Direction with cooldown so a held stick doesn't spam
      if (padDirCooldown > 0) padDirCooldown--;
      else {
        const dir = SG.getDirection(pi);
        if (dir) {
          padDirCooldown = 8;
          const k = dir === 'up' ? 'ArrowUp' : dir === 'down' ? 'ArrowDown' :
                    dir === 'left' ? 'ArrowLeft' : 'ArrowRight';
          kbFocusIdx = nextFocus(kbFocusIdx, k);
          actions.focusPile(PILE_ORDER[kbFocusIdx]);
        }
      }
      // Buttons
      if (SG.consumeButtonPress(pi, SG.BUTTONS.A)) {
        if (kbFocusIdx === 0) actions.draw();
        else if (selection) tryPlaceSelection(PILE_ORDER[kbFocusIdx]);
        else setSelection(PILE_ORDER[kbFocusIdx], 1);
      }
      if (SG.consumeButtonPress(pi, SG.BUTTONS.B)) clearSelection();
      if (SG.consumeButtonPress(pi, SG.BUTTONS.X)) actions.draw();
      if (SG.consumeButtonPress(pi, SG.BUTTONS.Y)) actions.hint();
      if (SG.consumeButtonPress(pi, SG.BUTTONS.LB)) actions.undo();
      if (SG.consumeButtonPress(pi, SG.BUTTONS.RB)) actions.redo();
      if (SG.consumeButtonPress(pi, SG.BUTTONS.START)) actions.openMenu();
    }
    padRaf = requestAnimationFrame(pollLoop);
  }
  function teardownGamepad() {
    if (padRaf) cancelAnimationFrame(padRaf);
    padRaf = 0;
    if (PAD()) PAD().teardown();
  }

  window.SolitaireInput = {
    init,
    setState,
    clearSelection,
    teardownGamepad
  };
})();
