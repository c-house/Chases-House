/* ═══════════════════════════════════════════════════════════════
   Jeopardy — player.js
   Player game logic: join, buzzer, wagers, Final Jeopardy answers.
   Depends on shared.js (window.Jeopardy).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var J = window.Jeopardy;

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

    if (status === J.STATUS.PLAYING) {
      transitionToPlaying();
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

    J.ref('rooms/' + roomCode + '/game/buzzer/buzzedPlayers/' + playerId)
      .set(J.serverTimestamp());

    setBuzzerBuzzed();
    els.gameStatus.textContent = 'Waiting for host...';
  }

  // ── Lockout Listener ─────────────────────────────────────

  function listenForLockout() {
    J.ref('rooms/' + roomCode + '/game/buzzer/lockedOut/' + playerId)
      .on('value', function (snap) {
        isLockedOut = !!snap.val();
        if (isLockedOut) {
          hasBuzzed = false;
        }
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
    var limits = getDDWagerLimits();
    els.ddInstruction.textContent = 'Enter your wager';
    els.ddWagerForm.style.display = '';
    els.ddWaiting.style.display = 'none';
    els.ddWagerInput.min = limits.min;
    els.ddWagerInput.max = limits.max;
    els.ddWagerInput.value = '';
    els.ddWagerRange.textContent = '$' + limits.min + ' \u2013 $' + limits.max.toLocaleString();
    els.ddWagerBtn.disabled = true;
  }

  function getDDWagerLimits() {
    var roundValues = J.ROUND_VALUES[currentRound];
    var maxClueValue = roundValues ? roundValues[roundValues.length - 1] : 1000;
    return {
      min: 5,
      max: Math.max(currentScore, maxClueValue)
    };
  }

  function validateDDWager() {
    var val = parseInt(els.ddWagerInput.value, 10);
    var limits = getDDWagerLimits();
    els.ddWagerBtn.disabled = isNaN(val) || val < limits.min || val > limits.max;
  }

  function submitDDWager() {
    var val = parseInt(els.ddWagerInput.value, 10);
    var limits = getDDWagerLimits();
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
