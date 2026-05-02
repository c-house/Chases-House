/* ═══════════════════════════════════════════════════════════════
   Uno — render.js
   DOM rendering + animation orchestration. Full state-driven render.
   Visual contract: docs/design/uno-preview.html.
   Exposes window.UnoRender.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const COLOR_VAR = {
    red:    'var(--uno-red)',
    yellow: 'var(--uno-yellow)',
    green:  'var(--uno-green)',
    blue:   'var(--uno-blue)'
  };
  const VALUE_GLYPH = {
    skip:    'g-skip',
    reverse: 'g-reverse',
    draw2:   'g-draw2',
    wild:    'g-wild',
    wild4:   'g-draw4'
  };

  const els = {};      // cached DOM refs
  let reduced = false;

  function init(opts) {
    els.table     = document.getElementById('uno-table');
    els.deck      = document.getElementById('hud-deck');
    els.score     = document.getElementById('hud-score');
    els.swatch    = document.getElementById('hud-swatch');
    els.direction = document.getElementById('hud-direction');
    els.menu      = document.getElementById('hud-menu');
    els.opponents = document.getElementById('opponents');
    els.drawPile  = document.getElementById('draw-pile');
    els.drawCount = document.getElementById('draw-count');
    els.discard   = document.getElementById('discard-pile');
    els.burst     = document.getElementById('color-burst');
    els.hand      = document.getElementById('hand');
    els.unoCall   = document.getElementById('uno-call');
    els.confetti  = document.getElementById('confetti');

    reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ── Card factory ────────────────────────────────────────
  // Returns a <div class="card …"> matching the design preview's structure.
  function buildCard(card, opts) {
    opts = opts || {};
    const div = document.createElement('div');
    const classes = ['card'];
    if (card.color === 'wild') classes.push('wild');
    else classes.push(card.color);
    if (opts.classes) classes.push.apply(classes, opts.classes);
    div.className = classes.join(' ');
    if (opts.tabIndex != null) div.tabIndex = opts.tabIndex;
    if (opts.dataIndex != null) div.dataset.index = String(opts.dataIndex);
    if (card.id) div.dataset.cardId = card.id;
    div.dataset.color = card.color;
    div.dataset.value = String(card.value);

    // Top-left corner
    const tl = document.createElement(typeof card.value === 'string' ? 'div' : 'span');
    tl.className = (typeof card.value === 'string' ? 'card-corner-glyph tl' : 'card-corner tl');
    if (typeof card.value === 'string') {
      tl.innerHTML = '<svg viewBox="0 0 60 60"><use href="#' + VALUE_GLYPH[card.value] + '"/></svg>';
      // Replace outer div with svg so corner-glyph CSS applies cleanly
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'card-corner-glyph tl');
      svg.setAttribute('viewBox', '0 0 60 60');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#' + VALUE_GLYPH[card.value]);
      svg.appendChild(use);
      div.appendChild(svg);
    } else {
      tl.textContent = String(card.value);
      div.appendChild(tl);
    }

    // Face + oval
    const face = document.createElement('div');
    face.className = 'card-face';
    const oval = document.createElement('div');
    oval.className = 'card-oval';
    if (typeof card.value === 'string') {
      const glyphSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      glyphSvg.setAttribute('class', 'card-glyph');
      glyphSvg.setAttribute('viewBox', '0 0 60 60');
      const glyphUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      glyphUse.setAttribute('href', '#' + VALUE_GLYPH[card.value]);
      glyphSvg.appendChild(glyphUse);
      oval.appendChild(glyphSvg);
    } else {
      const numeral = document.createElement('span');
      numeral.className = 'card-numeral';
      numeral.textContent = String(card.value);
      oval.appendChild(numeral);
    }
    face.appendChild(oval);
    div.appendChild(face);

    // Bottom-right corner
    if (typeof card.value === 'string') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'card-corner-glyph br');
      svg.setAttribute('viewBox', '0 0 60 60');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#' + VALUE_GLYPH[card.value]);
      svg.appendChild(use);
      div.appendChild(svg);
    } else {
      const br = document.createElement('span');
      br.className = 'card-corner br';
      br.textContent = String(card.value);
      div.appendChild(br);
    }

    return div;
  }

  function buildCardBack() {
    const div = document.createElement('div');
    div.className = 'card back';
    const tl = document.createElement('span');
    tl.className = 'card-corner-pip tl';
    div.appendChild(tl);
    const face = document.createElement('div');
    face.className = 'card-face';
    const oval = document.createElement('div');
    oval.className = 'card-back-oval';
    const txt = document.createElement('span');
    txt.className = 'card-back-text';
    txt.textContent = 'UNO';
    oval.appendChild(txt);
    face.appendChild(oval);
    div.appendChild(face);
    const br = document.createElement('span');
    br.className = 'card-corner-pip br';
    div.appendChild(br);
    return div;
  }

  function showTable(show) {
    els.table.classList.toggle('hidden', !show);
  }

  // ── Full re-render from state ───────────────────────────
  function render(state) {
    if (!state) return;
    if (state.phase === 'TITLE' || state.phase === 'SETUP') {
      showTable(false);
      return;
    }
    showTable(true);
    renderHud(state);
    renderOpponents(state);
    renderDiscard(state);
    renderHand(state);
    renderUnoButton(state);
  }

  function renderHud(state) {
    els.deck.textContent = String(state.drawPile.length);
    els.score.textContent = String(state.scores[playerIndex(state, 'p0')] || 0);
    els.swatch.style.background = COLOR_VAR[state.currentColor] || COLOR_VAR.red;
    document.documentElement.style.setProperty('--current-color', COLOR_VAR[state.currentColor] || COLOR_VAR.red);
    const cur = state.players[state.turnIndex];
    const arrow = state.direction === 1 ? '▶' : '◀';
    els.direction.textContent = arrow + ' ' + (cur ? cur.name.toUpperCase() : '') + ' ' + arrow;
  }

  function renderOpponents(state) {
    els.opponents.innerHTML = '';
    for (let i = 0; i < state.players.length; i++) {
      if (state.players[i].id === 'p0') continue;
      const opp = state.players[i];
      const handSize = state.hands[i].length;

      const div = document.createElement('div');
      div.className = 'opponent';
      if (i === state.turnIndex) div.classList.add('active');
      div.dataset.playerId = opp.id;

      const fan = document.createElement('div');
      fan.className = 'opponent-fan';
      const showCount = Math.min(handSize, 5);
      for (let j = 0; j < showCount; j++) {
        const mb = document.createElement('span');
        mb.className = 'mini-back';
        const offset = (j - (showCount - 1) / 2) * 14;
        const rot = (j - (showCount - 1) / 2) * 6;
        mb.style.transform = 'rotate(' + rot + 'deg) translateX(' + offset + 'px)';
        fan.appendChild(mb);
      }
      if (state.unoCalls[opp.id]) {
        const pip = document.createElement('span');
        pip.className = 'opponent-uno-pip';
        pip.textContent = 'UNO';
        fan.appendChild(pip);
      }
      div.appendChild(fan);

      const name = document.createElement('span');
      name.className = 'opponent-name';
      name.textContent = opp.name;
      div.appendChild(name);

      const count = document.createElement('span');
      count.className = 'opponent-count';
      count.textContent = String(handSize);
      div.appendChild(count);

      els.opponents.appendChild(div);
    }
  }

  function renderDiscard(state) {
    els.discard.innerHTML = '';
    if (state.discard.length === 0) return;
    // Show last 1–2 cards stacked with random tilts
    const visible = state.discard.slice(-2);
    visible.forEach((card, idx) => {
      const cardEl = buildCard(card);
      const tilt = ((card.id ? card.id.charCodeAt(card.id.length - 1) : 0) % 11) - 5;
      cardEl.style.setProperty('--tilt', tilt + 'deg');
      // First card stays in flow to size the wrapper; second stacks on top.
      if (idx === 1) {
        cardEl.style.position = 'absolute';
        cardEl.style.top = '0';
        cardEl.style.left = '0';
        cardEl.style.zIndex = '2';
      }
      els.discard.appendChild(cardEl);
    });
    els.drawCount.textContent = String(state.drawPile.length);
  }

  function renderHand(state) {
    els.hand.innerHTML = '';
    const hand = state.hands[playerIndex(state, 'p0')] || [];
    const isMyTurn = state.players[state.turnIndex].id === 'p0' && state.phase === 'PLAYER_TURN';
    const top = state.discard[state.discard.length - 1];

    hand.forEach((card, idx) => {
      const playable = isMyTurn && (window.UnoGame ? window.UnoGame.isPlayable(card, top, state.currentColor, state) : false);
      const classes = playable ? ['playable'] : (isMyTurn ? ['dimmed'] : []);
      const el = buildCard(card, { classes: classes, tabIndex: 0, dataIndex: idx });

      // Fan tilt — symmetric around center
      const center = (hand.length - 1) / 2;
      const offset = idx - center;
      const rot = offset * 6;
      const yOff = Math.abs(offset) * 4;
      el.style.setProperty('--hand-rot', rot + 'deg');
      el.style.setProperty('--hand-y', yOff + 'px');

      els.hand.appendChild(el);
    });
  }

  function renderUnoButton(state) {
    const myIdx = playerIndex(state, 'p0');
    const myHand = state.hands[myIdx] || [];
    const isMyTurn = state.players[state.turnIndex].id === 'p0';
    // Show when it's my turn and I'm about to play down to 1, OR I'm at 1 and haven't called yet.
    const show = (isMyTurn && myHand.length === 2 && state.phase === 'PLAYER_TURN')
              || (myHand.length === 1 && !state.unoCalls.p0 && state.phase !== 'ROUND_END');
    els.unoCall.classList.toggle('hidden', !show);
  }

  function playerIndex(state, id) {
    for (let i = 0; i < state.players.length; i++) if (state.players[i].id === id) return i;
    return -1;
  }

  // ── Animation: card-fly hand → pile ─────────────────────
  function animateCardPlayed(state, ev) {
    if (reduced) return;
    // Build a flying clone at the source's screen position, then animate to discard center.
    const cardEl = buildCard(ev.card);
    cardEl.classList.add('flying');
    document.body.appendChild(cardEl);

    const sourceRect = ev.fromRect || els.discard.getBoundingClientRect();
    const targetRect = els.discard.getBoundingClientRect();
    const rotStart = (Math.random() * 10 - 5);
    const rotEnd = ((ev.card.id ? ev.card.id.charCodeAt(ev.card.id.length - 1) : 0) % 11) - 5;

    cardEl.style.left = (sourceRect.left + (sourceRect.width - cardEl.offsetWidth) / 2) + 'px';
    cardEl.style.top  = (sourceRect.top  + (sourceRect.height - cardEl.offsetHeight) / 2) + 'px';
    cardEl.style.transform = 'rotate(' + rotStart + 'deg)';

    requestAnimationFrame(() => {
      const dx = (targetRect.left + targetRect.width / 2) - (sourceRect.left + sourceRect.width / 2);
      const dy = (targetRect.top + targetRect.height / 2) - (sourceRect.top + sourceRect.height / 2);
      cardEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rotEnd + 'deg)';
    });

    setTimeout(() => {
      if (cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
    }, 290);
  }

  function fireColorBurst() {
    if (reduced) return;
    els.burst.classList.remove('fire');
    void els.burst.offsetWidth;
    els.burst.classList.add('fire');
  }

  function animateSkipJolt(targetId) {
    if (reduced) return;
    const el = els.opponents.querySelector('[data-player-id="' + targetId + '"]');
    if (!el) return;
    el.classList.remove('skip-jolt');
    void el.offsetWidth;
    el.classList.add('skip-jolt');
  }

  function applyEvents(state, events) {
    if (!events || !events.length) return;
    events.forEach((ev) => {
      switch (ev.type) {
        case 'card-played':
          animateCardPlayed(state, ev);
          if (ev.card && ev.card.color === 'wild') fireColorBurst();
          break;
        case 'wild-color':
          fireColorBurst();
          break;
        case 'skip':
          animateSkipJolt(ev.skippedId);
          break;
      }
    });
  }

  function fireConfetti(winnerColor) {
    if (reduced) return;
    const palette = [
      'var(--uno-red)','var(--uno-yellow)','var(--uno-green)','var(--uno-blue)','var(--brass)','var(--uno-cream)'
    ];
    for (let i = 0; i < 40; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = palette[i % palette.length];
      piece.style.animationDelay = (Math.random() * 0.8) + 's';
      piece.style.animationDuration = (1.8 + Math.random() * 1.2) + 's';
      els.confetti.appendChild(piece);
    }
    setTimeout(() => { els.confetti.innerHTML = ''; }, 3500);
  }

  function showOverlay(id) {
    document.querySelectorAll('.overlay').forEach((el) => el.classList.add('hidden'));
    const target = document.getElementById('overlay-' + id);
    if (target) target.classList.remove('hidden');
  }

  function hideOverlays() {
    document.querySelectorAll('.overlay').forEach((el) => el.classList.add('hidden'));
  }

  function setReducedMotion(v) { reduced = v; }

  window.UnoRender = {
    init: init,
    render: render,
    applyEvents: applyEvents,
    fireConfetti: fireConfetti,
    showOverlay: showOverlay,
    hideOverlays: hideOverlays,
    buildCard: buildCard,
    buildCardBack: buildCardBack,
    setReducedMotion: setReducedMotion,
    fireColorBurst: fireColorBurst
  };
})();
