/* ═══════════════════════════════════════════════════════════════
   Jeopardy — host.js
   Host game logic: lobby, board rendering, clue flow, judging.
   Depends on shared.js (window.Jeopardy).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var J = window.Jeopardy;

  // ── State ───────────────────────────────────────────────────
  var hostId = null;
  var roomCode = null;
  var players = {};       // { playerId: { name, score, connected, joinedAt } }
  var boardData = null;   // Raw board JSON (selected board)
  var boards = {};        // { key: boardJSON } — available boards
  var playersRef = null;  // Firebase ref for cleanup
  var currentRound = 1;
  var boardState = null;       // Current round's category/clue data from Firebase
  var currentClueData = null;  // Active clue being displayed
  var config = null;            // Cached room config
  var buzzTimerId = null;       // Interval ID for buzz countdown
  var buzzStartTime = null;     // When buzz timer started (local time)
  var buzzRemainingMs = 0;      // Remaining buzz time in ms
  var lockedOutPlayers = {};    // Players locked out for current clue
  var buzzListenerRef = null;   // Firebase ref for buzz listener cleanup
  var currentBuzzer = null;     // Player ID currently being judged

  // ── DOM Elements ────────────────────────────────────────────
  var els = {};

  function cacheDom() {
    els.roomCode = document.getElementById('room-code');
    els.qrCode = document.getElementById('qr-code');
    els.joinUrl = document.getElementById('join-url');
    els.boardSelector = document.getElementById('board-selector');
    els.ruleDoubleJeopardy = document.getElementById('rule-double-jeopardy');
    els.ruleDailyDoubles = document.getElementById('rule-daily-doubles');
    els.ruleFinalJeopardy = document.getElementById('rule-final-jeopardy');
    els.ruleBuzzWindow = document.getElementById('rule-buzz-window');
    els.playerCount = document.getElementById('player-count');
    els.playerList = document.getElementById('player-list');
    els.startGameBtn = document.getElementById('start-game-btn');
    // Board phase
    els.board = document.getElementById('jeopardy-board');
    els.roundLabel = document.getElementById('round-label');
    els.pickingPlayer = document.getElementById('picking-player');
    els.scoreboardBar = document.getElementById('scoreboard-bar');
    // Clue overlay
    els.clueValueLabel = document.getElementById('clue-value-label');
    els.clueText = document.getElementById('clue-text');
    els.openBuzzingBtn = document.getElementById('open-buzzing-btn');
    els.clueReadingControls = document.getElementById('clue-reading-controls');
    els.clueBuzzingStatus = document.getElementById('clue-buzzing-status');
    els.clueAnswering = document.getElementById('clue-answering');
    els.clueRevealed = document.getElementById('clue-revealed');
    els.clueAnswerText = document.getElementById('clue-answer-text');
    els.returnBoardBtn = document.getElementById('return-board-btn');
    // Buzzing + judging
    els.buzzTimerFill = document.getElementById('buzz-timer-fill');
    els.buzzedPlayer = document.getElementById('buzzed-player');
    els.judgeCorrectBtn = document.getElementById('judge-correct-btn');
    els.judgeIncorrectBtn = document.getElementById('judge-incorrect-btn');
  }

  // ── Phase Management ────────────────────────────────────────

  function showPhase(phaseId) {
    var phases = document.querySelectorAll('.phase');
    for (var i = 0; i < phases.length; i++) {
      phases[i].classList.remove('active');
    }
    var target = document.getElementById(phaseId);
    if (target) target.classList.add('active');
  }

  // ── Config ──────────────────────────────────────────────────

  function readConfig() {
    return {
      enableDoubleJeopardy: els.ruleDoubleJeopardy.checked,
      enableDailyDoubles: els.ruleDailyDoubles.checked,
      enableFinalJeopardy: els.ruleFinalJeopardy.checked,
      buzzWindowMs: parseInt(els.ruleBuzzWindow.value, 10)
    };
  }

  // ── Board Loading ───────────────────────────────────────────

  function loadBoards() {
    // Load shipped sample board
    fetch('boards/sample.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        boards['sample'] = data;
        boardData = data;
        loadLocalStorageBoards();
        populateBoardSelector();
      })
      .catch(function (err) {
        console.error('Failed to load sample board:', err);
        loadLocalStorageBoards();
        populateBoardSelector();
      });
  }

  function loadLocalStorageBoards() {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.startsWith('jeopardy-board-')) {
        try {
          var data = JSON.parse(localStorage.getItem(key));
          var result = J.validateBoard(data);
          if (result.valid) {
            boards[key] = data;
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
    }
  }

  function populateBoardSelector() {
    els.boardSelector.innerHTML = '';
    Object.keys(boards).forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key;
      var board = boards[key];
      var label = board.title || key;
      if (board.author) label += ' by ' + board.author;
      if (key === 'sample') label += ' (Sample)';
      opt.textContent = label;
      els.boardSelector.appendChild(opt);
    });

    // Select first board by default
    if (els.boardSelector.options.length > 0) {
      els.boardSelector.selectedIndex = 0;
      boardData = boards[els.boardSelector.value];
    }
  }

  function onBoardChange() {
    var key = els.boardSelector.value;
    if (boards[key]) {
      boardData = boards[key];
    }
  }

  // ── Room Creation ───────────────────────────────────────────

  async function createAndJoinRoom() {
    try {
      var config = readConfig();
      roomCode = await J.createRoom(hostId, boardData, config);
      displayRoomCode();
      renderQrCode();
      listenForPlayers();
      setupHostDisconnect();
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  }

  function displayRoomCode() {
    els.roomCode.textContent = roomCode;
    var joinUrl = window.location.origin + '/games/jeopardy/play.html?room=' + roomCode;
    els.joinUrl.textContent = joinUrl;
  }

  function renderQrCode() {
    els.qrCode.innerHTML = '';
    var joinUrl = window.location.origin + '/games/jeopardy/play.html?room=' + roomCode;
    if (typeof QRCode !== 'undefined') {
      new QRCode(els.qrCode, {
        text: joinUrl,
        width: 150,
        height: 150,
        colorDark: '#0a0a0b',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  function setupHostDisconnect() {
    J.ref('rooms/' + roomCode + '/meta/status')
      .onDisconnect().set(J.STATUS.PAUSED);
  }

  // ── Player List ─────────────────────────────────────────────

  function listenForPlayers() {
    playersRef = J.ref('rooms/' + roomCode + '/players');

    playersRef.on('value', function (snap) {
      players = snap.val() || {};
      renderPlayerList();
      updateStartButton();
      renderScoreboard();
    });
  }

  function renderPlayerList() {
    var ids = Object.keys(players);
    var count = ids.length;

    els.playerCount.textContent = count + ' joined';

    if (count === 0) {
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
      if (!p.connected) {
        dot.style.background = 'var(--text-faint)';
      }

      var nameSpan = document.createElement('span');
      nameSpan.textContent = p.name;
      if (!p.connected) {
        nameSpan.style.opacity = '0.5';
      }

      item.appendChild(dot);
      item.appendChild(nameSpan);
      els.playerList.appendChild(item);
    });
  }

  function updateStartButton() {
    var count = Object.keys(players).length;
    els.startGameBtn.disabled = count < 1;
  }

  // ── Daily Double Placement ──────────────────────────────────

  function placeDailyDoubles(roundKey, numDoubles) {
    if (numDoubles <= 0) return Promise.resolve();

    // Pick random clue positions (categoryIndex, clueIndex)
    var positions = [];
    for (var c = 0; c < J.CATEGORIES_PER_ROUND; c++) {
      for (var r = 0; r < J.CLUES_PER_CATEGORY; r++) {
        // Avoid top row (cheapest clues) — matches real Jeopardy tendency
        if (r > 0) positions.push({ cat: c, clue: r });
      }
    }

    // Shuffle and pick
    shuffle(positions);
    var selected = positions.slice(0, numDoubles);

    var updates = {};
    selected.forEach(function (pos) {
      updates['rooms/' + roomCode + '/board/' + roundKey + '/categories/' + pos.cat + '/clues/' + pos.clue + '/dailyDouble'] = true;
    });

    return J.ref().update(updates);
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }

  // ── Start Game ──────────────────────────────────────────────

  async function startGame() {
    var playerIds = Object.keys(players);
    if (playerIds.length < 1) return;

    els.startGameBtn.disabled = true;
    els.startGameBtn.textContent = 'Starting...';

    try {
      config = readConfig();

      // Place Daily Doubles if enabled
      if (config.enableDailyDoubles) {
        await placeDailyDoubles('round1', 1);
        if (config.enableDoubleJeopardy) {
          await placeDailyDoubles('round2', 2);
        }
      }

      // Pick a random player to go first
      var firstPicker = playerIds[Math.floor(Math.random() * playerIds.length)];

      // Update game state in Firebase
      await J.ref('rooms/' + roomCode).update({
        'meta/status': J.STATUS.PLAYING,
        'game/pickingPlayer': firstPicker,
        'game/currentRound': 1,
        'game/currentClue': null
      });

      // Transition to board phase
      enterBoardPhase();
    } catch (err) {
      console.error('Failed to start game:', err);
      els.startGameBtn.disabled = false;
      els.startGameBtn.textContent = 'Start Game';
    }
  }

  // ── Board Phase ────────────────────────────────────────────

  function enterBoardPhase() {
    currentRound = 1;
    listenForPickingPlayer();
    loadRoundBoard(currentRound);
  }

  function loadRoundBoard(roundNum) {
    var roundKey = 'round' + roundNum;
    J.ref('rooms/' + roomCode + '/board/' + roundKey).once('value', function (snap) {
      boardState = snap.val();
      if (boardState) {
        els.roundLabel.textContent = roundNum === 1 ? 'Round 1' : 'Double Jeopardy';
        renderBoard();
        renderScoreboard();
        showPhase('phase-board');
      }
    });
  }

  // ── Board Rendering ───────────────────────────────────────

  function renderBoard() {
    els.board.innerHTML = '';
    var cats = boardState.categories;

    // Category headers (row 1)
    for (var c = 0; c < cats.length; c++) {
      var header = document.createElement('div');
      header.className = 'category-header';
      header.textContent = cats[c].name;
      els.board.appendChild(header);
    }

    // Clue cells: 5 rows × 6 columns
    for (var row = 0; row < J.CLUES_PER_CATEGORY; row++) {
      for (var col = 0; col < J.CATEGORIES_PER_ROUND; col++) {
        var clue = cats[col].clues[row];
        var cell = document.createElement('div');
        cell.className = 'board-cell';
        cell.setAttribute('role', 'gridcell');

        if (clue.asked) {
          cell.classList.add('asked');
        } else {
          cell.textContent = '$' + clue.value;
          cell.dataset.cat = col;
          cell.dataset.clue = row;
          cell.addEventListener('click', onCellClick);
        }

        els.board.appendChild(cell);
      }
    }
  }

  function onCellClick(e) {
    var cell = e.currentTarget;
    var catIndex = parseInt(cell.dataset.cat, 10);
    var clueIndex = parseInt(cell.dataset.clue, 10);
    var clue = boardState.categories[catIndex].clues[clueIndex];

    // Build clue data for Firebase
    currentClueData = {
      categoryIndex: catIndex,
      clueIndex: clueIndex,
      state: J.CLUE_STATE.READING,
      text: clue.clue,
      answer: clue.answer,
      value: clue.value
    };

    // Write to Firebase: set currentClue + mark asked
    var roundKey = 'round' + currentRound;
    var updates = {};
    updates['game/currentClue'] = currentClueData;
    updates['board/' + roundKey + '/categories/' + catIndex + '/clues/' + clueIndex + '/asked'] = true;
    J.ref('rooms/' + roomCode).update(updates);

    // Update local state + dim the cell immediately
    boardState.categories[catIndex].clues[clueIndex].asked = true;
    cell.classList.add('asked');
    cell.textContent = '';
    cell.style.pointerEvents = 'none';

    // Show clue overlay
    showClueOverlay();
  }

  // ── Clue Overlay ──────────────────────────────────────────

  function showClueOverlay() {
    els.clueValueLabel.textContent = '$' + currentClueData.value;
    els.clueText.textContent = currentClueData.text;

    // Show reading controls, hide other states
    els.clueReadingControls.style.display = '';
    els.clueBuzzingStatus.style.display = 'none';
    els.clueAnswering.style.display = 'none';
    els.clueRevealed.style.display = 'none';

    showPhase('phase-clue');
  }

  function onOpenBuzzing() {
    // Reset buzzer state
    currentBuzzer = null;
    lockedOutPlayers = {};

    // Write buzzer + clue state to Firebase
    J.ref('rooms/' + roomCode).update({
      'game/currentClue/state': J.CLUE_STATE.BUZZING,
      'game/buzzer': {
        isOpen: true,
        openedAt: J.serverTimestamp()
      }
    });

    // Update local state
    currentClueData.state = J.CLUE_STATE.BUZZING;

    // Update UI
    els.clueReadingControls.style.display = 'none';
    els.clueBuzzingStatus.style.display = '';
    els.clueAnswering.style.display = 'none';
    els.clueRevealed.style.display = 'none';

    // Start timer + listen for buzzes
    startBuzzTimer(config.buzzWindowMs || 5000);
    listenForBuzzes();
  }

  function returnToBoard() {
    cleanupBuzzer();
    J.ref('rooms/' + roomCode + '/game/currentClue').set(null);
    currentClueData = null;
    renderScoreboard();
    showPhase('phase-board');
  }

  // ── Buzzing + Judging ─────────────────────────────────────

  function startBuzzTimer(durationMs) {
    var totalMs = config.buzzWindowMs || 5000;
    buzzStartTime = Date.now();
    buzzRemainingMs = durationMs;

    // Reset timer bar
    els.buzzTimerFill.style.transition = 'none';
    els.buzzTimerFill.style.width = (durationMs / totalMs * 100) + '%';
    els.buzzTimerFill.offsetWidth; // force reflow
    els.buzzTimerFill.style.transition = 'width 0.1s linear';

    buzzTimerId = setInterval(function () {
      var elapsed = Date.now() - buzzStartTime;
      var remaining = Math.max(0, durationMs - elapsed);
      els.buzzTimerFill.style.width = (remaining / totalMs * 100) + '%';
      if (remaining <= 0) {
        clearInterval(buzzTimerId);
        buzzTimerId = null;
        onBuzzTimeout();
      }
    }, 50);
  }

  function stopBuzzTimer() {
    if (buzzTimerId) {
      clearInterval(buzzTimerId);
      buzzTimerId = null;
    }
    var elapsed = Date.now() - buzzStartTime;
    buzzRemainingMs = Math.max(0, buzzRemainingMs - elapsed);
  }

  function listenForBuzzes() {
    buzzListenerRef = J.ref('rooms/' + roomCode + '/game/buzzer/buzzedPlayers');
    buzzListenerRef.on('value', function (snap) {
      processBuzzes(snap.val());
    });
  }

  function processBuzzes(buzzes) {
    if (currentBuzzer) return;
    if (!buzzes) return;

    // Find earliest non-locked-out buzz by server timestamp
    var earliest = null;
    var earliestTime = Infinity;
    Object.keys(buzzes).forEach(function (pid) {
      if (lockedOutPlayers[pid]) return;
      if (buzzes[pid] < earliestTime) {
        earliestTime = buzzes[pid];
        earliest = pid;
      }
    });

    if (earliest) {
      currentBuzzer = earliest;
      showAnsweringUI(earliest);
    }
  }

  function showAnsweringUI(playerId) {
    stopBuzzTimer();

    // Update Firebase state
    J.ref('rooms/' + roomCode + '/game/currentClue/state').set(J.CLUE_STATE.ANSWERING);

    // Update UI
    els.buzzedPlayer.textContent = players[playerId] ? players[playerId].name : playerId;
    els.clueBuzzingStatus.style.display = 'none';
    els.clueAnswering.style.display = '';
  }

  function onJudgeCorrect() {
    var pid = currentBuzzer;
    if (!pid) return;

    updatePlayerScore(pid, currentClueData.value);
    J.ref('rooms/' + roomCode + '/game/pickingPlayer').set(pid);

    cleanupBuzzer();
    revealAnswer();
  }

  function onJudgeIncorrect() {
    var pid = currentBuzzer;
    if (!pid) return;

    updatePlayerScore(pid, -currentClueData.value);

    // Lock out player
    lockedOutPlayers[pid] = true;
    J.ref('rooms/' + roomCode + '/game/buzzer/lockedOut/' + pid).set(true);

    currentBuzzer = null;

    // Check if all connected players are locked out
    var allLocked = Object.keys(players).every(function (id) {
      return !players[id].connected || lockedOutPlayers[id];
    });

    if (allLocked) {
      cleanupBuzzer();
      revealAnswer();
    } else {
      reopenBuzzing();
    }
  }

  function reopenBuzzing() {
    // Write state back to Firebase so players detect buzzing reopened
    J.ref('rooms/' + roomCode + '/game/currentClue/state').set(J.CLUE_STATE.BUZZING);

    // Show buzzing UI, resume timer
    els.clueBuzzingStatus.style.display = '';
    els.clueAnswering.style.display = 'none';

    if (buzzRemainingMs > 0) {
      startBuzzTimer(buzzRemainingMs);
    } else {
      onBuzzTimeout();
      return;
    }

    // Check for pending buzzes from other players
    J.ref('rooms/' + roomCode + '/game/buzzer/buzzedPlayers').once('value', function (snap) {
      processBuzzes(snap.val());
    });
  }

  function onBuzzTimeout() {
    cleanupBuzzer();
    revealAnswer();
  }

  function revealAnswer() {
    J.ref('rooms/' + roomCode + '/game/currentClue/state').set(J.CLUE_STATE.REVEALED);

    els.clueAnswerText.textContent = currentClueData.answer;
    els.clueReadingControls.style.display = 'none';
    els.clueBuzzingStatus.style.display = 'none';
    els.clueAnswering.style.display = 'none';
    els.clueRevealed.style.display = '';
  }

  function cleanupBuzzer() {
    if (buzzTimerId) {
      clearInterval(buzzTimerId);
      buzzTimerId = null;
    }
    if (buzzListenerRef) {
      buzzListenerRef.off();
      buzzListenerRef = null;
    }
    J.ref('rooms/' + roomCode + '/game/buzzer').set(null);
    currentBuzzer = null;
    buzzStartTime = null;
    buzzRemainingMs = 0;
    lockedOutPlayers = {};
  }

  function updatePlayerScore(playerId, delta) {
    var current = (players[playerId] && players[playerId].score) || 0;
    J.ref('rooms/' + roomCode + '/players/' + playerId + '/score').set(current + delta);
  }

  // ── Scoreboard ────────────────────────────────────────────

  function formatScore(score) {
    score = score || 0;
    if (score < 0) return '-$' + Math.abs(score);
    return '$' + score;
  }

  function renderScoreboard() {
    els.scoreboardBar.innerHTML = '';
    var ids = Object.keys(players);

    for (var i = 0; i < ids.length; i++) {
      var p = players[ids[i]];
      var chip = document.createElement('div');
      chip.className = 'score-chip';

      var nameSpan = document.createElement('span');
      nameSpan.className = 'score-chip-name';
      nameSpan.textContent = p.name;

      var valueSpan = document.createElement('span');
      valueSpan.className = 'score-chip-value';
      var score = p.score || 0;
      if (score < 0) valueSpan.classList.add('negative');
      valueSpan.textContent = formatScore(score);

      chip.appendChild(nameSpan);
      chip.appendChild(valueSpan);
      els.scoreboardBar.appendChild(chip);
    }
  }

  // ── Game State Listeners ──────────────────────────────────

  function listenForPickingPlayer() {
    J.ref('rooms/' + roomCode + '/game/pickingPlayer').on('value', function (snap) {
      var playerId = snap.val();
      if (playerId && players[playerId]) {
        els.pickingPlayer.textContent = players[playerId].name;
      }
    });
  }

  // ── Initialize ──────────────────────────────────────────────

  async function init() {
    cacheDom();
    loadBoards();

    // Wire up events
    els.boardSelector.addEventListener('change', onBoardChange);
    els.startGameBtn.addEventListener('click', startGame);
    els.openBuzzingBtn.addEventListener('click', onOpenBuzzing);
    els.returnBoardBtn.addEventListener('click', returnToBoard);
    els.judgeCorrectBtn.addEventListener('click', onJudgeCorrect);
    els.judgeIncorrectBtn.addEventListener('click', onJudgeIncorrect);

    // Firebase auth + room creation
    try {
      var user = await J.signInAnonymously();
      hostId = user.uid;
      await createAndJoinRoom();
    } catch (err) {
      console.error('Failed to initialize host:', err);
    }
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
