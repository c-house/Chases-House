/* ═══════════════════════════════════════════════════════════════
   Jeopardy — shared.js
   Firebase init, room management, board validation, constants.
   Exposes window.Jeopardy for use by host.js, player.js, builder.js.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

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
  const CLAIM_TOKEN_BYTES = 4; // 8 hex chars

  // ── Pure Helpers ─────────────────────────────────────────────
  // Used by control.js and player.js — extracted from prior duplicates
  // so the rules live in one place.

  function isRoundComplete(boardState) {
    if (!boardState || !boardState.categories) return false;
    var cats = boardState.categories;
    for (var c = 0; c < cats.length; c++) {
      for (var r = 0; r < cats[c].clues.length; r++) {
        if (!cats[c].clues[r].asked) return false;
      }
    }
    return true;
  }

  function formatScore(n) {
    n = n || 0;
    if (n < 0) return '-$' + Math.abs(n).toLocaleString();
    return '$' + n.toLocaleString();
  }

  /**
   * Min/max wager for a Daily Double: min $5, max = greater of the player's
   * current score or the highest clue value in the round (matches real show).
   */
  function getDDWagerLimits(score, round) {
    var roundValues = ROUND_VALUES[round];
    var maxClueValue = roundValues ? roundValues[roundValues.length - 1] : 1000;
    return { min: 5, max: Math.max(score || 0, maxClueValue) };
  }

  // ── Claim Token ──────────────────────────────────────────────
  // Random 8-hex token embedded in the host control QR. Anyone with the
  // URL can claim, but a 4-letter room code × 16⁸ token = unguessable in a
  // party-game threat model.

  function generateClaimToken() {
    var bytes = new Uint8Array(CLAIM_TOKEN_BYTES);
    crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  // ── Firebase Init ─────────────────────────────────────────────
  // Delegates to SharedFirebase (games/shared/firebase.js). Function
  // names are preserved for callers that import them off window.Jeopardy.

  function initFirebase() {
    window.SharedFirebase.init();
  }

  function signInAnonymously() {
    return window.SharedFirebase.signInAnonymously();
  }

  function ref(path) {
    return window.SharedFirebase.ref(path);
  }

  function serverTimestamp() {
    return window.SharedFirebase.serverTimestamp();
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
      const snap = await ref('rooms/' + code + '/meta').once('value');
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
  /**
   * Create a room shell. With ADR-026 the host TV creates the room with
   * empty board + default config; control.html (host phone) writes the
   * real config + board after claim. boardData/config args remain for
   * back-compat callers but may be omitted.
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
        config: mergedConfig,
        control: {
          claimToken: generateClaimToken(),
          claimedBy: null,
          claimedAt: null
        }
      },
      board: boardData ? buildBoardData(boardData, mergedConfig) : null,
      game: {
        currentRound: 1,
        pickingPlayer: null,
        currentClue: null
      }
    };

    await ref('rooms/' + roomCode).set(roomData);
    return roomCode;
  }

  /**
   * Control claim flow. Called from control.html after scanning the host QR.
   * Returns a promise resolving to:
   *   { ok: true, mine: true }   — claim is now ours (or was already)
   *   { ok: false, reason: 'claimed-by-other' | 'invalid-token' | 'no-room' }
   */
  async function claimControl(roomCode, providedToken, myUid) {
    initFirebase();
    var snap = await ref('rooms/' + roomCode + '/meta/control').once('value');
    var control = snap.val();
    if (!control) return { ok: false, reason: 'no-room' };
    if (control.claimedBy && control.claimedBy === myUid) {
      return { ok: true, mine: true }; // re-entrant claim (page reload)
    }
    if (control.claimedBy && control.claimedBy !== myUid) {
      return { ok: false, reason: 'claimed-by-other' };
    }
    if (!providedToken || providedToken !== control.claimToken) {
      return { ok: false, reason: 'invalid-token' };
    }
    await ref('rooms/' + roomCode + '/meta/control').update({
      claimedBy: myUid,
      claimedAt: serverTimestamp()
    });
    return { ok: true, mine: true };
  }

  /**
   * Reset host control. Called from host.html?reset=1 by the TV operator.
   * Regenerates the claim token and clears claimedBy. Only the TV's UID
   * (meta/hostId) can perform this write per Firebase rules.
   */
  async function resetControl(roomCode) {
    initFirebase();
    await ref('rooms/' + roomCode + '/meta/control').set({
      claimToken: generateClaimToken(),
      claimedBy: null,
      claimedAt: null
    });
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
    const metaSnap = await ref('rooms/' + roomCode + '/meta').once('value');
    if (!metaSnap.exists()) {
      throw new Error('Room not found.');
    }
    const meta = metaSnap.val();

    // Check if this player already exists in the room (rejoin case)
    const playerSnap = await ref('rooms/' + roomCode + '/players/' + playerId).once('value');
    if (playerSnap.exists()) {
      // Rejoin: restore connection, update name if changed
      await ref('rooms/' + roomCode + '/players/' + playerId).update({
        name: playerName,
        connected: true
      });
    } else {
      // New join: room must be in lobby
      if (meta.status !== STATUS.LOBBY) {
        throw new Error('Game has already started.');
      }
      await ref('rooms/' + roomCode + '/players/' + playerId).set({
        name: playerName,
        score: 0,
        connected: true,
        joinedAt: serverTimestamp()
      });
    }

    // Set onDisconnect to mark player as disconnected
    ref('rooms/' + roomCode + '/players/' + playerId + '/connected')
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
    await ref('rooms/' + roomCode + '/players/' + playerId).remove();
  }

  /**
   * Add a player record directly. Skips the lobby/auth-uid checks in joinRoom
   * so the host can add hot-seat players (using synthetic IDs) at any time.
   * @param {string} roomCode
   * @param {string} playerId
   * @param {string} playerName
   * @returns {Promise<void>}
   */
  async function joinRoomDirect(roomCode, playerId, playerName) {
    initFirebase();
    const playerRef = ref('rooms/' + roomCode + '/players/' + playerId);
    await playerRef.set({
      name: playerName,
      score: 0,
      connected: true,
      joinedAt: serverTimestamp()
    });
    ref('rooms/' + roomCode + '/players/' + playerId + '/connected')
      .onDisconnect().set(false);
  }

  /**
   * Write a buzz timestamp for a player.
   * @param {string} roomCode
   * @param {string} playerId
   * @returns {Promise<void>}
   */
  function writeBuzz(roomCode, playerId) {
    initFirebase();
    return ref('rooms/' + roomCode + '/game/buzzer/buzzedPlayers/' + playerId)
      .set(serverTimestamp());
  }

  /**
   * Probe whether the current user can write to a non-self playerId path.
   * Used by hot-seat mode to detect Firebase rules misconfigurations at the
   * moment a feature is used, rather than failing silently mid-game.
   * Resolves on success, rejects with the Firebase error on permission_denied.
   * @param {string} roomCode
   * @param {string} playerId
   * @returns {Promise<void>}
   */
  function probeWritePermission(roomCode, playerId) {
    initFirebase();
    const probeRef = ref('rooms/' + roomCode + '/players/' + playerId + '/_probe');
    return probeRef.set(true).then(function () { return probeRef.remove(); });
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
    joinRoomDirect: joinRoomDirect,
    leaveRoom: leaveRoom,
    writeBuzz: writeBuzz,
    probeWritePermission: probeWritePermission,

    // Host control claim (ADR-026)
    claimControl: claimControl,
    resetControl: resetControl,
    generateClaimToken: generateClaimToken,

    // Pure helpers (used across host/control/player)
    isRoundComplete: isRoundComplete,
    formatScore: formatScore,
    getDDWagerLimits: getDDWagerLimits,

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
