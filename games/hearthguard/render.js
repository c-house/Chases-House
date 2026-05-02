/* ═══════════════════════════════════════════════════════════════
   Hearthguard — render.js
   Effectful. The only module besides input.js that touches DOM.
   Reads game state from window.HearthguardState/Units/Missions;
   never duplicates game-rule logic.
   Exposes window.HearthguardRender.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const S = window.HearthguardState;
  const U = window.HearthguardUnits;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK_NS = 'http://www.w3.org/1999/xlink';
  const N = () => window.HearthguardNarrate;
  const A = () => window.HearthguardAudio;

  let root = null;
  let boardEl = null;
  let heroStripEl = null;
  let marginNotesEl = null;
  let lastNoteCount = 0;

  const tileEls = new Map();
  const heroCardEls = new Map();

  const SCREEN_NAMES = ['title', 'briefing', 'play', 'mission-end', 'run-end', 'pause', 'how-to'];

  function mount(rootEl) {
    if (root) return;
    root = rootEl;
    boardEl = root.querySelector('[data-bind="board"]');
    heroStripEl = root.querySelector('[data-bind="hero-strip"]');
    marginNotesEl = root.querySelector('[data-bind="margin-notes"]');

    buildBoard();
    showScreen('title');
  }

  function teardown() {
    root = null;
    boardEl = null;
    heroStripEl = null;
    marginNotesEl = null;
    tileEls.clear();
    heroCardEls.clear();
  }

  function buildBoard() {
    if (!boardEl) return;
    boardEl.innerHTML = '';
    tileEls.clear();
    for (let row = 0; row < S.ROWS; row++) {
      for (let col = 0; col < S.COLS; col++) {
        const tile = S.coordsToTile(col, row);
        const btn = document.createElement('button');
        btn.className = 'hg-tile';
        btn.type = 'button';
        btn.setAttribute('role', 'gridcell');
        btn.dataset.tile = tile;
        btn.dataset.row = row;
        btn.dataset.col = col;
        btn.dataset.grain = ((col * 7 + row * 13) % 4);
        btn.dataset.state = 'empty';
        btn.dataset.occupant = '';
        btn.setAttribute('aria-label', `${tile}, empty`);

        const glyph = document.createElementNS(SVG_NS, 'svg');
        glyph.setAttribute('class', 'hg-glyph');
        glyph.setAttribute('viewBox', '0 0 32 32');
        glyph.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS(SVG_NS, 'use');
        glyph.appendChild(use);
        btn.appendChild(glyph);

        boardEl.appendChild(btn);
        tileEls.set(tile, btn);
      }
    }
  }

  function buildHeroCard(unit) {
    const card = document.createElement('button');
    card.className = 'hg-hero-card';
    card.type = 'button';
    card.dataset.unit = unit.id;
    card.dataset.selected = 'false';
    card.dataset.spent = 'false';

    const glyphId = '#' + U.statsFor(unit.type).glyphId;
    const glyph = document.createElementNS(SVG_NS, 'svg');
    glyph.setAttribute('class', 'hg-glyph');
    glyph.setAttribute('viewBox', '0 0 32 32');
    glyph.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttributeNS(XLINK_NS, 'href', glyphId);
    use.setAttribute('href', glyphId);
    glyph.appendChild(use);

    const name = document.createElement('span');
    name.className = 'hg-hero-name';
    name.textContent = U.statsFor(unit.type).label;

    const hp = document.createElement('span');
    hp.className = 'hg-hero-hp';
    hp.setAttribute('aria-label', `${unit.hp} of ${unit.maxHp} health`);

    card.appendChild(glyph);
    card.appendChild(name);
    card.appendChild(hp);
    return card;
  }

  function showScreen(name) {
    if (!root) return;
    const sections = root.querySelectorAll('[data-screen]');
    sections.forEach(s => {
      const sn = s.getAttribute('data-screen');
      if (!SCREEN_NAMES.includes(sn)) return;
      if (sn === name) {
        s.hidden = false;
        s.removeAttribute('hidden');
      } else if (sn !== 'pause') {
        s.hidden = true;
      }
    });
    const vellum = root.closest('.hg-vellum') || root.parentElement;
    if (vellum) vellum.dataset.screen = name;
  }

  function hideScreen(name) {
    if (!root) return;
    const s = root.querySelector(`[data-screen="${name}"]`);
    if (s) s.hidden = true;
  }

  function syncState(state, prevState) {
    if (!root || !state) return;
    if (state.phase === 'title') return;

    syncHud(state);
    syncBoard(state, prevState);
    syncPlannedActions(state);
    syncHeroStrip(state);
    syncMarginNotes(state);
  }

  function syncPlannedActions(state) {
    for (const btn of tileEls.values()) {
      const g = btn.querySelector('.hg-ghost');
      if (g) g.remove();
      if (btn.dataset.planned === 'true') delete btn.dataset.planned;
    }
    const overlay = root && root.querySelector('[data-bind="board-overlay"]');
    if (overlay) overlay.innerHTML = '';
    if (!state.pendingPlayerActions || state.pendingPlayerActions.length === 0) return;
    if (!boardEl) return;

    const firstTile = tileEls.values().next().value;
    const tilePx = firstTile ? firstTile.getBoundingClientRect().width : 56;

    for (const action of state.pendingPlayerActions) {
      if (action.kind === 'move' && action.fromTile && action.toTile) {
        placeGhost(action.fromTile, U.statsFor(actionUnitType(state, action.unitId)).glyphId);
        markPlanned(action.toTile);
        drawTrail(action.fromTile, action.toTile, overlay, tilePx, false);
      } else if ((action.kind === 'push' || action.kind === 'pull') && action.heroTile && action.targetTile) {
        markPlanned(action.targetTile);
        drawTrail(action.heroTile, action.targetTile, overlay, tilePx, false);
      } else if (action.kind === 'swap' && action.tileA && action.tileB) {
        markPlanned(action.tileA);
        markPlanned(action.tileB);
        drawTrail(action.tileA, action.tileB, overlay, tilePx, true);
      }
    }
  }

  function actionUnitType(state, unitId) {
    const u = S.unitById(state, unitId);
    return u ? u.type : 'knight';
  }

  function placeGhost(tile, glyphId) {
    const btn = tileEls.get(tile);
    if (!btn || !glyphId) return;
    const ghost = document.createElementNS(SVG_NS, 'svg');
    ghost.setAttribute('class', 'hg-ghost');
    ghost.setAttribute('viewBox', '0 0 32 32');
    ghost.setAttribute('aria-hidden', 'true');
    const useEl = document.createElementNS(SVG_NS, 'use');
    useEl.setAttributeNS(XLINK_NS, 'href', '#' + glyphId);
    useEl.setAttribute('href', '#' + glyphId);
    ghost.appendChild(useEl);
    btn.appendChild(ghost);
  }

  function markPlanned(tile) {
    const btn = tileEls.get(tile);
    if (btn) btn.dataset.planned = 'true';
  }

  function drawTrail(fromTile, toTile, overlay, tilePx, isCurve) {
    if (!overlay) return;
    const a = S.tileToCoords(fromTile);
    const b = S.tileToCoords(toTile);
    if (!a || !b) return;

    const x1 = a.col * tilePx + tilePx / 2;
    const y1 = a.row * tilePx + tilePx / 2;
    const x2 = b.col * tilePx + tilePx / 2;
    const y2 = b.row * tilePx + tilePx / 2;

    const line = document.createElementNS(SVG_NS, isCurve ? 'path' : 'line');
    if (isCurve) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - 12;
      line.setAttribute('d', `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`);
    } else {
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
    }
    line.setAttribute('class', 'hg-plan-trail');

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const ax = x2 - Math.cos(angle) * 6;
    const ay = y2 - Math.sin(angle) * 6;
    const w = 5;
    const c1x = ax - Math.cos(angle - Math.PI / 2) * w;
    const c1y = ay - Math.sin(angle - Math.PI / 2) * w;
    const c2x = ax + Math.cos(angle - Math.PI / 2) * w;
    const c2y = ay + Math.sin(angle - Math.PI / 2) * w;
    const tri = document.createElementNS(SVG_NS, 'path');
    tri.setAttribute('d', `M ${x2} ${y2} L ${c1x} ${c1y} L ${c2x} ${c2y} Z`);
    tri.setAttribute('class', 'hg-plan-trail-arrow');

    overlay.appendChild(line);
    overlay.appendChild(tri);
  }

  function syncHud(state) {
    setBind('turn', state.turn);
    setBind('max-turns', state.maxTurns);
    const score = state.runScore + (state.missionScore ? state.missionScore.total : 0);
    setBind('score', score);
    if (state.missionDef) setBind('play-mission-name', state.missionDef.name);
  }

  function syncBoard(state) {
    if (!boardEl || !state.units) return;

    const heroId = state.selectedUnitId;
    const selected = heroId ? S.unitById(state, heroId) : null;

    const moveTiles = new Set();
    const actionTiles = new Set();

    if (selected && selected.side === 'hero' && selected.hp > 0) {
      if (!selected.hasMoved) {
        const stats = U.statsFor(selected.type);
        const reach = S.reachableTiles(state, selected.at, stats.move);
        for (const t of reach.keys()) moveTiles.add(t);
      }
      if (!selected.hasActed) {
        const targets = U.legalActionTargets(state, selected.id);
        for (const t of targets) {
          if (t.targetTile) actionTiles.add(t.targetTile);
          if (t.tileA) actionTiles.add(t.tileA);
          if (t.tileB) actionTiles.add(t.tileB);
        }
      }
    }

    const threatTiles = new Map();
    for (const u of state.units) {
      if (u.side === 'enemy' && u.hp > 0 && u.intent && u.intent.targetTile) {
        const prior = threatTiles.get(u.intent.targetTile);
        threatTiles.set(u.intent.targetTile, {
          dmg: (prior ? prior.dmg : 0) + u.intent.damage,
          kind: u.intent.kind,
          attackerId: u.id,
        });
      }
    }

    const spawnTiles = new Map();
    for (const f of (state.forecasts || [])) {
      if (f.at && f.at !== 'random-edge') spawnTiles.set(f.at, f);
    }

    for (const [tile, btn] of tileEls) {
      const occupant = S.unitAt(state, tile);
      const occId = occupant ? occupant.id : '';
      const occSide = occupant ? occupant.side : '';
      const occType = occupant ? occupant.type : '';

      if (btn.dataset.occupant !== occId) {
        btn.dataset.occupant = occId;
        btn.dataset.occupantSide = occSide;
        const useEl = btn.querySelector('use');
        if (useEl) {
          const href = occupant ? '#' + U.statsFor(occType).glyphId : '';
          useEl.setAttributeNS(XLINK_NS, 'href', href);
          useEl.setAttribute('href', href);
        }
        const glyphEl = btn.querySelector('.hg-glyph');
        if (glyphEl) glyphEl.style.display = occupant ? '' : 'none';
      }

      let stateName = 'empty';
      if (occupant && occupant.id === heroId) stateName = 'selected';
      else if (actionTiles.has(tile)) stateName = 'attack';
      else if (moveTiles.has(tile)) stateName = 'move';
      else if (threatTiles.has(tile)) stateName = 'threat';
      else if (spawnTiles.has(tile)) stateName = 'spawn-warn';

      if (btn.dataset.state !== stateName) btn.dataset.state = stateName;

      let num = btn.querySelector('.hg-threat-num');
      let icon = btn.querySelector('.hg-threat-icon');
      let spawn = btn.querySelector('.hg-spawn-warn-icon');
      const threat = threatTiles.get(tile);
      const showThreat = threat && stateName !== 'selected' && stateName !== 'attack' && stateName !== 'move';

      if (showThreat) {
        if (!num) {
          num = document.createElement('span');
          num.className = 'hg-threat-num';
          btn.appendChild(num);
        }
        num.textContent = threat.dmg;
        if (!icon) {
          icon = document.createElementNS(SVG_NS, 'svg');
          icon.setAttribute('class', 'hg-threat-icon');
          icon.setAttribute('viewBox', '0 0 16 16');
          icon.setAttribute('aria-hidden', 'true');
          const u2 = document.createElementNS(SVG_NS, 'use');
          icon.appendChild(u2);
          btn.appendChild(icon);
        }
        const iconHref = threat.kind === 'ranged' ? '#hg-icon-ranged'
                       : threat.kind === 'magic'  ? '#hg-icon-magic'
                       : '#hg-icon-melee';
        const useEl = icon.querySelector('use');
        if (useEl) {
          useEl.setAttributeNS(XLINK_NS, 'href', iconHref);
          useEl.setAttribute('href', iconHref);
        }
      } else {
        if (num) num.remove();
        if (icon) icon.remove();
      }

      if (stateName === 'spawn-warn') {
        if (!spawn) {
          spawn = document.createElement('span');
          spawn.className = 'hg-spawn-warn-icon';
          spawn.textContent = '↟';
          btn.appendChild(spawn);
        }
      } else if (spawn) {
        spawn.remove();
      }

      const labelParts = [tile];
      if (occupant) {
        const lbl = U.statsFor(occType).label;
        labelParts.push(`${lbl}${occupant.side === 'hero' ? `, ${occupant.hp} of ${occupant.maxHp} health` : ''}`);
      } else {
        labelParts.push('empty');
      }
      if (threat) labelParts.push(`will be struck for ${threat.dmg} damage`);
      else if (spawnTiles.has(tile)) labelParts.push('enemy arriving next turn');
      else if (moveTiles.has(tile)) labelParts.push('move here');
      else if (actionTiles.has(tile)) labelParts.push('action target');
      btn.setAttribute('aria-label', labelParts.join(', '));
    }
  }

  function syncHeroStrip(state) {
    if (!heroStripEl) return;
    const heroes = S.livingHeroes(state);

    if (heroCardEls.size === 0 || heroes.length !== heroCardEls.size) {
      heroStripEl.innerHTML = '';
      heroCardEls.clear();
      for (const h of heroes) {
        const card = buildHeroCard(h);
        heroStripEl.appendChild(card);
        heroCardEls.set(h.id, card);
      }
    }

    for (const h of heroes) {
      const card = heroCardEls.get(h.id);
      if (!card) continue;
      card.dataset.selected = (h.id === state.selectedUnitId) ? 'true' : 'false';
      card.dataset.spent = (h.hasMoved && h.hasActed) ? 'true' : 'false';

      const hp = card.querySelector('.hg-hero-hp');
      if (hp) {
        hp.innerHTML = '';
        for (let i = 0; i < h.maxHp; i++) {
          const pip = document.createElement('span');
          pip.className = 'hg-pip' + (i < h.hp ? ' filled' : '');
          hp.appendChild(pip);
        }
        hp.setAttribute('aria-label', `${h.hp} of ${h.maxHp} health`);
      }
    }
  }

  function syncMarginNotes(state) {
    if (!marginNotesEl || !state.events) return;
    const proseLines = collectProseFromEvents(state);
    if (proseLines.length === lastNoteCount) return;

    const newLines = proseLines.slice(lastNoteCount);
    for (const line of newLines) {
      const p = document.createElement('p');
      p.className = 'hg-note';
      p.textContent = line;
      marginNotesEl.appendChild(p);
    }
    lastNoteCount = proseLines.length;

    setTimeout(() => {
      const all = marginNotesEl.querySelectorAll('.hg-note');
      const excess = all.length - 5;
      for (let i = 0; i < excess; i++) all[i].remove();
    }, 1500);
  }

  function collectProseFromEvents(state) {
    const Narr = N();
    if (!Narr) return [];
    return Narr.describeEvents(state.events, state);
  }

  function appendNote(text) {
    if (!marginNotesEl || !text) return;
    const p = document.createElement('p');
    p.className = 'hg-note';
    p.textContent = text;
    marginNotesEl.appendChild(p);
    lastNoteCount += 1;
    setTimeout(() => {
      const all = marginNotesEl.querySelectorAll('.hg-note');
      const excess = all.length - 6;
      for (let i = 0; i < excess; i++) all[i].remove();
    }, 1500);
  }

  function playEvents(events, opts, state) {
    const speed = (opts && opts.speed) || 1;
    const reduced = (opts && opts.reducedMotion) || false;
    if (!events || events.length === 0) {
      return Promise.resolve();
    }
    if (reduced || speed === 0) {
      // Still fire SFX so the audio narrative isn't silent under reduced-motion.
      for (const ev of events) playEventSfx(ev, state);
      return Promise.resolve();
    }
    return new Promise(resolve => {
      let i = 0;
      const stepMs = 320 / speed;
      const tick = () => {
        if (i >= events.length) { resolve(); return; }
        const ev = events[i++];
        playEventSfx(ev, state);
        if (ev.kind === 'move' && ev.cause !== 'plan') {
          const tile = tileEls.get(ev.to);
          if (tile) {
            tile.classList.add('hg-step');
            setTimeout(() => tile.classList.remove('hg-step'), 320);
          }
        }
        setTimeout(tick, stepMs * 0.6);
      };
      tick();
    });
  }

  function playEventSfx(ev, state) {
    const Audio = A();
    if (!Audio) return;
    switch (ev.kind) {
      case 'move':
        if (ev.cause === 'shove') Audio.moveConfirm();
        return;
      case 'attack': {
        const attacker = state && S.unitById(state, ev.attackerId);
        if (!attacker) return Audio.enemyMelee();
        if (attacker.type === 'knight')        return Audio.knightStrike();
        if (attacker.type === 'archer')        return Audio.archerShot();
        if (attacker.type === 'mage')          return Audio.mageSwap();
        if (attacker.type === 'goblin-archer') return Audio.enemyRanged();
        return Audio.enemyMelee();
      }
      case 'damage': {
        const target = state && S.unitById(state, ev.unitId);
        if (target && target.side === 'hero')     return Audio.hitHero();
        if (target && target.side === 'villager') return Audio.villagerFall();
        return Audio.hitEnemy();
      }
      case 'death': {
        if (ev.side === 'villager') return Audio.villagerFall();
        return;
      }
      case 'collision':
      case 'collision-wall':
        Audio.hitEnemy();
        return;
      case 'spawn':
        Audio.unitSelect();
        return;
      default:
        return;
    }
  }

  function showTutorialHint(triggerId, anchorSelector, text) {
    return new Promise(resolve => {
      if (!triggerId || !text) { resolve(); return; }

      let seen = {};
      try { seen = JSON.parse(localStorage.getItem('hearthguard-tutorial-seen') || '{}'); } catch (e) {}
      if (seen[triggerId]) { resolve(); return; }

      const popover = root && root.querySelector('[data-bind="tutorial-popover"]');
      if (!popover) { resolve(); return; }

      const cap = text.charAt(0);
      const rest = text.slice(1);
      const content = popover.querySelector('.hg-tip-content');
      if (content) {
        content.innerHTML = '';
        const dc = document.createElement('span');
        dc.className = 'hg-tip-dropcap';
        dc.textContent = cap;
        content.appendChild(dc);
        content.appendChild(document.createTextNode(rest));
      }

      const anchor = anchorSelector
        ? document.querySelector(anchorSelector)
        : root.querySelector('[data-bind="margin-notes"]');
      positionPopover(popover, anchor);

      popover.hidden = false;
      popover.removeAttribute('hidden');

      const dismiss = () => {
        popover.hidden = true;
        document.removeEventListener('click', onDoc, true);
        document.removeEventListener('keydown', onKey, true);
        seen[triggerId] = true;
        try { localStorage.setItem('hearthguard-tutorial-seen', JSON.stringify(seen)); } catch (e) {}
        resolve();
      };
      const onDoc = () => { setTimeout(dismiss, 0); };
      const onKey = () => { dismiss(); };

      setTimeout(() => {
        document.addEventListener('click', onDoc, true);
        document.addEventListener('keydown', onKey, true);
      }, 50);
    });
  }

  function positionPopover(popover, anchor) {
    if (!anchor) {
      popover.style.left = '50%';
      popover.style.top = '';
      popover.style.bottom = '20%';
      popover.style.transform = 'translateX(-50%)';
      popover.dataset.arrow = 'down';
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    let left = rect.left + rect.width / 2;
    let top, transform, arrow;

    if (rect.top < vh / 2) {
      top = rect.bottom + 12;
      arrow = 'up';
      transform = 'translateX(-50%)';
    } else {
      top = rect.top - 12;
      arrow = 'down';
      transform = 'translateX(-50%) translateY(-100%)';
    }

    if (left < 24) left = 24;
    if (left > vw - 24) left = vw - 24;

    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
    popover.style.bottom = '';
    popover.style.transform = transform;
    popover.dataset.arrow = arrow;
  }

  function setBind(name, value) {
    if (!root) return;
    const els = root.querySelectorAll(`[data-bind="${name}"]`);
    els.forEach(el => { el.textContent = value; });
  }

  window.HearthguardRender = {
    mount, teardown,
    showScreen, hideScreen,
    syncState,
    playEvents,
    showTutorialHint,
    appendNote,
    setBind,
    getRoot() { return root; },
  };
})();
