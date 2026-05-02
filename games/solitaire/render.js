/* ═══════════════════════════════════════════════════════════════
   Solitaire — render.js
   DOM card rendering. Reads state, writes DOM. Owns the cascade
   physics. Knows nothing about rules.
   Exposes window.SolitaireRender.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ENGINE = () => window.SolitaireEngine;

  // Pip-layout grid positions per rank — [col, row, invert]
  // (matches the 3×7 grid the static HTML CSS already has)
  const PIPS = {
    2:  [[2,1,0],[2,7,1]],
    3:  [[2,1,0],[2,4,0],[2,7,1]],
    4:  [[1,1,0],[3,1,0],[1,7,1],[3,7,1]],
    5:  [[1,1,0],[3,1,0],[2,4,0],[1,7,1],[3,7,1]],
    6:  [[1,1,0],[3,1,0],[1,4,0],[3,4,0],[1,7,1],[3,7,1]],
    7:  [[1,1,0],[3,1,0],[2,2,0],[1,4,0],[3,4,0],[1,7,1],[3,7,1]],
    8:  [[1,1,0],[3,1,0],[2,2,0],[1,4,0],[3,4,0],[2,6,1],[1,7,1],[3,7,1]],
    9:  [[1,1,0],[3,1,0],[1,2,0],[3,2,0],[2,4,0],[1,6,1],[3,6,1],[1,7,1],[3,7,1]],
    10: [[1,1,0],[3,1,0],[2,2,0],[1,3,0],[3,3,0],[1,5,1],[3,5,1],[2,6,1],[1,7,1],[3,7,1]]
  };

  let dom = null;          // populated in init()
  let cascadeStage = null;
  let cascadeRaf = 0;

  function init() {
    dom = {
      table:        document.getElementById('table'),
      stock:        document.querySelector('[data-pile="stock"]'),
      waste:        document.querySelector('[data-pile="waste"]'),
      foundations:  {
        spade:   document.querySelector('.pile-foundation[data-suit="spade"]'),
        heart:   document.querySelector('.pile-foundation[data-suit="heart"]'),
        diamond: document.querySelector('.pile-foundation[data-suit="diamond"]'),
        club:    document.querySelector('.pile-foundation[data-suit="club"]')
      },
      tableau: [0,1,2,3,4,5,6].map(i =>
        document.querySelector('.pile-column[data-col="' + i + '"]')),
      score: document.querySelector('[data-bind="score"]'),
      timer: document.querySelector('[data-bind="timer"]'),
      moves: document.querySelector('[data-bind="moves"]'),
      seed:  document.querySelector('[data-bind="seed"]'),
      autoBanner: null  // lazily created
    };

    // Wipe the demo cards/slots from every pile
    clearPile(dom.stock);
    clearPile(dom.waste);
    Object.values(dom.foundations).forEach(clearPile);
    dom.tableau.forEach(clearPile);

    // Cascade stage — fixed-position, full-viewport, untouched by layout
    cascadeStage = document.createElement('div');
    cascadeStage.className = 'cascade-stage';
    document.body.appendChild(cascadeStage);
  }

  function clearPile(el) { if (el) el.innerHTML = ''; }

  // Build card HTML — fast & resilient. The CSS already styles these classes.
  function cardHTML(card, opts) {
    opts = opts || {};
    if (!card.faceUp) return '<div class="card face-down" aria-hidden="true"></div>';
    const r = card.rank, s = card.suit;
    const rstr = ENGINE().rankToStr(r);
    const corner = '<span class="rank">' + rstr + '</span>' +
                   '<svg class="suit-tiny"><use href="#suit-' + s + '"/></svg>';
    let centre;
    if (r === 1) {
      centre = '<div class="card-mono"><svg class="mono-suit"><use href="#suit-' + s + '"/></svg></div>';
    } else if (r >= 11) {
      const letter = rstr; // J Q K
      centre = '<div class="card-mono">' +
               '<span class="mono-letter">' + letter + '</span>' +
               '<svg class="mono-suit"><use href="#suit-' + s + '"/></svg></div>';
    } else {
      const layout = PIPS[r] || [];
      const pips = layout.map(([c, row, inv]) =>
        '<svg class="pip' + (inv ? ' invert' : '') +
        '" style="--c:' + c + ';--r:' + row + '"><use href="#suit-' + s + '"/></svg>'
      ).join('');
      centre = '<div class="card-pips">' + pips + '</div>';
    }
    const rankCls = ' rank-' + (r === 1 ? 'A' : rstr);
    const cls = 'card face-up' + rankCls + (opts.top ? ' top' : '');
    return '<div class="' + cls + '" data-suit="' + s + '" data-rank="' + rstr +
           '" data-pid="' + (opts.pid || '') + '"' +
           (opts.style ? ' style="' + opts.style + '"' : '') +
           '>' +
           '<span class="card-corner tl">' + corner + '</span>' +
           centre +
           '<span class="card-corner br">' + corner + '</span>' +
           '</div>';
  }

  // Build the HTML for a tableau column — staggered offsets via inline --i.
  // Face-down cards stack tighter than face-up cards (CSS handles it via
  // --stack-face-up / --stack-face-down vars).
  function tableauColHTML(col, colIdx) {
    if (col.length === 0) {
      return '<div class="pile-slot"></div>';
    }
    let downCount = 0;
    return col.map((c, i) => {
      const opts = {
        top: i === col.length - 1,
        pid: 'tableau-' + colIdx + ':' + i
      };
      let style = '--i:' + i + ';';
      if (c.faceUp) {
        style += '--down-stack: calc(' + downCount + ' * var(--stack-face-down));';
      } else {
        downCount++;
      }
      opts.style = style;
      return cardHTML(c, opts);
    }).join('');
  }

  // Stock pile — render up to 3 stacked face-down cards as a depth illusion;
  // empty state shows a recycle ring.
  function stockHTML(stock, redealsLeft) {
    if (stock.length === 0) {
      return '<div class="pile-slot"><svg class="slot-glyph"><use href="#ic-recycle"/></svg></div>';
    }
    const visible = Math.min(stock.length, 3);
    let html = '';
    for (let i = 0; i < visible; i++) {
      const offset = i;
      html += '<div class="card face-down" aria-hidden="true" data-pid="stock"' +
              (i > 0 ? ' style="position:absolute;top:' + offset + 'px;left:' + offset + 'px"' : '') +
              '></div>';
    }
    return html;
  }

  function wasteHTML(waste, drawSize) {
    if (waste.length === 0) {
      return '<div class="pile-slot"></div>';
    }
    // Show up to drawSize most-recent cards, fanned by --i
    const visibleCount = Math.min(waste.length, drawSize);
    const start = waste.length - visibleCount;
    return waste.slice(start).map((c, i) => {
      const isTop = (start + i) === waste.length - 1;
      return cardHTML(c, {
        top: isTop,
        pid: 'waste:' + (start + i),
        style: '--i:' + i
      });
    }).join('');
  }

  function foundationHTML(cards, suit) {
    if (cards.length === 0) {
      return '<div class="pile-slot"><svg class="slot-glyph"><use href="#suit-' + suit + '"/></svg></div>';
    }
    const top = cards[cards.length - 1];
    return cardHTML(top, { top: true, pid: 'foundation-' + suit });
  }

  // ── Full render ────────────────────────────────────────────────
  function drawAll(state) {
    // Stock + recycle hint
    dom.stock.innerHTML = stockHTML(state.stock, state.redeals);
    dom.stock.classList.toggle('empty', state.stock.length === 0);

    dom.waste.innerHTML = wasteHTML(state.waste, state.drawSize);
    dom.waste.classList.toggle('empty', state.waste.length === 0);

    for (const suit of ENGINE().SUITS) {
      dom.foundations[suit].innerHTML = foundationHTML(state.foundations[suit], suit);
    }

    for (let col = 0; col < 7; col++) {
      dom.tableau[col].innerHTML = tableauColHTML(state.tableau[col], col);
    }

    updateAutoCompleteBanner(state);
  }

  // Rerender just one pile — used after every move for performance and
  // so each pile's animations stay independent.
  function drawPile(state, pileId) {
    if (pileId === 'stock') {
      dom.stock.innerHTML = stockHTML(state.stock, state.redeals);
      dom.stock.classList.toggle('empty', state.stock.length === 0);
    } else if (pileId === 'waste') {
      dom.waste.innerHTML = wasteHTML(state.waste, state.drawSize);
      dom.waste.classList.toggle('empty', state.waste.length === 0);
    } else if (pileId.startsWith('foundation-')) {
      const suit = pileId.slice(11);
      dom.foundations[suit].innerHTML = foundationHTML(state.foundations[suit], suit);
    } else if (pileId.startsWith('tableau-')) {
      const col = +pileId.slice(8);
      dom.tableau[col].innerHTML = tableauColHTML(state.tableau[col], col);
    }
  }

  // ── HUD ────────────────────────────────────────────────────────
  function setHud(state, elapsedMs, seedLabel) {
    if (state.scoring === 'vegas') {
      dom.score.textContent = (state.score >= 0 ? '+$' : '-$') + Math.abs(state.score);
    } else {
      dom.score.textContent = String(state.score);
    }
    dom.moves.textContent = String(state.movesCount);
    if (state.scoring === 'untimed') {
      dom.timer.textContent = '—';
    } else {
      const s = Math.floor(elapsedMs / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      dom.timer.textContent = mm + ':' + ss;
    }
    if (seedLabel) dom.seed.textContent = seedLabel;
  }

  // ── Drop-target ring ──────────────────────────────────────────
  function highlightDropTarget(pileId) {
    clearDropTargets();
    const el = pileElement(pileId);
    if (el) el.classList.add('is-drop-target');
  }
  function clearDropTargets() {
    document.querySelectorAll('.pile.is-drop-target').forEach(el =>
      el.classList.remove('is-drop-target'));
  }
  function pileElement(pileId) {
    if (pileId === 'stock') return dom.stock;
    if (pileId === 'waste') return dom.waste;
    if (pileId.startsWith('foundation-')) return dom.foundations[pileId.slice(11)];
    if (pileId.startsWith('tableau-')) return dom.tableau[+pileId.slice(8)];
    return null;
  }

  // ── Illegal flash + hint pulse ────────────────────────────────
  function flashIllegal(cardEl) {
    if (!cardEl) return;
    cardEl.classList.remove('illegal');
    void cardEl.offsetWidth; // restart the keyframe
    cardEl.classList.add('illegal');
    setTimeout(() => cardEl.classList.remove('illegal'), 400);
  }

  function pulseHint(hint) {
    if (!hint) return;
    document.querySelectorAll('.card.hint').forEach(c => c.classList.remove('hint'));
    if (hint.draw) {
      const stockTop = dom.stock.querySelector('.card.face-down') || dom.stock.querySelector('.pile-slot');
      if (stockTop && stockTop.classList) stockTop.classList.add('hint');
      setTimeout(() => stockTop && stockTop.classList && stockTop.classList.remove('hint'), 2900);
      return;
    }
    const fromEl = pileElement(hint.from);
    if (!fromEl) return;
    const cards = fromEl.querySelectorAll('.card');
    if (!cards.length) return;
    const startIdx = Math.max(0, cards.length - hint.count);
    for (let i = startIdx; i < cards.length; i++) cards[i].classList.add('hint');
    setTimeout(() => {
      for (let i = startIdx; i < cards.length; i++) {
        if (cards[i]) cards[i].classList.remove('hint');
      }
    }, 2900);
  }

  // ── Auto-complete banner ──────────────────────────────────────
  function updateAutoCompleteBanner(state) {
    const should = ENGINE().canAutoComplete(state) && !state.won;
    let banner = document.querySelector('.auto-complete-banner');
    if (should && !banner) {
      banner = document.createElement('div');
      banner.className = 'auto-complete-banner';
      banner.innerHTML = '<span>House is open</span>' +
                         '<button class="cta-primary" data-action="auto-complete" type="button">Auto-finish</button>';
      dom.table.appendChild(banner);
    } else if (!should && banner) {
      banner.remove();
    }
  }

  // ── Win cascade ───────────────────────────────────────────────
  // Clones the foundation top cards as fixed-position elements and runs
  // a small gravity-bounce loop. Reduced-motion users get a fade.
  function beginCascade(state, onDone) {
    cascadeStage.innerHTML = '';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      cascadeStage.classList.add('cascade-reduced');
      setTimeout(() => {
        cascadeStage.classList.remove('cascade-reduced');
        if (onDone) onDone();
      }, 800);
      return;
    }

    // Snapshot the four foundation top-card positions for spawn origins
    const origins = [];
    for (const suit of ['spade', 'heart', 'diamond', 'club']) {
      const el = dom.foundations[suit];
      const rect = el.getBoundingClientRect();
      origins.push({ x: rect.left, y: rect.top, w: rect.width, h: rect.height, suit });
    }

    const stage = cascadeStage;
    const cards = [];
    // Spawn 52 cascade cards over time (one per ~30ms for ~1.5s of spawning)
    const total = 52;
    let spawned = 0;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const G = 0.6;       // gravity (px/frame²)
    const E = 0.72;      // bounce restitution

    function spawnNext() {
      if (spawned >= total) return;
      const idx = spawned++;
      const orig = origins[idx % 4];
      const rank = ((idx >> 2) % 13) + 1;
      // Build a real card via cardHTML, then re-host its inner content on a
      // .cascade-card wrapper so the existing fixed-position styling applies.
      const tmp = document.createElement('div');
      tmp.innerHTML = cardHTML({ suit: orig.suit, rank, faceUp: true }, {});
      const inner = tmp.firstChild;
      const card = document.createElement('div');
      card.className = 'cascade-card card face-up';
      card.setAttribute('data-suit', orig.suit);
      card.setAttribute('data-rank', ENGINE().rankToStr(rank));
      card.innerHTML = inner.innerHTML;
      card.style.left = orig.x + 'px';
      card.style.top = orig.y + 'px';
      card.style.width = orig.w + 'px';
      card.style.height = orig.h + 'px';
      stage.appendChild(card);

      const dir = (idx % 2 === 0) ? -1 : 1;
      const physics = {
        el: card,
        x: orig.x,
        y: orig.y,
        vx: (Math.random() * 4 + 3) * dir,
        vy: -(Math.random() * 6 + 5),
        rot: 0,
        vr: (Math.random() - 0.5) * 6
      };
      cards.push(physics);
    }

    let lastSpawn = 0;
    const start = performance.now();
    function tick(t) {
      if (spawned < total && t - lastSpawn > 28) {
        spawnNext();
        lastSpawn = t;
      }
      for (const c of cards) {
        c.vy += G;
        c.x += c.vx;
        c.y += c.vy;
        c.rot += c.vr;
        if (c.y + 96 > H) {
          c.y = H - 96;
          c.vy = -c.vy * E;
          c.vx *= 0.92;
        }
        c.el.style.transform = 'translate(' + Math.round(c.x - parseFloat(c.el.style.left)) + 'px,' +
                               Math.round(c.y - parseFloat(c.el.style.top)) + 'px) rotate(' + c.rot.toFixed(1) + 'deg)';
      }
      // End condition — if all cards are off-screen-right and we've spawned them all
      const allDone = spawned >= total && cards.every(c => c.x > W + 200);
      if (allDone || (t - start) > 9000) {
        cascadeRaf = 0;
        cascadeStage.innerHTML = '';
        if (onDone) onDone();
        return;
      }
      cascadeRaf = requestAnimationFrame(tick);
    }
    cascadeRaf = requestAnimationFrame(tick);
  }

  function stopCascade() {
    if (cascadeRaf) cancelAnimationFrame(cascadeRaf);
    cascadeRaf = 0;
    cascadeStage.innerHTML = '';
  }

  // ── Misc ──────────────────────────────────────────────────────
  function setBodyClass(cls, on) { document.body.classList.toggle(cls, !!on); }

  // Find the DOM element for the topmost card on a pile
  function topCardEl(pileId) {
    const el = pileElement(pileId);
    if (!el) return null;
    const cards = el.querySelectorAll('.card.face-up');
    if (cards.length) return cards[cards.length - 1];
    const downs = el.querySelectorAll('.card.face-down');
    return downs.length ? downs[downs.length - 1] : null;
  }

  window.SolitaireRender = {
    init,
    drawAll, drawPile,
    setHud,
    highlightDropTarget, clearDropTargets,
    flashIllegal, pulseHint,
    beginCascade, stopCascade,
    setBodyClass,
    pileElement, topCardEl,
    cardHTML
  };
})();
