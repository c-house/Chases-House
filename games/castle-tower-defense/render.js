/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense — render.js
   Owns ALL DOM mutation. Engine state in → DOM out.
   No gameplay logic, no input handling, no audio.
   Exposes window.CTDRender.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Cached element refs
  let body, playfield, fieldSvg;
  let layers = {};                    // terrain, slots, ranges, towers, enemies, projectiles, effects
  let towerInfo;
  let mapGrid, totalStarsEl, maxStarsEl;
  let hudGold, hudLives, hudWaveNum, hudWaveOf, hudWavePreview;
  let palette, controls;
  let towerInfoBindings = {};
  let gameOverBindings = {};
  let initialized = false;

  // Tracking maps for entity diff
  const towerNodes = new Map();       // id → <g>
  const enemyNodes = new Map();       // id → <g>
  const projNodes  = new Map();       // id → <g>
  const effectNodes = new Map();      // id → element

  // Last-known palette state (to skip redraw when nothing changed)
  let lastGold = -1;
  let lastSelectedTower = null;
  let lastWaveSig = '';               // signature of currently-rendered wave preview

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function init() {
    if (initialized) return;
    body = document.body;
    playfield = $('#playfield');
    fieldSvg = $('.field', playfield);
    layers = {
      terrain:     $('.layer.terrain', fieldSvg),
      slots:       $('.layer.slots', fieldSvg),
      ranges:      $('.layer.ranges', fieldSvg),
      towers:      $('.layer.towers', fieldSvg),
      enemies:     $('.layer.enemies', fieldSvg),
      projectiles: $('.layer.projectiles', fieldSvg),
      effects:     $('.layer.effects', fieldSvg)
    };

    towerInfo = $('#towerInfo');
    towerInfoBindings = {
      towerName:    $('[data-bind="towerName"]', towerInfo),
      tier:         $('[data-bind="tier"]', towerInfo),
      stats:        $('[data-bind="stats"]', towerInfo),
      upgradeLabel: $('[data-bind="upgradeLabel"]', towerInfo),
      sellLabel:    $('[data-bind="sellLabel"]', towerInfo)
    };

    mapGrid       = $('[data-bind="mapGrid"]');
    totalStarsEl  = $('[data-bind="totalStars"]');
    maxStarsEl    = $('[data-bind="maxStars"]');

    hudGold        = $('#hud-gold');
    hudLives       = $('#hud-lives');
    hudWaveNum     = $('.hud-wave .num');
    hudWaveOf      = $('.hud-wave .of');
    hudWavePreview = $('[data-bind="wavePreview"]');

    palette  = $('.palette');
    controls = $('.controls');

    gameOverBindings = {
      ribbon:         $('[data-bind="resultRibbon"]'),
      mapDifficulty:  $('[data-bind="mapDifficulty"]'),
      heading:        $('[data-bind="resultHeading"]'),
      starsRow:       $('[data-bind="starsRow"]'),
      livesRemaining: $('[data-bind="livesRemaining"]'),
      score:          $('[data-bind="score"]'),
      bestScore:      $('[data-bind="bestScore"]')
    };

    // initialize palette costs from entities data
    refreshPaletteCosts();
    initialized = true;
  }

  // ─── Screen FSM ──────────────────────────────────────────────
  function setScreen(name) {
    body.setAttribute('data-screen', name);
  }
  function getScreen() { return body.getAttribute('data-screen'); }

  function setReducedMotion(on) {
    body.classList.toggle('reduced-motion', !!on);
    const tog = $('#rmToggle');
    if (tog) {
      tog.classList.toggle('on', !!on);
      tog.setAttribute('aria-pressed', String(!!on));
    }
  }

  // ─── Tower palette ───────────────────────────────────────────
  function refreshPaletteCosts() {
    const TOWERS = window.CTDEntities.TOWERS;
    $$('.tower-card', palette).forEach(card => {
      const type = card.dataset.tower;
      const def = TOWERS[type];
      if (!def) return;
      const costEl = $('[data-bind="cost"]', card);
      if (costEl) costEl.textContent = String(def.tiers[0].cost);
    });
  }

  function updatePalette(state) {
    const TOWERS = window.CTDEntities.TOWERS;
    const sel = state.paletteSelection;
    const gold = state.gold;
    const goldChanged = gold !== lastGold;
    const selChanged = sel !== lastSelectedTower;
    if (!goldChanged && !selChanged) return;
    lastGold = gold;
    lastSelectedTower = sel;
    $$('.tower-card', palette).forEach(card => {
      const type = card.dataset.tower;
      const def = TOWERS[type];
      if (!def) return;
      const cost = def.tiers[0].cost;
      card.classList.toggle('disabled', gold < cost);
      card.classList.toggle('selected', sel === type);
    });
  }

  // ─── Top HUD ─────────────────────────────────────────────────
  function updateHUD(state) {
    if (hudGold)  hudGold.textContent  = String(state.gold);
    if (hudLives) hudLives.textContent = String(Math.max(0, state.lives));
    if (hudWaveNum && state.waveTotal) {
      const display = Math.min(state.waveIndex + 1, state.waveTotal);
      hudWaveNum.textContent = String(display);
    }
    if (hudWaveOf && state.waveTotal) {
      hudWaveOf.textContent = `Wave · of ${state.waveTotal}`;
    }
    updateWavePreview(state);
    updatePalette(state);
    updateTowerInfo(state);
    updateNextWaveButton(state);
  }

  function updateNextWaveButton(state) {
    const btn = $('.ctrl-btn.next-wave', controls);
    if (!btn) return;
    btn.classList.toggle('active', state.fsm === 'prepWave' && state.earlyBonusEligible);
    btn.disabled = !(state.fsm === 'prepWave' && state.earlyBonusEligible);
  }

  function updateWavePreview(state) {
    if (!hudWavePreview) return;
    const map = state.mapDef;
    if (!map) { hudWavePreview.innerHTML = ''; lastWaveSig = ''; return; }
    // Show NEXT wave (the upcoming one when prepWave; the current one when inWave).
    const idx = state.waveIndex;
    const wave = map.waves[idx];
    if (!wave) { hudWavePreview.innerHTML = ''; lastWaveSig = ''; return; }
    // Build a representative list of distinct enemy types, in spawn order.
    const seen = new Set();
    const types = [];
    wave.enemies.forEach(g => { if (!seen.has(g.type)) { seen.add(g.type); types.push(g.type); } });
    const sig = idx + ':' + types.join(',');
    if (sig === lastWaveSig) return;
    lastWaveSig = sig;
    hudWavePreview.innerHTML = '';
    types.forEach(t => {
      const ent = window.CTDEntities.ENEMIES[t];
      if (!ent) return;
      const svg = document.createElementNS(SVG_NS, 'svg');
      const use = document.createElementNS(SVG_NS, 'use');
      use.setAttribute('href', '#' + ent.sprite);
      svg.appendChild(use);
      hudWavePreview.appendChild(svg);
    });
  }

  // ─── Tower info panel ────────────────────────────────────────
  function updateTowerInfo(state) {
    if (!towerInfo) return;
    const tw = state.towers.find(t => t.id === state.selectedTowerId);
    if (!tw) {
      towerInfo.classList.remove('open');
      return;
    }
    const TOWERS = window.CTDEntities.TOWERS;
    const def = TOWERS[tw.type];
    const tier = def.tiers[tw.tier];
    const sellValue = window.CTDEntities.towerSellValue(tw.type, tw.tier);
    const nextTier = def.tiers[tw.tier + 1];
    towerInfo.classList.add('open');

    if (towerInfoBindings.towerName) {
      towerInfoBindings.towerName.textContent = `${def.name} Tower`;
    }
    if (towerInfoBindings.tier) {
      const pips = ['', '', ''];
      pips.forEach((_, i) => {});
      towerInfoBindings.tier.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const pip = document.createElement('span');
        pip.className = 'tier-pip' + (i <= tw.tier ? ' filled' : '');
        towerInfoBindings.tier.appendChild(pip);
      }
    }
    if (towerInfoBindings.stats) {
      const rows = [
        ['Damage', String(tier.damage)],
        ['Range',  String(tier.range)],
        ['Rate',   tier.fireRate.toFixed(1) + ' / s'],
        ['Sell',   `+${sellValue}`]
      ];
      if (tier.splashRadius) rows.splice(3, 0, ['Splash', String(tier.splashRadius)]);
      if (tier.chains)       rows.splice(3, 0, ['Chains', String(tier.chains)]);
      if (tier.slowMs)       rows.splice(3, 0, ['Slow',   `${(tier.slowMs/1000).toFixed(1)}s`]);
      towerInfoBindings.stats.innerHTML = '';
      rows.forEach(([k, v]) => {
        const a = document.createElement('span'); a.textContent = k;
        const b = document.createElement('span'); b.className = 'v'; b.textContent = v;
        towerInfoBindings.stats.appendChild(a);
        towerInfoBindings.stats.appendChild(b);
      });
    }
    if (towerInfoBindings.upgradeLabel) {
      if (nextTier) {
        towerInfoBindings.upgradeLabel.textContent = `Upgrade · ${nextTier.cost}`;
      } else {
        towerInfoBindings.upgradeLabel.textContent = 'Maxed';
      }
      const upBtn = towerInfoBindings.upgradeLabel.closest('button');
      if (upBtn) {
        upBtn.disabled = !nextTier || state.gold < (nextTier && nextTier.cost);
      }
    }
    if (towerInfoBindings.sellLabel) {
      towerInfoBindings.sellLabel.textContent = `Sell · +${sellValue}`;
    }
  }

  // ─── Map select ──────────────────────────────────────────────
  function hydrateMapSelect(scores, isMapUnlocked, isHardUnlocked, totalStarsFn) {
    if (!mapGrid) return;
    const MAPS = window.CTDMaps.MAPS;
    if (totalStarsEl) totalStarsEl.textContent = String(totalStarsFn());
    if (maxStarsEl)   maxStarsEl.textContent   = String(window.CTDMaps.maxStars());
    mapGrid.innerHTML = '';
    MAPS.forEach(map => {
      const unlocked = isMapUnlocked(map.id);
      const card = document.createElement('article');
      card.className = 'map-card' + (unlocked ? '' : ' locked');
      card.dataset.mapId = map.id;
      const mapScores = scores[map.id] || {};

      const head = document.createElement('div');
      head.className = 'card-head';
      head.innerHTML = `
        <div>
          <div class="name">${map.displayName}</div>
          <div class="roman">— ${map.roman} —</div>
        </div>
        <span class="chip${map.chipKind ? ' ' + map.chipKind : ''}">${unlocked ? map.chip : 'Sealed'}</span>
      `;
      card.appendChild(head);

      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      thumb.innerHTML = `<svg viewBox="0 0 160 90" preserveAspectRatio="none"><use href="#${map.thumbSprite}"/></svg>`;
      card.appendChild(thumb);

      const desc = document.createElement('p');
      desc.className = 'desc';
      desc.textContent = map.description;
      card.appendChild(desc);

      const diffs = document.createElement('div');
      diffs.className = 'difficulty-row';
      ['easy', 'normal', 'hard'].forEach(diff => {
        const pill = document.createElement('button');
        pill.className = 'diff-pill';
        const stars = (mapScores[diff] && mapScores[diff].stars) || 0;
        const hardLocked = diff === 'hard' && !isHardUnlocked(map.id);
        const allLocked = !unlocked || hardLocked;
        if (allLocked) pill.classList.add('locked');
        pill.dataset.action = 'start-map';
        pill.dataset.mapId = map.id;
        pill.dataset.difficulty = diff;
        pill.innerHTML = diff[0].toUpperCase() + diff.slice(1);
        if (allLocked) {
          pill.innerHTML += ' <svg style="width:11px;height:11px;color:var(--ink-faint)"><use href="#i-lock"/></svg>';
        } else {
          let mini = '<span class="stars-mini">';
          for (let i = 0; i < 3; i++) {
            mini += `<svg class="${i < stars ? 'filled' : 'empty'}"><use href="#i-star"/></svg>`;
          }
          mini += '</span>';
          pill.innerHTML += mini;
        }
        diffs.appendChild(pill);
      });
      card.appendChild(diffs);

      if (!unlocked) {
        const seal = document.createElement('div');
        seal.className = 'wax-seal';
        seal.innerHTML = `<span class="label">Awaits<br>${map.unlockRequirement}★</span>`;
        card.appendChild(seal);
      }

      mapGrid.appendChild(card);
    });
  }

  // ─── Game-over screen ────────────────────────────────────────
  function fillGameOver(opts) {
    if (!gameOverBindings.heading) return;
    const { won, mapName, difficulty, stars, livesRemaining, startLives, score, bestScore } = opts;
    gameOverBindings.ribbon.textContent = won ? 'Victory' : 'Defeat';
    gameOverBindings.ribbon.style.background = won ? 'var(--accent-gold)' : 'var(--wine)';
    gameOverBindings.ribbon.style.color = won ? 'var(--ink)' : 'var(--parchment-cream)';
    gameOverBindings.heading.textContent = won ? 'The Watch Holds' : 'The Gate Has Fallen';
    gameOverBindings.mapDifficulty.textContent = `${mapName} · ${difficulty[0].toUpperCase() + difficulty.slice(1)}`;
    gameOverBindings.starsRow.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', i < stars ? 'earned' : 'empty');
      const use = document.createElementNS(SVG_NS, 'use');
      use.setAttribute('href', '#i-star');
      svg.appendChild(use);
      gameOverBindings.starsRow.appendChild(svg);
    }
    gameOverBindings.livesRemaining.textContent = `${Math.max(0, livesRemaining)} / ${startLives}`;
    gameOverBindings.score.textContent = score.toLocaleString();
    gameOverBindings.bestScore.textContent = bestScore.toLocaleString();
  }

  // ─── Playfield: terrain + build slots (drawn once per map) ──
  function paintTerrain(state) {
    const map = state.mapDef;
    if (!map) return;
    const ter = layers.terrain, slots = layers.slots;
    ter.innerHTML = '';
    slots.innerHTML = '';

    // Path — base brown ribbon + dashed darker overlay
    const d = pathToD(map.path);
    const base = document.createElementNS(SVG_NS, 'path');
    base.setAttribute('d', d);
    base.setAttribute('fill', 'none');
    base.setAttribute('stroke', '#7a5a30');
    base.setAttribute('stroke-width', '40');
    base.setAttribute('stroke-linecap', 'round');
    base.setAttribute('stroke-linejoin', 'round');
    ter.appendChild(base);
    const dash = document.createElementNS(SVG_NS, 'path');
    dash.setAttribute('d', d);
    dash.setAttribute('fill', 'none');
    dash.setAttribute('stroke', '#5d3a1a');
    dash.setAttribute('stroke-width', '40');
    dash.setAttribute('stroke-linecap', 'round');
    dash.setAttribute('stroke-linejoin', 'round');
    dash.setAttribute('stroke-dasharray', '6 8');
    dash.setAttribute('opacity', '0.4');
    ter.appendChild(dash);

    // Castle gate at end of path
    const castle = document.createElementNS(SVG_NS, 'g');
    castle.setAttribute('transform', `translate(${map.castle.x},${map.castle.y})`);
    castle.innerHTML = `
      <rect x="-22" y="-12" width="44" height="64" fill="#cdb88d" stroke="#1a1410" stroke-width="2"/>
      <path d="M -24 -12 L -24 -24 L -18 -24 L -18 -16 L -10 -16 L -10 -24 L -4 -24 L -4 -16 L 4 -16 L 4 -24 L 10 -24 L 10 -16 L 18 -16 L 18 -24 L 24 -24 L 24 -12 Z"
            fill="#a08864" stroke="#1a1410" stroke-width="2" stroke-linejoin="round"/>
      <rect x="-9" y="22" width="18" height="34" fill="#1a1410"/>
    `;
    ter.appendChild(castle);

    // Build slots — each clickable, hover-highlighted
    map.buildSlots.forEach(slot => {
      const sl = document.createElementNS(SVG_NS, 'rect');
      sl.setAttribute('class', 'slot');
      sl.setAttribute('data-slot-id', slot.id);
      sl.setAttribute('data-action', 'select-slot');
      sl.setAttribute('x', slot.x - 28);
      sl.setAttribute('y', slot.y - 28);
      sl.setAttribute('width', 56);
      sl.setAttribute('height', 56);
      sl.setAttribute('fill', 'rgba(255,255,255,0.18)');
      sl.setAttribute('stroke', '#1a1410');
      sl.setAttribute('stroke-width', '1.8');
      sl.setAttribute('stroke-dasharray', '3 3');
      sl.setAttribute('style', 'cursor: pointer;');
      slots.appendChild(sl);
    });
  }

  function pathToD(points) {
    if (!points.length) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
    return d;
  }

  function clearPlayfield() {
    Object.values(layers).forEach(l => { if (l) l.innerHTML = ''; });
    towerNodes.clear();
    enemyNodes.clear();
    projNodes.clear();
    effectNodes.clear();
    lastWaveSig = '';
    lastGold = -1;
    lastSelectedTower = null;
  }

  // ─── Entity diff: towers, enemies, projectiles, effects ─────
  function syncEntities(state) {
    syncTowers(state);
    syncRanges(state);
    syncEnemies(state);
    syncProjectiles(state);
    syncEffects(state);
  }

  function syncTowers(state) {
    const present = new Set();
    state.towers.forEach(tw => {
      present.add(tw.id);
      let node = towerNodes.get(tw.id);
      const sprite = `#${window.CTDEntities.TOWERS[tw.type].sprite}-${tw.tier + 1}`;
      if (!node) {
        node = document.createElementNS(SVG_NS, 'g');
        node.setAttribute('class', 'entity tower');
        node.setAttribute('data-tower-id', tw.id);
        node.setAttribute('data-action', 'select-tower-instance');
        node.setAttribute('style', 'cursor: pointer;');
        const inner = document.createElementNS(SVG_NS, 'svg');
        inner.setAttribute('x', '-32');
        inner.setAttribute('y', '-32');
        inner.setAttribute('width', '64');
        inner.setAttribute('height', '64');
        inner.setAttribute('viewBox', '0 0 64 64');
        const use = document.createElementNS(SVG_NS, 'use');
        use.setAttribute('href', sprite);
        inner.appendChild(use);
        node.appendChild(inner);
        layers.towers.appendChild(node);
        towerNodes.set(tw.id, node);
      } else {
        // tier may have changed; update sprite href
        const use = node.querySelector('use');
        if (use && use.getAttribute('href') !== sprite) use.setAttribute('href', sprite);
      }
      node.setAttribute('transform', `translate(${tw.x},${tw.y})`);
      node.classList.toggle('selected', state.selectedTowerId === tw.id);
    });
    // remove vanished
    towerNodes.forEach((node, id) => {
      if (!present.has(id)) { node.remove(); towerNodes.delete(id); }
    });
  }

  function syncRanges(state) {
    layers.ranges.innerHTML = '';
    // Show range circle for selected tower OR for hovered slot with paletteSelection
    const selected = state.towers.find(t => t.id === state.selectedTowerId);
    if (selected) {
      const range = window.CTDEntities.TOWERS[selected.type].tiers[selected.tier].range;
      drawRange(selected.x, selected.y, range, 'var(--accent-gold)');
    }
    if (state.fsm !== 'title' && state.fsm !== 'mapSelect' &&
        state.paletteSelection && state.hoverSlotId) {
      const map = state.mapDef;
      const slot = map.buildSlots.find(s => s.id === state.hoverSlotId);
      const occupied = state.towers.some(t => t.slotId === state.hoverSlotId);
      if (slot && !occupied) {
        const range = window.CTDEntities.TOWERS[state.paletteSelection].tiers[0].range;
        drawRange(slot.x, slot.y, range, 'var(--accent-ember)');
      }
    }
  }

  function drawRange(x, y, r, stroke) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', x);
    c.setAttribute('cy', y);
    c.setAttribute('r', r);
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke', stroke);
    c.setAttribute('stroke-width', '1.5');
    c.setAttribute('stroke-dasharray', '6 4');
    c.setAttribute('opacity', '0.4');
    layers.ranges.appendChild(c);
  }

  function syncEnemies(state) {
    const present = new Set();
    state.enemies.forEach(en => {
      present.add(en.id);
      let node = enemyNodes.get(en.id);
      const def = window.CTDEntities.ENEMIES[en.type];
      if (!node) {
        node = document.createElementNS(SVG_NS, 'g');
        node.setAttribute('class', 'entity enemy enemy-' + en.type);
        const half = def.size / 2;
        const inner = document.createElementNS(SVG_NS, 'svg');
        inner.setAttribute('x', String(-half));
        inner.setAttribute('y', String(-half));
        inner.setAttribute('width', String(def.size));
        inner.setAttribute('height', String(def.size));
        inner.setAttribute('viewBox', '0 0 64 64');
        const use = document.createElementNS(SVG_NS, 'use');
        use.setAttribute('href', '#' + def.sprite);
        inner.appendChild(use);
        node.appendChild(inner);
        // HP bar (only visible after first damage)
        const hpBar = document.createElementNS(SVG_NS, 'g');
        hpBar.setAttribute('class', 'hpbar');
        hpBar.setAttribute('opacity', '0');
        const bg = document.createElementNS(SVG_NS, 'rect');
        bg.setAttribute('x', String(-half));
        bg.setAttribute('y', String(-half - 10));
        bg.setAttribute('width', String(def.size));
        bg.setAttribute('height', '4');
        bg.setAttribute('fill', '#2d251c');
        const fg = document.createElementNS(SVG_NS, 'rect');
        fg.setAttribute('x', String(-half));
        fg.setAttribute('y', String(-half - 10));
        fg.setAttribute('width', String(def.size));
        fg.setAttribute('height', '4');
        fg.setAttribute('fill', def.isBoss ? 'var(--wine)' : 'var(--accent-gold)');
        fg.setAttribute('class', 'hpbar-fg');
        hpBar.appendChild(bg);
        hpBar.appendChild(fg);
        node.appendChild(hpBar);
        layers.enemies.appendChild(node);
        enemyNodes.set(en.id, node);
      }
      node.setAttribute('transform', `translate(${en.x},${en.y})`);
      // hit-flash class toggles
      node.classList.toggle('hit-flash', en.hitFlashMs > 0);
      // boss regen telegraph
      if (def.isBoss) node.classList.toggle('regenerating', en.regenSuppressedMs <= 0);
      // slow tint
      node.classList.toggle('slowed', en.slowMs > 0 || en.freezeMs > 0);
      // hp bar
      const hpBar = node.querySelector('.hpbar');
      const fg = node.querySelector('.hpbar-fg');
      if (en.hp < en.maxHp && en.hp > 0) {
        if (hpBar) hpBar.setAttribute('opacity', '1');
        if (fg) fg.setAttribute('width', String(def.size * (en.hp / en.maxHp)));
      } else {
        if (hpBar) hpBar.setAttribute('opacity', '0');
      }
    });
    enemyNodes.forEach((node, id) => {
      if (!present.has(id)) { node.remove(); enemyNodes.delete(id); }
    });
  }

  function syncProjectiles(state) {
    const present = new Set();
    state.projectiles.forEach(pr => {
      present.add(pr.id);
      let node = projNodes.get(pr.id);
      if (!node) {
        node = makeProjectileNode(pr);
        layers.projectiles.appendChild(node);
        projNodes.set(pr.id, node);
      }
      const angle = Math.atan2(pr.vy, pr.vx) * 180 / Math.PI;
      node.setAttribute('transform', `translate(${pr.x},${pr.y}) rotate(${angle.toFixed(1)})`);
    });
    projNodes.forEach((node, id) => {
      if (!present.has(id)) { node.remove(); projNodes.delete(id); }
    });
  }

  function makeProjectileNode(pr) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'entity projectile proj-' + pr.kind);
    if (pr.kind === 'arrow') {
      g.innerHTML = '<svg x="-12" y="-4" width="24" height="8" viewBox="0 0 24 8"><use href="#i-arrow"/></svg>';
    } else if (pr.kind === 'cannonball') {
      g.innerHTML = '<circle cx="0" cy="0" r="6" fill="#1a1410"/>';
    } else if (pr.kind === 'magebolt') {
      g.innerHTML = `
        <circle cx="0" cy="0" r="7" fill="#c8943e" opacity="0.5"/>
        <circle cx="0" cy="0" r="4" fill="#c8943e"/>
        <circle cx="0" cy="0" r="2" fill="#ede2c8"/>`;
    } else if (pr.kind === 'frostshard') {
      g.innerHTML = `
        <path d="M -6 0 L 0 -6 L 6 0 L 0 6 Z" fill="#cfe1ec" stroke="#1a1410" stroke-width="1"/>`;
    }
    return g;
  }

  function syncEffects(state) {
    const present = new Set();
    state.effects.forEach(ef => {
      present.add(ef.id);
      let node = effectNodes.get(ef.id);
      if (!node) {
        node = makeEffectNode(ef);
        layers.effects.appendChild(node);
        effectNodes.set(ef.id, node);
      }
      const fade = Math.max(0, ef.ttlMs / (ef.totalTtlMs || ef.ttlMs || 1));
      node.setAttribute('opacity', String(fade));
      if (ef.kind === 'goldPopup') {
        const lift = (1 - fade) * 28;
        node.setAttribute('transform', `translate(${ef.x},${ef.y - lift})`);
      } else {
        node.setAttribute('transform', `translate(${ef.x},${ef.y})`);
      }
    });
    effectNodes.forEach((node, id) => {
      if (!present.has(id)) { node.remove(); effectNodes.delete(id); }
    });
  }

  function makeEffectNode(ef) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'effect eff-' + ef.kind);
    g.setAttribute('transform', `translate(${ef.x},${ef.y})`);
    if (ef.kind === 'goldPopup') {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('font-family', 'Fraunces, serif');
      t.setAttribute('font-size', '20');
      t.setAttribute('font-weight', '700');
      t.setAttribute('fill', '#a06828');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('style', 'filter: drop-shadow(0 1px 0 rgba(255,225,170,0.6));');
      t.textContent = ef.text || '+0';
      g.appendChild(t);
    } else if (ef.kind === 'splash') {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', '0'); c.setAttribute('cy', '0');
      c.setAttribute('r', String(ef.r || 30));
      c.setAttribute('fill', 'rgba(160, 104, 40, 0.5)');
      c.setAttribute('stroke', '#a06828');
      c.setAttribute('stroke-width', '2');
      g.appendChild(c);
    } else if (ef.kind === 'castleHit') {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', '0'); c.setAttribute('cy', '0');
      c.setAttribute('r', '40');
      c.setAttribute('fill', 'rgba(110, 31, 36, 0.4)');
      g.appendChild(c);
    }
    return g;
  }

  // ─── One-shot flourishes ────────────────────────────────────
  function flashWaveClear(label) {
    if (body.classList.contains('reduced-motion')) return;
    let r = playfield.querySelector('.wave-clear');
    if (r) r.remove();
    r = document.createElement('div');
    r.className = 'wave-clear';
    r.textContent = label || 'Wave Cleared';
    playfield.appendChild(r);
    setTimeout(() => r.remove(), 1800);
  }

  function flyBird() {
    if (body.classList.contains('reduced-motion')) return;
    const bird = document.querySelector('.marginalia-bird');
    if (!bird) return;
    bird.classList.remove('flying');
    void bird.offsetWidth;     // restart animation
    bird.classList.add('flying');
    setTimeout(() => bird.classList.remove('flying'), 2400);
  }

  // ─── Public surface ─────────────────────────────────────────
  window.CTDRender = {
    init,
    setScreen, getScreen,
    setReducedMotion,
    hydrateMapSelect,
    fillGameOver,
    paintTerrain,
    clearPlayfield,
    syncEntities,
    updateHUD,
    refreshPaletteCosts,
    flashWaveClear,
    flyBird
  };
})();
