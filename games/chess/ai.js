// Chess AI — ai.js
// Separate AI engine with difficulty-layered enhancements:
// Easy: 2 plies, material-only evaluation
// Medium: 3-4 plies with piece-square tables
// Hard: 4-5 plies with alpha-beta pruning and move ordering
// Extreme: 5-6 plies with iterative deepening, transposition table, quiescence search

(function () {
  'use strict';

  const E = window.ChessEngine;

  // ── Piece Values ──────────────────────────────────
  const PIECE_VALUE = {
    [E.W_PAWN]: 100, [E.W_KNIGHT]: 320, [E.W_BISHOP]: 330,
    [E.W_ROOK]: 500, [E.W_QUEEN]: 900, [E.W_KING]: 20000,
    [E.B_PAWN]: 100, [E.B_KNIGHT]: 320, [E.B_BISHOP]: 330,
    [E.B_ROOK]: 500, [E.B_QUEEN]: 900, [E.B_KING]: 20000
  };

  // ── Piece-Square Tables (from Black's perspective, row 0 = black's back rank) ──
  // These are for black pieces. For white, we mirror vertically.

  const PST_PAWN = [
    [  0,  0,  0,  0,  0,  0,  0,  0],
    [ 50, 50, 50, 50, 50, 50, 50, 50],
    [ 10, 10, 20, 30, 30, 20, 10, 10],
    [  5,  5, 10, 25, 25, 10,  5,  5],
    [  0,  0,  0, 20, 20,  0,  0,  0],
    [  5, -5,-10,  0,  0,-10, -5,  5],
    [  5, 10, 10,-20,-20, 10, 10,  5],
    [  0,  0,  0,  0,  0,  0,  0,  0]
  ];

  const PST_KNIGHT = [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ];

  const PST_BISHOP = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10, 10,  5, 10, 10,  5, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ];

  const PST_ROOK = [
    [  0,  0,  0,  0,  0,  0,  0,  0],
    [  5, 10, 10, 10, 10, 10, 10,  5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [  0,  0,  0,  5,  5,  0,  0,  0]
  ];

  const PST_QUEEN = [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
  ];

  const PST_KING_MID = [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20]
  ];

  const PST_MAP = {};
  PST_MAP[E.W_PAWN] = PST_PAWN;
  PST_MAP[E.W_KNIGHT] = PST_KNIGHT;
  PST_MAP[E.W_BISHOP] = PST_BISHOP;
  PST_MAP[E.W_ROOK] = PST_ROOK;
  PST_MAP[E.W_QUEEN] = PST_QUEEN;
  PST_MAP[E.W_KING] = PST_KING_MID;

  function getPST(piece, row, col) {
    const type = E.pieceType(piece);
    const table = PST_MAP[type];
    if (!table) return 0;
    if (E.isBlack(piece)) {
      return table[row][col];
    } else {
      // Mirror for white (row 7 = white's back rank)
      return table[7 - row][col];
    }
  }

  // ── Evaluation ────────────────────────────────────

  function evaluateMaterial(b) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (p === E.EMPTY) continue;
        const val = PIECE_VALUE[p] || 0;
        if (E.isBlack(p)) score += val;
        else score -= val;
      }
    }
    return score;
  }

  function evaluateWithPST(b) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (p === E.EMPTY) continue;
        const val = PIECE_VALUE[p] || 0;
        const pst = getPST(p, r, c);
        if (E.isBlack(p)) {
          score += val + pst;
        } else {
          score -= val + pst;
        }
      }
    }
    return score;
  }

  // ── Move Ordering ─────────────────────────────────

  function scoreMove(b, move) {
    let score = 0;
    const captured = b[move.to.row][move.to.col];

    // MVV-LVA: Most Valuable Victim - Least Valuable Attacker
    if (captured !== E.EMPTY) {
      const victimVal = PIECE_VALUE[captured] || 0;
      const attackerVal = PIECE_VALUE[b[move.from.row][move.from.col]] || 0;
      score += 10 * victimVal - attackerVal;
    }

    if (move.special === 'enPassant') score += 900;
    if (move.special === 'promotion') score += PIECE_VALUE[move.promoteTo] || 0;

    // Favor central moves
    const centerDist = Math.abs(move.to.row - 3.5) + Math.abs(move.to.col - 3.5);
    score += (7 - centerDist) * 2;

    return score;
  }

  function orderMoves(b, moves) {
    return moves.map(m => ({ move: m, score: scoreMove(b, m) }))
                .sort((a, b2) => b2.score - a.score)
                .map(x => x.move);
  }

  // ── Transposition Table ───────────────────────────

  const TT_SIZE = 1 << 18; // 262144 entries
  let transTable = new Array(TT_SIZE);
  const TT_EXACT = 0, TT_ALPHA = 1, TT_BETA = 2;

  function hashBoard(b, turn, cast, ep) {
    // Simple hash — not Zobrist but sufficient for vanilla JS
    let h = turn === 'black' ? 1 : 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        h = (h * 31 + b[r][c]) | 0;
      }
    }
    h = (h * 31 + (cast.wK?1:0) + (cast.wQ?2:0) + (cast.bK?4:0) + (cast.bQ?8:0)) | 0;
    if (ep) h = (h * 31 + ep.row * 8 + ep.col) | 0;
    return ((h % TT_SIZE) + TT_SIZE) % TT_SIZE;
  }

  function ttLookup(hash, depth, alpha, beta) {
    const entry = transTable[hash];
    if (!entry || entry.depth < depth) return null;

    if (entry.flag === TT_EXACT) return entry.score;
    if (entry.flag === TT_ALPHA && entry.score <= alpha) return alpha;
    if (entry.flag === TT_BETA && entry.score >= beta) return beta;
    return null;
  }

  function ttStore(hash, depth, score, flag) {
    transTable[hash] = { depth, score, flag };
  }

  // ── Quiescence Search ─────────────────────────────

  function quiescence(b, alpha, beta, side, ep, cast, depth) {
    if (depth <= -4) return evaluateWithPST(b); // Limit quiescence depth

    const standPat = evaluateWithPST(b);

    if (side === 'black') {
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;

      const moves = E.generateLegalMoves(b, side, ep, cast);
      // Only look at captures
      const captures = moves.filter(m =>
        b[m.to.row][m.to.col] !== E.EMPTY || m.special === 'enPassant' || m.special === 'promotion'
      );

      const ordered = orderMoves(b, captures);

      for (const move of ordered) {
        const nb = E.cloneBoard(b);
        const newCast = { ...cast };
        updateCastRights(newCast, move, nb);
        E.applyMoveToBoard(nb, move);
        const newEp = move.special === 'pawnDouble' ? { row: (move.from.row + move.to.row) / 2, col: move.to.col } : null;

        const score = quiescence(nb, alpha, beta, 'white', newEp, newCast, depth - 1);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }

      return alpha;
    } else {
      if (standPat <= alpha) return alpha;
      if (standPat < beta) beta = standPat;

      const moves = E.generateLegalMoves(b, side, ep, cast);
      const captures = moves.filter(m =>
        b[m.to.row][m.to.col] !== E.EMPTY || m.special === 'enPassant' || m.special === 'promotion'
      );

      const ordered = orderMoves(b, captures);

      for (const move of ordered) {
        const nb = E.cloneBoard(b);
        const newCast = { ...cast };
        updateCastRights(newCast, move, nb);
        E.applyMoveToBoard(nb, move);
        const newEp = move.special === 'pawnDouble' ? { row: (move.from.row + move.to.row) / 2, col: move.to.col } : null;

        const score = quiescence(nb, alpha, beta, 'black', newEp, newCast, depth - 1);
        if (score <= alpha) return alpha;
        if (score < beta) beta = score;
      }

      return beta;
    }
  }

  // ── Alpha-Beta Search ─────────────────────────────

  function alphaBeta(b, depth, alpha, beta, side, ep, cast, useAdvanced) {
    if (depth <= 0) {
      if (useAdvanced) {
        return quiescence(b, alpha, beta, side, ep, cast, 0);
      }
      return useAdvanced ? evaluateWithPST(b) : evaluateMaterial(b);
    }

    const hash = useAdvanced ? hashBoard(b, side, cast, ep) : 0;
    if (useAdvanced) {
      const ttResult = ttLookup(hash, depth, alpha, beta);
      if (ttResult !== null) return ttResult;
    }

    const moves = E.generateLegalMoves(b, side, ep, cast);

    if (moves.length === 0) {
      if (E.isInCheck(b, side)) {
        // Checkmate — prefer quicker mates
        return side === 'black' ? (-99999 - depth) : (99999 + depth);
      }
      return 0; // Stalemate
    }

    const ordered = useAdvanced ? orderMoves(b, moves) : moves;
    let bestScore;

    if (side === 'black') {
      bestScore = -Infinity;
      for (const move of ordered) {
        const nb = E.cloneBoard(b);
        const newCast = { ...cast };
        updateCastRights(newCast, move, nb);
        E.applyMoveToBoard(nb, move);
        const newEp = move.special === 'pawnDouble' ? { row: (move.from.row + move.to.row) / 2, col: move.to.col } : null;

        const score = alphaBeta(nb, depth - 1, alpha, beta, 'white', newEp, newCast, useAdvanced);
        if (score > bestScore) bestScore = score;
        if (score > alpha) alpha = score;
        if (alpha >= beta) break;
      }

      if (useAdvanced) {
        const flag = bestScore <= alpha ? TT_ALPHA : (bestScore >= beta ? TT_BETA : TT_EXACT);
        ttStore(hash, depth, bestScore, flag);
      }
    } else {
      bestScore = Infinity;
      for (const move of ordered) {
        const nb = E.cloneBoard(b);
        const newCast = { ...cast };
        updateCastRights(newCast, move, nb);
        E.applyMoveToBoard(nb, move);
        const newEp = move.special === 'pawnDouble' ? { row: (move.from.row + move.to.row) / 2, col: move.to.col } : null;

        const score = alphaBeta(nb, depth - 1, alpha, beta, 'black', newEp, newCast, useAdvanced);
        if (score < bestScore) bestScore = score;
        if (score < beta) beta = score;
        if (alpha >= beta) break;
      }

      if (useAdvanced) {
        const flag = bestScore >= beta ? TT_BETA : (bestScore <= alpha ? TT_ALPHA : TT_EXACT);
        ttStore(hash, depth, bestScore, flag);
      }
    }

    return bestScore;
  }

  function updateCastRights(cast, move, b) {
    const piece = b[move.from.row][move.from.col];
    if (piece === E.W_KING) { cast.wK = false; cast.wQ = false; }
    if (piece === E.B_KING) { cast.bK = false; cast.bQ = false; }
    if (move.from.row === 7 && move.from.col === 0) cast.wQ = false;
    if (move.from.row === 7 && move.from.col === 7) cast.wK = false;
    if (move.from.row === 0 && move.from.col === 0) cast.bQ = false;
    if (move.from.row === 0 && move.from.col === 7) cast.bK = false;
    if (move.to.row === 7 && move.to.col === 0) cast.wQ = false;
    if (move.to.row === 7 && move.to.col === 7) cast.wK = false;
    if (move.to.row === 0 && move.to.col === 0) cast.bQ = false;
    if (move.to.row === 0 && move.to.col === 7) cast.bK = false;
  }

  // ── Difficulty Configurations ─────────────────────

  const DIFFICULTY_CONFIG = {
    easy:    { depth: 2, usePST: false, useOrdering: false, useTT: false, useQuiescence: false },
    medium:  { depth: 3, usePST: true,  useOrdering: false, useTT: false, useQuiescence: false },
    hard:    { depth: 4, usePST: true,  useOrdering: true,  useTT: false, useQuiescence: false },
    extreme: { depth: 5, usePST: true,  useOrdering: true,  useTT: true,  useQuiescence: true  }
  };

  // ── Find Best Move ────────────────────────────────

  function findBestMove(b, difficulty, ep, cast, halfMoves, posHistory) {
    const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
    const moves = E.generateLegalMoves(b, 'black', ep, cast);

    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0];

    // Clear transposition table for new search
    if (config.useTT) {
      transTable = new Array(TT_SIZE);
    }

    const useAdvanced = config.usePST;
    let bestMove = moves[0];
    let bestScore = -Infinity;

    // For extreme, use iterative deepening
    if (difficulty === 'extreme') {
      for (let d = 1; d <= config.depth; d++) {
        let currentBest = moves[0];
        let currentBestScore = -Infinity;

        const ordered = orderMoves(b, moves);

        for (const move of ordered) {
          const nb = E.cloneBoard(b);
          const newCast = { ...cast };
          updateCastRights(newCast, move, nb);
          E.applyMoveToBoard(nb, move);
          const newEp = move.special === 'pawnDouble' ? { row: (move.from.row + move.to.row) / 2, col: move.to.col } : null;

          const score = alphaBeta(nb, d - 1, -Infinity, Infinity, 'white', newEp, newCast, true);
          if (score > currentBestScore) {
            currentBestScore = score;
            currentBest = move;
          }
        }

        bestMove = currentBest;
        bestScore = currentBestScore;
      }
    } else {
      const ordered = config.useOrdering ? orderMoves(b, moves) : moves;

      for (const move of ordered) {
        const nb = E.cloneBoard(b);
        const newCast = { ...cast };
        updateCastRights(newCast, move, nb);
        E.applyMoveToBoard(nb, move);
        const newEp = move.special === 'pawnDouble' ? { row: (move.from.row + move.to.row) / 2, col: move.to.col } : null;

        const score = alphaBeta(nb, config.depth - 1, -Infinity, Infinity, 'white', newEp, newCast, useAdvanced);
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
    }

    return bestMove;
  }

  // ── Expose ────────────────────────────────────────
  window.ChessAI = { findBestMove };
})();
