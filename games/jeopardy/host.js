/* ═══════════════════════════════════════════════════════════════
   Jeopardy — host.js
   TV display surface (ADR-026). Pure renderer of Firebase state.
   Does NOT write game-flow state — that's control.js's job.
   The TV does still:
     - Create the room + claim token (anchor)
     - Host couch.js for controller binding (gamepads physically attach here)
     - Run the FJ 30s timer locally (display)
     - Reset host control via ?reset=1
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var J = window.Jeopardy;
  var Couch = window.JeopardyCouch;

  // ── State ────────────────────────────────────────────────────
  var hostId = null;
  var roomCode = null;
  var players = {};
  var boardData = null;        // cached for createRoom only (control writes the real board)
  var boardState = null;       // current round's categories from Firebase (for render)
  var currentClueData = null;
  var currentRound = 1;
  var pickingPlayerId = null;
  var config = null;

  // Listener refs (so we can detach on round change etc.)
  var playersRef = null;
  var clueListenerRef = null;
  var buzzListenerRef = null;
  var ddListenerRef = null;
  var fjListenerRef = null;
  var pickingListenerRef = null;
  var boardListenerRef = null;
  var statusListenerRef = null;
  var controlListenerRef = null;
  var roundListenerRef = null;

  // FJ timer (TV-local, canonical)
  var fjTimerId = null;

  // Buzz timer animation (TV-local, driven by openedAt server timestamp)
  var buzzTimerRafId = null;
  var buzzWindowMs = 5000;

  var els = {};
  var currentStatus = null; // tracked for centralized phase resolution

  function cacheDom() {
    els.roomCode = document.getElementById('room-code');
    els.playerQr = document.getElementById('player-qr');
    els.playerJoinUrl = document.getElementById('player-join-url');
    els.controlQr = document.getElementById('control-qr');
    els.hostClaimStatus = document.getElementById('host-claim-status');
    els.hostControlPanel = document.getElementById('host-control-panel');
    els.lobbySubtitle = document.getElementById('lobby-subtitle');
    els.playerCount = document.getElementById('player-count');
    els.playerList = document.getElementById('player-list');
    els.couchPanel = document.getElementById('couch-panel');
    els.addCouchBtn = document.getElementById('add-couch-btn');
    els.resetBanner = document.getElementById('reset-banner');
    els.resetConfirmBtn = document.getElementById('reset-confirm-btn');
    els.resetCancelBtn = document.getElementById('reset-cancel-btn');

    // Board
    els.board = document.getElementById('jeopardy-board');
    els.roundLabel = document.getElementById('round-label');
    els.pickingPlayer = document.getElementById('picking-player');
    els.scoreboardBar = document.getElementById('scoreboard-bar');

    // Clue overlay
    els.clueValueLabel = document.getElementById('clue-value-label');
    els.clueText = document.getElementById('clue-text');
    els.clueBuzzingStatus = document.getElementById('clue-buzzing-status');
    els.buzzTimerFill = document.getElementById('buzz-timer-fill');
    els.clueAnswering = document.getElementById('clue-answering');
    els.buzzedPlayer = document.getElementById('buzzed-player');
    els.clueRevealed = document.getElementById('clue-revealed');
    els.clueAnswerText = document.getElementById('clue-answer-text');

    // Daily Double
    els.ddPlayerName = document.getElementById('dd-player-name');
    els.ddWagerStatus = document.getElementById('dd-wager-status');
    els.ddWagerAmount = document.getElementById('dd-wager-amount');
    els.ddClueText = document.getElementById('dd-clue-text');
    els.ddRevealed = document.getElementById('dd-revealed');
    els.ddAnswerText = document.getElementById('dd-answer-text');

    // Round transition
    els.roundTransitionTitle = document.getElementById('round-transition-title');
    els.roundTransitionSubtitle = document.getElementById('round-transition-subtitle');

    // Final Jeopardy
    els.finalCategory = document.getElementById('final-category');
    els.finalWagerStatus = document.getElementById('final-wager-status');
    els.finalClueText = document.getElementById('final-clue-text');
    els.finalTimer = document.getElementById('final-timer');
    els.finalTimerFill = document.getElementById('final-timer-fill');
    els.finalPlayerReveal = document.getElementById('final-player-reveal');
    els.finalRevealName = document.getElementById('final-reveal-name');
    els.finalRevealAnswer = document.getElementById('final-reveal-answer');
    els.finalRevealWager = document.getElementById('final-reveal-wager');

    // Game over
    els.finalStandings = document.getElementById('final-standings');
  }

  function showPhase(id) {
    var phases = document.querySelectorAll('.phase');
    for (var i = 0; i < phases.length; i++) phases[i].classList.remove('active');
    var t = document.getElementById(id);
    if (t) t.classList.add('active');
  }

  // Single source of truth for which phase to show given status + clue state.
  // Both the status listener and the clue listener call this so transitions
  // stay consistent (status=LOBBY must beat any clue=null transition).
  function resolvePhase() {
    // PAUSED = brief host-offline marker; render as lobby (host has reconnected).
    if (currentStatus === J.STATUS.LOBBY || currentStatus === J.STATUS.PAUSED || currentStatus === null) {
      showPhase('phase-lobby');
      return;
    }
    if (currentStatus === J.STATUS.ENDED) { showPhase('phase-game-over'); return; }
    if (currentStatus === J.STATUS.FINAL) { showPhase('phase-final'); return; }
    if (currentStatus === J.STATUS.PLAYING) {
      if (currentClueData) {
        showPhase(currentClueData.dailyDouble ? 'phase-daily-double' : 'phase-clue');
      } else {
        showPhase('phase-board');
      }
    }
  }

  // ── Bootstrapping ──────────────────────────────────────────

  async function init() {
    cacheDom();

    var params = new URLSearchParams(window.location.search);
    var resetMode = params.get('reset') === '1';
    var existingRoom = (params.get('room') || '').toUpperCase() || null;

    // Auth
    try {
      var user = await J.signInAnonymously();
      hostId = user.uid;
    } catch (err) {
      console.error('Failed to auth:', err);
      return;
    }

    if (resetMode && existingRoom) {
      // Reset path: confirm + clear claim, regenerate token, return to lobby
      roomCode = existingRoom;
      els.resetBanner.classList.add('active');
      els.resetConfirmBtn.addEventListener('click', async function () {
        try {
          await J.resetControl(roomCode);
        } catch (err) {
          console.error('Reset failed:', err);
        }
        window.location.search = '?room=' + roomCode;
      });
      els.resetCancelBtn.addEventListener('click', function () {
        window.location.search = '?room=' + roomCode;
      });
      return;
    }

    // Create or rejoin a room
    if (existingRoom) {
      roomCode = existingRoom;
    } else {
      try {
        // Pre-fetch the sample board so createRoom can stamp something in.
        // Control will overwrite with the chosen board on Start Game.
        var res = await fetch('boards/sample.json');
        boardData = await res.json();
        roomCode = await J.createRoom(hostId, boardData, J.DEFAULT_CONFIG);
      } catch (err) {
        console.error('Failed to create room:', err);
        return;
      }
    }

    // Reflect URL so refreshes don't recreate rooms (and the reset link works)
    if (!existingRoom) {
      try { history.replaceState(null, '', '?room=' + roomCode); } catch (e) {}
    }

    // If we reconnected and status is still PAUSED (set by our prior onDisconnect),
    // restore an appropriate status. Use currentClue presence as the heuristic.
    try {
      var statusSnap = await J.ref('rooms/' + roomCode + '/meta/status').once('value');
      if (statusSnap.val() === J.STATUS.PAUSED) {
        var clueSnap = await J.ref('rooms/' + roomCode + '/game/currentClue').once('value');
        var newStatus = clueSnap.exists() ? J.STATUS.PLAYING : J.STATUS.LOBBY;
        await J.ref('rooms/' + roomCode + '/meta/status').set(newStatus);
      }
    } catch (e) { /* non-fatal */ }

    setupHostDisconnect();
    renderJoinSurface();
    listenForPlayers();
    listenForControl();
    listenForRoomStatus();
    listenForCurrentRound();
    listenForCurrentClue();
    listenForBuzzer();
    listenForDailyDouble();
    listenForFinalJeopardy();
    listenForPickingPlayer();
    listenForCouchPanel();

    // Couch (controller binding lives on the TV)
    if (Couch) {
      Couch.init({
        roomCode: roomCode,
        authUid: hostId,
        getCurrentClueState: function () { return currentClueData ? currentClueData.state : null; },
        getLockout: function () { return currentLockout(); },
        onPanelUpdate: renderCouchPanel
      });
    }
    if (els.addCouchBtn) els.addCouchBtn.addEventListener('click', onAddCouchClick);
  }

  function setupHostDisconnect() {
    J.ref('rooms/' + roomCode + '/meta/status')
      .onDisconnect().set(J.STATUS.PAUSED);
  }

  // ── Lobby surfaces (QRs, claim status) ─────────────────────

  function renderJoinSurface() {
    els.roomCode.textContent = roomCode;
    var origin = window.location.origin;
    var playerUrl = origin + '/games/jeopardy/play.html?room=' + roomCode;
    els.playerJoinUrl.textContent = playerUrl;
    els.playerQr.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(els.playerQr, {
        text: playerUrl,
        width: 150, height: 150,
        colorDark: '#0a0a0b', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  function renderControlQr(token) {
    if (!token) { els.controlQr.innerHTML = ''; return; }
    var origin = window.location.origin;
    var url = origin + '/games/jeopardy/control.html?room=' + roomCode + '&token=' + token;
    els.controlQr.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(els.controlQr, {
        text: url,
        width: 130, height: 130,
        colorDark: '#0a0a0b', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  function listenForControl() {
    controlListenerRef = J.ref('rooms/' + roomCode + '/meta/control');
    controlListenerRef.on('value', function (snap) {
      var c = snap.val() || {};
      if (c.claimedBy) {
        els.hostClaimStatus.textContent = 'Claimed';
        els.hostClaimStatus.classList.remove('unclaimed');
        els.hostControlPanel.classList.add('claimed');
        els.controlQr.innerHTML = ''; // hide QR after claim
        els.lobbySubtitle.textContent = 'Host has claimed control. Waiting for game to start...';
      } else {
        els.hostClaimStatus.textContent = 'Unclaimed';
        els.hostClaimStatus.classList.add('unclaimed');
        els.hostControlPanel.classList.remove('claimed');
        renderControlQr(c.claimToken);
        els.lobbySubtitle.textContent = 'Scan the host control QR with your phone to claim control.';
      }
    });
  }

  // ── Players ────────────────────────────────────────────────

  function listenForPlayers() {
    playersRef = J.ref('rooms/' + roomCode + '/players');
    playersRef.on('value', function (snap) {
      players = snap.val() || {};
      renderPlayerList();
      renderScoreboard();
    });
  }

  function renderPlayerList() {
    var ids = Object.keys(players);
    els.playerCount.textContent = ids.length + ' joined';
    if (ids.length === 0) {
      els.playerList.innerHTML = '<span class="player-list-empty">Waiting for players to join...</span>';
      return;
    }
    els.playerList.innerHTML = '';
    ids.forEach(function (id) {
      var p = players[id];
      var item = document.createElement('div');
      item.className = 'player-list-item';
      var dot = document.createElement('span');
      dot.className = 'player-dot';
      if (!p.connected) dot.style.background = 'var(--text-faint)';
      var nameSpan = document.createElement('span');
      nameSpan.textContent = p.name;
      if (!p.connected) nameSpan.style.opacity = '0.5';
      item.appendChild(dot);
      item.appendChild(nameSpan);
      els.playerList.appendChild(item);
    });
  }

  function renderScoreboard() {
    if (!els.scoreboardBar) return;
    els.scoreboardBar.innerHTML = '';
    Object.keys(players).forEach(function (id) {
      var p = players[id];
      var chip = document.createElement('div');
      chip.className = 'score-chip';
      if (id === pickingPlayerId) chip.classList.add('picker');
      if (currentClueData && currentClueData.state === J.CLUE_STATE.ANSWERING && id === currentBuzzerForRender) {
        chip.classList.add('buzzed-in');
      }
      var name = document.createElement('span');
      name.className = 'score-chip-name';
      name.textContent = p.name;
      var val = document.createElement('span');
      val.className = 'score-chip-value';
      var s = p.score || 0;
      if (s < 0) val.classList.add('negative');
      val.textContent = J.formatScore(s);
      chip.appendChild(name);
      chip.appendChild(val);
      els.scoreboardBar.appendChild(chip);
    });
  }

  // ── Room status (lobby/playing/final/ended) ────────────────

  function listenForRoomStatus() {
    statusListenerRef = J.ref('rooms/' + roomCode + '/meta/status');
    statusListenerRef.on('value', function (snap) {
      currentStatus = snap.val();
      if (currentStatus === J.STATUS.ENDED) renderStandings();
      resolvePhase();
    });
    J.ref('rooms/' + roomCode + '/meta/config').on('value', function (snap) {
      config = snap.val();
      if (config && config.buzzWindowMs) buzzWindowMs = config.buzzWindowMs;
    });
  }

  // ── Current round + board ──────────────────────────────────

  function listenForCurrentRound() {
    roundListenerRef = J.ref('rooms/' + roomCode + '/game/currentRound');
    roundListenerRef.on('value', function (snap) {
      currentRound = snap.val() || 1;
      els.roundLabel.textContent = currentRound === 1 ? 'Round 1' : 'Double Jeopardy';
      loadBoardForRender();
    });
  }

  function loadBoardForRender() {
    var roundKey = 'round' + currentRound;
    if (boardListenerRef) boardListenerRef.off();
    boardListenerRef = J.ref('rooms/' + roomCode + '/board/' + roundKey);
    boardListenerRef.on('value', function (snap) {
      boardState = snap.val();
      if (boardState) renderBoard();
    });
  }

  function renderBoard() {
    if (!boardState) return;
    els.board.innerHTML = '';
    var cats = boardState.categories;
    for (var c = 0; c < cats.length; c++) {
      var h = document.createElement('div');
      h.className = 'category-header';
      h.textContent = cats[c].name;
      els.board.appendChild(h);
    }
    for (var r = 0; r < J.CLUES_PER_CATEGORY; r++) {
      for (var c2 = 0; c2 < J.CATEGORIES_PER_ROUND; c2++) {
        var clue = cats[c2].clues[r];
        var cell = document.createElement('div');
        cell.className = 'board-cell';
        cell.setAttribute('role', 'gridcell');
        if (clue.asked) cell.classList.add('asked');
        else cell.textContent = '$' + clue.value;
        els.board.appendChild(cell);
      }
    }
  }

  // ── Picking player ─────────────────────────────────────────

  function listenForPickingPlayer() {
    pickingListenerRef = J.ref('rooms/' + roomCode + '/game/pickingPlayer');
    pickingListenerRef.on('value', function (snap) {
      pickingPlayerId = snap.val();
      if (pickingPlayerId && players[pickingPlayerId]) {
        els.pickingPlayer.textContent = players[pickingPlayerId].name;
      }
      renderScoreboard();
    });
  }

  // ── Current clue overlay (driven by Firebase state) ────────

  var currentBuzzerForRender = null;
  function currentLockout() {
    // Reflect server-side lockedOut so couch.js doesn't re-buzz lockedout pads.
    return _lockedOut;
  }
  var _lockedOut = {};

  function listenForCurrentClue() {
    clueListenerRef = J.ref('rooms/' + roomCode + '/game/currentClue');
    clueListenerRef.on('value', function (snap) {
      var clue = snap.val();
      currentClueData = clue;
      if (!clue) {
        if (Couch) Couch.resetForNewClue();
        currentBuzzerForRender = null;
        resolvePhase();
        return;
      }
      // Pre-render overlay contents; resolvePhase activates the section.
      if (clue.dailyDouble) renderDailyDoubleOverlay(clue);
      else renderClueOverlay(clue);
      resolvePhase();
    });
  }

  function renderClueOverlay(clue) {
    els.clueValueLabel.textContent = '$' + clue.value;
    els.clueText.textContent = clue.text;
    var state = clue.state;
    els.clueBuzzingStatus.style.display = state === J.CLUE_STATE.BUZZING ? '' : 'none';
    els.clueAnswering.style.display = state === J.CLUE_STATE.ANSWERING ? '' : 'none';
    els.clueRevealed.style.display = state === J.CLUE_STATE.REVEALED ? '' : 'none';
    if (state === J.CLUE_STATE.REVEALED) {
      els.clueAnswerText.textContent = clue.answer; // public reveal — judging done
    }
  }

  function renderDailyDoubleOverlay(clue) {
    els.ddPlayerName.textContent = (players[pickingPlayerId] && players[pickingPlayerId].name) || '...';
    var state = clue.state;
    if (state === J.CLUE_STATE.READING || state === undefined) {
      els.ddWagerStatus.textContent = 'Waiting for wager...';
      els.ddWagerStatus.style.display = '';
      els.ddWagerAmount.style.display = 'none';
      els.ddClueText.style.display = 'none';
      els.ddRevealed.style.display = 'none';
    } else if (state === J.CLUE_STATE.ANSWERING) {
      els.ddClueText.textContent = clue.text;
      els.ddClueText.style.display = '';
      els.ddRevealed.style.display = 'none';
    } else if (state === J.CLUE_STATE.REVEALED) {
      els.ddAnswerText.textContent = clue.answer;
      els.ddRevealed.style.display = '';
    }
  }

  // ── Buzzer (TV animates timer from openedAt) ───────────────

  function listenForBuzzer() {
    buzzListenerRef = J.ref('rooms/' + roomCode + '/game/buzzer');
    buzzListenerRef.on('value', function (snap) {
      var b = snap.val();
      if (!b || !b.isOpen) {
        stopBuzzTimerAnim();
        _lockedOut = {};
        currentBuzzerForRender = null;
        renderScoreboard(); // clear the lectern-light highlight
        return;
      }
      _lockedOut = b.lockedOut || {};
      // Determine the earliest non-locked-out buzz for visual lectern light
      if (b.buzzedPlayers) {
        var earliest = null, earliestTime = Infinity;
        Object.keys(b.buzzedPlayers).forEach(function (pid) {
          if (_lockedOut[pid]) return;
          if (b.buzzedPlayers[pid] < earliestTime) {
            earliestTime = b.buzzedPlayers[pid];
            earliest = pid;
          }
        });
        currentBuzzerForRender = earliest;
        if (earliest) {
          els.buzzedPlayer.textContent = (players[earliest] && players[earliest].name) || earliest;
          renderScoreboard(); // glow the buzzed-in chip
        }
      }
      // Animate timer if openedAt available
      if (b.openedAt && typeof b.openedAt === 'number') {
        startBuzzTimerAnim(b.openedAt, buzzWindowMs);
      }
    });
  }

  function startBuzzTimerAnim(openedAt, durationMs) {
    stopBuzzTimerAnim();
    var clientStart = Date.now();
    function step() {
      var elapsed = Date.now() - clientStart;
      var remaining = Math.max(0, durationMs - elapsed);
      els.buzzTimerFill.style.width = (remaining / durationMs * 100) + '%';
      if (remaining > 0) buzzTimerRafId = requestAnimationFrame(step);
    }
    els.buzzTimerFill.style.transition = 'none';
    els.buzzTimerFill.style.width = '100%';
    els.buzzTimerFill.offsetWidth;
    buzzTimerRafId = requestAnimationFrame(step);
  }

  function stopBuzzTimerAnim() {
    if (buzzTimerRafId) { cancelAnimationFrame(buzzTimerRafId); buzzTimerRafId = null; }
  }

  // ── Daily Double wager mirror ──────────────────────────────

  function listenForDailyDouble() {
    ddListenerRef = J.ref('rooms/' + roomCode + '/game/dailyDouble');
    ddListenerRef.on('value', function (snap) {
      var d = snap.val();
      if (d && typeof d.wager === 'number') {
        els.ddWagerStatus.textContent = 'Wagered:';
        els.ddWagerAmount.textContent = '$' + d.wager.toLocaleString();
        els.ddWagerAmount.style.display = '';
      }
    });
  }

  // ── Final Jeopardy mirror (TV runs canonical 30s timer) ────

  function listenForFinalJeopardy() {
    fjListenerRef = J.ref('rooms/' + roomCode + '/game/finalJeopardy');
    fjListenerRef.on('value', function (snap) {
      var fj = snap.val();
      if (!fj) {
        if (fjTimerId) { clearInterval(fjTimerId); fjTimerId = null; }
        return;
      }
      handleFinalState(fj);
    });
    J.ref('rooms/' + roomCode + '/board/final').on('value', function (snap) {
      var f = snap.val();
      if (!f) return;
      els.finalCategory.textContent = f.category;
      // Don't display clue/answer until states change
    });
  }

  function handleFinalState(fj) {
    var state = fj.state;
    if (state === J.FINAL_STATE.CATEGORY || state === J.FINAL_STATE.WAGER) {
      els.finalClueText.style.display = 'none';
      els.finalTimer.style.display = 'none';
      els.finalPlayerReveal.style.display = 'none';
      renderFinalWagerStatus(fj);
    } else if (state === J.FINAL_STATE.CLUE) {
      // Reveal clue + start canonical 30s timer
      J.ref('rooms/' + roomCode + '/board/final').once('value', function (snap) {
        var f = snap.val();
        if (f) {
          els.finalClueText.textContent = f.clue;
          els.finalClueText.style.display = '';
        }
      });
      startFinalTimer();
      renderFinalWagerStatus(fj);
    } else if (state === J.FINAL_STATE.ANSWER) {
      if (fjTimerId) { clearInterval(fjTimerId); fjTimerId = null; }
      els.finalTimer.style.display = 'none';
    } else if (state === J.FINAL_STATE.JUDGING) {
      if (fjTimerId) { clearInterval(fjTimerId); fjTimerId = null; }
      els.finalTimer.style.display = 'none';
      // Mirror per-player reveal — but the canonical info comes from
      // control.js writing one at a time isn't a thing today; control.js
      // shows judging UI privately. The TV stays on category + answers
      // count until the host reveals each. Future polish: write the
      // currently-judged pid to Firebase so the TV can reveal in sync.
    }
  }

  function renderFinalWagerStatus(fj) {
    if (!els.finalWagerStatus) return;
    els.finalWagerStatus.innerHTML = '';
    var wagers = (fj && fj.wagers) || {};
    Object.keys(players).forEach(function (id) {
      var p = players[id];
      var chip = document.createElement('span');
      chip.className = 'final-wager-chip';
      if (wagers[id] !== undefined) {
        chip.classList.add('submitted');
        chip.innerHTML = '<span class="check">✓</span> ' + p.name;
      } else {
        chip.textContent = p.name;
      }
      els.finalWagerStatus.appendChild(chip);
    });
  }

  function startFinalTimer() {
    if (fjTimerId) clearInterval(fjTimerId);
    var durationMs = 30000;
    var startTime = Date.now();
    els.finalTimer.style.display = '';
    els.finalTimerFill.style.transition = 'none';
    els.finalTimerFill.style.width = '100%';
    els.finalTimerFill.offsetWidth;
    els.finalTimerFill.style.transition = 'width 0.1s linear';
    fjTimerId = setInterval(function () {
      var elapsed = Date.now() - startTime;
      var remaining = Math.max(0, durationMs - elapsed);
      els.finalTimerFill.style.width = (remaining / durationMs * 100) + '%';
      if (remaining <= 0) {
        clearInterval(fjTimerId); fjTimerId = null;
        // Note: control.js owns moving state to ANSWER; the TV just stops the bar.
      }
    }, 50);
  }

  // ── Game-over standings ────────────────────────────────────

  function renderStandings() {
    if (!els.finalStandings) return;
    var ids = Object.keys(players);
    ids.sort(function (a, b) {
      return ((players[b] && players[b].score) || 0) - ((players[a] && players[a].score) || 0);
    });
    els.finalStandings.innerHTML = '';
    ids.forEach(function (id, i) {
      var p = players[id];
      var row = document.createElement('div');
      row.className = 'standing-row';
      if (i === 0) row.classList.add('winner');
      var rank = document.createElement('span');
      rank.className = 'standing-rank';
      rank.textContent = '#' + (i + 1);
      var name = document.createElement('span');
      name.className = 'standing-name';
      name.textContent = p.name;
      var score = document.createElement('span');
      var s = p.score || 0;
      score.className = 'standing-score' + (s < 0 ? ' negative' : '');
      score.textContent = J.formatScore(s);
      row.appendChild(rank);
      row.appendChild(name);
      row.appendChild(score);
      els.finalStandings.appendChild(row);
    });
  }

  // ── Couch panel ────────────────────────────────────────────

  function listenForCouchPanel() {
    // The couch panel state comes from couch.js's onPanelUpdate callback.
    // No extra listener here.
  }

  function renderCouchPanel(s) {
    if (!els.couchPanel) return;
    var rows = [];
    Object.keys(s.assignments).forEach(function (idxKey) {
      var rec = s.assignments[idxKey];
      var p = players[rec.synthId] || {};
      rows.push({
        kind: 'active', synthId: rec.synthId, name: rec.name,
        idx: idxKey, score: p.score || 0
      });
    });
    Object.keys(s.orphans).forEach(function (sid) {
      rows.push({ kind: 'orphan', synthId: sid, name: s.orphans[sid].name });
    });

    if (rows.length === 0) {
      els.couchPanel.innerHTML = '<span class="couch-empty">No couch players yet</span>';
    } else {
      els.couchPanel.innerHTML = '';
      rows.forEach(function (r) {
        var row = document.createElement('div');
        row.className = 'couch-row' + (r.kind === 'orphan' ? ' disconnected' : '');
        var nameEl = document.createElement('span');
        nameEl.className = 'couch-name';
        nameEl.textContent = r.name;
        row.appendChild(nameEl);
        var meta = document.createElement('span');
        meta.className = 'couch-meta';
        meta.textContent = r.kind === 'orphan'
          ? 'disconnected'
          : 'pad ' + r.idx + (typeof r.score === 'number' ? ' · ' + J.formatScore(r.score) : '');
        row.appendChild(meta);
        if (r.kind === 'orphan') {
          var btn = document.createElement('button');
          btn.className = 'couch-reclaim';
          btn.textContent = 'Re-claim';
          btn.addEventListener('click', function () { onReclaimOrphan(r.synthId); });
          row.appendChild(btn);
        }
        els.couchPanel.appendChild(row);
      });
    }

    if (s.pendingBind) {
      els.addCouchBtn.classList.add('pending');
      els.addCouchBtn.textContent = 'Press A on a controller for ' + s.pendingBind.name + '...';
    } else {
      els.addCouchBtn.classList.remove('pending');
      els.addCouchBtn.textContent = '+ Add couch player';
    }
  }

  function onAddCouchClick() {
    var name = (window.prompt('Couch player name?') || '').trim();
    if (!name) return;
    Couch.startBindFlow(name);
  }

  function onReclaimOrphan(synthId) {
    var pads = window.SharedGamepad.listGamepads();
    for (var i = 0; i < pads.length; i++) {
      Couch.reclaimOrphan(synthId, pads[i].index);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
