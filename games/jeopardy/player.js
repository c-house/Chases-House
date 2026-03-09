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
      renderPlayerList(snap.val() || {});
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
    showPhase('phase-playing');
    els.gameStatus.textContent = 'Waiting for host to select a clue...';
  }

  function listenForScore() {
    J.ref('rooms/' + roomCode + '/players/' + playerId + '/score')
      .on('value', function (snap) {
        updateScoreDisplay(snap.val() || 0);
      });
  }

  function updateScoreDisplay(score) {
    var formatted = '$' + Math.abs(score).toLocaleString();
    if (score < 0) formatted = '-' + formatted;
    els.playerScoreValue.textContent = formatted;
    els.playerScoreValue.classList.toggle('negative', score < 0);
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
