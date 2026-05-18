/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — ui.js
   DOM HUD: top bar, palette, sheets, pause, end-of-run, map select.
   Owns goldDeficitFlash UI state. ADR-028 §7, §12, §14.
   Exposes window.CTD3Ui.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const GOLD_FLASH_DURATION_MS = 800;

  let body, palette, gameOverBindings, mapGrid;
  let totalStarsEl, maxStarsEl;
  let hudGold, hudLives, hudWaveNum, hudWaveOf;
  let nextWaveBtn, fastFwdBtn;
  let sheetSlot, sheetTower, sheetSlotIdLabel, sheetPicks, sheetTowerName, sheetTierPips, sheetStats, sheetUpgradeBtn, sheetSellBtn;
  let activeSheet = null;       // 'slot' | 'tower' | null
  let sheetTargetSlotId = null; // for slot sheet
  let sheetTargetTowerId = null;// for tower sheet

  // goldDeficitFlash — ui-local; decayed against performance.now() in update()
  // (NOT setTimeout — ADR-028 §C-3).
  let goldFlashUntilMs = 0;
  let initialized = false;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'style') e.style.cssText = attrs[k];
      else if (k.startsWith('data-')) e.setAttribute(k, attrs[k]);
      else if (k in e) e[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (children) {
      for (const c of children) {
        if (c == null) continue;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return e;
  }

  function init() {
    if (initialized) return;
    body = document.body;
    palette = $('[data-bind="palette"]');
    mapGrid = $('[data-bind="mapGrid"]');
    totalStarsEl = $('[data-bind="totalStars"]');
    maxStarsEl   = $('[data-bind="maxStars"]');
    hudGold      = $('[data-bind="gold"]');
    hudLives     = $('[data-bind="lives"]');
    hudWaveNum   = $('[data-bind="waveNum"]');
    hudWaveOf    = $('[data-bind="waveOf"]');
    nextWaveBtn  = $('[data-action="send-next-wave"]');
    fastFwdBtn   = $('[data-action="toggle-fast-forward"]');

    gameOverBindings = {
      heading:        $('[data-bind="resultHeading"]'),
      mapDifficulty:  $('[data-bind="mapDifficulty"]'),
      starsRow:       $('[data-bind="starsRow"]'),
      livesRemaining: $('[data-bind="livesRemaining"]'),
      score:          $('[data-bind="score"]'),
      bestScore:      $('[data-bind="bestScore"]')
    };

    sheetSlot         = $('#sheet-slot');
    sheetTower        = $('#sheet-tower');
    sheetSlotIdLabel  = $('[data-bind="sheet-slot-id"]');
    sheetPicks        = $('[data-bind="sheet-picks"]');
    sheetTowerName    = $('[data-bind="sheet-tower-name"]');
    sheetTierPips     = $('[data-bind="sheet-tier-pips"]');
    sheetStats        = $('[data-bind="sheet-stats"]');
    sheetUpgradeBtn   = $('[data-bind="sheet-upgrade"]');
    sheetSellBtn      = $('[data-bind="sheet-sell"]');

    paintPalette();
    initialized = true;
  }

  // ─── Action sheets (ADR-028 §12) ─────────────────────────────
  function openSlotSheet(slotId, gold) {
    activeSheet = 'slot';
    sheetTargetSlotId = slotId;
    if (sheetSlotIdLabel) sheetSlotIdLabel.textContent = 'Slot ' + slotId;
    paintSlotPicks(gold);
    closeOtherSheets('slot');
    if (sheetSlot) sheetSlot.classList.add('open');
  }
  function openTowerSheet(tower, gold) {
    activeSheet = 'tower';
    sheetTargetTowerId = tower.id;
    paintTowerSheet(tower, gold);
    closeOtherSheets('tower');
    if (sheetTower) sheetTower.classList.add('open');
  }
  function closeSheets() {
    activeSheet = null;
    sheetTargetSlotId = null;
    sheetTargetTowerId = null;
    if (sheetSlot)  sheetSlot.classList.remove('open');
    if (sheetTower) sheetTower.classList.remove('open');
  }
  function closeOtherSheets(keep) {
    if (keep !== 'slot' && sheetSlot)  sheetSlot.classList.remove('open');
    if (keep !== 'tower' && sheetTower) sheetTower.classList.remove('open');
  }
  function getActiveSheet() { return activeSheet; }
  function getSheetSlotId() { return sheetTargetSlotId; }
  function getSheetTowerId() { return sheetTargetTowerId; }

  function paintSlotPicks(gold) {
    if (!sheetPicks) return;
    sheetPicks.replaceChildren();
    ['ranger', 'catapult', 'mage', 'warden'].forEach(type => {
      const def = window.CTD3Entities.TOWERS[type];
      const cost = def.tiers[0].cost;
      const aff = gold >= cost;
      const img = el('img', { src: window.CTD3Assets.getIconUrl(type, 0), alt: def.name });
      img.addEventListener('error', () => { img.style.opacity = '0.3'; });
      const pick = el('button', {
        class: 'pick' + (aff ? '' : ' disabled'),
        'data-action': 'sheet-pick',
        'data-tower': type
      }, [
        img,
        el('div', { class: 'name' }, [def.name]),
        el('div', { class: 'cost' }, [String(cost) + 'g'])
      ]);
      if (!aff) pick.disabled = true;
      sheetPicks.appendChild(pick);
    });
  }

  function paintTowerSheet(tower, gold) {
    const def = window.CTD3Entities.TOWERS[tower.type];
    const tier = def.tiers[tower.tier];
    const nextTier = def.tiers[tower.tier + 1];
    const sellValue = window.CTD3Entities.towerSellValue(tower.type, tower.tier);
    if (sheetTowerName) sheetTowerName.textContent = def.name + ' Tower';

    if (sheetTierPips) {
      sheetTierPips.replaceChildren();
      for (let i = 0; i < 3; i++) {
        sheetTierPips.appendChild(el('span', { class: 'pip' + (i <= tower.tier ? ' filled' : '') }));
      }
    }

    if (sheetStats) {
      sheetStats.replaceChildren();
      const rows = [];
      if (tower.behavior === 'projectile') {
        rows.push(['Damage', String(tower.damage)]);
        rows.push(['Range',  String(tower.range)]);
        rows.push(['Rate',   tower.fireRate.toFixed(1) + ' / s']);
        if (tower.splashRadius) rows.push(['Splash', String(tower.splashRadius)]);
        if (tower.chains)       rows.push(['Chains', String(tower.chains)]);
      } else if (tower.behavior === 'aura') {
        rows.push(['Aura',  String(tower.auraRadius)]);
        rows.push(['Slow',  Math.round((1 - tower.auraSlowMult) * 100) + '%']);
      }
      rows.push(['Sell',   '+' + sellValue + 'g']);
      rows.forEach(([k, v]) => {
        sheetStats.appendChild(el('span', null, [k]));
        sheetStats.appendChild(el('span', null, [v]));
      });
    }

    if (sheetUpgradeBtn) {
      if (nextTier) {
        sheetUpgradeBtn.textContent = 'Upgrade · ' + nextTier.cost + 'g';
        sheetUpgradeBtn.disabled = gold < nextTier.cost;
      } else {
        sheetUpgradeBtn.textContent = 'Maxed';
        sheetUpgradeBtn.disabled = true;
      }
    }
    if (sheetSellBtn) sheetSellBtn.textContent = 'Sell · +' + sellValue + 'g';
  }

  function setScreen(name) {
    body.setAttribute('data-screen', name);
    document.querySelectorAll('.screen').forEach(scr => {
      if (scr.classList.contains(name)) scr.removeAttribute('inert');
      else scr.setAttribute('inert', '');
    });
  }
  function getScreen() { return body.getAttribute('data-screen'); }

  function setReducedMotion(on) { body.classList.toggle('reduced-motion', !!on); }

  // ─── Palette: render 4 tower cards using pre-baked icons ─────
  function paintPalette() {
    if (!palette || !window.CTD3Entities) return;
    const TOWERS = window.CTD3Entities.TOWERS;
    palette.replaceChildren();
    ['ranger', 'catapult', 'mage', 'warden'].forEach(type => {
      const def = TOWERS[type];
      if (!def) return;
      const iconUrl = window.CTD3Assets ? window.CTD3Assets.getIconUrl(type, 0) : '';
      const img = el('img', { src: iconUrl, alt: def.name });
      img.addEventListener('error', () => { img.style.opacity = '0.3'; });
      const card = el('button', {
        class: 'tower-card',
        'data-action': 'select-tower',
        'data-tower': type
      }, [
        img,
        el('div', null, [def.name]),
        el('div', { class: 'cost' }, [String(def.tiers[0].cost)])
      ]);
      palette.appendChild(card);
    });
  }

  function updatePalette(state) {
    if (!palette) return;
    const TOWERS = window.CTD3Entities.TOWERS;
    const sel = state.paletteSelection;
    const gold = state.gold;
    $$('.tower-card', palette).forEach(card => {
      const type = card.dataset.tower;
      const def = TOWERS[type];
      if (!def) return;
      card.classList.toggle('disabled', gold < def.tiers[0].cost);
      card.classList.toggle('selected', sel === type);
    });
  }

  // ─── HUD ─────────────────────────────────────────────────────
  function update(state) {
    if (!hudGold) return;
    hudGold.textContent  = String(state.gold);
    hudLives.textContent = String(Math.max(0, state.lives));
    if (state.waveTotal) {
      const display = Math.min(state.waveIndex + 1, state.waveTotal);
      hudWaveNum.textContent = String(display);
      hudWaveOf.textContent  = `of ${state.waveTotal}`;
    } else {
      hudWaveNum.textContent = '';
      hudWaveOf.textContent  = '';
    }
    updatePalette(state);
    updateNextWaveButton(state);
    updateFastFwdButton(state);
    updateGoldFlash();
  }

  function motionAllowed() {
    return !body.classList.contains('reduced-motion');
  }

  function updateNextWaveButton(state) {
    if (!nextWaveBtn) return;
    const canSend = window.CTD3Engine.canSendNextWave(state);
    nextWaveBtn.disabled = !canSend;
    nextWaveBtn.classList.toggle('active', canSend);
  }
  function updateFastFwdButton(state) {
    if (!fastFwdBtn) return;
    fastFwdBtn.classList.toggle('active', state.fastForward);
  }

  // ─── Gold-deficit flash (ADR-028 §C-3) ───────────────────────
  function setGoldFlash(on) {
    goldFlashUntilMs = on ? (performance.now() + GOLD_FLASH_DURATION_MS) : 0;
  }
  function updateGoldFlash() {
    const stat = document.getElementById('stat-gold');
    if (!stat) return;
    stat.classList.toggle('flash', performance.now() < goldFlashUntilMs);
  }

  // ─── Map select ──────────────────────────────────────────────
  function hydrateMapSelect(scores, isMapUnlocked, isHardUnlocked, totalStars) {
    if (!mapGrid) return;
    const MAPS = window.CTD3Maps.MAPS;
    if (totalStarsEl) totalStarsEl.textContent = String(totalStars());
    if (maxStarsEl)   maxStarsEl.textContent   = String(window.CTD3Maps.maxStars());
    mapGrid.replaceChildren();
    MAPS.forEach(map => {
      const unlocked = isMapUnlocked(map.id);
      const mapScores = scores[map.id] || {};
      const sQuiet    = (mapScores.quiet    && mapScores.quiet.stars)    || 0;
      const sSpirited = (mapScores.spirited && mapScores.spirited.stars) || 0;

      const card = el('article', {
        style: 'background:rgba(40,28,18,0.7);border:1px solid rgba(200,148,62,0.4);border-radius:8px;padding:1rem;margin:0.6rem auto;max-width:520px;color:var(--warm-stone);' + (unlocked ? '' : 'opacity:0.5;')
      });
      card.appendChild(el('div', { style: 'font-family:var(--font-display),serif;font-size:1.4rem;' }, [map.displayName]));
      card.appendChild(el('div', { style: 'font-size:0.8rem;opacity:0.7;font-style:italic;' }, ['— ' + map.roman + ' —']));
      card.appendChild(el('p', { style: 'font-size:0.9rem;color:rgba(240,230,211,0.8);' }, [map.description]));

      const row = el('div', { style: 'display:flex;gap:0.4rem;margin-top:0.6rem;' });
      const quietBtn = el('button', {
        class: 'btn',
        'data-action': 'start-map',
        'data-map-id': map.id,
        'data-difficulty': 'quiet'
      }, [
        'Quiet ',
        el('span', { role: 'img', 'aria-label': `${sQuiet} of 3 stars` }, ['★'.repeat(sQuiet) + '☆'.repeat(3 - sQuiet)])
      ]);
      if (!unlocked) quietBtn.disabled = true;
      row.appendChild(quietBtn);

      const spiritedBtn = el('button', {
        class: 'btn btn-spirited',
        'data-action': 'start-map',
        'data-map-id': map.id,
        'data-difficulty': 'spirited'
      }, [
        '★ Spirited ',
        el('span', { role: 'img', 'aria-label': `${sSpirited} of 3 stars` }, ['★'.repeat(sSpirited) + '☆'.repeat(3 - sSpirited)])
      ]);
      if (!unlocked) spiritedBtn.disabled = true;
      row.appendChild(spiritedBtn);
      card.appendChild(row);

      if (!unlocked) {
        card.appendChild(el('div', { style: 'text-align:center;margin-top:0.5rem;opacity:0.8;' }, ['Awaits ' + map.unlockRequirement + '★']));
      }
      mapGrid.appendChild(card);
    });
  }

  // ─── Game over ───────────────────────────────────────────────
  function fillGameOver(opts) {
    const { won, mapName, difficulty, stars, livesRemaining, startLives, score, bestScore } = opts;
    if (!gameOverBindings.heading) return;
    gameOverBindings.heading.textContent       = won ? 'The Watch Holds' : 'The Gate Has Fallen';
    gameOverBindings.heading.style.color       = won ? 'var(--aged-gold)' : 'var(--terracotta)';
    gameOverBindings.mapDifficulty.textContent = `${mapName} · ${difficulty[0].toUpperCase() + difficulty.slice(1)}`;
    gameOverBindings.starsRow.replaceChildren(
      el('span', { role: 'img', 'aria-label': `${stars} of 3 stars` }, ['★'.repeat(stars) + '☆'.repeat(3 - stars)])
    );
    gameOverBindings.livesRemaining.textContent = `${Math.max(0, livesRemaining)} / ${startLives}`;
    gameOverBindings.score.textContent         = score.toLocaleString();
    gameOverBindings.bestScore.textContent     = bestScore.toLocaleString();
  }

  // ─── Wave-clear flourish (gold-bar wipe; no 3D bird) ─────────
  function flashWaveClear(/* label */) {
    if (!motionAllowed()) return;
    const wipe = el('div', { class: 'wave-clear-wipe' });
    document.body.appendChild(wipe);
    setTimeout(() => wipe.remove(), 700);
  }

  // ─── First-load notice (ADR-028 §14, m-4) ────────────────────
  function showFirstLoadNoticeIfNeeded() {
    const noticeSeen = window.SharedStorage.safeGet('ctd3:noticeSeen', null);
    if (noticeSeen === '1' || noticeSeen === true) return;
    const oldScores = window.SharedStorage.safeGet('ctd:scores', null);
    if (!oldScores) return;
    body.classList.add('show-first-load-notice');
  }
  function dismissFirstLoadNotice() {
    body.classList.remove('show-first-load-notice');
    window.SharedStorage.safeSet('ctd3:noticeSeen', '1');
  }

  function setLoadingProgress(pct, status) {
    const fill = $('[data-bind="loading-fill"]');
    const stat = $('[data-bind="loading-status"]');
    if (fill) fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
    if (stat && status) stat.textContent = status;
  }

  // ─── HOW TO PLAY legend (hydrated from entities tables) ──────
  function towerRoleHint(type, def) {
    if (def.behavior === 'aura') return 'Aura — slows nearby raiders. No fire cooldown.';
    const t0 = def.tiers[0];
    if (def.splashRadius || (t0 && t0.splashRadius)) return 'Splash damage — strong vs. crowds.';
    if (def.damageType === 'magic') return 'Magic damage — ignores armor; later tiers chain.';
    if (def.targets === 'all') return 'Reliable single-target. Hits flying.';
    return 'Single-target.';
  }
  function enemyMeta(def) {
    const tags = [];
    if (def.isFlying) tags.push('flying');
    if (def.armor && def.armor > 0) tags.push('armored');
    if (def.isBoss) tags.push('boss');
    return tags.length ? tags.join(' · ') : 'standard';
  }

  function fillHelpScreen() {
    const E = window.CTD3Entities;
    if (!E) return;
    const towersEl  = $('[data-bind="helpTowers"]');
    const enemiesEl = $('[data-bind="helpEnemies"]');
    if (towersEl) {
      towersEl.replaceChildren();
      ['ranger', 'catapult', 'mage', 'warden'].forEach(type => {
        const def = E.TOWERS[type];
        if (!def) return;
        const t0 = def.tiers[0];
        const card = el('div', { class: 'legend-card' }, [
          el('span', { class: 'name' }, [def.name]),
          el('span', { class: 'meta' }, ['cost ' + t0.cost + 'g · ' + (def.behavior === 'aura' ? 'aura' : (def.targets || 'all'))]),
          el('span', { class: 'role' }, [towerRoleHint(type, def)])
        ]);
        towersEl.appendChild(card);
      });
    }
    if (enemiesEl) {
      enemiesEl.replaceChildren();
      ['footman', 'heavy', 'runner', 'skirmisher', 'shielded', 'captain'].forEach(type => {
        const def = E.ENEMIES[type];
        if (!def) return;
        const card = el('div', { class: 'legend-card' + (def.isBoss ? ' boss' : '') }, [
          el('span', { class: 'name' }, [def.name]),
          el('span', { class: 'meta' }, ['hp ' + def.hp + ' · spd ' + def.speed]),
          el('span', { class: 'role' }, [enemyMeta(def)])
        ]);
        enemiesEl.appendChild(card);
      });
    }
  }

  window.CTD3Ui = {
    init, setScreen, getScreen,
    setReducedMotion, motionAllowed,
    update, paintPalette, updatePalette,
    hydrateMapSelect, fillGameOver,
    flashWaveClear,
    setGoldFlash,
    showFirstLoadNoticeIfNeeded, dismissFirstLoadNotice,
    setLoadingProgress,
    fillHelpScreen,
    openSlotSheet, openTowerSheet, closeSheets,
    paintTowerSheet, paintSlotPicks,
    getActiveSheet, getSheetSlotId, getSheetTowerId
  };
})();
