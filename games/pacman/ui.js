(function () {
  'use strict';

  const I = window.PacmanInput;
  const Au = window.PacmanAudio;
  const G = window.PacmanGame;
  const Modes = window.PacmanModes;

  const canvas = document.getElementById('pacman-canvas');
  const overlayMode = document.getElementById('overlay-mode');
  const overlayOptions = document.getElementById('overlay-options');
  const overlayBind = document.getElementById('overlay-bind');
  const overlayGameOver = document.getElementById('overlay-gameover');
  const overlayPause = document.getElementById('overlay-pause');
  const modeGrid = document.getElementById('mode-grid');
  const optionsTitle = document.getElementById('options-title');
  const pacCountRow = document.getElementById('pac-count-row');
  const pacCountPills = document.getElementById('pac-count-pills');
  const ghostCountRow = document.getElementById('ghost-count-row');
  const ghostCountPills = document.getElementById('ghost-count-pills');
  const bindList = document.getElementById('bind-list');
  const bindStart = document.getElementById('bind-start');
  const gameoverTitle = document.getElementById('gameover-title');
  const gameoverScores = document.getElementById('gameover-scores');
  const gamepadListEl = document.getElementById('gamepad-list');
  const btnPause = document.getElementById('btn-pause');
  const btnMute = document.getElementById('btn-mute');

  let pendingConfig = null;
  let bindRows = null;
  let bindScanRAF = null;
  let paused = false;

  function hideAllOverlays() {
    overlayMode.classList.add('hidden');
    overlayOptions.classList.add('hidden');
    overlayBind.classList.add('hidden');
    overlayGameOver.classList.add('hidden');
    overlayPause.classList.add('hidden');
  }

  function showModeSelect() {
    cancelBindScan();
    hideAllOverlays();
    overlayMode.classList.remove('hidden');
    renderModeGrid();
    G.stopGame();
  }

  function renderModeGrid() {
    modeGrid.innerHTML = '';
    for (const mode of Modes.list()) {
      const btn = document.createElement('button');
      btn.className = 'mode-btn';
      btn.innerHTML = `<span class="mode-btn-name">${mode.name}</span><span class="mode-btn-desc">${mode.description}</span>`;
      btn.addEventListener('click', () => onModePicked(mode));
      modeGrid.appendChild(btn);
    }
  }

  function onModePicked(mode) {
    pendingConfig = JSON.parse(JSON.stringify(mode));
    // Show options screen if this mode has variable counts
    const needsOptions =
      (mode.allowPacCountRange && mode.allowPacCountRange.length > 1) ||
      (mode.allowHumanGhostCountRange && mode.allowHumanGhostCountRange.length > 1);
    if (needsOptions) showOptions(mode);
    else showBind();
  }

  function showOptions(mode) {
    hideAllOverlays();
    overlayOptions.classList.remove('hidden');
    optionsTitle.textContent = mode.name.toUpperCase();

    // Pac count pills
    if (mode.allowPacCountRange && mode.allowPacCountRange.length > 1) {
      pacCountRow.style.display = '';
      pacCountPills.innerHTML = '';
      for (const n of mode.allowPacCountRange) {
        const p = document.createElement('button');
        p.className = 'pill' + (pendingConfig.pacCount === n ? ' active' : '');
        p.textContent = String(n);
        p.addEventListener('click', () => {
          pendingConfig.pacCount = n;
          pendingConfig.humanPacCount = n;
          Array.from(pacCountPills.children).forEach(c => c.classList.remove('active'));
          p.classList.add('active');
        });
        pacCountPills.appendChild(p);
      }
    } else { pacCountRow.style.display = 'none'; }

    if (mode.allowHumanGhostCountRange && mode.allowHumanGhostCountRange.length > 1) {
      ghostCountRow.style.display = '';
      ghostCountPills.innerHTML = '';
      for (const n of mode.allowHumanGhostCountRange) {
        const p = document.createElement('button');
        p.className = 'pill' + (pendingConfig.humanGhostCount === n ? ' active' : '');
        p.textContent = String(n);
        p.addEventListener('click', () => {
          pendingConfig.humanGhostCount = n;
          Array.from(ghostCountPills.children).forEach(c => c.classList.remove('active'));
          p.classList.add('active');
        });
        ghostCountPills.appendChild(p);
      }
    } else { ghostCountRow.style.display = 'none'; }
  }

  function showBind() {
    hideAllOverlays();
    overlayBind.classList.remove('hidden');

    // Clear any existing bindings
    Object.keys(I.getBindings()).forEach(s => I.unbindSlot(s));

    const slots = Modes.humanSlotsForMode(pendingConfig);
    bindList.innerHTML = '';
    bindRows = slots.map((info, i) => {
      const row = document.createElement('div');
      row.className = 'bind-row' + (i === 0 ? ' waiting' : '');
      row.dataset.slot = info.slot;
      row.innerHTML = `
        <div class="bind-label">${info.label}
          <small>${info.role === 'pac' ? 'Move Pac-Man' : 'Control ghost'}</small>
        </div>
        <div class="bind-status">WAITING...</div>
      `;
      bindList.appendChild(row);
      return { info, row, bound: false };
    });
    bindStart.classList.add('hidden');
    startBindScan();
  }

  function defaultSchemeForSlot(order) {
    return ['wasd', 'arrows', 'ijkl', 'numpad'][order] || 'wasd';
  }

  function describeSource(src) {
    if (src.kind === 'keyboard') {
      const labels = {
        wasd: 'KEYBOARD · WASD',
        arrows: 'KEYBOARD · ARROWS',
        ijkl: 'KEYBOARD · IJKL',
        numpad: 'KEYBOARD · NUMPAD',
      };
      return labels[src.scheme] || 'KEYBOARD';
    }
    if (src.kind === 'gamepad') {
      const pads = I.listGamepads();
      const p = pads.find(pp => pp.index === src.index);
      return 'GAMEPAD ' + (src.index + 1) + (p ? ' · ' + shortPad(p.id) : '');
    }
    return '';
  }

  function shortPad(id) {
    if (!id) return '';
    if (/xbox/i.test(id)) return 'XBOX';
    if (/dualshock|dualsense|wireless controller/i.test(id)) return 'PLAYSTATION';
    if (/8bitdo/i.test(id)) return '8BITDO';
    if (/pro controller|switch/i.test(id)) return 'SWITCH';
    return id.split(/[()]/)[0].trim().slice(0, 18).toUpperCase();
  }

  function startBindScan() {
    cancelBindScan();
    const boundSchemes = new Set();
    const boundGamepads = new Set();
    function scan() {
      bindScanRAF = requestAnimationFrame(scan);
      const nextIdx = bindRows.findIndex(r => !r.bound);
      if (nextIdx < 0) return;
      const input = I.anyInputPressed();
      if (!input) return;
      let source = null;
      if (input.kind === 'keyboard') {
        const scheme = I.schemeForCode(input.code);
        if (!scheme) return;
        if (boundSchemes.has(scheme)) return;
        source = { kind: 'keyboard', scheme };
        boundSchemes.add(scheme);
      } else if (input.kind === 'gamepad') {
        if (boundGamepads.has(input.index)) return;
        source = { kind: 'gamepad', index: input.index };
        boundGamepads.add(input.index);
      }
      if (!source) return;
      const row = bindRows[nextIdx];
      row.bound = true;
      row.source = source;
      I.bindSlot(row.info.slot, source);
      row.row.classList.remove('waiting');
      row.row.classList.add('bound');
      row.row.querySelector('.bind-status').textContent = describeSource(source);
      const next = bindRows[nextIdx + 1];
      if (next) next.row.classList.add('waiting');
      if (bindRows.every(r => r.bound)) {
        bindStart.classList.remove('hidden');
        cancelBindScan();
      }
    }
    scan();
  }
  function cancelBindScan() { if (bindScanRAF) { cancelAnimationFrame(bindScanRAF); bindScanRAF = null; } }

  function onStart() {
    hideAllOverlays();
    G.startGame(pendingConfig);
  }

  function onGameOver(state) {
    overlayGameOver.classList.remove('hidden');
    let title = 'GAME OVER';
    if (state.gameOverReason === 'last_standing' && state.winnerId != null) {
      title = `P${state.winnerId + 1} WINS!`;
    } else if (state.config.win === 'mostDotsWhenCleared' && state.winnerId != null) {
      title = `P${state.winnerId + 1} WINS!`;
    } else if (state.phase === 'level_clear') {
      title = 'VICTORY';
    }
    gameoverTitle.textContent = title;
    const rows = state.pacs.map((p, i) => {
      const color = p.color;
      return `<div style="color:${color};margin:0.25rem 0">PAC ${i + 1}: ${String(state.scores[p.id] || 0).padStart(6, '0')}</div>`;
    }).join('');
    gameoverScores.innerHTML = rows;
  }

  function updateGamepadList() {
    const pads = I.listGamepads();
    if (!pads.length) { gamepadListEl.textContent = 'No controllers'; return; }
    const names = pads.map(p => shortPad(p.id) || 'Pad').join(', ');
    gamepadListEl.textContent = pads.length + ' pad' + (pads.length > 1 ? 's' : '') + ' · ' + names;
  }

  function doPause() {
    if (!G.isRunning()) return;
    G.pauseGame();
    paused = true;
    overlayPause.classList.remove('hidden');
  }
  function doResume() {
    if (!paused) return;
    paused = false;
    overlayPause.classList.add('hidden');
    G.resumeGame();
  }

  function toggleMute() {
    Au.setMuted(!Au.isMuted());
    btnMute.innerHTML = Au.isMuted() ? '&#128263;' : '&#128266;';
    btnMute.title = Au.isMuted() ? 'Unmute (M)' : 'Mute (M)';
    try {
      localStorage.setItem('pacman.muted', Au.isMuted() ? '1' : '0');
    } catch (_) {}
  }

  // Restore mute preference
  try {
    const m = localStorage.getItem('pacman.muted');
    if (m === '1') { Au.setMuted(true); }
  } catch (_) {}

  // Wire buttons
  document.getElementById('options-back').addEventListener('click', showModeSelect);
  document.getElementById('options-next').addEventListener('click', showBind);
  document.getElementById('bind-back').addEventListener('click', () => {
    cancelBindScan();
    showModeSelect();
  });
  bindStart.addEventListener('click', onStart);
  document.getElementById('gameover-menu').addEventListener('click', showModeSelect);
  document.getElementById('gameover-again').addEventListener('click', () => {
    overlayGameOver.classList.add('hidden');
    G.startGame(pendingConfig);
  });
  document.getElementById('pause-menu').addEventListener('click', () => {
    overlayPause.classList.add('hidden');
    paused = false;
    showModeSelect();
  });
  document.getElementById('pause-resume').addEventListener('click', doResume);
  btnPause.addEventListener('click', () => {
    if (paused) doResume(); else doPause();
  });
  btnMute.addEventListener('click', toggleMute);

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') { toggleMute(); }
    if (e.code === 'KeyP') { if (paused) doResume(); else doPause(); }
    if (e.code === 'Escape' && paused) { doResume(); }
  });

  // Periodically refresh gamepad list
  setInterval(updateGamepadList, 1000);
  window.addEventListener('gamepadconnected', updateGamepadList);
  window.addEventListener('gamepaddisconnected', updateGamepadList);

  // Boot
  G.init({ canvas, onGameOver });
  updateGamepadList();
  showModeSelect();
})();
