/* ═══════════════════════════════════════════════════════════════
   Asteroids — ui.js
   DOM overlay flow + HUD writes + bind-screen polling + initials entry
   + meta-key handlers + mute persistence.

   Per review fix #3: bind screen is a state-machine state, polled per
   tick from updateBindScreen(dt). No Promises in the input layer.
   Per review fix #1: this file does NOT drain state.events — only
   audio.js does. UI reads state directly for HUD updates.

   Exposes window.AsteroidsUI.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const I = window.AsteroidsInput;
  const Au = window.AsteroidsAudio;

  const MUTE_KEY = 'asteroids-muted';

  const FLAVOR_LINES = [
    '"One rock left. So close."',
    '"The cosmos is unforgiving."',
    '"Inertia is a cruel mistress."',
    '"Saw it coming. Couldn\'t move."',
    '"The small ones got you."',
    '"Hyperspace gave, hyperspace took."',
    '"Phosphor never sleeps."',
    '"Eight vertices to your name."'
  ];

  // DOM refs (resolved on init)
  let dom = {};

  // ── init / DOM wiring ─────────────────────────────────────
  function init() {
    dom.hud           = document.getElementById('hud');
    dom.hudScore      = dom.hud && dom.hud.querySelector('.hud-score');
    dom.hudWave       = dom.hud && dom.hud.querySelector('.hud-wave');
    dom.hudLives      = dom.hud && dom.hud.querySelector('.hud-lives');
    dom.hudP2         = dom.hud && dom.hud.querySelector('.hud-p2');

    // Map scene names → DOM overlay elements (so setScene(name) toggles correctly).
    dom.overlays = {
      title:    document.getElementById('overlay-title'),
      bind:     document.getElementById('overlay-bind'),
      paused:   document.getElementById('overlay-pause'),
      gameover: document.getElementById('overlay-gameover'),
      hsentry:  document.getElementById('overlay-initials'),
      hstable:  document.getElementById('overlay-scores')
    };

    // Title screen interactive elements
    dom.modeToggle = dom.overlays.title.querySelector('.mode-toggle');
    dom.modeBtns   = dom.overlays.title.querySelectorAll('.mode-btn');

    // Bind screen elements
    dom.bindCards = dom.overlays.bind.querySelectorAll('.bind-card');

    // Game over
    dom.gameoverScore = dom.overlays.gameover.querySelector('.gameover-score');
    dom.gameoverMeta  = dom.overlays.gameover.querySelectorAll('.gameover-meta strong');
    dom.flavor        = document.getElementById('flavor');

    // Initials entry
    dom.initialsScore = dom.overlays.hsentry.querySelector('.gameover-score');
    dom.initialsLabel = dom.overlays.hsentry.querySelector('.initials-label');
    dom.initialCells  = dom.overlays.hsentry.querySelectorAll('.initial-cell');

    // High-score table
    dom.scoretableBody = dom.overlays.hstable.querySelector('tbody');

    wireModeButtons();
    wireMenuItems();
    restoreMute();
  }

  function wireModeButtons() {
    if (!dom.modeBtns) return;
    dom.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const coop = btn.textContent.trim() === 'CO-OP';
        dom.modeBtns.forEach(b => b.dataset.active = (b === btn) ? 'true' : 'false');
        Au.resume();  // first click counts as user gesture for AudioContext
        window.AsteroidsGame.startNewGame(coop);
      });
    });
  }

  function wireMenuItems() {
    const pauseMenu = dom.overlays.paused.querySelectorAll('.menu-item');
    pauseMenu.forEach(item => {
      item.addEventListener('click', () => {
        const text = item.textContent.trim().toUpperCase();
        if (text === 'RESUME') window.AsteroidsGame.resumeFromPause();
        else if (text === 'RESTART') window.AsteroidsGame.restartFromPause();
        else if (text === 'MUTE') toggleMute();
        else if (text === 'QUIT') window.AsteroidsGame.quitToTitle();
      });
    });
  }

  // ── overlay show/hide ─────────────────────────────────────
  function setScene(name, state) {
    for (const key in dom.overlays) {
      const el = dom.overlays[key];
      if (el) el.hidden = (key !== name);
    }
    if (dom.hud) dom.hud.hidden = !(name === 'playing' || name === 'paused');

    // Per-scene enter hooks
    if (name === 'gameover') pickFlavor();
    if (name === 'hstable')  renderHsTable();
    if (name === 'title')    retriggerTitleAnim();
    if (name === 'gameover' && state) populateGameoverStats(state);
  }

  function populateGameoverStats(state) {
    if (dom.gameoverScore) dom.gameoverScore.textContent = formatScore(state.score);
    if (dom.gameoverMeta && dom.gameoverMeta.length >= 2) {
      dom.gameoverMeta[0].textContent = String(state.wave).padStart(2, '0');
      const rank = window.AsteroidsGame.computeRank(state.score);
      const TOP_N = window.AsteroidsGame.CONSTANTS.HIGHSCORE_TOP_N;
      dom.gameoverMeta[1].textContent = rank >= 0 && rank < TOP_N
        ? '#' + (rank + 1).toString().padStart(2, '0')
        : '—';
    }
  }

  function pickFlavor() {
    if (!dom.flavor) return;
    dom.flavor.textContent = FLAVOR_LINES[Math.floor(Math.random() * FLAVOR_LINES.length)];
  }

  function retriggerTitleAnim() {
    const t = dom.overlays.title.querySelector('.title-mark text');
    if (!t) return;
    t.style.animation = 'none';
    void t.offsetWidth;  // force reflow
    t.style.animation = '';
  }

  // ── HUD ───────────────────────────────────────────────────
  function updateHUD(state) {
    if (!dom.hud || dom.hud.hidden) return;
    const p1 = state.players[0];
    if (p1 && dom.hudScore) {
      dom.hudScore.innerHTML = '<span class="hud-score-label">SCORE</span>' +
        formatScore(state.score);
    }
    if (dom.hudWave) {
      dom.hudWave.textContent = 'WAVE ' + String(state.wave).padStart(2, '0');
    }
    if (dom.hudLives) renderLives(dom.hudLives, p1 ? p1.lives : 0);

    // P2 HUD only in co-op
    const p2 = state.players[1];
    if (dom.hudP2) {
      if (state.coop && p2) {
        dom.hudP2.hidden = false;
        renderP2HUD(p2);
      } else {
        dom.hudP2.hidden = true;
      }
    }
  }

  function formatScore(s) {
    // 12 480 — space every three digits
    const str = String(s);
    const parts = [];
    for (let i = str.length; i > 0; i -= 3) {
      parts.unshift(str.slice(Math.max(0, i - 3), i));
    }
    return parts.join(' ').padStart(6, '0');
  }

  function renderLives(container, lives) {
    container.innerHTML = '';
    const total = Math.max(lives, 0);
    for (let i = 0; i < total; i++) {
      container.appendChild(makeShipIcon(false));
    }
  }

  function renderP2HUD(p2) {
    const livesEl = dom.hudP2.querySelector('.hud-p2-lives');
    if (!livesEl) return;
    // textContent format: "P2\n04 320" + lives row
    // We rebuild the markup so we don't drift the layout
    dom.hudP2.innerHTML =
      '<span class="hud-p2-label">P2</span>' +
      formatScore(p2.score || 0) +  // score is shared in our spec; show shared score
      '<div class="hud-p2-lives"></div>';
    const newLives = dom.hudP2.querySelector('.hud-p2-lives');
    for (let i = 0; i < p2.lives; i++) newLives.appendChild(makeShipIcon(true));
  }

  function makeShipIcon(small) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 32');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linejoin', 'round');
    if (small) svg.style.width = '16px';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 3 L21 28 L12 23 L3 28 Z');
    svg.appendChild(path);
    return svg;
  }

  // ── bind screen (polled per tick by game.js) ──────────────
  function updateBindScreen(state) {
    // Refresh card states based on current bindings
    const p1 = state.players[0];
    const p2 = state.players[1];
    const cards = dom.bindCards;
    if (!cards || cards.length < 2) return;

    updateBindCard(cards[0], p1);
    updateBindCard(cards[1], p2);

    // Both bound? wait for Enter to be handled in game.js's keyboard handler
    const bothBound = p1 && p1.input.scheme || p1 && p1.input.gamepadIndex != null;
    const p2Bound   = p2 && (p2.input.scheme || p2.input.gamepadIndex != null);

    // Poll for next unbound assignment
    if (!p1 || !(p1.input.scheme || p1.input.gamepadIndex != null)) {
      const src = I.peekUnclaimedInput();
      if (src) {
        if (src.kind === 'keyboard') p1.input.scheme = src.scheme;
        else                          p1.input.gamepadIndex = src.gamepadIndex;
        I.claimInput(1, src);
      }
    } else if (state.coop && p2 && !(p2.input.scheme || p2.input.gamepadIndex != null)) {
      const src = I.peekUnclaimedInput();
      if (src) {
        if (src.kind === 'keyboard') p2.input.scheme = src.scheme;
        else                          p2.input.gamepadIndex = src.gamepadIndex;
        I.claimInput(2, src);
      }
    }
  }

  function updateBindCard(card, player) {
    if (!card || !player) return;
    const bound = !!(player.input.scheme || player.input.gamepadIndex != null);
    card.dataset.state = bound ? 'bound' : 'waiting';
    const pill = card.querySelector('.bind-pill');
    const value = card.querySelector('.bind-value');
    if (pill) pill.textContent = `P${player.slot} · ${bound ? 'BOUND' : 'WAITING'}`;
    if (value && bound) {
      if (player.input.scheme === 'arrows') {
        value.innerHTML = 'ARROW KEYS<span class="bind-value-secondary">SPACE fire · SHIFT hyperspace</span>';
      } else if (player.input.scheme === 'wasd') {
        value.innerHTML = 'WASD<span class="bind-value-secondary">F fire · G hyperspace</span>';
      } else if (player.input.gamepadIndex != null) {
        value.innerHTML = 'GAMEPAD ' + (player.input.gamepadIndex + 1) +
          '<span class="bind-value-secondary">D-PAD move · A fire · DOWN hyperspace</span>';
      }
    } else if (value) {
      value.innerHTML = 'PRESS A KEY<span class="bind-value-secondary">or any gamepad button</span>';
    }
  }

  // ── initials entry ────────────────────────────────────────
  function enterHsEntry(state) {
    state.hsEntry = { initials: ['A', 'A', 'A'], cursor: 0 };
    if (dom.initialsScore) dom.initialsScore.textContent = formatScore(state.score);
    if (dom.initialsLabel) {
      const rank = window.AsteroidsGame.computeRank(state.score) + 1;
      dom.initialsLabel.textContent = `NEW HIGH SCORE · RANK #${String(rank).padStart(2, '0')}`;
    }
    refreshInitialCells(state);
  }

  function updateHsEntry(state, code) {
    const e = state.hsEntry;
    if (!e) return false;  // returns true when complete
    if (code === 'ArrowUp')   { e.initials[e.cursor] = nextChar(e.initials[e.cursor], +1); refreshInitialCells(state); return false; }
    if (code === 'ArrowDown') { e.initials[e.cursor] = nextChar(e.initials[e.cursor], -1); refreshInitialCells(state); return false; }
    if (code === 'ArrowRight' || code === 'Tab') {
      if (e.cursor < 2) { e.cursor++; refreshInitialCells(state); }
      return false;
    }
    if (code === 'ArrowLeft') {
      if (e.cursor > 0) { e.cursor--; refreshInitialCells(state); }
      return false;
    }
    if (code === 'Enter') {
      if (e.cursor < 2) { e.cursor++; refreshInitialCells(state); return false; }
      return true;
    }
    // Direct letter input
    if (code.startsWith('Key') && code.length === 4) {
      e.initials[e.cursor] = code.charAt(3);
      if (e.cursor < 2) e.cursor++;
      refreshInitialCells(state);
      return false;
    }
    return false;
  }

  function nextChar(c, dir) {
    const code = c.charCodeAt(0);
    const A = 'A'.charCodeAt(0), Z = 'Z'.charCodeAt(0);
    let n = code + dir;
    if (n < A) n = Z;
    if (n > Z) n = A;
    return String.fromCharCode(n);
  }

  function refreshInitialCells(state) {
    if (!dom.initialCells) return;
    dom.initialCells.forEach((cell, i) => {
      cell.textContent = state.hsEntry.initials[i];
      cell.dataset.active = (i === state.hsEntry.cursor) ? 'true' : 'false';
    });
  }

  // ── high-score table ──────────────────────────────────────
  function renderHsTable() {
    if (!dom.scoretableBody) return;
    const list = window.AsteroidsGame.loadHighScores();
    dom.scoretableBody.innerHTML = '';
    if (list.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="5" style="text-align:center;color:rgba(240,240,230,0.4);padding:1.6rem">no scores yet · be the first</td>';
      dom.scoretableBody.appendChild(tr);
      return;
    }
    list.forEach((entry, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="rank">${String(i + 1).padStart(2, '0')}</td>` +
        `<td class="initials">${escapeHtml(entry.initials)}</td>` +
        `<td class="num">${formatScore(entry.score)}</td>` +
        `<td class="num">${String(entry.wave).padStart(2, '0')}</td>` +
        `<td>${escapeHtml(entry.date || '')}</td>`;
      dom.scoretableBody.appendChild(tr);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── mute persistence ──────────────────────────────────────
  function restoreMute() {
    try {
      const v = localStorage.getItem(MUTE_KEY);
      if (v === '1') Au.setMuted(true);
    } catch (_) {}
  }

  function toggleMute() {
    Au.setMuted(!Au.isMuted());
    try { localStorage.setItem(MUTE_KEY, Au.isMuted() ? '1' : '0'); } catch (_) {}
  }

  window.AsteroidsUI = {
    init: init,
    setScene: setScene,
    updateHUD: updateHUD,
    updateBindScreen: updateBindScreen,
    enterHsEntry: enterHsEntry,
    updateHsEntry: updateHsEntry,
    renderHsTable: renderHsTable,
    toggleMute: toggleMute,
    formatScore: formatScore
  };

  // Boot — ui.js is the last-loaded script, so all module APIs are now resolved.
  // Trigger game.js to wire DOM, attach input, and start the RAF loop.
  window.AsteroidsGame.init();
})();
