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
      var config = readConfig();

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

      // Transition to board phase (will be handled by JP-008)
      showPhase('phase-board');
    } catch (err) {
      console.error('Failed to start game:', err);
      els.startGameBtn.disabled = false;
      els.startGameBtn.textContent = 'Start Game';
    }
  }

  // ── Initialize ──────────────────────────────────────────────

  async function init() {
    cacheDom();
    loadBoards();

    // Wire up events
    els.boardSelector.addEventListener('change', onBoardChange);
    els.startGameBtn.addEventListener('click', startGame);

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
