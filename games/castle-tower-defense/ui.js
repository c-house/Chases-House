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
  let earlyCallChip, earlyCallValue, earlyCallAnnounce;
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
    earlyCallChip     = $('[data-bind="early-call"]');
    earlyCallValue    = $('[data-bind="early-call-value"]');
    earlyCallAnnounce = $('[data-bind="early-call-announce"]');

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
  // Focus management for the sheets' role="dialog" (ADR-034 T14
  // follow-through): capture the invoking element on first open, move
  // focus into the sheet, restore on close. Captured only when no sheet
  // was open, so slot→tower sheet swaps keep the ORIGINAL invoker.
  let sheetReturnFocus = null;
  function focusIntoSheet(sheetEl) {
    if (!sheetEl) return;
    // Skip disabled buttons (focus() on them is a no-op — an unaffordable
    // Upgrade/pick would leave focus stranded on body); the close-x is
    // never disabled, so the chain always finds a target.
    const target = sheetEl.querySelector('button:not(.close-x):not(:disabled)')
      || sheetEl.querySelector('button:not(:disabled)');
    if (target) target.focus();
  }
  function openSlotSheet(slotId, gold) {
    if (!activeSheet) sheetReturnFocus = document.activeElement;
    activeSheet = 'slot';
    sheetTargetSlotId = slotId;
    if (sheetSlotIdLabel) sheetSlotIdLabel.textContent = 'Slot ' + slotId;
    paintSlotPicks(gold);
    closeOtherSheets('slot');
    if (sheetSlot) sheetSlot.classList.add('open');
    setPlayInert(true);
    focusIntoSheet(sheetSlot);
  }
  function openTowerSheet(tower, gold) {
    if (!activeSheet) sheetReturnFocus = document.activeElement;
    activeSheet = 'tower';
    sheetTargetTowerId = tower.id;
    paintTowerSheet(tower, gold);
    closeOtherSheets('tower');
    if (sheetTower) sheetTower.classList.add('open');
    setPlayInert(true);
    focusIntoSheet(sheetTower);
  }
  function closeSheets() {
    const wasOpen = activeSheet !== null;
    activeSheet = null;
    sheetTargetSlotId = null;
    sheetTargetTowerId = null;
    if (sheetSlot)  sheetSlot.classList.remove('open');
    if (sheetTower) sheetTower.classList.remove('open');
    setPlayInert(false);
    // Restore focus AFTER inert is lifted (focus into an inert subtree
    // silently fails). Guarded on wasOpen so the defensive teardown
    // calls (startMap, restart) never steal focus.
    if (wasOpen && sheetReturnFocus) {
      if (sheetReturnFocus.isConnected && typeof sheetReturnFocus.focus === 'function') {
        sheetReturnFocus.focus();
      }
      sheetReturnFocus = null;
    }
  }

  // ADR-034 T14 — while an action sheet (modal) is open, the play HUD
  // behind it goes inert so Tab cannot reach the cog/palette through the
  // sheet. The sheets live outside .screen blocks, so setScreen's own
  // inert sweep never covers this case.
  function setPlayInert(on) {
    const play = document.querySelector('.screen.play');
    if (!play) return;
    if (on) play.setAttribute('inert', '');
    else if (getScreen() === 'play') play.removeAttribute('inert');
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
    // If focus is on a control this repaint may disable (Upgrade → Maxed /
    // unaffordable), remember so we can re-land focus inside the dialog rather
    // than let the browser drop it to <body> when the button goes disabled.
    const hadFocus = sheetTower && sheetTower.contains(document.activeElement);
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
      // Total-invested context (ADR-036 X-6): the tier ladder charges less to
      // upgrade than to place (catapult 120→110, mage 200→160), which reads as
      // a pricing bug in isolation. Showing cumulative gold-in-tower — and, when
      // an upgrade is available, where it lands the total (120g → 230g) — reframes
      // the next-tier price as growing investment rather than a sub-placement
      // bargain, and makes the Sell refund below legible as 75% of what's in.
      const invested = window.CTD3Entities.towerInvested(tower.type, tower.tier);
      rows.push(['Invested', nextTier ? invested + 'g → ' + (invested + nextTier.cost) + 'g' : invested + 'g']);
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
    // Disabling the focused control blurs it to <body>; move focus to the
    // nearest enabled control (Sell, else close-×) so the dialog keeps it.
    if (hadFocus && (!sheetTower.contains(document.activeElement) ||
        (document.activeElement && document.activeElement.disabled))) {
      focusIntoSheet(sheetTower);
    }
  }

  function setScreen(name) {
    body.setAttribute('data-screen', name);
    document.querySelectorAll('.screen').forEach(scr => {
      if (scr.classList.contains(name)) scr.removeAttribute('inert');
      else scr.setAttribute('inert', '');
    });
    // Returning to play with a sheet still open keeps the HUD inert (T14).
    if (name === 'play' && activeSheet) setPlayInert(true);
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
    updateEarlyCall(state);
    updateGoldFlash();
  }

  function motionAllowed() {
    // ADR-034 Group 6 T13 — honor both the user-toggled body.reduced-motion
    // class AND the OS-level prefers-reduced-motion media query. Either
    // suppresses aura pulse, enemy bob, and other in-tick animations.
    if (body.classList.contains('reduced-motion')) return false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
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

  // ─── Early-call bonus chip (ADR-036 D4) ──────────────────────
  // The ticking readout is deliberately NOT aria-live (it changes every
  // second); the award is announced once through the separate
  // role="status" region in announceEarlyCallBonus.
  function updateEarlyCall(state) {
    if (!earlyCallChip) return;
    // In the browser, pause hides the whole play screen (game.js swaps
    // data-screen), so the !paused term only matters for headless/embedded
    // callers that drive engine.togglePause directly.
    const show = state.fsm === 'prepWave' && state.prepCountdownMs > 0 && !state.paused;
    earlyCallChip.hidden = !show;
    if (!show || !earlyCallValue) return;
    const secs = Math.ceil(state.prepCountdownMs / 1000);
    const bonus = window.CTD3Entities.earlyCallBonus(state.prepCountdownMs / 1000, state);
    earlyCallValue.textContent = '+' + bonus + 'g · ' + secs + 's';
  }
  // ADR-034 T9 — screen-reader denial announcement. The gold counter's own
  // aria-live only reports the number changing; a denied action changes
  // nothing, so it needs an explicit atomic announcement. Clear-then-set on
  // the next frame so back-to-back identical denials re-announce.
  function announceDenial(text) {
    const region = $('[data-bind="denial-announce"]');
    if (!region) return;
    region.textContent = '';
    // ~50ms gap, not rAF: both mutations inside one a11y-tree update cycle
    // get coalesced and identical repeated denials would go unannounced.
    setTimeout(() => { region.textContent = text; }, 50);
  }

  function announceEarlyCallBonus(amount) {
    if (earlyCallAnnounce) earlyCallAnnounce.textContent = 'Early call bonus +' + amount + ' gold';
    const goldStat = document.getElementById('stat-gold');
    if (goldStat && motionAllowed()) {
      goldStat.classList.remove('bonus-pulse');
      void goldStat.offsetWidth; // restart the animation on back-to-back awards
      goldStat.classList.add('bonus-pulse');
    }
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
  function renderMapCard(map, opts) {
    const { scores, unlocked, showUnlockHint, showDelete } = opts;
    const mapScores = scores[map.id] || {};
    const sQuiet    = (mapScores.quiet    && mapScores.quiet.stars)    || 0;
    const sSpirited = (mapScores.spirited && mapScores.spirited.stars) || 0;

    const card = el('article', {
      style: 'background:rgba(40,28,18,0.7);border:1px solid rgba(200,148,62,0.4);border-radius:8px;padding:1rem;margin:0.6rem auto;max-width:520px;color:var(--warm-stone);' + (unlocked ? '' : 'opacity:0.5;')
    });
    card.appendChild(el('div', { style: 'font-family:var(--font-display),serif;font-size:1.4rem;' }, [map.displayName]));
    if (map.roman) card.appendChild(el('div', { style: 'font-size:0.8rem;opacity:0.7;font-style:italic;' }, ['— ' + map.roman + ' —']));
    if (map.description) card.appendChild(el('p', { style: 'font-size:0.9rem;color:rgba(240,230,211,0.8);' }, [map.description]));

    const row = el('div', { style: 'display:flex;gap:0.4rem;margin-top:0.6rem;' });
    const quietBtn = el('button', { class: 'btn', 'data-action': 'start-map', 'data-map-id': map.id, 'data-difficulty': 'quiet' },
      ['Quiet ', el('span', { role: 'img', 'aria-label': `${sQuiet} of 3 stars` }, ['★'.repeat(sQuiet) + '☆'.repeat(3 - sQuiet)])]);
    if (!unlocked) quietBtn.disabled = true;
    row.appendChild(quietBtn);

    const spiritedBtn = el('button', { class: 'btn btn-spirited', 'data-action': 'start-map', 'data-map-id': map.id, 'data-difficulty': 'spirited' },
      ['★ Spirited ', el('span', { role: 'img', 'aria-label': `${sSpirited} of 3 stars` }, ['★'.repeat(sSpirited) + '☆'.repeat(3 - sSpirited)])]);
    if (!unlocked) spiritedBtn.disabled = true;
    row.appendChild(spiritedBtn);

    if (showDelete) {
      const delBtn = el('button', { class: 'btn', 'data-action': 'delete-user-map', 'data-map-id': map.id, style: 'margin-left:auto;background:rgba(176,90,58,0.2);border-color:rgba(176,90,58,0.5);color:var(--terracotta, #b05a3a);' }, ['Delete']);
      row.appendChild(delBtn);
    }
    card.appendChild(row);

    if (showUnlockHint) {
      card.appendChild(el('div', { style: 'text-align:center;margin-top:0.5rem;opacity:0.8;' }, ['Awaits ' + map.unlockRequirement + '★']));
    }
    return card;
  }

  // Tab state lives on the function — simple module-private store.
  let _activeMapTab = 'official';
  function setMapTab(tab) {
    _activeMapTab = tab;
    // Caller (game.js) re-hydrates with the same args; we read from state.
  }
  function getActiveMapTab() { return _activeMapTab; }

  function _renderTabs() {
    const map = { official: 'tab-official', mine: 'tab-mine', community: 'tab-community' };
    Object.entries(map).forEach(([tab, bind]) => {
      const btn = document.querySelector('[data-bind="' + bind + '"]');
      if (!btn) return;
      btn.classList.toggle('primary', tab === _activeMapTab);
      btn.setAttribute('aria-pressed', tab === _activeMapTab);
    });
  }

  function _renderCommunityList(scores) {
    mapGrid.appendChild(el('div', { style: 'text-align:center;color:rgba(240,230,211,0.6);font-size:0.9rem;margin:1rem;' }, ['Loading community maps…']));
    if (typeof window.SharedFirebase === 'undefined') {
      mapGrid.replaceChildren();
      mapGrid.appendChild(el('div', { style: 'text-align:center;color:var(--terracotta);font-size:0.9rem;margin:1rem;' }, ['Firebase SDK not loaded.']));
      return;
    }
    window.SharedFirebase.signInAnonymously()
      .then(() => window.SharedFirebase.ref('ctd3-community').orderByChild('updatedAt').limitToLast(30).once('value'))
      .then(snap => {
        mapGrid.replaceChildren();
        // Reverse so newest first (Firebase orderByChild returns ascending).
        const entries = [];
        snap.forEach(child => { entries.push({ code: child.key, val: child.val() }); });
        entries.reverse();
        if (entries.length === 0) {
          mapGrid.appendChild(el('div', { style: 'text-align:center;color:rgba(240,230,211,0.6);font-size:0.9rem;margin:1rem;' }, ['No community maps yet. Be the first — publish from the editor.']));
          return;
        }
        entries.forEach(({ code, val }) => {
          if (!val || !val.map) return;
          // Stamp the code into the displayed map so import + identification work.
          const cardMap = Object.assign({}, val.map, { _communityCode: code, _communityMeta: val.meta });
          const card = renderCommunityCard(cardMap, val, scores);
          mapGrid.appendChild(card);
        });
      })
      .catch(e => {
        mapGrid.replaceChildren();
        mapGrid.appendChild(el('div', { style: 'text-align:center;color:var(--terracotta);font-size:0.9rem;margin:1rem;' }, ['Community fetch failed: ' + (e && e.message)]));
      });
  }

  function renderCommunityCard(map, record, scores) {
    const card = el('article', {
      style: 'background:rgba(40,28,18,0.7);border:1px solid rgba(200,148,62,0.4);border-radius:8px;padding:1rem;margin:0.6rem auto;max-width:520px;color:var(--warm-stone);'
    });
    card.appendChild(el('div', { style: 'font-family:var(--font-display),serif;font-size:1.4rem;' }, [map.displayName || 'Untitled']));
    const author = (record.meta && record.meta.authorName) ? record.meta.authorName : 'anonymous';
    card.appendChild(el('div', { style: 'font-size:0.8rem;opacity:0.7;font-style:italic;' }, ['by ' + author + ' · code ' + map._communityCode]));
    if (map.description) card.appendChild(el('p', { style: 'font-size:0.9rem;color:rgba(240,230,211,0.8);' }, [map.description]));
    const row = el('div', { style: 'display:flex;gap:0.4rem;margin-top:0.6rem;' });
    row.appendChild(el('button', {
      class: 'btn primary', 'data-action': 'import-community', 'data-community-code': map._communityCode
    }, ['Import to My Maps']));
    card.appendChild(row);
    return card;
  }

  function hydrateMapSelect(scores, isMapUnlocked, isHardUnlocked, totalStars) {
    if (!mapGrid) return;
    if (totalStarsEl) totalStarsEl.textContent = String(totalStars());
    if (maxStarsEl)   maxStarsEl.textContent   = String(window.CTD3Maps.maxStars());
    _renderTabs();
    mapGrid.replaceChildren();
    if (_activeMapTab === 'official') {
      const MAPS = window.CTD3Maps.listOfficial();
      MAPS.forEach(map => {
        const unlocked = isMapUnlocked(map.id);
        mapGrid.appendChild(renderMapCard(map, {
          scores, unlocked, showUnlockHint: !unlocked, showDelete: false
        }));
      });
    } else if (_activeMapTab === 'mine') {
      const USER = window.CTD3Maps.listUserMaps();
      if (USER.length === 0) {
        mapGrid.appendChild(el('div', { style: 'text-align:center;color:rgba(240,230,211,0.6);font-size:0.9rem;margin:1rem;' }, ['No user maps yet. Open the Map Editor from the title screen and click "Save to My Maps".']));
      } else {
        USER.forEach(map => {
          mapGrid.appendChild(renderMapCard(map, {
            scores, unlocked: true, showUnlockHint: false, showDelete: true
          }));
        });
      }
    } else if (_activeMapTab === 'community') {
      _renderCommunityList(scores);
    }
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
    if (def.spectralCharges) tags.push('spectral × ' + def.spectralCharges);
    if (def.splitsInto) tags.push('splits on death');
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
      ['footman', 'heavy', 'runner', 'skirmisher', 'shielded', 'juggernaut', 'slime', 'ghost', 'captain'].forEach(type => {
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
    setMapTab, getActiveMapTab,
    flashWaveClear,
    setGoldFlash, announceEarlyCallBonus, announceDenial,
    showFirstLoadNoticeIfNeeded, dismissFirstLoadNotice,
    setLoadingProgress,
    fillHelpScreen,
    openSlotSheet, openTowerSheet, closeSheets,
    paintTowerSheet, paintSlotPicks,
    getActiveSheet, getSheetSlotId, getSheetTowerId
  };
})();
