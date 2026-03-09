// Chess — game.js
// Player = White (bottom), AI = Black (top)
// Full rules: all piece movement, castling, en passant, pawn promotion,
// fifty-move rule, threefold repetition, stalemate, check, checkmate.

(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────
  const EMPTY = 0;
  const W_PAWN = 1, W_KNIGHT = 2, W_BISHOP = 3, W_ROOK = 4, W_QUEEN = 5, W_KING = 6;
  const B_PAWN = 7, B_KNIGHT = 8, B_BISHOP = 9, B_ROOK = 10, B_QUEEN = 11, B_KING = 12;

  const PIECE_SYMBOLS = {
    [W_KING]: '\u2654', [W_QUEEN]: '\u2655', [W_ROOK]: '\u2656',
    [W_BISHOP]: '\u2657', [W_KNIGHT]: '\u2658', [W_PAWN]: '\u2659',
    [B_KING]: '\u265A', [B_QUEEN]: '\u265B', [B_ROOK]: '\u265C',
    [B_BISHOP]: '\u265D', [B_KNIGHT]: '\u265E', [B_PAWN]: '\u265F'
  };

  const PIECE_NAMES = {
    [W_PAWN]: '', [W_KNIGHT]: 'N', [W_BISHOP]: 'B', [W_ROOK]: 'R', [W_QUEEN]: 'Q', [W_KING]: 'K',
    [B_PAWN]: '', [B_KNIGHT]: 'N', [B_BISHOP]: 'B', [B_ROOK]: 'R', [B_QUEEN]: 'Q', [B_KING]: 'K'
  };

  const FILES = 'abcdefgh';

  // ── State ─────────────────────────────────────────
  let board = [];
  let difficulty = 'medium';
  let gameOver = false;
  let selectedSquare = null;     // { row, col }
  let validMoves = [];           // [{ row, col, special }]
  let currentTurn = 'white';     // 'white' | 'black'
  let lastMove = null;           // { from, to, piece, captured, special }
  let moveHistory = [];          // algebraic notation strings
  let halfMoveClock = 0;         // for fifty-move rule
  let positionHistory = [];      // for threefold repetition

  // Castling rights
  let castling = { wK: true, wQ: true, bK: true, bQ: true };

  // En passant target square (the square a pawn skipped over)
  let enPassantTarget = null;    // { row, col } or null

  // Promotion state
  let pendingPromotion = null;   // { from, to } or null

  // DOM refs
  const boardEl = document.getElementById('board');
  const statusText = document.querySelector('.status-text');
  const newGameBtn = document.querySelector('.new-game-btn');
  const difficultyBtns = document.querySelectorAll('.difficulty-btn');
  const moveListEl = document.getElementById('moveList');
  const promotionOverlay = document.getElementById('promotionOverlay');
  const promotionPieces = document.getElementById('promotionPieces');

  // ── Initialization ────────────────────────────────

  function createInitialBoard() {
    return [
      [B_ROOK, B_KNIGHT, B_BISHOP, B_QUEEN, B_KING, B_BISHOP, B_KNIGHT, B_ROOK],
      [B_PAWN, B_PAWN,   B_PAWN,   B_PAWN,  B_PAWN, B_PAWN,   B_PAWN,   B_PAWN],
      [EMPTY,  EMPTY,    EMPTY,    EMPTY,   EMPTY,  EMPTY,    EMPTY,    EMPTY],
      [EMPTY,  EMPTY,    EMPTY,    EMPTY,   EMPTY,  EMPTY,    EMPTY,    EMPTY],
      [EMPTY,  EMPTY,    EMPTY,    EMPTY,   EMPTY,  EMPTY,    EMPTY,    EMPTY],
      [EMPTY,  EMPTY,    EMPTY,    EMPTY,   EMPTY,  EMPTY,    EMPTY,    EMPTY],
      [W_PAWN, W_PAWN,   W_PAWN,   W_PAWN,  W_PAWN, W_PAWN,   W_PAWN,   W_PAWN],
      [W_ROOK, W_KNIGHT, W_BISHOP, W_QUEEN, W_KING, W_BISHOP, W_KNIGHT, W_ROOK]
    ];
  }

  function init() {
    board = createInitialBoard();
    gameOver = false;
    selectedSquare = null;
    validMoves = [];
    currentTurn = 'white';
    lastMove = null;
    moveHistory = [];
    halfMoveClock = 0;
    positionHistory = [];
    castling = { wK: true, wQ: true, bK: true, bQ: true };
    enPassantTarget = null;
    pendingPromotion = null;
    promotionOverlay.classList.remove('active');

    recordPosition();
    renderBoard();
    renderMoveHistory();
    setStatus('Your turn — <span class="highlight">select a piece</span>');

    newGameBtn.addEventListener('click', resetGame);
    difficultyBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        difficulty = this.dataset.difficulty;
        difficultyBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        resetGame();
      });
    });
  }

  function resetGame() {
    board = createInitialBoard();
    gameOver = false;
    selectedSquare = null;
    validMoves = [];
    currentTurn = 'white';
    lastMove = null;
    moveHistory = [];
    halfMoveClock = 0;
    positionHistory = [];
    castling = { wK: true, wQ: true, bK: true, bQ: true };
    enPassantTarget = null;
    pendingPromotion = null;
    promotionOverlay.classList.remove('active');

    recordPosition();
    renderBoard();
    renderMoveHistory();
    setStatus('Your turn — <span class="highlight">select a piece</span>');
  }

  // ── Piece Helpers ─────────────────────────────────

  function isWhite(p) { return p >= W_PAWN && p <= W_KING; }
  function isBlack(p) { return p >= B_PAWN && p <= B_KING; }
  function isOwn(p, side) { return side === 'white' ? isWhite(p) : isBlack(p); }
  function isEnemy(p, side) { return side === 'white' ? isBlack(p) : isWhite(p); }
  function pieceColor(p) { return p === EMPTY ? null : (isWhite(p) ? 'white' : 'black'); }
  function pieceType(p) {
    if (p === EMPTY) return null;
    // Normalize to white piece type
    return isWhite(p) ? p : p - 6;
  }

  function findKing(b, side) {
    const king = side === 'white' ? W_KING : B_KING;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (b[r][c] === king) return { row: r, col: c };
      }
    }
    return null;
  }

  // ── Attack / Check Detection ──────────────────────

  function isSquareAttacked(b, row, col, byColor) {
    // Check if square (row, col) is attacked by any piece of byColor

    // Knight attacks
    const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    const enemyKnight = byColor === 'white' ? W_KNIGHT : B_KNIGHT;
    for (const [dr, dc] of knightMoves) {
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r][c] === enemyKnight) return true;
    }

    // King attacks
    const enemyKing = byColor === 'white' ? W_KING : B_KING;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r][c] === enemyKing) return true;
      }
    }

    // Pawn attacks
    const enemyPawn = byColor === 'white' ? W_PAWN : B_PAWN;
    const pawnDir = byColor === 'white' ? 1 : -1; // Direction pawns of byColor attack FROM
    const pr = row + pawnDir;
    if (pr >= 0 && pr < 8) {
      if (col - 1 >= 0 && b[pr][col - 1] === enemyPawn) return true;
      if (col + 1 < 8 && b[pr][col + 1] === enemyPawn) return true;
    }

    // Rook/Queen (straight lines)
    const enemyRook = byColor === 'white' ? W_ROOK : B_ROOK;
    const enemyQueen = byColor === 'white' ? W_QUEEN : B_QUEEN;
    const straightDirs = [[0,1],[0,-1],[1,0],[-1,0]];
    for (const [dr, dc] of straightDirs) {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (b[r][c] !== EMPTY) {
          if (b[r][c] === enemyRook || b[r][c] === enemyQueen) return true;
          break;
        }
        r += dr; c += dc;
      }
    }

    // Bishop/Queen (diagonals)
    const enemyBishop = byColor === 'white' ? W_BISHOP : B_BISHOP;
    const diagDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dr, dc] of diagDirs) {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (b[r][c] !== EMPTY) {
          if (b[r][c] === enemyBishop || b[r][c] === enemyQueen) return true;
          break;
        }
        r += dr; c += dc;
      }
    }

    return false;
  }

  function isInCheck(b, side) {
    const king = findKing(b, side);
    if (!king) return false;
    const attacker = side === 'white' ? 'black' : 'white';
    return isSquareAttacked(b, king.row, king.col, attacker);
  }

  // ── Move Generation ───────────────────────────────

  function generatePseudoLegalMoves(b, side, epTarget, cast) {
    const moves = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!isOwn(p, side)) continue;
        const type = pieceType(p);

        if (type === W_PAWN) {
          const dir = side === 'white' ? -1 : 1;
          const startRow = side === 'white' ? 6 : 1;
          const promoRow = side === 'white' ? 0 : 7;

          // Forward one
          const nr = r + dir;
          if (nr >= 0 && nr < 8 && b[nr][c] === EMPTY) {
            if (nr === promoRow) {
              const promos = side === 'white' ? [W_QUEEN, W_ROOK, W_BISHOP, W_KNIGHT] : [B_QUEEN, B_ROOK, B_BISHOP, B_KNIGHT];
              for (const pp of promos) {
                moves.push({ from: {row:r, col:c}, to: {row:nr, col:c}, special: 'promotion', promoteTo: pp });
              }
            } else {
              moves.push({ from: {row:r, col:c}, to: {row:nr, col:c} });
              // Forward two from start
              const nr2 = r + 2 * dir;
              if (r === startRow && b[nr2][c] === EMPTY) {
                moves.push({ from: {row:r, col:c}, to: {row:nr2, col:c}, special: 'pawnDouble' });
              }
            }
          }

          // Captures
          for (const dc of [-1, 1]) {
            const nc = c + dc;
            if (nc < 0 || nc >= 8 || nr < 0 || nr >= 8) continue;
            if (isEnemy(b[nr][nc], side)) {
              if (nr === promoRow) {
                const promos = side === 'white' ? [W_QUEEN, W_ROOK, W_BISHOP, W_KNIGHT] : [B_QUEEN, B_ROOK, B_BISHOP, B_KNIGHT];
                for (const pp of promos) {
                  moves.push({ from: {row:r, col:c}, to: {row:nr, col:nc}, special: 'promotion', promoteTo: pp });
                }
              } else {
                moves.push({ from: {row:r, col:c}, to: {row:nr, col:nc} });
              }
            }
            // En passant
            if (epTarget && epTarget.row === nr && epTarget.col === nc) {
              moves.push({ from: {row:r, col:c}, to: {row:nr, col:nc}, special: 'enPassant' });
            }
          }
        }

        else if (type === W_KNIGHT) {
          for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
            if (!isOwn(b[nr][nc], side)) {
              moves.push({ from: {row:r, col:c}, to: {row:nr, col:nc} });
            }
          }
        }

        else if (type === W_BISHOP || type === W_ROOK || type === W_QUEEN) {
          const dirs = [];
          if (type === W_BISHOP || type === W_QUEEN) dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
          if (type === W_ROOK || type === W_QUEEN) dirs.push([0,1],[0,-1],[1,0],[-1,0]);
          for (const [dr, dc] of dirs) {
            let nr = r + dr, nc = c + dc;
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
              if (isOwn(b[nr][nc], side)) break;
              moves.push({ from: {row:r, col:c}, to: {row:nr, col:nc} });
              if (isEnemy(b[nr][nc], side)) break;
              nr += dr; nc += dc;
            }
          }
        }

        else if (type === W_KING) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr, nc = c + dc;
              if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
              if (!isOwn(b[nr][nc], side)) {
                moves.push({ from: {row:r, col:c}, to: {row:nr, col:nc} });
              }
            }
          }

          // Castling
          const opponent = side === 'white' ? 'black' : 'white';
          if (side === 'white' && r === 7 && c === 4) {
            // Kingside
            if (cast.wK && b[7][5] === EMPTY && b[7][6] === EMPTY && b[7][7] === W_ROOK &&
                !isSquareAttacked(b, 7, 4, opponent) &&
                !isSquareAttacked(b, 7, 5, opponent) &&
                !isSquareAttacked(b, 7, 6, opponent)) {
              moves.push({ from: {row:7, col:4}, to: {row:7, col:6}, special: 'castleK' });
            }
            // Queenside
            if (cast.wQ && b[7][3] === EMPTY && b[7][2] === EMPTY && b[7][1] === EMPTY && b[7][0] === W_ROOK &&
                !isSquareAttacked(b, 7, 4, opponent) &&
                !isSquareAttacked(b, 7, 3, opponent) &&
                !isSquareAttacked(b, 7, 2, opponent)) {
              moves.push({ from: {row:7, col:4}, to: {row:7, col:2}, special: 'castleQ' });
            }
          }
          if (side === 'black' && r === 0 && c === 4) {
            if (cast.bK && b[0][5] === EMPTY && b[0][6] === EMPTY && b[0][7] === B_ROOK &&
                !isSquareAttacked(b, 0, 4, opponent) &&
                !isSquareAttacked(b, 0, 5, opponent) &&
                !isSquareAttacked(b, 0, 6, opponent)) {
              moves.push({ from: {row:0, col:4}, to: {row:0, col:6}, special: 'castleK' });
            }
            if (cast.bQ && b[0][3] === EMPTY && b[0][2] === EMPTY && b[0][1] === EMPTY && b[0][0] === B_ROOK &&
                !isSquareAttacked(b, 0, 4, opponent) &&
                !isSquareAttacked(b, 0, 3, opponent) &&
                !isSquareAttacked(b, 0, 2, opponent)) {
              moves.push({ from: {row:0, col:4}, to: {row:0, col:2}, special: 'castleQ' });
            }
          }
        }
      }
    }

    return moves;
  }

  function generateLegalMoves(b, side, epTarget, cast) {
    const pseudoMoves = generatePseudoLegalMoves(b, side, epTarget, cast);
    const legal = [];

    for (const move of pseudoMoves) {
      const nb = cloneBoard(b);
      applyMoveToBoard(nb, move);
      if (!isInCheck(nb, side)) {
        legal.push(move);
      }
    }

    return legal;
  }

  // Apply move to board (mutating)
  function applyMoveToBoard(b, move) {
    const piece = b[move.from.row][move.from.col];
    b[move.to.row][move.to.col] = piece;
    b[move.from.row][move.from.col] = EMPTY;

    if (move.special === 'enPassant') {
      // Remove the captured pawn
      const capturedRow = move.from.row;
      b[capturedRow][move.to.col] = EMPTY;
    }

    if (move.special === 'castleK') {
      // Move rook
      const row = move.from.row;
      b[row][5] = b[row][7];
      b[row][7] = EMPTY;
    }

    if (move.special === 'castleQ') {
      const row = move.from.row;
      b[row][3] = b[row][0];
      b[row][0] = EMPTY;
    }

    if (move.special === 'promotion') {
      b[move.to.row][move.to.col] = move.promoteTo;
    }
  }

  // ── Game State: Execute Move ──────────────────────

  function executeMove(move) {
    const piece = board[move.from.row][move.from.col];
    const captured = board[move.to.row][move.to.col];
    const isPawnMove = pieceType(piece) === W_PAWN;
    const isCapture = captured !== EMPTY || move.special === 'enPassant';

    // Generate algebraic notation before applying
    const notation = toAlgebraic(board, move, piece, isCapture);

    // Apply the move
    applyMoveToBoard(board, move);

    // Update castling rights
    updateCastlingRights(move, piece);

    // Update en passant target
    if (move.special === 'pawnDouble') {
      const epRow = (move.from.row + move.to.row) / 2;
      enPassantTarget = { row: epRow, col: move.to.col };
    } else {
      enPassantTarget = null;
    }

    // Update half-move clock
    if (isPawnMove || isCapture) {
      halfMoveClock = 0;
    } else {
      halfMoveClock++;
    }

    // Store move info
    lastMove = { from: move.from, to: move.to, piece, captured, special: move.special };

    // Check for check/checkmate indicators in notation
    const opponent = currentTurn === 'white' ? 'black' : 'white';
    const opponentInCheck = isInCheck(board, opponent);
    const opponentMoves = generateLegalMoves(board, opponent, enPassantTarget, castling);

    let finalNotation = notation;
    if (opponentMoves.length === 0 && opponentInCheck) {
      finalNotation += '#';
    } else if (opponentInCheck) {
      finalNotation += '+';
    }

    moveHistory.push(finalNotation);

    // Switch turns
    currentTurn = opponent;

    // Record position for threefold repetition
    recordPosition();
  }

  function updateCastlingRights(move, piece) {
    // King moved
    if (piece === W_KING) { castling.wK = false; castling.wQ = false; }
    if (piece === B_KING) { castling.bK = false; castling.bQ = false; }

    // Rook moved or captured
    if (move.from.row === 7 && move.from.col === 0) castling.wQ = false;
    if (move.from.row === 7 && move.from.col === 7) castling.wK = false;
    if (move.from.row === 0 && move.from.col === 0) castling.bQ = false;
    if (move.from.row === 0 && move.from.col === 7) castling.bK = false;

    // Rook captured
    if (move.to.row === 7 && move.to.col === 0) castling.wQ = false;
    if (move.to.row === 7 && move.to.col === 7) castling.wK = false;
    if (move.to.row === 0 && move.to.col === 0) castling.bQ = false;
    if (move.to.row === 0 && move.to.col === 7) castling.bK = false;
  }

  // ── Algebraic Notation ────────────────────────────

  function toAlgebraic(b, move, piece, isCapture) {
    if (move.special === 'castleK') return 'O-O';
    if (move.special === 'castleQ') return 'O-O-O';

    const type = pieceType(piece);
    const toFile = FILES[move.to.col];
    const toRank = 8 - move.to.row;
    let notation = '';

    if (type === W_PAWN) {
      if (isCapture) {
        notation = FILES[move.from.col] + 'x' + toFile + toRank;
      } else {
        notation = toFile + '' + toRank;
      }
      if (move.special === 'promotion') {
        notation += '=' + PIECE_NAMES[move.promoteTo];
      }
    } else {
      notation = PIECE_NAMES[piece];

      // Disambiguation: check if another piece of same type can reach same square
      const side = pieceColor(piece);
      const disambig = getDisambiguation(b, move, piece, side);
      notation += disambig;

      if (isCapture) notation += 'x';
      notation += toFile + '' + toRank;
    }

    return notation;
  }

  function getDisambiguation(b, move, piece, side) {
    const type = pieceType(piece);
    let sameType = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (r === move.from.row && c === move.from.col) continue;
        const p = b[r][c];
        if (p !== EMPTY && pieceType(p) === type && pieceColor(p) === side) {
          // Check if this piece can also reach the target square
          const pseudoMoves = generatePseudoLegalMoves(b, side, enPassantTarget, castling);
          const canReach = pseudoMoves.some(m =>
            m.from.row === r && m.from.col === c &&
            m.to.row === move.to.row && m.to.col === move.to.col
          );
          if (canReach) {
            sameType.push({ row: r, col: c });
          }
        }
      }
    }

    if (sameType.length === 0) return '';

    const sameFile = sameType.some(s => s.col === move.from.col);
    const sameRank = sameType.some(s => s.row === move.from.row);

    if (!sameFile) return FILES[move.from.col];
    if (!sameRank) return '' + (8 - move.from.row);
    return FILES[move.from.col] + (8 - move.from.row);
  }

  // ── Draw Detection ────────────────────────────────

  function recordPosition() {
    positionHistory.push(boardToKey(board, currentTurn, castling, enPassantTarget));
  }

  function boardToKey(b, turn, cast, ep) {
    let key = turn;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        key += ',' + b[r][c];
      }
    }
    key += '|' + (cast.wK?1:0) + (cast.wQ?1:0) + (cast.bK?1:0) + (cast.bQ?1:0);
    if (ep) key += '|' + ep.row + ep.col;
    return key;
  }

  function isThreefoldRepetition() {
    const current = positionHistory[positionHistory.length - 1];
    let count = 0;
    for (const pos of positionHistory) {
      if (pos === current) count++;
    }
    return count >= 3;
  }

  function isFiftyMoveRule() {
    return halfMoveClock >= 100; // 100 half-moves = 50 full moves
  }

  function isInsufficientMaterial() {
    const pieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] !== EMPTY) {
          pieces.push({ piece: board[r][c], row: r, col: c });
        }
      }
    }

    // K vs K
    if (pieces.length === 2) return true;

    // K+B vs K or K+N vs K
    if (pieces.length === 3) {
      const nonKing = pieces.find(p => pieceType(p.piece) !== W_KING);
      if (nonKing) {
        const t = pieceType(nonKing.piece);
        if (t === W_BISHOP || t === W_KNIGHT) return true;
      }
    }

    // K+B vs K+B with same-color bishops
    if (pieces.length === 4) {
      const bishops = pieces.filter(p => pieceType(p.piece) === W_BISHOP);
      if (bishops.length === 2) {
        const color1 = (bishops[0].row + bishops[0].col) % 2;
        const color2 = (bishops[1].row + bishops[1].col) % 2;
        if (color1 === color2) return true;
      }
    }

    return false;
  }

  // ── Game End Check ────────────────────────────────

  function checkGameEnd() {
    const legalMoves = generateLegalMoves(board, currentTurn, enPassantTarget, castling);
    const inCheck = isInCheck(board, currentTurn);

    if (legalMoves.length === 0) {
      gameOver = true;
      if (inCheck) {
        const winner = currentTurn === 'white' ? 'AI' : 'You';
        if (winner === 'You') {
          setStatus('Checkmate — <span class="highlight">you win!</span>');
        } else {
          setStatus('Checkmate — AI wins.');
        }
      } else {
        setStatus('Stalemate — <span class="highlight">draw</span>');
      }
      renderBoard();
      return true;
    }

    if (isThreefoldRepetition()) {
      gameOver = true;
      setStatus('Threefold repetition — <span class="highlight">draw</span>');
      renderBoard();
      return true;
    }

    if (isFiftyMoveRule()) {
      gameOver = true;
      setStatus('Fifty-move rule — <span class="highlight">draw</span>');
      renderBoard();
      return true;
    }

    if (isInsufficientMaterial()) {
      gameOver = true;
      setStatus('Insufficient material — <span class="highlight">draw</span>');
      renderBoard();
      return true;
    }

    return false;
  }

  // ── Rendering ─────────────────────────────────────

  function renderBoard() {
    boardEl.innerHTML = '';
    const inCheck = isInCheck(board, currentTurn);
    const kingPos = findKing(board, currentTurn);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = document.createElement('div');
        sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        sq.dataset.row = r;
        sq.dataset.col = c;

        // Selected square
        if (selectedSquare && selectedSquare.row === r && selectedSquare.col === c) {
          sq.classList.add('selected');
        }

        // Last move highlight
        if (lastMove &&
          ((lastMove.from.row === r && lastMove.from.col === c) ||
           (lastMove.to.row === r && lastMove.to.col === c))) {
          sq.classList.add('last-move');
        }

        // Check highlight
        if (inCheck && !gameOver && kingPos && kingPos.row === r && kingPos.col === c) {
          sq.classList.add('check');
        }

        // Valid move indicators
        const moveInfo = validMoves.find(m => m.to.row === r && m.to.col === c);
        if (moveInfo) {
          const targetPiece = board[r][c];
          if (targetPiece !== EMPTY || moveInfo.special === 'enPassant') {
            sq.classList.add('valid-capture');
          } else {
            sq.classList.add('valid-move');
          }
          sq.addEventListener('click', () => onSquareClick(r, c));
        }

        // Piece
        const piece = board[r][c];
        if (piece !== EMPTY) {
          const pieceEl = document.createElement('span');
          pieceEl.className = 'piece';
          pieceEl.textContent = PIECE_SYMBOLS[piece];

          if (isWhite(piece) && currentTurn === 'white' && !gameOver && !pendingPromotion) {
            pieceEl.classList.add('player-piece');
            pieceEl.addEventListener('click', (e) => {
              e.stopPropagation();
              onPieceClick(r, c);
            });
          }

          sq.appendChild(pieceEl);
        }

        // Click on empty/enemy square when moves are shown
        if (!moveInfo && selectedSquare) {
          sq.addEventListener('click', () => {
            // Deselect if clicking elsewhere
            selectedSquare = null;
            validMoves = [];
            renderBoard();
          });
        }

        boardEl.appendChild(sq);
      }
    }
  }

  function renderMoveHistory() {
    moveListEl.innerHTML = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const row = document.createElement('div');
      row.className = 'move-row';

      const numSpan = document.createElement('span');
      numSpan.className = 'move-number';
      numSpan.textContent = moveNum + '.';
      row.appendChild(numSpan);

      const whiteSpan = document.createElement('span');
      whiteSpan.className = 'move-white';
      whiteSpan.textContent = moveHistory[i] || '';
      if (i === moveHistory.length - 1) whiteSpan.classList.add('latest');
      row.appendChild(whiteSpan);

      const blackSpan = document.createElement('span');
      blackSpan.className = 'move-black';
      blackSpan.textContent = moveHistory[i + 1] || '';
      if (i + 1 === moveHistory.length - 1) blackSpan.classList.add('latest');
      row.appendChild(blackSpan);

      moveListEl.appendChild(row);
    }

    // Auto-scroll to bottom
    moveListEl.scrollTop = moveListEl.scrollHeight;
  }

  // ── Player Interaction ────────────────────────────

  function onPieceClick(r, c) {
    if (gameOver || currentTurn !== 'white' || pendingPromotion) return;

    // If clicking the already-selected piece, deselect
    if (selectedSquare && selectedSquare.row === r && selectedSquare.col === c) {
      selectedSquare = null;
      validMoves = [];
      renderBoard();
      return;
    }

    selectedSquare = { row: r, col: c };
    const allLegal = generateLegalMoves(board, 'white', enPassantTarget, castling);
    validMoves = allLegal.filter(m => m.from.row === r && m.from.col === c);
    renderBoard();
  }

  function onSquareClick(r, c) {
    if (gameOver || currentTurn !== 'white' || !selectedSquare || pendingPromotion) return;

    // Find matching moves (may be multiple for promotion)
    const matchingMoves = validMoves.filter(m => m.to.row === r && m.to.col === c);
    if (matchingMoves.length === 0) return;

    // Check if this is a promotion move
    const promotionMoves = matchingMoves.filter(m => m.special === 'promotion');
    if (promotionMoves.length > 0) {
      // Show promotion dialog
      pendingPromotion = { from: selectedSquare, to: { row: r, col: c } };
      showPromotionDialog(promotionMoves);
      return;
    }

    // Normal move
    const move = matchingMoves[0];
    executeMove(move);
    selectedSquare = null;
    validMoves = [];
    renderBoard();
    renderMoveHistory();

    if (checkGameEnd()) return;

    // AI turn
    currentTurn = 'black';
    setStatus('AI is thinking...');
    renderBoard();
    setTimeout(aiMove, 200);
  }

  function showPromotionDialog(moves) {
    promotionPieces.innerHTML = '';
    for (const move of moves) {
      const btn = document.createElement('button');
      btn.className = 'promotion-piece';
      btn.textContent = PIECE_SYMBOLS[move.promoteTo];
      btn.addEventListener('click', () => {
        promotionOverlay.classList.remove('active');
        executeMove(move);
        pendingPromotion = null;
        selectedSquare = null;
        validMoves = [];
        renderBoard();
        renderMoveHistory();

        if (checkGameEnd()) return;

        currentTurn = 'black';
        setStatus('AI is thinking...');
        renderBoard();
        setTimeout(aiMove, 200);
      });
      promotionPieces.appendChild(btn);
    }
    promotionOverlay.classList.add('active');
  }

  // ── AI Move ───────────────────────────────────────

  function aiMove() {
    if (gameOver) return;

    const move = window.ChessAI.findBestMove(
      board, difficulty, enPassantTarget, castling, halfMoveClock, positionHistory
    );

    if (!move) {
      // No legal moves — should have been caught by checkGameEnd
      gameOver = true;
      setStatus('Stalemate — <span class="highlight">draw</span>');
      renderBoard();
      return;
    }

    executeMove(move);
    renderBoard();
    renderMoveHistory();

    if (checkGameEnd()) return;

    setStatus('Your turn — <span class="highlight">select a piece</span>');
  }

  // ── Board Utils ───────────────────────────────────

  function cloneBoard(b) {
    return b.map(row => row.slice());
  }

  // ── UI Helpers ────────────────────────────────────

  function setStatus(html) {
    statusText.innerHTML = html;
  }

  // ── Expose for AI module ──────────────────────────
  window.ChessEngine = {
    EMPTY, W_PAWN, W_KNIGHT, W_BISHOP, W_ROOK, W_QUEEN, W_KING,
    B_PAWN, B_KNIGHT, B_BISHOP, B_ROOK, B_QUEEN, B_KING,
    isWhite, isBlack, isOwn, isEnemy, pieceType, pieceColor,
    generateLegalMoves, generatePseudoLegalMoves,
    applyMoveToBoard, cloneBoard,
    isInCheck, isSquareAttacked, findKing,
    boardToKey
  };

  // ── Start ─────────────────────────────────────────
  init();
})();
