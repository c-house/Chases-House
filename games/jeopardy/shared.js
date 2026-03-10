/* ═══════════════════════════════════════════════════════════════
   Jeopardy — shared.js
   Firebase init, room management, board validation, constants.
   Exposes window.Jeopardy for use by host.js, player.js, builder.js.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Firebase Config (public client-side identifiers) ──────────
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx',
    authDomain: 'chases-house.firebaseapp.com',
    databaseURL: 'https://chases-house-default-rtdb.firebaseio.com',
    projectId: 'chases-house',
    storageBucket: 'chases-house.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000'
  };

  // ── Constants ─────────────────────────────────────────────────

  /** Top-level room status values (meta/status) */
  const STATUS = Object.freeze({
    LOBBY: 'lobby',
    PLAYING: 'playing',
    FINAL: 'final',
    ENDED: 'ended',
    PAUSED: 'paused'
  });

  /** Per-clue state values (game/currentClue/state) */
  const CLUE_STATE = Object.freeze({
    PICKING: 'picking',
    READING: 'reading',
    BUZZING: 'buzzing',
    ANSWERING: 'answering',
    JUDGING: 'judging',
    REVEALED: 'revealed'
  });

  /** Final Jeopardy sub-states */
  const FINAL_STATE = Object.freeze({
    CATEGORY: 'category',
    WAGER: 'wager',
    CLUE: 'clue',
    ANSWER: 'answer',
    JUDGING: 'judging'
  });

  /** Default config applied when creating a room */
  const DEFAULT_CONFIG = Object.freeze({
    enableDailyDoubles: true,
    enableDoubleJeopardy: true,
    enableFinalJeopardy: true,
    buzzWindowMs: 5000
  });

  /** Dollar values per round */
  const ROUND_VALUES = Object.freeze({
    1: [200, 400, 600, 800, 1000],
    2: [400, 800, 1200, 1600, 2000]
  });

  const CATEGORIES_PER_ROUND = 6;
  const CLUES_PER_CATEGORY = 5;
  const ROOM_CODE_LENGTH = 4;

  // ── Firebase Init ─────────────────────────────────────────────

  let app = null;
  let db = null;
  let auth = null;

  function initFirebase() {
    if (app) return;
    if (typeof firebase === 'undefined') {
      console.error('Jeopardy: Firebase SDK not loaded. Include firebase-app-compat and firebase-database-compat via CDN.');
      return;
    }
    if (!firebase.apps.length) {
      app = firebase.initializeApp(FIREBASE_CONFIG);
    } else {
      app = firebase.apps[0];
    }
    db = firebase.database();
    auth = firebase.auth();
  }

  /**
   * Sign in anonymously. Returns the Firebase user object.
   * @returns {Promise<firebase.User>}
   */
  async function signInAnonymously() {
    initFirebase();
    const cred = await auth.signInAnonymously();
    return cred.user;
  }

  /**
   * Get a Firebase database reference.
   * @param {string} path
   * @returns {firebase.database.Reference}
   */
  function ref(path) {
    initFirebase();
    return db.ref(path);
  }

  /**
   * Get the Firebase server timestamp sentinel.
   * @returns {object}
   */
  function serverTimestamp() {
    return firebase.database.ServerValue.TIMESTAMP;
  }

  // ── Room Code Generation ──────────────────────────────────────

  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // omit I, O to avoid confusion

  function generateCode() {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    }
    return code;
  }

  /**
   * Generate a unique 4-letter room code, checking Firebase for collisions.
   * @returns {Promise<string>}
   */
  async function generateRoomCode() {
    initFirebase();
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      const code = generateCode();
      const snap = await db.ref('rooms/' + code + '/meta').once('value');
      if (!snap.exists()) return code;
    }
    throw new Error('Could not generate a unique room code after ' + maxAttempts + ' attempts.');
  }

  // ── Room Management ───────────────────────────────────────────

  /**
   * Create a new room in Firebase.
   * @param {string} hostId - Firebase anonymous UID of the host
   * @param {object} boardData - Full board JSON matching the ADR schema
   * @param {object} [config] - Optional rule overrides (merged with DEFAULT_CONFIG)
   * @returns {Promise<string>} The 4-letter room code
   */
  async function createRoom(hostId, boardData, config) {
    initFirebase();
    const roomCode = await generateRoomCode();
    const mergedConfig = Object.assign({}, DEFAULT_CONFIG, config || {});

    const roomData = {
      meta: {
        hostId: hostId,
        status: STATUS.LOBBY,
        createdAt: serverTimestamp(),
        config: mergedConfig
      },
      board: buildBoardData(boardData, mergedConfig),
      game: {
        currentRound: 1,
        pickingPlayer: null,
        currentClue: null
      }
    };

    await db.ref('rooms/' + roomCode).set(roomData);
    return roomCode;
  }

  /**
   * Transform raw board JSON into the Firebase board structure.
   * Copies rounds and final into the expected shape.
   */
  function buildBoardData(boardData, config) {
    const result = {};

    // Round 1 — always present
    if (boardData.rounds && boardData.rounds[0]) {
      result.round1 = {
        categories: boardData.rounds[0].categories.map(function (cat) {
          return {
            name: cat.name,
            clues: cat.clues.map(function (c) {
              return {
                value: c.value,
                clue: c.clue,
                answer: c.answer,
                asked: false,
                dailyDouble: false
              };
            })
          };
        })
      };
    }

    // Round 2 — only if enabled and present
    if (config.enableDoubleJeopardy && boardData.rounds && boardData.rounds[1]) {
      result.round2 = {
        categories: boardData.rounds[1].categories.map(function (cat) {
          return {
            name: cat.name,
            clues: cat.clues.map(function (c) {
              return {
                value: c.value,
                clue: c.clue,
                answer: c.answer,
                asked: false,
                dailyDouble: false
              };
            })
          };
        })
      };
    }

    // Final Jeopardy
    if (config.enableFinalJeopardy && boardData.final) {
      result.final = {
        category: boardData.final.category,
        clue: boardData.final.clue,
        answer: boardData.final.answer
      };
    }

    return result;
  }

  /**
   * Join a room as a player.
   * @param {string} roomCode - 4-letter room code
   * @param {string} playerId - Firebase anonymous UID
   * @param {string} playerName - Display name chosen by player
   * @returns {Promise<void>}
   */
  async function joinRoom(roomCode, playerId, playerName) {
    initFirebase();

    // Verify room exists
    const metaSnap = await db.ref('rooms/' + roomCode + '/meta').once('value');
    if (!metaSnap.exists()) {
      throw new Error('Room not found.');
    }
    const meta = metaSnap.val();

    // Check if this player already exists in the room (rejoin case)
    const playerSnap = await db.ref('rooms/' + roomCode + '/players/' + playerId).once('value');
    if (playerSnap.exists()) {
      // Rejoin: restore connection, update name if changed
      await db.ref('rooms/' + roomCode + '/players/' + playerId).update({
        name: playerName,
        connected: true
      });
    } else {
      // New join: room must be in lobby
      if (meta.status !== STATUS.LOBBY) {
        throw new Error('Game has already started.');
      }
      await db.ref('rooms/' + roomCode + '/players/' + playerId).set({
        name: playerName,
        score: 0,
        connected: true,
        joinedAt: serverTimestamp()
      });
    }

    // Set onDisconnect to mark player as disconnected
    db.ref('rooms/' + roomCode + '/players/' + playerId + '/connected')
      .onDisconnect().set(false);
  }

  /**
   * Remove a player from a room.
   * @param {string} roomCode
   * @param {string} playerId
   * @returns {Promise<void>}
   */
  async function leaveRoom(roomCode, playerId) {
    initFirebase();
    await db.ref('rooms/' + roomCode + '/players/' + playerId).remove();
  }

  // ── Board Validation ──────────────────────────────────────────

  /**
   * Validate board JSON against the ADR-011 schema.
   * @param {object} board - Parsed board JSON
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validateBoard(board) {
    var errors = [];

    if (!board || typeof board !== 'object') {
      return { valid: false, errors: ['Board data must be an object.'] };
    }

    if (!board.title || typeof board.title !== 'string') {
      errors.push('Board must have a title (string).');
    }

    if (!Array.isArray(board.rounds) || board.rounds.length < 1 || board.rounds.length > 2) {
      errors.push('Board must have 1 or 2 rounds.');
      return { valid: false, errors: errors };
    }

    board.rounds.forEach(function (round, ri) {
      var roundLabel = 'Round ' + (ri + 1);
      var expectedValues = ROUND_VALUES[ri + 1];

      if (!Array.isArray(round.categories)) {
        errors.push(roundLabel + ': categories must be an array.');
        return;
      }

      if (round.categories.length !== CATEGORIES_PER_ROUND) {
        errors.push(roundLabel + ': must have exactly ' + CATEGORIES_PER_ROUND + ' categories (found ' + round.categories.length + ').');
      }

      round.categories.forEach(function (cat, ci) {
        var catLabel = roundLabel + ', Category ' + (ci + 1);

        if (!cat.name || typeof cat.name !== 'string') {
          errors.push(catLabel + ': must have a name (string).');
        }

        if (!Array.isArray(cat.clues)) {
          errors.push(catLabel + ': clues must be an array.');
          return;
        }

        if (cat.clues.length !== CLUES_PER_CATEGORY) {
          errors.push(catLabel + ': must have exactly ' + CLUES_PER_CATEGORY + ' clues (found ' + cat.clues.length + ').');
        }

        cat.clues.forEach(function (clue, ki) {
          var clueLabel = catLabel + ', Clue ' + (ki + 1);

          if (typeof clue.value !== 'number') {
            errors.push(clueLabel + ': value must be a number.');
          } else if (expectedValues && clue.value !== expectedValues[ki]) {
            errors.push(clueLabel + ': value should be $' + expectedValues[ki] + ' (found $' + clue.value + ').');
          }

          if (!clue.clue || typeof clue.clue !== 'string') {
            errors.push(clueLabel + ': must have clue text (string).');
          }

          if (!clue.answer || typeof clue.answer !== 'string') {
            errors.push(clueLabel + ': must have an answer (string).');
          }
        });
      });

      if (typeof round.dailyDoubles !== 'number' || round.dailyDoubles < 0) {
        errors.push(roundLabel + ': dailyDoubles must be a non-negative number.');
      }
    });

    // Final Jeopardy — required field in schema
    if (board.final) {
      if (!board.final.category || typeof board.final.category !== 'string') {
        errors.push('Final Jeopardy: must have a category (string).');
      }
      if (!board.final.clue || typeof board.final.clue !== 'string') {
        errors.push('Final Jeopardy: must have clue text (string).');
      }
      if (!board.final.answer || typeof board.final.answer !== 'string') {
        errors.push('Final Jeopardy: must have an answer (string).');
      }
    } else {
      errors.push('Board must include a "final" section for Final Jeopardy.');
    }

    return { valid: errors.length === 0, errors: errors };
  }

  // ── Expose Public API ─────────────────────────────────────────

  window.Jeopardy = {
    // Firebase helpers
    initFirebase: initFirebase,
    signInAnonymously: signInAnonymously,
    ref: ref,
    serverTimestamp: serverTimestamp,

    // Room management
    createRoom: createRoom,
    joinRoom: joinRoom,
    leaveRoom: leaveRoom,

    // Board utilities
    validateBoard: validateBoard,
    buildBoardData: buildBoardData,

    // Constants
    STATUS: STATUS,
    CLUE_STATE: CLUE_STATE,
    FINAL_STATE: FINAL_STATE,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    ROUND_VALUES: ROUND_VALUES,
    CATEGORIES_PER_ROUND: CATEGORIES_PER_ROUND,
    CLUES_PER_CATEGORY: CLUES_PER_CATEGORY
  };
})();
