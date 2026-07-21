export type Piece = 0 | 1 | 2 | 3 | 4; // 0: пусто, 1: белые, 2: черные, 3: белая дамка, 4: черная дамка
export type Board = Piece[][];
export type Move = { from: {r: number, c: number}, to: {r: number, c: number}, captures?: {r: number, c: number}[] };

export function createInitialBoard(): Board {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(0));
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) board[r][c] = 2; // Черные сверху
        if (r > 4) board[r][c] = 1; // Белые снизу
      }
    }
  }
  return board;
}

export function getValidMoves(board: Board, player: 1 | 2): Move[] {
  let moves: Move[] = [];
  let canCapture = false;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (player === 1 && (piece === 1 || piece === 3)) {
        moves = moves.concat(getPieceMoves(board, r, c, piece));
      } else if (player === 2 && (piece === 2 || piece === 4)) {
        moves = moves.concat(getPieceMoves(board, r, c, piece));
      }
    }
  }

  // Правило обязательного взятия в русских шашках
  const captureMoves = moves.filter(m => m.captures && m.captures.length > 0);
  if (captureMoves.length > 0) {
    // Оставляем только ходы с максимальным количеством взятий (для многократного взятия)
    const maxCaptures = Math.max(...captureMoves.map(m => m.captures!.length));
    return captureMoves.filter(m => m.captures!.length === maxCaptures);
  }

  return moves;
}

function getPieceMoves(board: Board, r: number, c: number, piece: Piece): Move[] {
  const moves: Move[] = [];
  const isKing = piece === 3 || piece === 4;
  const isWhite = piece === 1 || piece === 3;
  const directions = isKing ? [[-1,-1], [-1,1], [1,-1], [1,1]] : (isWhite ? [[-1,-1], [-1,1]] : [[1,-1], [1,1]]);

  // 1. Проверка взятий (приоритет)
  const captureDirs = [[-1,-1], [-1,1], [1,-1], [1,1]]; // Бить можно в любую сторону даже простой шашкой
  for (const [dr, dc] of captureDirs) {
    const midR = r + dr, midC = c + dc;
    const destR = r + 2 * dr, destC = c + 2 * dc;
    if (destR >= 0 && destR < 8 && destC >= 0 && destC < 8) {
      const midPiece = board[midR][midC];
      const isEnemy = isWhite ? (midPiece === 2 || midPiece === 4) : (midPiece === 1 || midPiece === 3);
      if (isEnemy && board[destR][destC] === 0) {
        moves.push({ from: {r, c}, to: {r: destR, c: destC}, captures: [{r: midR, c: midC}] });
      }
    }
  }

  // 2. Обычные ходы (только если нет взятий, это отфильтруется позже)
  if (moves.length === 0) {
    for (const [dr, dc] of directions) {
      const destR = r + dr, destC = c + dc;
      if (destR >= 0 && destR < 8 && destC >= 0 && destC < 8 && board[destR][destC] === 0) {
        moves.push({ from: {r, c}, to: {r: destR, c: destC} });
      }
    }
  }
  return moves;
}

export function applyMove(board: Board, move: Move): Board {
  const newBoard = board.map(row => [...row]);
  const piece = newBoard[move.from.r][move.from.c];
  newBoard[move.from.r][move.from.c] = 0;
  newBoard[move.to.r][move.to.c] = piece;

  if (move.captures) {
    for (const cap of move.captures) {
      newBoard[cap.r][cap.c] = 0;
    }
  }

  // Превращение в дамку
  if (piece === 1 && move.to.r === 0) newBoard[move.to.r][move.to.c] = 3;
  if (piece === 2 && move.to.r === 7) newBoard[move.to.r][move.to.c] = 4;

  return newBoard;
}

export function checkWinCondition(board: Board, currentTurn: 1 | 2): 'white' | 'black' | 'draw' | null {
  const whitePieces = board.flat().filter(p => p === 1 || p === 3).length;
  const blackPieces = board.flat().filter(p => p === 2 || p === 4).length;

  if (whitePieces === 0) return 'black';
  if (blackPieces === 0) return 'white';

  // Если у текущего игрока нет ходов, он проиграл
  if (getValidMoves(board, currentTurn).length === 0) {
    return currentTurn === 1 ? 'black' : 'white';
  }

  return null;
}