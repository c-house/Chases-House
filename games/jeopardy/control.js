/* ═══════════════════════════════════════════════════════════════
   Jeopardy — control.js
   Host phone control surface (ADR-026). Owns game-flow writes:
   cell pick, judging, DD/FJ wagers for couch players, round
   transitions, play-again. Extracted from host.js so the TV view
   becomes a pure renderer.
   Depends on shared.js (window.Jeopardy) and shared/firebase.js.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var J = window.Jeopardy;

  // ── State ───────────────────────────────────────────────────
  var myUid = null;
  var roomCode = null;
  var providedToken = null;
  var players = {};
  var boardData = null;          // selected board JSON (full content)
  var boards = {};               // available boards keyed by id
  var config = null;
  var boardState = null;         // current round's category data from Firebase
  var currentClueData = null;
  var currentRound = 1;
  var pickingPlayerId = null;

  var buzzTimerId = null;
  var buzzStartTime = null;
  var buzzRemainingMs = 0;
  var lockedOutPlayers = {};
  var buzzListenerRef = null;
  var currentBuzzer = null;

  var ddWagerListenerRef = null;
  var ddWager = 0;
  var ddPlayerId = null;

  var finalData = null;
  var finalWagers = {};
  var finalAnswers = {};
  var finalWagerListenerRef = null;
  var finalAnswerListenerRef = null;
  var finalJudgeQueue = [];
  var finalJudgeIndex = 0;

  var els = {};

  // ── DOM ─────────────────────────────────────────────────────

  function cacheDom() {
    els.roomCode = document.getElementById('ctl-room-code');
    els.claimStatus = document.getElementById('claim-status');

    // Lobby
    els.boardSelector = document.getElementById('board-selector');
    els.ruleDoubleJeopardy = document.getElementById('rule-double-jeopardy');
    els.ruleDailyDoubles = document.getElementById('rule-daily-doubles');
    els.ruleFinalJeopardy = document.getElementById('rule-final-jeopardy');
    els.ruleBuzzWindow = document.getElementById('rule-buzz-window');
    els.playerCount = document.getElementById('ctl-player-count');
    els.playerList = document.getElementById('ctl-player-list');
    els.startGameBtn = document.getElementById('start-game-btn');

    // Board phase
    els.scoreboard = document.getElementById('ctl-scoreboard');
    els.roundLabel = document.getElementById('round-label');
    els.pickingPlayerName = document.getElementById('picking-player-name');
    els.board = document.getElementById('ctl-board');

    // Clue phase
    els.clueValue = document.getElementById('clue-value');
    els.clueText = document.getElementById('clue-text');
    els.clueAnswerText = document.getElementById('clue-answer-text');
    els.clueReading = document.getElementById('clue-reading');
    els.openBuzzingBtn = document.getElementById('open-buzzing-btn');
    els.skipClueBtn = document.getElementById('skip-clue-btn');
    els.clueBuzzing = document.getElementById('clue-buzzing');
    els.buzzTimerFill = document.getElementById('buzz-timer-fill');
    els.clueAnswering = document.getElementById('clue-answering');
    els.buzzedPlayer = document.getElementById('buzzed-player');
    els.judgeCorrectBtn = document.getElementById('judge-correct-btn');
    els.judgeIncorrectBtn = document.getElementById('judge-incorrect-btn');
    els.clueRevealed = document.getElementById('clue-revealed');
    els.returnBoardBtn = document.getElementById('return-board-btn');

    // Daily Double
    els.ddPlayerNameLabel = document.getElementById('dd-player-name');
    els.ddWagerStatus = document.getElementById('dd-wager-status');
    els.ddHostWager = document.getElementById('dd-host-wager');
    els.ddWagerRange = document.getElementById('dd-wager-range');
    els.ddWagerInput = document.getElementById('dd-wager-input');
    els.ddWagerSubmit = document.getElementById('dd-wager-submit');
    els.ddClueBlock = document.getElementById('dd-clue-block');
    els.ddWagerAmount = document.getElementById('dd-wager-amount');
    els.ddClueText = document.getElementById('dd-clue-text');
    els.ddAnswerBox = document.getElementById('dd-answer-box');
    els.ddAnswerText = document.getElementById('dd-answer-text');
    els.ddJudging = document.getElementById('dd-judging');
    els.ddCorrectBtn = document.getElementById('dd-correct-btn');
    els.ddIncorrectBtn = document.getElementById('dd-incorrect-btn');
    els.ddRevealed = document.getElementById('dd-revealed');
    els.ddReturnBtn = document.getElementById('dd-return-btn');

    // Round transition
    els.roundTransitionTitle = document.getElementById('round-transition-title');
    els.roundTransitionSubtitle = document.getElementById('round-transition-subtitle');
    els.nextRoundBtn = document.getElementById('next-round-btn');

    // Final Jeopardy
    els.finalCategory = document.getElementById('final-category');
    els.finalWagerSection = document.getElementById('final-wager-section');
    els.finalWagerRoster = document.getElementById('final-wager-roster');
    els.finalRevealClueBtn = document.getElementById('final-reveal-clue-btn');
    els.finalClueSection = document.getElementById('final-clue-section');
    els.finalClueText = document.getElementById('final-clue-text');
    els.finalAnswerText = document.getElementById('final-answer-text');
    els.finalAnswerRoster = document.getElementById('final-answer-roster');
    els.finalBeginJudgingBtn = document.getElementById('final-begin-judging-btn');
    els.finalJudgingSection = document.getElementById('final-judging-section');
    els.finalJudgeName = document.getElementById('final-judge-name');
    els.finalJudgeAnswer = document.getElementById('final-judge-answer');
    els.finalJudgeWager = document.getElementById('final-judge-wager');
    els.finalJudgeCorrect = document.getElementById('final-judge-correct');
    els.finalCorrectBtn = document.getElementById('final-correct-btn');
    els.finalIncorrectBtn = document.getElementById('final-incorrect-btn');
    els.finalEndSection = document.getElementById('final-end-section');
    els.finalEndGameBtn = document.getElementById('final-end-game-btn');

    // Game over
    els.standings = document.getElementById('standings');
    els.playAgainBtn = document.getElementById('play-again-btn');
  }

  // ── Phase switching ────────────────────────────────────────

  function showPhase(id) {
    var phases = document.querySelectorAll('.phase');
    for (var i = 0; i < phases.length; i++) phases[i].classList.remove('active');
    var t = document.getElementById(id);
    if (t) t.classList.add('active');
  }

  function setClaimStatus(msg, isError) {
    els.claimStatus.textContent = msg;
    els.claimStatus.classList.toggle('error', !!isError);
  }

  // ── Boards ─────────────────────────────────────────────────

  function loadBoards() {
    return fetch('boards/sample.json')
      .then(function (r) { return r.json(); })
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
          if (result.valid) boards[key] = data;
        } catch (e) { /* skip */ }
      }
    }
  }

  function populateBoardSelector() {
    els.boardSelector.innerHTML = '';
    Object.keys(boards).forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key;
      var b = boards[key];
      var label = b.title || key;
      if (b.author) label += ' by ' + b.author;
      if (key === 'sample') label += ' (Sample)';
      opt.textContent = label;
      els.boardSelector.appendChild(opt);
    });
    if (els.boardSelector.options.length > 0) {
      els.boardSelector.selectedIndex = 0;
      boardData = boards[els.boardSelector.value];
    }
  }

  function onBoardChange() {
    var key = els.boardSelector.value;
    if (boards[key]) boardData = boards[key];
  }

  // ── Config ─────────────────────────────────────────────────

  function readConfig() {
    return {
      enableDoubleJeopardy: els.ruleDoubleJeopardy.checked,
      enableDailyDoubles: els.ruleDailyDoubles.checked,
      enableFinalJeopardy: els.ruleFinalJeopardy.checked,
      buzzWindowMs: parseInt(els.ruleBuzzWindow.value, 10)
    };
  }

  // ── Player listening ───────────────────────────────────────

  function listenForPlayers() {
    J.ref('rooms/' + roomCode + '/players').on('value', function (snap) {
      players = snap.val() || {};
      renderPlayerList();
      renderScoreboard();
      updateStartButton();
      // FJ wager/answer rosters re-render (may include new couch players)
      if (els.finalWagerRoster && els.finalWagerRoster.children.length > 0) renderFinalWagerRoster();
      if (els.finalAnswerRoster && els.finalAnswerRoster.children.length > 0) renderFinalAnswerRoster();
    });
  }

  function renderPlayerList() {
    var ids = Object.keys(players);
    els.playerCount.textContent = ids.length === 0 ? '' : '(' + ids.length + ' joined)';
    if (ids.length === 0) {
      els.playerList.innerHTML = '<span class="ctl-empty">Waiting for players to join...</span>';
      return;
    }
    els.playerList.innerHTML = '';
    ids.forEach(function (id) {
      var p = players[id];
      var row = document.createElement('div');
      row.className = 'ctl-player';
      var dot = document.createElement('span');
      dot.className = 'ctl-player-dot';
      if (!p.connected) dot.classList.add('disconnected');
      if (p.kind === 'couch') dot.classList.add('couch');
      var name = document.createElement('span');
      name.className = 'ctl-player-name';
      name.textContent = p.name;
      row.appendChild(dot);
      row.appendChild(name);
      if (p.kind === 'couch') {
        var tag = document.createElement('span');
        tag.className = 'ctl-player-tag';
        tag.textContent = 'couch';
        row.appendChild(tag);
      }
      els.playerList.appendChild(row);
    });
  }

  function updateStartButton() {
    els.startGameBtn.disabled = Object.keys(players).length < 1;
  }

  function renderScoreboard() {
    if (!els.scoreboard) return;
    els.scoreboard.innerHTML = '';
    Object.keys(players).forEach(function (id) {
      var p = players[id];
      var item = document.createElement('div');
      item.className = 'ctl-score';
      var name = document.createElement('span');
      name.className = 'ctl-score-name' + (id === pickingPlayerId ? ' picker' : '');
      name.textContent = p.name;
      var val = document.createElement('span');
      val.className = 'ctl-score-value' + ((p.score || 0) < 0 ? ' negative' : '');
      val.textContent = J.formatScore(p.score || 0);
      item.appendChild(name);
      item.appendChild(val);
      els.scoreboard.appendChild(item);
    });
  }

  // ── Daily Double placement (random at start) ─────────────

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
  }

  function placeDailyDoubles(roundKey, numDoubles) {
    if (numDoubles <= 0) return Promise.resolve();
    var positions = [];
    for (var c = 0; c < J.CATEGORIES_PER_ROUND; c++) {
      for (var r = 0; r < J.CLUES_PER_CATEGORY; r++) {
        if (r > 0) positions.push({ cat: c, clue: r });
      }
    }
    shuffle(positions);
    var selected = positions.slice(0, numDoubles);
    var updates = {};
    selected.forEach(function (pos) {
      updates['rooms/' + roomCode + '/board/' + roundKey + '/categories/' + pos.cat + '/clues/' + pos.clue + '/dailyDouble'] = true;
    });
    return J.ref().update(updates);
  }

  // ── Start Game ─────────────────────────────────────────────

  async function startGame() {
    var ids = Object.keys(players);
    if (ids.length < 1) return;
    els.startGameBtn.disabled = true;
    els.startGameBtn.textContent = 'Starting...';
    try {
      config = readConfig();
      // Write board + config to Firebase (control owns config now per ADR-026)
      var freshBoard = J.buildBoardData(boardData, config);
      await J.ref('rooms/' + roomCode).update({
        'meta/config': config,
        'board': freshBoard
      });
      if (config.enableDailyDoubles) {
        await placeDailyDoubles('round1', 1);
        if (config.enableDoubleJeopardy) await placeDailyDoubles('round2', 2);
      }
      var firstPicker = ids[Math.floor(Math.random() * ids.length)];
      await J.ref('rooms/' + roomCode).update({
        'meta/status': J.STATUS.PLAYING,
        'game/pickingPlayer': firstPicker,
        'game/currentRound': 1,
        'game/currentClue': null
      });
      enterBoardPhase();
    } catch (err) {
      console.error('Failed to start game:', err);
      els.startGameBtn.disabled = false;
      els.startGameBtn.textContent = 'Start Game';
    }
  }

  // ── Board phase ────────────────────────────────────────────

  function enterBoardPhase() {
    listenForPickingPlayer();
    loadRoundBoard(currentRound);
  }

  function loadRoundBoard(roundNum) {
    var roundKey = 'round' + roundNum;
    J.ref('rooms/' + roomCode + '/board/' + roundKey).once('value', function (snap) {
      boardState = snap.val();
      if (!boardState) return;
      els.roundLabel.textContent = roundNum === 1 ? 'Round 1' : 'Double Jeopardy';
      renderBoard();
      showPhase('phase-board');
    });
  }

  function renderBoard() {
    els.board.innerHTML = '';
    var cats = boardState.categories;
    for (var c = 0; c < cats.length; c++) {
      var h = document.createElement('div');
      h.className = 'ctl-cat-header';
      h.textContent = cats[c].name;
      els.board.appendChild(h);
    }
    for (var r = 0; r < J.CLUES_PER_CATEGORY; r++) {
      for (var c2 = 0; c2 < J.CATEGORIES_PER_ROUND; c2++) {
        var clue = cats[c2].clues[r];
        var cell = document.createElement('div');
        cell.className = 'ctl-cell';
        if (clue.asked) {
          cell.classList.add('asked');
        } else {
          cell.textContent = '$' + clue.value;
          cell.dataset.cat = c2;
          cell.dataset.clue = r;
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
    var isDailyDouble = !!clue.dailyDouble;

    currentClueData = {
      categoryIndex: catIndex,
      clueIndex: clueIndex,
      state: J.CLUE_STATE.READING,
      text: clue.clue,
      answer: clue.answer,
      value: clue.value,
      dailyDouble: isDailyDouble
    };

    var roundKey = 'round' + currentRound;
    var updates = {};
    updates['game/currentClue'] = currentClueData;
    updates['board/' + roundKey + '/categories/' + catIndex + '/clues/' + clueIndex + '/asked'] = true;
    J.ref('rooms/' + roomCode).update(updates);

    boardState.categories[catIndex].clues[clueIndex].asked = true;
    cell.classList.add('asked');
    cell.textContent = '';
    cell.style.pointerEvents = 'none';

    if (isDailyDouble) showDailyDoubleOverlay();
    else showClueOverlay();
  }

  // ── Clue overlay ───────────────────────────────────────────

  function showClueOverlay() {
    els.clueValue.textContent = '$' + currentClueData.value;
    els.clueText.textContent = currentClueData.text;
    els.clueAnswerText.textContent = currentClueData.answer;
    els.clueReading.style.display = '';
    els.clueBuzzing.style.display = 'none';
    els.clueAnswering.style.display = 'none';
    els.clueRevealed.style.display = 'none';
    showPhase('phase-clue');
  }

  function onOpenBuzzing() {
    currentBuzzer = null;
    lockedOutPlayers = {};
    J.ref('rooms/' + roomCode).update({
      'game/currentClue/state': J.CLUE_STATE.BUZZING,
      'game/buzzer': {
        isOpen: true,
        openedAt: J.serverTimestamp()
      }
    });
    currentClueData.state = J.CLUE_STATE.BUZZING;
    els.clueReading.style.display = 'none';
    els.clueBuzzing.style.display = '';
    els.clueAnswering.style.display = 'none';
    els.clueRevealed.style.display = 'none';
    startBuzzTimer((config && config.buzzWindowMs) || 5000);
    listenForBuzzes();
  }

  function onSkipClue() {
    cleanupBuzzer();
    revealAnswer();
  }

  function returnToBoard() {
    cleanupBuzzer();
    J.ref('rooms/' + roomCode + '/game/currentClue').set(null);
    currentClueData = null;
    if (J.isRoundComplete(boardState)) checkRoundComplete();
    else showPhase('phase-board');
  }

  // ── Buzzing + judging ─────────────────────────────────────

  function startBuzzTimer(durationMs) {
    var totalMs = (config && config.buzzWindowMs) || 5000;
    buzzStartTime = Date.now();
    buzzRemainingMs = durationMs;
    els.buzzTimerFill.style.transition = 'none';
    els.buzzTimerFill.style.width = (durationMs / totalMs * 100) + '%';
    els.buzzTimerFill.offsetWidth;
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
    if (buzzTimerId) { clearInterval(buzzTimerId); buzzTimerId = null; }
    var elapsed = Date.now() - buzzStartTime;
    buzzRemainingMs = Math.max(0, buzzRemainingMs - elapsed);
  }

  function listenForBuzzes() {
    buzzListenerRef = J.ref('rooms/' + roomCode + '/game/buzzer/buzzedPlayers');
    buzzListenerRef.on('value', function (snap) { processBuzzes(snap.val()); });
  }

  function processBuzzes(buzzes) {
    if (currentBuzzer) return;
    if (!buzzes) return;
    var earliest = null, earliestTime = Infinity;
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
    J.ref('rooms/' + roomCode + '/game/currentClue/state').set(J.CLUE_STATE.ANSWERING);
    els.buzzedPlayer.textContent = (players[playerId] && players[playerId].name) || playerId;
    els.clueBuzzing.style.display = 'none';
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
    lockedOutPlayers[pid] = true;
    J.ref('rooms/' + roomCode + '/game/buzzer/lockedOut/' + pid).set(true);
    currentBuzzer = null;
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
    J.ref('rooms/' + roomCode + '/game/currentClue/state').set(J.CLUE_STATE.BUZZING);
    els.clueBuzzing.style.display = '';
    els.clueAnswering.style.display = 'none';
    if (buzzRemainingMs > 0) startBuzzTimer(buzzRemainingMs);
    else { onBuzzTimeout(); return; }
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
    els.clueReading.style.display = 'none';
    els.clueBuzzing.style.display = 'none';
    els.clueAnswering.style.display = 'none';
    els.clueRevealed.style.display = '';
  }

  function cleanupBuzzer() {
    if (buzzTimerId) { clearInterval(buzzTimerId); buzzTimerId = null; }
    if (buzzListenerRef) { buzzListenerRef.off(); buzzListenerRef = null; }
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

  // ── Daily Double flow ──────────────────────────────────────

  function isCouchPlayer(pid) {
    return !!(pid && players[pid] && players[pid].kind === 'couch');
  }

  function showDailyDoubleOverlay() {
    ddPlayerId = pickingPlayerId;
    ddWager = 0;

    els.ddPlayerNameLabel.textContent = (players[ddPlayerId] && players[ddPlayerId].name) || '...';
    els.ddWagerStatus.textContent = 'Waiting for wager...';
    els.ddHostWager.style.display = 'none';
    els.ddClueBlock.style.display = 'none';
    els.ddAnswerBox.style.display = 'none';
    els.ddJudging.style.display = 'none';
    els.ddRevealed.style.display = 'none';

    if (isCouchPlayer(ddPlayerId)) showHostDDWagerForm();

    showPhase('phase-daily-double');
    listenForDDWager();
  }

  function showHostDDWagerForm() {
    var score = (players[ddPlayerId] && players[ddPlayerId].score) || 0;
    var limits = J.getDDWagerLimits(score, currentRound);
    els.ddWagerStatus.textContent = 'Enter spoken wager';
    els.ddWagerRange.textContent = '$' + limits.min + ' – $' + limits.max.toLocaleString();
    els.ddWagerInput.min = limits.min;
    els.ddWagerInput.max = limits.max;
    els.ddWagerInput.value = '';
    els.ddWagerSubmit.disabled = true;
    els.ddHostWager.style.display = '';
    setTimeout(function () { els.ddWagerInput.focus(); }, 50);
  }

  function validateHostDDWager() {
    var score = (players[ddPlayerId] && players[ddPlayerId].score) || 0;
    var limits = J.getDDWagerLimits(score, currentRound);
    var v = parseInt(els.ddWagerInput.value, 10);
    els.ddWagerSubmit.disabled = isNaN(v) || v < limits.min || v > limits.max;
  }

  function submitHostDDWager() {
    var score = (players[ddPlayerId] && players[ddPlayerId].score) || 0;
    var limits = J.getDDWagerLimits(score, currentRound);
    var v = parseInt(els.ddWagerInput.value, 10);
    if (isNaN(v) || v < limits.min || v > limits.max) return;
    els.ddHostWager.style.display = 'none';
    J.ref('rooms/' + roomCode + '/game/dailyDouble').set({ playerId: ddPlayerId, wager: v });
  }

  function listenForDDWager() {
    ddWagerListenerRef = J.ref('rooms/' + roomCode + '/game/dailyDouble');
    ddWagerListenerRef.on('value', function (snap) {
      var data = snap.val();
      if (data && data.wager !== undefined) onDDWagerReceived(data);
    });
  }

  function onDDWagerReceived(data) {
    ddWager = data.wager;
    ddPlayerId = data.playerId;
    els.ddWagerStatus.textContent = 'Wager locked in.';
    els.ddWagerAmount.textContent = '$' + ddWager.toLocaleString();
    els.ddClueText.textContent = currentClueData.text;
    els.ddAnswerText.textContent = currentClueData.answer;
    els.ddClueBlock.style.display = '';
    els.ddAnswerBox.style.display = '';
    els.ddJudging.style.display = '';
    J.ref('rooms/' + roomCode + '/game/currentClue/state').set(J.CLUE_STATE.ANSWERING);
  }

  function onDDJudgeCorrect() {
    if (!ddPlayerId) return;
    updatePlayerScore(ddPlayerId, ddWager);
    cleanupDailyDouble();
    ddRevealAnswer();
  }

  function onDDJudgeIncorrect() {
    if (!ddPlayerId) return;
    updatePlayerScore(ddPlayerId, -ddWager);
    cleanupDailyDouble();
    ddRevealAnswer();
  }

  function ddRevealAnswer() {
    J.ref('rooms/' + roomCode + '/game/currentClue/state').set(J.CLUE_STATE.REVEALED);
    els.ddJudging.style.display = 'none';
    els.ddRevealed.style.display = '';
  }

  function ddReturnToBoard() {
    cleanupDailyDouble();
    J.ref('rooms/' + roomCode + '/game/currentClue').set(null);
    J.ref('rooms/' + roomCode + '/game/dailyDouble').set(null);
    currentClueData = null;
    if (J.isRoundComplete(boardState)) checkRoundComplete();
    else showPhase('phase-board');
  }

  function cleanupDailyDouble() {
    if (ddWagerListenerRef) { ddWagerListenerRef.off(); ddWagerListenerRef = null; }
  }

  // ── Round transitions ──────────────────────────────────────

  function checkRoundComplete() {
    if (!J.isRoundComplete(boardState)) return;
    if (currentRound === 1 && config && config.enableDoubleJeopardy) showRoundTransition();
    else onAllRoundsComplete();
  }

  function showRoundTransition() {
    els.roundTransitionTitle.textContent = 'Round 1 Complete';
    els.roundTransitionSubtitle.textContent = 'Double Jeopardy is next...';
    els.nextRoundBtn.onclick = onNextRound;
    showPhase('phase-round-transition');
  }

  function onNextRound() {
    currentRound = 2;
    var lowest = getLowestScoringPlayer();
    J.ref('rooms/' + roomCode).update({
      'game/currentRound': 2,
      'game/pickingPlayer': lowest,
      'game/currentClue': null
    });
    loadRoundBoard(2);
  }

  function getLowestScoringPlayer() {
    var ids = Object.keys(players);
    if (ids.length === 0) return null;
    var lowestId = ids[0];
    var lowest = (players[ids[0]] && players[ids[0]].score) || 0;
    for (var i = 1; i < ids.length; i++) {
      var s = (players[ids[i]] && players[ids[i]].score) || 0;
      if (s < lowest) { lowest = s; lowestId = ids[i]; }
    }
    return lowestId;
  }

  function onAllRoundsComplete() {
    if (config && config.enableFinalJeopardy) {
      els.roundTransitionTitle.textContent = currentRound === 1 ? 'Round Complete' : 'Double Jeopardy Complete';
      els.roundTransitionSubtitle.textContent = 'Final Jeopardy is next...';
      els.nextRoundBtn.onclick = enterFinalJeopardy;
      showPhase('phase-round-transition');
    } else {
      showGameOver();
    }
  }

  // ── Final Jeopardy ─────────────────────────────────────────

  function enterFinalJeopardy() {
    els.nextRoundBtn.onclick = onNextRound;
    J.ref('rooms/' + roomCode + '/board/final').once('value', function (snap) {
      finalData = snap.val();
      if (!finalData) { showGameOver(); return; }
      startFinalCategory();
    });
  }

  function startFinalCategory() {
    finalWagers = {};
    finalAnswers = {};
    finalJudgeQueue = [];
    finalJudgeIndex = 0;

    J.ref('rooms/' + roomCode).update({
      'meta/status': J.STATUS.FINAL,
      'game/finalJeopardy': { state: J.FINAL_STATE.CATEGORY }
    });

    els.finalCategory.textContent = finalData.category;
    els.finalWagerSection.style.display = '';
    els.finalClueSection.style.display = 'none';
    els.finalJudgingSection.style.display = 'none';
    els.finalEndSection.style.display = 'none';
    els.finalRevealClueBtn.disabled = true;

    renderFinalWagerRoster();

    J.ref('rooms/' + roomCode + '/game/finalJeopardy/state').set(J.FINAL_STATE.WAGER);
    listenForFinalWagers();

    showPhase('phase-final');
  }

  function renderFinalWagerRoster() {
    if (!els.finalWagerRoster) return;
    els.finalWagerRoster.innerHTML = '';
    Object.keys(players).forEach(function (id) {
      var p = players[id];
      var score = (p && p.score) || 0;
      var couch = isCouchPlayer(id);
      var row = document.createElement('div');
      row.className = 'fj-row';
      row.id = 'fj-wager-row-' + id;

      var head = document.createElement('div');
      head.className = 'fj-row-head';
      var name = document.createElement('span');
      name.className = 'fj-row-name';
      name.textContent = p.name + (couch ? ' (couch)' : '');
      var status = document.createElement('span');
      status.className = 'fj-row-status pending';
      status.textContent = 'pending';
      head.appendChild(name);
      head.appendChild(status);
      row.appendChild(head);

      var submitted = finalWagers[id] !== undefined;
      if (submitted) {
        row.classList.add('submitted');
        status.textContent = '✓ ' + J.formatScore(finalWagers[id]);
        status.classList.remove('pending');
      } else if (score <= 0) {
        // Auto-zero ineligible players (positive-score-only rule, real show).
        // Also auto-empty the answer so updateBeginJudgingButton sees them
        // as fully done — they have no UI path to submit one.
        finalWagers[id] = 0;
        J.ref('rooms/' + roomCode + '/game/finalJeopardy/wagers/' + id).set(0);
        J.ref('rooms/' + roomCode + '/game/finalJeopardy/answers/' + id).set('');
        row.classList.add('submitted');
        status.textContent = '$0 (no wager)';
        status.classList.remove('pending');
      } else if (couch) {
        // Inline wager input from index card
        var line = document.createElement('div');
        line.className = 'fj-row-input-line';
        var input = document.createElement('input');
        input.type = 'number';
        input.inputMode = 'numeric';
        input.min = 0;
        input.max = score;
        input.placeholder = 'wager from card';
        input.className = 'ctl-input';
        var btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.textContent = 'Set';
        btn.style.padding = '0.55rem 0.8rem';
        btn.onclick = function () {
          var v = parseInt(input.value, 10);
          if (isNaN(v) || v < 0 || v > score) return;
          J.ref('rooms/' + roomCode + '/game/finalJeopardy/wagers/' + id).set(v);
        };
        line.appendChild(input);
        line.appendChild(btn);
        row.appendChild(line);
      }
      els.finalWagerRoster.appendChild(row);
    });
  }

  function listenForFinalWagers() {
    finalWagerListenerRef = J.ref('rooms/' + roomCode + '/game/finalJeopardy/wagers');
    finalWagerListenerRef.on('value', function (snap) {
      var wagers = snap.val() || {};
      Object.keys(wagers).forEach(function (pid) {
        var was = finalWagers[pid];
        finalWagers[pid] = wagers[pid];
        if (was !== wagers[pid]) {
          var row = document.getElementById('fj-wager-row-' + pid);
          if (row) {
            row.classList.add('submitted');
            var st = row.querySelector('.fj-row-status');
            if (st) {
              st.textContent = '✓ ' + J.formatScore(wagers[pid]);
              st.classList.remove('pending');
            }
            // Remove inline input row if present
            var inputLine = row.querySelector('.fj-row-input-line');
            if (inputLine) inputLine.remove();
          }
        }
      });
      els.finalRevealClueBtn.disabled = !allWagersIn();
    });
  }

  function allWagersIn() {
    var ids = Object.keys(players);
    for (var i = 0; i < ids.length; i++) {
      if (!players[ids[i]].connected) continue;
      if (finalWagers[ids[i]] === undefined) return false;
    }
    return ids.length > 0;
  }

  function onRevealFinalClue() {
    if (finalWagerListenerRef) { finalWagerListenerRef.off(); finalWagerListenerRef = null; }
    els.finalWagerSection.style.display = 'none';
    els.finalClueSection.style.display = '';
    els.finalClueText.textContent = finalData.clue;
    els.finalAnswerText.textContent = finalData.answer;

    J.ref('rooms/' + roomCode + '/game/finalJeopardy/state').set(J.FINAL_STATE.CLUE);

    renderFinalAnswerRoster();
    listenForFinalAnswers();
  }

  function renderFinalAnswerRoster() {
    if (!els.finalAnswerRoster) return;
    els.finalAnswerRoster.innerHTML = '';
    Object.keys(players).forEach(function (id) {
      var p = players[id];
      var couch = isCouchPlayer(id);
      var row = document.createElement('div');
      row.className = 'fj-row';
      row.id = 'fj-answer-row-' + id;

      var head = document.createElement('div');
      head.className = 'fj-row-head';
      var name = document.createElement('span');
      name.className = 'fj-row-name';
      name.textContent = p.name + (couch ? ' (couch)' : '');
      var status = document.createElement('span');
      status.className = 'fj-row-status pending';
      status.textContent = 'pending';
      head.appendChild(name);
      head.appendChild(status);
      row.appendChild(head);

      var submitted = finalAnswers[id] !== undefined;
      if (submitted) {
        row.classList.add('submitted');
        status.textContent = '✓';
        status.classList.remove('pending');
      } else if (couch) {
        var line = document.createElement('div');
        line.className = 'fj-row-input-line';
        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'answer from card';
        input.className = 'ctl-input';
        var btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.textContent = 'Set';
        btn.style.padding = '0.55rem 0.8rem';
        btn.onclick = function () {
          var v = (input.value || '').trim();
          J.ref('rooms/' + roomCode + '/game/finalJeopardy/answers/' + id).set(v);
        };
        line.appendChild(input);
        line.appendChild(btn);
        row.appendChild(line);
      }
      els.finalAnswerRoster.appendChild(row);
    });
    updateBeginJudgingButton();
  }

  function listenForFinalAnswers() {
    finalAnswerListenerRef = J.ref('rooms/' + roomCode + '/game/finalJeopardy/answers');
    finalAnswerListenerRef.on('value', function (snap) {
      var answers = snap.val() || {};
      Object.keys(answers).forEach(function (pid) {
        var was = finalAnswers[pid];
        finalAnswers[pid] = answers[pid];
        if (was !== answers[pid]) {
          var row = document.getElementById('fj-answer-row-' + pid);
          if (row) {
            row.classList.add('submitted');
            var st = row.querySelector('.fj-row-status');
            if (st) { st.textContent = '✓'; st.classList.remove('pending'); }
            var inputLine = row.querySelector('.fj-row-input-line');
            if (inputLine) inputLine.remove();
          }
        }
      });
      updateBeginJudgingButton();
    });
  }

  function updateBeginJudgingButton() {
    var ids = Object.keys(players);
    var allIn = ids.length > 0 && ids.every(function (id) {
      if (!players[id].connected) return true;
      return finalAnswers[id] !== undefined;
    });
    els.finalBeginJudgingBtn.disabled = !allIn;
  }

  function onBeginFinalJudging() {
    if (finalAnswerListenerRef) { finalAnswerListenerRef.off(); finalAnswerListenerRef = null; }
    J.ref('rooms/' + roomCode + '/game/finalJeopardy/state').set(J.FINAL_STATE.JUDGING);
    finalJudgeQueue = Object.keys(players).filter(function (id) { return players[id].connected; });
    finalJudgeIndex = 0;
    els.finalClueSection.style.display = 'none';
    els.finalJudgingSection.style.display = '';
    showNextFinalPlayer();
  }

  function showNextFinalPlayer() {
    if (finalJudgeIndex >= finalJudgeQueue.length) {
      onFinalJudgingComplete();
      return;
    }
    var pid = finalJudgeQueue[finalJudgeIndex];
    var ans = finalAnswers[pid] || '(no answer)';
    var w = finalWagers[pid] || 0;
    els.finalJudgeName.textContent = players[pid].name;
    els.finalJudgeAnswer.textContent = '"' + ans + '"';
    els.finalJudgeWager.textContent = 'Wager: ' + J.formatScore(w);
    els.finalJudgeCorrect.textContent = (finalData && finalData.answer) || '';
    els.finalCorrectBtn.onclick = function () { judgeFinalPlayer(pid, true); };
    els.finalIncorrectBtn.onclick = function () { judgeFinalPlayer(pid, false); };
  }

  function judgeFinalPlayer(pid, correct) {
    var w = finalWagers[pid] || 0;
    var delta = correct ? w : -w;
    updatePlayerScore(pid, delta);
    J.ref('rooms/' + roomCode + '/game/finalJeopardy/judged/' + pid).set(true);
    finalJudgeIndex++;
    showNextFinalPlayer();
  }

  function onFinalJudgingComplete() {
    els.finalJudgingSection.style.display = 'none';
    els.finalEndSection.style.display = '';
  }

  function cleanupFinalJeopardy() {
    if (finalWagerListenerRef) { finalWagerListenerRef.off(); finalWagerListenerRef = null; }
    if (finalAnswerListenerRef) { finalAnswerListenerRef.off(); finalAnswerListenerRef = null; }
  }

  function showGameOver() {
    cleanupFinalJeopardy();
    J.ref('rooms/' + roomCode + '/meta/status').set(J.STATUS.ENDED);

    var ids = Object.keys(players);
    ids.sort(function (a, b) {
      return ((players[b] && players[b].score) || 0) - ((players[a] && players[a].score) || 0);
    });
    els.standings.innerHTML = '';
    ids.forEach(function (id, i) {
      var p = players[id];
      var row = document.createElement('div');
      row.className = 'standing';
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
      els.standings.appendChild(row);
    });
    showPhase('phase-game-over');
  }

  // ── Play again ─────────────────────────────────────────────

  async function playAgain() {
    cleanupBuzzer();
    cleanupDailyDouble();
    cleanupFinalJeopardy();

    currentRound = 1;
    boardState = null;
    currentClueData = null;
    pickingPlayerId = null;
    currentBuzzer = null;
    lockedOutPlayers = {};
    ddWager = 0; ddPlayerId = null;
    finalData = null; finalWagers = {}; finalAnswers = {};
    finalJudgeQueue = []; finalJudgeIndex = 0;

    config = readConfig();
    var freshBoard = J.buildBoardData(boardData, config);
    var updates = {
      'board': freshBoard,
      'game': { currentRound: 1, pickingPlayer: null, currentClue: null },
      'meta/status': J.STATUS.LOBBY,
      'meta/config': config
    };
    Object.keys(players).forEach(function (id) {
      updates['players/' + id + '/score'] = 0;
    });

    try {
      await J.ref('rooms/' + roomCode).update(updates);
      if (config.enableDailyDoubles) {
        await placeDailyDoubles('round1', 1);
        if (config.enableDoubleJeopardy) await placeDailyDoubles('round2', 2);
      }
    } catch (err) {
      console.error('Failed to reset:', err);
      return;
    }

    els.startGameBtn.disabled = false;
    els.startGameBtn.textContent = 'Start Game';
    els.nextRoundBtn.onclick = onNextRound;
    updateStartButton();
    renderPlayerList();
    showPhase('phase-lobby');
  }

  // ── Picking-player listener ────────────────────────────────

  function listenForPickingPlayer() {
    J.ref('rooms/' + roomCode + '/game/pickingPlayer').on('value', function (snap) {
      pickingPlayerId = snap.val();
      if (els.pickingPlayerName && pickingPlayerId && players[pickingPlayerId]) {
        els.pickingPlayerName.textContent = players[pickingPlayerId].name;
      }
      renderScoreboard();
    });
  }

  // ── Init ────────────────────────────────────────────────────

  async function init() {
    cacheDom();

    // Wire control inputs
    els.boardSelector.addEventListener('change', onBoardChange);
    els.startGameBtn.addEventListener('click', startGame);
    els.openBuzzingBtn.addEventListener('click', onOpenBuzzing);
    els.skipClueBtn.addEventListener('click', onSkipClue);
    els.judgeCorrectBtn.addEventListener('click', onJudgeCorrect);
    els.judgeIncorrectBtn.addEventListener('click', onJudgeIncorrect);
    els.returnBoardBtn.addEventListener('click', returnToBoard);
    els.ddWagerInput.addEventListener('input', validateHostDDWager);
    els.ddWagerSubmit.addEventListener('click', submitHostDDWager);
    els.ddWagerInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !els.ddWagerSubmit.disabled) submitHostDDWager();
    });
    els.ddCorrectBtn.addEventListener('click', onDDJudgeCorrect);
    els.ddIncorrectBtn.addEventListener('click', onDDJudgeIncorrect);
    els.ddReturnBtn.addEventListener('click', ddReturnToBoard);
    els.nextRoundBtn.addEventListener('click', onNextRound);
    els.finalRevealClueBtn.addEventListener('click', onRevealFinalClue);
    els.finalBeginJudgingBtn.addEventListener('click', onBeginFinalJudging);
    els.finalEndGameBtn.addEventListener('click', showGameOver);
    els.playAgainBtn.addEventListener('click', playAgain);

    // Read URL params
    var params = new URLSearchParams(window.location.search);
    roomCode = (params.get('room') || '').toUpperCase();
    providedToken = params.get('token') || '';
    if (els.roomCode) els.roomCode.textContent = roomCode || '----';

    if (!roomCode) {
      setClaimStatus('Missing room code. Open this page from the host control QR.', true);
      return;
    }

    setClaimStatus('Connecting...');
    try {
      var user = await J.signInAnonymously();
      myUid = user.uid;
    } catch (err) {
      console.error('Auth failed:', err);
      setClaimStatus('Could not connect. Refresh and try again.', true);
      return;
    }

    setClaimStatus('Claiming control...');
    var result;
    try {
      result = await J.claimControl(roomCode, providedToken, myUid);
    } catch (err) {
      console.error('Claim failed:', err);
      setClaimStatus('Could not claim control: ' + (err.message || err), true);
      return;
    }

    if (!result.ok) {
      var msg = result.reason === 'claimed-by-other'
        ? 'Host control already claimed by another device. Ask the TV operator to reset.'
        : result.reason === 'invalid-token'
          ? 'This QR is no longer valid. Ask the TV operator to reset host control.'
          : result.reason === 'no-room'
            ? 'Room not found.'
            : 'Could not claim control.';
      setClaimStatus(msg, true);
      return;
    }

    // Pick up existing config (if any)
    var configSnap = await J.ref('rooms/' + roomCode + '/meta/config').once('value');
    if (configSnap.exists()) config = configSnap.val();

    // Successful claim → leave the claim phase. Status listener will swap us
    // to phase-board if a game is already in progress.
    showPhase('phase-lobby');

    // Boards + listeners
    await loadBoards();
    listenForPlayers();
    listenForRoomStatus();
  }

  function listenForRoomStatus() {
    J.ref('rooms/' + roomCode + '/meta/status').on('value', function (snap) {
      var status = snap.val();
      // PAUSED is a brief "host left" marker; treat as LOBBY for control UI.
      if (status === J.STATUS.LOBBY || status === J.STATUS.PAUSED || status === null) {
        showPhase('phase-lobby');
      } else if (status === J.STATUS.PLAYING) {
        // Sync currentRound, then enter board phase
        J.ref('rooms/' + roomCode + '/game/currentRound').once('value', function (s) {
          currentRound = s.val() || 1;
          enterBoardPhase();
        });
      }
      // FINAL/ENDED: control.html stays on whatever phase it's in (driven locally)
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
