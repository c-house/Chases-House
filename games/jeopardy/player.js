/* ═══════════════════════════════════════════════════════════════
   Jeopardy — player.js
   Player game logic: join, buzzer, wagers, Final Jeopardy answers.
   Depends on shared.js (window.Jeopardy).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var J = window.Jeopardy;
  var SG = window.SharedGamepad;

  // ── Gamepad rumble patterns (ms / 0..1) ──────────────────
  var BUZZ_RUMBLE = { duration: 80, strongMagnitude: 0.7, weakMagnitude: 0.3 };
  var LOCKOUT_RUMBLE = { duration: 220, strongMagnitude: 0, weakMagnitude: 0.5 };

  // ── State ───────────────────────────────────────────────────
  var playerId = null;
  var playerName = '';
  var roomCode = null;
  var allPlayers = {};         // Cached player data for name lookups
  var hasBuzzed = false;       // Whether this player buzzed for current clue
  var isLockedOut = false;     // Whether locked out for current clue
  var currentClueState = null; // Current clue state from Firebase
  var pickingPlayerId = null;  // Who is currently picking
  var currentScore = 0;        // Player's current score (for DD wager limits)
  var currentRound = 1;        // Current round number (for DD wager limits)
  var ddWagerSubmitted = false; // Whether DD wager was submitted this clue
  var finalWagerSubmitted = false;  // Whether FJ wager was submitted
  var finalAnswerSubmitted = false; // Whether FJ answer was submitted
  var finalTimerId = null;          // Interval for FJ timer
  var finalStateListenerRef = null; // Firebase ref for FJ state listener

  // ── DOM Elements ────────────────────────────────────────────
  var els = {};

  function cacheDom() {
    // Join phase
    els.roomCodeInput = document.getElementById('room-code-input');
    els.playerNameInput = document.getElementById('player-name-input');
    els.joinBtn = document.getElementById('join-btn');
    els.joinError = document.getElementById('join-error');

    // Lobby phase
    els.lobbyRoomCode = document.getElementById('lobby-room-code');
    els.lobbyNameDisplay = document.getElementById('lobby-name-display');
    els.lobbyPlayerList = document.getElementById('lobby-player-list');

    // Playing phase
    els.playerScoreName = document.getElementById('player-score-name');
    els.playerScoreValue = document.getElementById('player-score-value');
    els.gameStatus = document.getElementById('game-status');

    // Clue area
    els.playerClueValue = document.getElementById('player-clue-value');
    els.playerClueText = document.getElementById('player-clue-text');
    els.playerCluePlaceholder = document.getElementById('player-clue-placeholder');

    // Buzzer
    els.buzzerBtn = document.getElementById('buzzer-btn');
    els.buzzerStatusText = document.getElementById('buzzer-status-text');

    // Daily Double
    els.ddInstruction = document.getElementById('dd-instruction');
    els.ddWagerForm = document.getElementById('dd-wager-form');
    els.ddWagerInput = document.getElementById('dd-wager-input');
    els.ddWagerRange = document.getElementById('dd-wager-range');
    els.ddWagerBtn = document.getElementById('dd-wager-btn');
    els.ddWaiting = document.getElementById('dd-waiting');

    // Final Jeopardy
    els.finalCategory = document.getElementById('final-category');
    els.finalWagerForm = document.getElementById('final-wager-form');
    els.finalWagerInput = document.getElementById('final-wager-input');
    els.finalWagerBtn = document.getElementById('final-wager-btn');
    els.finalClueArea = document.getElementById('final-clue-area');
    els.finalClueText = document.getElementById('final-clue-text');
    els.finalTimer = document.getElementById('final-timer');
    els.finalTimerFill = document.getElementById('final-timer-fill');
    els.finalAnswerForm = document.getElementById('final-answer-form');
    els.finalAnswerInput = document.getElementById('final-answer-input');
    els.finalAnswerBtn = document.getElementById('final-answer-btn');
    els.finalWaiting = document.getElementById('final-waiting');

    // Game Over
    els.finalScoreDisplay = document.getElementById('final-score-display');
    els.standingsList = document.getElementById('standings-list');

    // Host disconnected overlay
    els.hostDisconnected = document.getElementById('host-disconnected');
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

  // ── Join Flow ─────────────────────────────────────────────

  function updateJoinButton() {
    var code = els.roomCodeInput.value.trim();
    var name = els.playerNameInput.value.trim();
    els.joinBtn.disabled = code.length !== 4 || name.length === 0;
  }

  function showJoinError(msg) {
    els.joinError.textContent = msg;
  }

  function clearJoinError() {
    els.joinError.textContent = '';
  }

  async function handleJoin() {
    clearJoinError();
    var code = els.roomCodeInput.value.trim().toUpperCase();
    var name = els.playerNameInput.value.trim();

    if (code.length !== 4) {
      showJoinError('Room code must be 4 letters.');
      return;
    }
    if (!name) {
      showJoinError('Please enter your name.');
      return;
    }

    els.joinBtn.disabled = true;
    els.joinBtn.textContent = 'Joining...';

    try {
      await J.joinRoom(code, playerId, name);
      roomCode = code;
      playerName = name;
      transitionToLobby();
    } catch (err) {
      showJoinError(err.message || 'Failed to join room.');
      els.joinBtn.disabled = false;
      els.joinBtn.textContent = 'Join Game';
    }
  }

  // ── Lobby ─────────────────────────────────────────────────

  function transitionToLobby() {
    els.lobbyRoomCode.textContent = roomCode;
    els.lobbyNameDisplay.textContent = playerName;
    els.playerScoreName.textContent = playerName;

    listenForPlayers();
    listenForStatus();
    showPhase('phase-lobby');
  }

  function listenForPlayers() {
    J.ref('rooms/' + roomCode + '/players').on('value', function (snap) {
      allPlayers = snap.val() || {};
      renderPlayerList(allPlayers);
    });
  }

  function renderPlayerList(players) {
    // Preserve the title span, clear everything else
    var title = els.lobbyPlayerList.querySelector('.lobby-player-list-title');
    els.lobbyPlayerList.innerHTML = '';
    if (title) els.lobbyPlayerList.appendChild(title);

    var ids = Object.keys(players);
    ids.forEach(function (id) {
      var p = players[id];
      var item = document.createElement('div');
      item.className = 'lobby-player-item';
      if (id === playerId) item.classList.add('you');

      var dot = document.createElement('span');
      dot.className = 'lobby-player-dot';
      if (!p.connected) dot.style.opacity = '0.3';

      var nameSpan = document.createElement('span');
      nameSpan.textContent = p.name;
      if (id === playerId) nameSpan.textContent += ' (you)';
      if (!p.connected) nameSpan.style.opacity = '0.5';

      item.appendChild(dot);
      item.appendChild(nameSpan);
      els.lobbyPlayerList.appendChild(item);
    });
  }

  function listenForStatus() {
    J.ref('rooms/' + roomCode + '/meta/status').on('value', function (snap) {
      handleStatusChange(snap.val());
    });
  }

  function handleStatusChange(status) {
    if (status === J.STATUS.PAUSED) {
      els.hostDisconnected.classList.add('active');
      return;
    }
    els.hostDisconnected.classList.remove('active');

    if (status === J.STATUS.LOBBY) {
      returnToLobby();
    } else if (status === J.STATUS.PLAYING) {
      transitionToPlaying();
    } else if (status === J.STATUS.FINAL) {
      transitionToFinal();
    } else if (status === J.STATUS.ENDED) {
      transitionToGameOver();
    }
  }

  // ── Return to Lobby (Play Again) ──────────────────────────

  function returnToLobby() {
    cleanupGameListeners();

    // Reset local game state
    hasBuzzed = false;
    isLockedOut = false;
    currentClueState = null;
    pickingPlayerId = null;
    currentScore = 0;
    currentRound = 1;
    ddWagerSubmitted = false;
    finalWagerSubmitted = false;
    finalAnswerSubmitted = false;

    // Reset UI elements
    updateScoreDisplay(0);
    resetBuzzer();
    showCluePlaceholder();
    renderPlayerList(allPlayers);

    showPhase('phase-lobby');
  }

  function cleanupGameListeners() {
    J.ref('rooms/' + roomCode + '/players/' + playerId + '/score').off();
    J.ref('rooms/' + roomCode + '/game/currentClue').off();
    J.ref('rooms/' + roomCode + '/game/pickingPlayer').off();
    J.ref('rooms/' + roomCode + '/game/buzzer/lockedOut/' + playerId).off();
    J.ref('rooms/' + roomCode + '/game/currentRound').off();

    if (finalStateListenerRef) {
      finalStateListenerRef.off();
      finalStateListenerRef = null;
    }
    if (finalTimerId) {
      clearInterval(finalTimerId);
      finalTimerId = null;
    }
  }

  // ── Playing Phase ─────────────────────────────────────────

  function transitionToPlaying() {
    listenForScore();
    listenForClue();
    listenForPickingPlayer();
    listenForLockout();
    listenForRound();
    showPhase('phase-playing');
  }

  // ── Score ─────────────────────────────────────────────────

  function listenForScore() {
    J.ref('rooms/' + roomCode + '/players/' + playerId + '/score')
      .on('value', function (snap) {
        currentScore = snap.val() || 0;
        updateScoreDisplay(currentScore);
      });
  }

  function updateScoreDisplay(score) {
    var formatted = '$' + Math.abs(score).toLocaleString();
    if (score < 0) formatted = '-' + formatted;
    els.playerScoreValue.textContent = formatted;
    els.playerScoreValue.classList.toggle('negative', score < 0);
  }

  // ── Clue Listener ────────────────────────────────────────

  function listenForClue() {
    J.ref('rooms/' + roomCode + '/game/currentClue').on('value', function (snap) {
      handleClueChange(snap.val());
    });
  }

  function handleClueChange(clue) {
    if (!clue) {
      currentClueState = null;
      ddWagerSubmitted = false;
      showPhase('phase-playing');
      showCluePlaceholder();
      resetBuzzer();
      updatePickingStatus();
      return;
    }

    // Edge-detect state → BUZZING for haptic feedback (TV-faithful: phones
    // are silent for audio; we vibrate to mirror the lectern light cue).
    if (currentClueState !== J.CLUE_STATE.BUZZING && clue.state === J.CLUE_STATE.BUZZING) {
      try {
        if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 60]);
      } catch (e) { /* silent */ }
    }

    currentClueState = clue.state;

    if (clue.dailyDouble) {
      handleDailyDouble(clue);
      return;
    }

    showPhase('phase-playing');
    showClueContent(clue.value, clue.text);
    updateBuzzerForState(clue.state);
  }

  function showCluePlaceholder() {
    els.playerClueValue.style.display = 'none';
    els.playerClueText.style.display = 'none';
    els.playerCluePlaceholder.style.display = '';
  }

  function showClueContent(value, text) {
    els.playerClueValue.textContent = '$' + value;
    els.playerClueValue.style.display = '';
    els.playerClueText.textContent = text;
    els.playerClueText.style.display = '';
    els.playerCluePlaceholder.style.display = 'none';
  }

  // ── Buzzer State Management ──────────────────────────────

  function updateBuzzerForState(state) {
    switch (state) {
      case J.CLUE_STATE.READING:
        setBuzzerDisabled();
        els.gameStatus.textContent = 'Listen to the clue...';
        break;
      case J.CLUE_STATE.BUZZING:
        if (hasBuzzed) {
          setBuzzerBuzzed();
          els.gameStatus.textContent = 'Waiting for host...';
        } else if (isLockedOut) {
          setBuzzerDisabled();
          els.gameStatus.textContent = 'Locked out';
          els.buzzerStatusText.textContent = 'Incorrect answer';
        } else {
          setBuzzerActive();
          els.gameStatus.textContent = 'Buzz in!';
        }
        break;
      case J.CLUE_STATE.ANSWERING:
        if (hasBuzzed) {
          setBuzzerBuzzed();
          els.gameStatus.textContent = 'Answer out loud!';
        } else {
          setBuzzerDisabled();
          els.gameStatus.textContent = 'A player is answering...';
        }
        break;
      case J.CLUE_STATE.REVEALED:
        setBuzzerDisabled();
        els.gameStatus.textContent = 'Answer revealed';
        break;
      default:
        setBuzzerDisabled();
        break;
    }
  }

  function setBuzzerActive() {
    els.buzzerBtn.disabled = false;
    els.buzzerBtn.classList.add('active');
    els.buzzerBtn.classList.remove('buzzed');
    els.buzzerBtn.textContent = 'Buzz';
    els.buzzerStatusText.textContent = '';
  }

  function setBuzzerDisabled() {
    els.buzzerBtn.disabled = true;
    els.buzzerBtn.classList.remove('active', 'buzzed');
    els.buzzerBtn.textContent = 'Buzz';
    els.buzzerStatusText.textContent = '';
  }

  function setBuzzerBuzzed() {
    els.buzzerBtn.disabled = true;
    els.buzzerBtn.classList.remove('active');
    els.buzzerBtn.classList.add('buzzed');
    els.buzzerBtn.textContent = 'Buzzed!';
    els.buzzerStatusText.textContent = 'Waiting for host...';
  }

  function resetBuzzer() {
    hasBuzzed = false;
    isLockedOut = false;
    setBuzzerDisabled();
  }

  // ── Buzz Action ──────────────────────────────────────────

  function handleBuzz() {
    if (hasBuzzed || isLockedOut) return;
    hasBuzzed = true;

    J.writeBuzz(roomCode, playerId);

    setBuzzerBuzzed();
    els.gameStatus.textContent = 'Waiting for host...';
  }

  // ── Gamepad Polling ──────────────────────────────────────

  var gamepadPollRunning = false;

  function startGamepadPolling() {
    if (gamepadPollRunning) return;
    gamepadPollRunning = true;
    function tick() {
      if (!gamepadPollRunning) return;
      if (playerId && currentClueState === J.CLUE_STATE.BUZZING && !hasBuzzed && !isLockedOut) {
        var pads = SG.listGamepads();
        for (var i = 0; i < pads.length; i++) {
          if (SG.consumeButtonPress(pads[i].index, SG.BUTTONS.A)) {
            handleBuzz();
            SG.rumble(pads[i].index, BUZZ_RUMBLE);
            break;
          }
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function rumbleAllPads(opts) {
    var pads = SG.listGamepads();
    for (var i = 0; i < pads.length; i++) SG.rumble(pads[i].index, opts);
  }

  // ── Toast ────────────────────────────────────────────────

  var toastTimer = null;
  function showToast(msg) {
    var t = document.getElementById('gp-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  function shortPadName(id) {
    if (!id) return 'Gamepad';
    var m = id.match(/([A-Za-z0-9_ -]{3,})/);
    return m ? m[1].trim().slice(0, 28) : 'Gamepad';
  }

  // ── Lockout Listener ─────────────────────────────────────

  function listenForLockout() {
    var prevLockedOut = false;
    J.ref('rooms/' + roomCode + '/game/buzzer/lockedOut/' + playerId)
      .on('value', function (snap) {
        isLockedOut = !!snap.val();
        if (isLockedOut) {
          hasBuzzed = false;
          if (!prevLockedOut) rumbleAllPads(LOCKOUT_RUMBLE);
        }
        prevLockedOut = isLockedOut;
        // Re-evaluate buzzer if we're in an active clue state
        if (currentClueState) {
          updateBuzzerForState(currentClueState);
        }
      });
  }

  // ── Picking Player ───────────────────────────────────────

  function listenForPickingPlayer() {
    J.ref('rooms/' + roomCode + '/game/pickingPlayer').on('value', function (snap) {
      pickingPlayerId = snap.val();
      if (!currentClueState) {
        updatePickingStatus();
      }
    });
  }

  function updatePickingStatus() {
    if (!pickingPlayerId) {
      els.gameStatus.textContent = 'Waiting for host to select a clue...';
      return;
    }
    if (pickingPlayerId === playerId) {
      els.gameStatus.textContent = 'Your pick! Tell the host your choice.';
    } else {
      var name = getPlayerName(pickingPlayerId);
      els.gameStatus.textContent = name + '\u2019s pick';
    }
  }

  function getPlayerName(pid) {
    if (allPlayers[pid]) return allPlayers[pid].name;
    return 'Player';
  }

  // ── Round Listener ────────────────────────────────────────

  function listenForRound() {
    J.ref('rooms/' + roomCode + '/game/currentRound').on('value', function (snap) {
      currentRound = snap.val() || 1;
    });
  }

  // ── Daily Double ─────────────────────────────────────────

  function handleDailyDouble(clue) {
    if (pickingPlayerId === playerId) {
      handleDDAsPickingPlayer(clue);
    } else {
      handleDDAsSpectator(clue);
    }
  }

  function handleDDAsPickingPlayer(clue) {
    showPhase('phase-daily-double');

    switch (clue.state) {
      case J.CLUE_STATE.READING:
        if (!ddWagerSubmitted) {
          showDDWagerForm();
        } else {
          els.ddWagerForm.style.display = 'none';
          els.ddWaiting.style.display = '';
          els.ddWaiting.textContent = 'Waiting for host...';
          els.ddInstruction.textContent = 'Wager submitted!';
        }
        break;
      case J.CLUE_STATE.ANSWERING:
        els.ddWagerForm.style.display = 'none';
        els.ddWaiting.style.display = '';
        els.ddWaiting.textContent = 'Answer the clue out loud!';
        els.ddInstruction.textContent = clue.text;
        break;
      case J.CLUE_STATE.REVEALED:
        els.ddWagerForm.style.display = 'none';
        els.ddWaiting.style.display = '';
        els.ddWaiting.textContent = 'Answer revealed';
        els.ddInstruction.textContent = '';
        break;
    }
  }

  function handleDDAsSpectator(clue) {
    var name = getPlayerName(pickingPlayerId);
    showPhase('phase-daily-double');
    els.ddWagerForm.style.display = 'none';
    els.ddWaiting.style.display = '';
    els.ddInstruction.textContent = name + ' found the Daily Double!';

    switch (clue.state) {
      case J.CLUE_STATE.READING:
        els.ddWaiting.textContent = name + ' is wagering...';
        break;
      case J.CLUE_STATE.ANSWERING:
        els.ddWaiting.textContent = name + ' is answering...';
        break;
      case J.CLUE_STATE.REVEALED:
        els.ddWaiting.textContent = 'Answer revealed';
        break;
    }
  }

  function showDDWagerForm() {
    var limits = J.getDDWagerLimits(currentScore, currentRound);
    els.ddInstruction.textContent = 'Enter your wager';
    els.ddWagerForm.style.display = '';
    els.ddWaiting.style.display = 'none';
    els.ddWagerInput.min = limits.min;
    els.ddWagerInput.max = limits.max;
    els.ddWagerInput.value = '';
    els.ddWagerRange.textContent = '$' + limits.min + ' \u2013 $' + limits.max.toLocaleString();
    els.ddWagerBtn.disabled = true;
  }

  function validateDDWager() {
    var val = parseInt(els.ddWagerInput.value, 10);
    var limits = J.getDDWagerLimits(currentScore, currentRound);
    els.ddWagerBtn.disabled = isNaN(val) || val < limits.min || val > limits.max;
  }

  function submitDDWager() {
    var val = parseInt(els.ddWagerInput.value, 10);
    var limits = J.getDDWagerLimits(currentScore, currentRound);
    if (isNaN(val) || val < limits.min || val > limits.max) return;

    ddWagerSubmitted = true;

    J.ref('rooms/' + roomCode + '/game/dailyDouble').set({
      playerId: playerId,
      wager: val
    });

    els.ddWagerForm.style.display = 'none';
    els.ddWaiting.style.display = '';
    els.ddWaiting.textContent = 'Waiting for host...';
    els.ddInstruction.textContent = 'Wager: $' + val.toLocaleString();
  }

  // ── Final Jeopardy ────────────────────────────────────────

  function transitionToFinal() {
    finalWagerSubmitted = false;
    finalAnswerSubmitted = false;

    // Reset UI
    els.finalWagerForm.style.display = 'none';
    els.finalClueArea.style.display = 'none';
    els.finalTimer.style.display = 'none';
    els.finalAnswerForm.style.display = 'none';
    els.finalWaiting.style.display = 'none';

    // Listen for FJ state changes
    finalStateListenerRef = J.ref('rooms/' + roomCode + '/game/finalJeopardy');
    finalStateListenerRef.on('value', function (snap) {
      handleFinalStateChange(snap.val());
    });

    showPhase('phase-final');
  }

  function handleFinalStateChange(fj) {
    if (!fj) return;

    switch (fj.state) {
      case J.FINAL_STATE.CATEGORY:
        showFinalCategory(fj);
        break;
      case J.FINAL_STATE.WAGER:
        showFinalWager(fj);
        break;
      case J.FINAL_STATE.CLUE:
        showFinalClue(fj);
        break;
      case J.FINAL_STATE.ANSWER:
        showFinalAnswerWaiting();
        break;
      case J.FINAL_STATE.JUDGING:
        showFinalJudging();
        break;
    }
  }

  function showFinalCategory(fj) {
    // Category is shown via the HTML element already set by host
    els.finalWagerForm.style.display = 'none';
    els.finalWaiting.style.display = '';
    els.finalWaiting.textContent = 'The category has been revealed...';
  }

  function showFinalWager(fj) {
    // Load category name from Firebase
    J.ref('rooms/' + roomCode + '/board/final/category').once('value', function (snap) {
      els.finalCategory.textContent = snap.val() || '';
    });

    if (currentScore <= 0) {
      // Can't wager with $0 or negative score
      els.finalWagerForm.style.display = 'none';
      els.finalWaiting.style.display = '';
      els.finalWaiting.textContent = 'You cannot wager with a score of ' + J.formatScore(currentScore);
      // Auto-submit $0 wager
      if (!finalWagerSubmitted) {
        finalWagerSubmitted = true;
        J.ref('rooms/' + roomCode + '/game/finalJeopardy/wagers/' + playerId).set(0);
      }
      return;
    }

    if (finalWagerSubmitted) {
      els.finalWagerForm.style.display = 'none';
      els.finalWaiting.style.display = '';
      els.finalWaiting.textContent = 'Wager locked in. Waiting for other players...';
      return;
    }

    // Show wager form
    els.finalWagerForm.style.display = '';
    els.finalWaiting.style.display = 'none';
    els.finalWagerInput.max = currentScore;
    els.finalWagerInput.value = '';
    els.finalWagerBtn.disabled = true;
  }

  function validateFinalWager() {
    var val = parseInt(els.finalWagerInput.value, 10);
    els.finalWagerBtn.disabled = isNaN(val) || val < 0 || val > currentScore;
  }

  function submitFinalWager() {
    var val = parseInt(els.finalWagerInput.value, 10);
    if (isNaN(val) || val < 0 || val > currentScore) return;

    finalWagerSubmitted = true;
    J.ref('rooms/' + roomCode + '/game/finalJeopardy/wagers/' + playerId).set(val);

    els.finalWagerForm.style.display = 'none';
    els.finalWaiting.style.display = '';
    els.finalWaiting.textContent = 'Wager locked in. Waiting for other players...';
  }

  function showFinalClue(fj) {
    // Load clue text from Firebase
    J.ref('rooms/' + roomCode + '/board/final/clue').once('value', function (snap) {
      els.finalClueText.textContent = snap.val() || '';
    });

    els.finalWagerForm.style.display = 'none';
    els.finalClueArea.style.display = '';
    els.finalWaiting.style.display = 'none';

    if (finalAnswerSubmitted) {
      els.finalAnswerForm.style.display = 'none';
      els.finalWaiting.style.display = '';
      els.finalWaiting.textContent = 'Answer submitted. Waiting for time to expire...';
    } else {
      // Show answer form and start timer
      els.finalAnswerForm.style.display = '';
      els.finalAnswerInput.value = '';
      els.finalAnswerBtn.disabled = true;
      startFinalPlayerTimer();
    }
  }

  function startFinalPlayerTimer() {
    if (finalTimerId) return; // Don't start twice

    var durationMs = 30000;
    var startTime = Date.now();

    els.finalTimer.style.display = '';
    els.finalTimerFill.style.transition = 'none';
    els.finalTimerFill.style.width = '100%';
    els.finalTimerFill.offsetWidth; // force reflow
    els.finalTimerFill.style.transition = 'width 0.1s linear';

    finalTimerId = setInterval(function () {
      var elapsed = Date.now() - startTime;
      var remaining = Math.max(0, durationMs - elapsed);
      els.finalTimerFill.style.width = (remaining / durationMs * 100) + '%';
      if (remaining <= 0) {
        clearInterval(finalTimerId);
        finalTimerId = null;
        onFinalPlayerTimerExpired();
      }
    }, 50);
  }

  function onFinalPlayerTimerExpired() {
    els.finalTimer.style.display = 'none';
    if (!finalAnswerSubmitted) {
      // Auto-submit whatever is in the input (or empty)
      autoSubmitFinalAnswer();
    }
  }

  function autoSubmitFinalAnswer() {
    var answer = els.finalAnswerInput ? els.finalAnswerInput.value.trim() : '';
    finalAnswerSubmitted = true;
    J.ref('rooms/' + roomCode + '/game/finalJeopardy/answers/' + playerId).set(answer);

    els.finalAnswerForm.style.display = 'none';
    els.finalWaiting.style.display = '';
    els.finalWaiting.textContent = 'Time\'s up! Waiting for host...';
  }

  function validateFinalAnswer() {
    var val = els.finalAnswerInput.value.trim();
    els.finalAnswerBtn.disabled = val.length === 0;
  }

  function submitFinalAnswer() {
    var answer = els.finalAnswerInput.value.trim();
    if (!answer) return;

    finalAnswerSubmitted = true;
    J.ref('rooms/' + roomCode + '/game/finalJeopardy/answers/' + playerId).set(answer);

    els.finalAnswerForm.style.display = 'none';
    els.finalWaiting.style.display = '';
    els.finalWaiting.textContent = 'Answer submitted. Waiting for host...';
  }

  function showFinalAnswerWaiting() {
    // Time is up — if answer not yet submitted, auto-submit
    if (finalTimerId) {
      clearInterval(finalTimerId);
      finalTimerId = null;
    }
    els.finalTimer.style.display = 'none';

    if (!finalAnswerSubmitted) {
      autoSubmitFinalAnswer();
    } else {
      els.finalAnswerForm.style.display = 'none';
      els.finalWaiting.style.display = '';
      els.finalWaiting.textContent = 'Waiting for host to judge...';
    }
  }

  function showFinalJudging() {
    if (finalTimerId) {
      clearInterval(finalTimerId);
      finalTimerId = null;
    }
    els.finalTimer.style.display = 'none';
    els.finalAnswerForm.style.display = 'none';
    els.finalWaiting.style.display = '';
    els.finalWaiting.textContent = 'Host is judging answers...';
  }

  // ── Game Over ────────────────────────────────────────────

  function transitionToGameOver() {
    // Clean up Final Jeopardy state
    if (finalStateListenerRef) {
      finalStateListenerRef.off();
      finalStateListenerRef = null;
    }
    if (finalTimerId) {
      clearInterval(finalTimerId);
      finalTimerId = null;
    }

    // Show player's final score
    els.finalScoreDisplay.textContent = J.formatScore(currentScore);
    if (currentScore < 0) {
      els.finalScoreDisplay.classList.add('negative');
    } else {
      els.finalScoreDisplay.classList.remove('negative');
    }

    // Build standings from all players
    var ids = Object.keys(allPlayers);
    ids.sort(function (a, b) {
      return ((allPlayers[b] && allPlayers[b].score) || 0) -
             ((allPlayers[a] && allPlayers[a].score) || 0);
    });

    els.standingsList.innerHTML = '';
    ids.forEach(function (id, i) {
      var p = allPlayers[id];
      var row = document.createElement('div');
      row.className = 'standing-row';
      if (i === 0) row.classList.add('winner');
      if (id === playerId) row.classList.add('you');

      var rank = document.createElement('span');
      rank.className = 'standing-rank';
      rank.textContent = '#' + (i + 1);

      var name = document.createElement('span');
      name.className = 'standing-name';
      name.textContent = p.name;

      var score = document.createElement('span');
      score.className = 'standing-score';
      score.textContent = J.formatScore(p.score);

      row.appendChild(rank);
      row.appendChild(name);
      row.appendChild(score);
      els.standingsList.appendChild(row);
    });

    showPhase('phase-game-over');
  }

  // ── URL Parameters ────────────────────────────────────────

  function checkUrlParams() {
    var params = new URLSearchParams(window.location.search);
    var room = params.get('room');
    if (room) {
      els.roomCodeInput.value = room.toUpperCase().substring(0, 4);
      updateJoinButton();
    }
  }

  // ── Initialize ──────────────────────────────────────────────

  async function init() {
    cacheDom();

    // Wire up input events
    els.roomCodeInput.addEventListener('input', function () {
      els.roomCodeInput.value = els.roomCodeInput.value.toUpperCase();
      updateJoinButton();
      clearJoinError();
    });

    els.playerNameInput.addEventListener('input', function () {
      updateJoinButton();
      clearJoinError();
    });

    els.joinBtn.addEventListener('click', handleJoin);
    els.buzzerBtn.addEventListener('click', handleBuzz);
    els.ddWagerInput.addEventListener('input', validateDDWager);
    els.ddWagerBtn.addEventListener('click', submitDDWager);
    els.finalWagerInput.addEventListener('input', validateFinalWager);
    els.finalWagerBtn.addEventListener('click', submitFinalWager);
    els.finalAnswerInput.addEventListener('input', validateFinalAnswer);
    els.finalAnswerBtn.addEventListener('click', submitFinalAnswer);

    // Enter key submits join form
    els.roomCodeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !els.joinBtn.disabled) handleJoin();
    });
    els.playerNameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !els.joinBtn.disabled) handleJoin();
    });

    // Pre-fill room code from URL (?room=ABCD)
    checkUrlParams();

    // Firebase auth
    try {
      var user = await J.signInAnonymously();
      playerId = user.uid;
    } catch (err) {
      console.error('Failed to initialize player:', err);
      showJoinError('Failed to connect. Please refresh and try again.');
    }

    // Gamepad: announce connect/disconnect, poll for buzz button
    SG.init({
      onConnect: function (idx, id) { showToast('Controller connected: ' + shortPadName(id)); },
      onDisconnect: function (idx, id) { showToast('Controller ' + shortPadName(id) + ' disconnected'); }
    });
    startGamepadPolling();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
