/* ═══════════════════════════════════════════════════════════════════════
   Underhearth — render.js
   DOM-grid renderer. Creates 1,200 spans inside #mock-grid once at init,
   then mutates .textContent + .className per cell. No innerHTML thrash,
   no listener re-attachment. HUD updates target [data-uh="..."] hooks
   added to index.html.
   Exposes window.UnderhearthRender.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const E = window.UnderhearthEntities;
  if (!E) { console.error('UnderhearthRender: missing UnderhearthEntities'); return; }
  const TILE = E.TILE;

  let cells = [];
  let aria = null;

  // ── Public API ─────────────────────────────────────────────────────────

  function init(state) {
    const grid = document.getElementById('mock-grid');
    if (!grid) { console.error('UnderhearthRender: #mock-grid missing'); return; }
    grid.innerHTML = '';
    cells = [];
    const total = state.floor.cols * state.floor.rows;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < total; i++) {
      const span = document.createElement('span');
      span.textContent = ' ';
      span.className = 't-wall-unseen';
      frag.appendChild(span);
      cells.push(span);
    }
    grid.appendChild(frag);
    aria = document.getElementById('uh-aria-log');
  }

  function syncScreen(state) {
    document.body.dataset.screen = state.fsm;
    if (history.replaceState) history.replaceState(null, '', '#' + state.fsm);
  }

  function renderFrame(state) {
    if (!cells.length) return;
    renderGrid(state);
    renderHud(state);
    renderDeath(state);
    renderInventory(state);
    renderMemorial(state);
  }

  function appendLogLine(state, line) {
    state.log.push(line);
    if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
    renderLog(state);
    if (aria && line && line.text) {
      const el = document.createElement('div');
      el.textContent = line.text;
      aria.appendChild(el);
      // Keep the live region from growing forever.
      while (aria.childNodes.length > 30) aria.removeChild(aria.firstChild);
    }
  }

  function setHpLowPulse(amount) {
    document.body.style.setProperty('--uh-hp-low-pulse', String(Math.max(0, Math.min(1, amount))));
  }

  function flashTile(x, y) {
    const idx = y * 60 + x;
    const cell = cells[idx];
    if (!cell) return;
    cell.classList.add('uh-hit-flash');
    setTimeout(() => cell.classList.remove('uh-hit-flash'), 90);
  }

  function shake(durationMs) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.body.classList.add('uh-shake');
    setTimeout(() => document.body.classList.remove('uh-shake'), durationMs || 80);
  }

  // ── Grid ───────────────────────────────────────────────────────────────

  function renderGrid(state) {
    const cols = state.floor.cols, rows = state.floor.rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        const visState = state.floor.seen[idx]; // 0 unseen / 1 remembered / 2 visible
        const out = tileGlyph(state, x, y, visState);
        const cell = cells[idx];
        if (cell.textContent !== out.glyph) cell.textContent = out.glyph;
        if (cell.className   !== out.cls)   cell.className   = out.cls;
      }
    }
  }

  function tileGlyph(state, x, y, visState) {
    if (visState === 0) return { glyph: ' ', cls: 't-wall-unseen' };

    const idx = y * state.floor.cols + x;
    const t = state.floor.tiles[idx];

    // Visible: monsters, items, player, stairs override terrain
    if (visState === 2) {
      if (state.player.x === x && state.player.y === y) {
        return { glyph: '@', cls: 'g-player' };
      }
      const m = state.floor.monsters.find(mm => mm.x === x && mm.y === y);
      if (m) {
        const def = E.monster(m.kind);
        return { glyph: def ? def.glyph : '?', cls: classForThreat(def && def.threat) };
      }
      const it = state.floor.items.find(ii => ii.x === x && ii.y === y);
      if (it) {
        const def = E.item(it.kind, it.sub);
        return { glyph: def ? def.glyph : '?', cls: classForThreat(def && def.threat) };
      }
      if (state.floor.ghosts) {
        const g = state.floor.ghosts.find(gg => gg.x === x && gg.y === y);
        if (g) return { glyph: '%', cls: 'g-ghost' };
      }
    }

    // Terrain
    if (t === TILE.WALL)         return { glyph: '#', cls: visState === 2 ? 't-wall-lit' : 't-wall-remembered' };
    if (t === TILE.STAIRS_DOWN)  return { glyph: '>', cls: 'g-stairs-down' };
    if (t === TILE.STAIRS_UP)    return { glyph: '<', cls: 'g-stairs-up' };
    if (t === TILE.DOOR)         return { glyph: '+', cls: visState === 2 ? 't-wall-lit' : 't-wall-remembered' };
    return { glyph: '·', cls: visState === 2 ? 't-floor-lit' : 't-floor' };
  }

  function classForThreat(threat) {
    switch (threat) {
      case 'trivial': return 'g-enemy-trivial';
      case 'threat':  return 'g-enemy-threat';
      case 'lethal':  return 'g-enemy-lethal';
      case 'item':    return 'g-item';
      case 'magic':   return 'g-magic';
      default:        return 'g-enemy-trivial';
    }
  }

  // ── HUD ────────────────────────────────────────────────────────────────

  function renderHud(state) {
    const p = state.player;
    setText('[data-uh="hud-class"]', E.classBase(state.cls).label);
    setText('[data-uh="hud-depth"]', pad2(state.depth));
    setText('[data-uh="hud-turn"]',  String(state.turn));
    setText('[data-uh="hud-gold"]',  String(state.gold));
    setText('[data-uh="hud-seed"]',  (state.daily ? '◆ ' : '') + state.seed);
    setText('[data-uh="hud-crest"]', E.classBase(state.cls).label[0]);

    setGauge('hp',     p.hp,     p.hpMax);
    setGauge('mp',     p.mp,     p.mpMax);
    setGauge('hunger', p.hunger, 1000, hungerLabel(p.hunger));

    const hpPct = p.hpMax > 0 ? p.hp / p.hpMax : 0;
    const isLow = hpPct > 0 && hpPct <= 0.25;
    const hpEl = document.querySelector('.gauge-hp');
    if (hpEl) hpEl.classList.toggle('is-low', isLow);
    setHpLowPulse(isLow ? 0.6 : 0);

    renderLog(state);
  }

  function hungerLabel(h) {
    if (h <= 0)   return 'Starving';
    if (h <  200) return 'Hungry';
    if (h <  600) return 'Peckish';
    if (h <  900) return 'Fed';
    return 'Sated';
  }

  function setGauge(kind, val, max, valueLabel) {
    const root = document.querySelector('.gauge.gauge-' + kind);
    if (!root) return;
    const fill = root.querySelector('.gauge-fill');
    const txt  = root.querySelector('.gauge-value');
    if (fill) fill.style.width = (max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0) + '%';
    if (txt)  txt.textContent  = valueLabel != null ? valueLabel : (val + ' / ' + max);
  }

  function setText(sel, text) {
    const el = document.querySelector(sel);
    if (el && el.textContent !== text) el.textContent = text;
  }

  // ── Log ────────────────────────────────────────────────────────────────

  function renderLog(state) {
    const root = document.querySelector('.hud-logbar');
    if (!root) return;
    root.innerHTML = '';
    const last3 = state.log.slice(-3);
    for (const line of last3) {
      const div = document.createElement('div');
      div.className = 'log-line';
      const span = document.createElement('span');
      if (line.kind === 'threat') span.className = 'threat';
      else if (line.kind === 'lethal') span.className = 'lethal';
      else if (line.kind === 'magic') span.className = 'magic';
      else if (line.kind === 'flavor') {
        const em = document.createElement('em');
        em.textContent = line.text;
        div.appendChild(em);
        root.appendChild(div);
        continue;
      }
      span.textContent = line.text;
      div.appendChild(span);
      root.appendChild(div);
    }
  }

  // ── Death card ─────────────────────────────────────────────────────────

  function renderDeath(state) {
    if (state.fsm !== 'death' && state.fsm !== 'memorial') return;
    if (!state.death) return;
    setText('[data-uh="death-cause"]',   state.death.cause || '???');
    setText('[data-uh="death-floor"]',   E.ordinal(state.death.depth || state.depth));
    setText('[data-uh="death-depth"]',   String(state.death.depth || state.depth));
    setText('[data-uh="death-turns"]',   String(state.death.turns || state.turn).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
    setText('[data-uh="death-gold"]',    String(state.death.gold != null ? state.death.gold : state.gold));
    setText('[data-uh="death-seed"]',    state.seed);
    renderDeathCarrying(state);
  }

  function renderDeathCarrying(state) {
    const root = document.querySelector('.epitaph-carrying');
    if (!root || !state.death) return;
    const inv = state.death.inv || [];
    if (inv.length === 0) {
      root.textContent = 'carrying nothing.';
      return;
    }
    // Build the carrying line, marking unidentified items in magic class.
    root.innerHTML = '';
    root.appendChild(document.createTextNode('carrying '));
    const phrases = inv.map((it) => {
      const span = document.createElement('span');
      const unident = E.isItemUnidentified(state, it);
      span.className = unident ? 'unident' : 'ident';
      span.textContent = E.itemDisplayName(state, it);
      return span;
    });
    phrases.forEach((span, i) => {
      root.appendChild(span);
      if (i < phrases.length - 2) root.appendChild(document.createTextNode(', '));
      else if (i === phrases.length - 2) root.appendChild(document.createTextNode(', and '));
    });
    root.appendChild(document.createTextNode('.'));
  }

  // ── Inventory list ─────────────────────────────────────────────────────

  function renderInventory(state) {
    if (state.fsm !== 'inventory') return;
    const list = document.querySelector('.inventory-list');
    if (!list) return;
    list.innerHTML = '';
    setText('.inventory-title .count', state.inv.length + ' / 26');

    if (state.inv.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:1.4rem;text-align:center;font-style:italic;color:var(--uh-ink-faint);';
      empty.textContent = 'Your pack is empty.';
      list.appendChild(empty);
      return;
    }

    for (const it of state.inv) {
      const row = document.createElement('div');
      row.className = 'inv-row';
      const def = E.item(it.kind, it.sub);
      const unident = E.isItemUnidentified(state, it);

      const glyphSpan = document.createElement('span');
      glyphSpan.className = 'inv-glyph ' + (unident ? 'g-magic' : 'g-item');
      glyphSpan.textContent = def ? def.glyph : '?';
      row.appendChild(glyphSpan);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'inv-name';
      const nameLabel = document.createElement('span');
      nameLabel.className = unident ? 'unident' : '';
      nameLabel.textContent = E.itemDisplayName(state, it);
      nameSpan.appendChild(nameLabel);
      const descr = document.createElement('span');
      descr.className = 'descr';
      descr.textContent = invDescription(it, unident);
      nameSpan.appendChild(descr);
      row.appendChild(nameSpan);

      const actions = document.createElement('span');
      actions.className = 'inv-actions';
      const primary = primaryActionFor(it);
      if (primary) {
        const btn = document.createElement('button');
        btn.className = 'inv-action';
        btn.dataset.kind = 'primary';
        btn.dataset.act = 'inv-use';
        btn.dataset.uid = it.uid;
        btn.textContent = primary;
        actions.appendChild(btn);
      }
      const drop = document.createElement('button');
      drop.className = 'inv-action';
      drop.dataset.act = 'inv-drop';
      drop.dataset.uid = it.uid;
      drop.textContent = 'Drop';
      actions.appendChild(drop);
      row.appendChild(actions);

      list.appendChild(row);
    }
  }

  // ── Memorial ───────────────────────────────────────────────────────────

  function renderMemorial(state) {
    if (state.fsm !== 'memorial') return;
    const list = document.querySelector('.memorial-list');
    if (!list || !window.UnderhearthStorage) return;

    const memorial = window.UnderhearthStorage.loadMemorial();
    const tab = state.memorialTab || 'free';
    const rows = (tab === 'daily' ? memorial.daily : memorial.free) || [];

    // Wire tab buttons (idempotent — sets data-act/data-tab + aria-selected).
    const tabs = document.querySelectorAll('.memorial-tab');
    tabs.forEach(t => {
      const isFree = t.textContent.toLowerCase().indexOf('free') >= 0;
      t.dataset.act = 'memorial-tab';
      t.dataset.tab = isFree ? 'free' : 'daily';
      t.setAttribute('aria-selected', String((tab === 'free' && isFree) || (tab === 'daily' && !isFree)));
    });

    list.innerHTML = '';

    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:2rem 1.5rem;text-align:center;font-style:italic;color:var(--uh-ink-faint);position:relative;';
      empty.textContent = tab === 'daily'
        ? 'No daily descents recorded yet. The hearth waits.'
        : 'No descents recorded yet. The hearth waits.';
      list.appendChild(empty);
      return;
    }

    rows.forEach((row, i) => {
      const div = document.createElement('div');
      div.className = 'mem-row' + (row.win ? ' is-win' : '');
      div.dataset.act = 'memorial-load';
      div.dataset.seed = row.seed || '';
      div.dataset.cls = row.cls || 'archer';
      div.dataset.daily = String(!!row.daily);
      div.title = 'Click to load this seed and class.';

      const rank = document.createElement('span');
      rank.className = 'mem-rank' + (i < 3 ? ' gold' : '');
      rank.textContent = String(i + 1).padStart(2, '0');
      div.appendChild(rank);

      const init = document.createElement('span');
      init.className = 'mem-init';
      init.textContent = (row.initials || 'YOU').slice(0, 3);
      div.appendChild(init);

      const cls = document.createElement('span');
      cls.className = 'mem-class';
      cls.dataset.class = row.cls || 'archer';
      const base = E.classBase(row.cls || 'archer');
      cls.textContent = base.label[0];
      div.appendChild(cls);

      const cause = document.createElement('span');
      cause.className = 'mem-cause' + (row.win ? ' win' : '');
      cause.textContent = row.win ? 'Recovered the amulet' : ('to a ' + (row.cause || 'shadow'));
      div.appendChild(cause);

      const depth = document.createElement('span');
      depth.className = 'mem-depth';
      const small = document.createElement('small');
      small.textContent = '↓';
      depth.appendChild(document.createTextNode(String(row.depth || 1)));
      depth.appendChild(small);
      div.appendChild(depth);

      const date = document.createElement('span');
      date.className = 'mem-date';
      date.textContent = formatDate(row.ts);
      div.appendChild(date);

      const seed = document.createElement('span');
      seed.className = 'mem-seed';
      seed.textContent = row.seed || '???';
      div.appendChild(seed);

      list.appendChild(div);
    });
  }

  function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}·${mm}·${dd}`;
  }

  function primaryActionFor(it) {
    if (it.kind === 'potion') return 'Quaff';
    if (it.kind === 'scroll') return 'Read';
    if (it.kind === 'wand')   return 'Zap';
    if (it.kind === 'gold')   return null;
    return null;
  }

  function invDescription(it, unident) {
    if (it.kind === 'gold')   return 'currency. spend it at shops, or count it on your tombstone.';
    if (it.kind === 'potion') return unident ? 'unidentified. quaff it and find out.' : 'identified.';
    if (it.kind === 'scroll') return unident ? 'unidentified. read it carefully.' : 'identified.';
    return '';
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  window.UnderhearthRender = {
    init, syncScreen, renderFrame, appendLogLine,
    setHpLowPulse, flashTile, shake,
    renderInventory, renderDeathCarrying, renderMemorial,
  };
})();
