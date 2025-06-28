// Gomoku AI Logic - Web Worker

// Attempt to import utilities and constants
try {
    importScripts('utils.js'); // Assuming utils.js is in the same /js/ path relative to the worker
    console.log("ai.worker.js: utils.js imported successfully.");
} catch (e) {
    console.error("ai.worker.js: Failed to import utils.js. Essential constants/functions might be missing.", e);
    // If importScripts fails, critical constants need to be defined manually or passed via message.
    // For now, we'll assume critical ones like BOARD_SIZE might be passed or are known.
    // This is a fallback and not ideal.
    self.BOARD_SIZE = 15; // Fallback, should be passed or imported
    self.EMPTY = 0;
    self.PLAYER_BLACK = 1;
    self.PLAYER_WHITE = 2;
    self.WINNING_LENGTH = 5;
    self.isInBounds = function(x, y) { // Fallback isInBounds
        return x >= 0 && x < self.BOARD_SIZE && y >= 0 && y < self.BOARD_SIZE;
    };
}


// --- Heuristic Evaluation ---
const PATTERN_SCORES = {
    FIVE_IN_A_ROW: 100000,
    LIVE_FOUR: 10000,
    RUSH_FOUR: 1000,
    LIVE_THREE: 1000,
    SLEEP_THREE: 100,
    LIVE_TWO: 100,
    SLEEP_TWO: 10,
};

function evaluateBoard(board, aiPlayer = PLAYER_WHITE) {
    const humanPlayer = (aiPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
    const aiScore = calculateScoreForPlayer(board, aiPlayer);
    const playerScore = calculateScoreForPlayer(board, humanPlayer);
    if (aiScore >= PATTERN_SCORES.FIVE_IN_A_ROW) return PATTERN_SCORES.FIVE_IN_A_ROW * 10;
    if (playerScore >= PATTERN_SCORES.FIVE_IN_A_ROW) return -PATTERN_SCORES.FIVE_IN_A_ROW * 10;
    return aiScore - playerScore;
}

function calculateScoreForPlayer(board, player) {
    let totalScore = 0;
    const directions = [
        { dr: 0, dc: 1 }, { dr: 1, dc: 0 },
        { dr: 1, dc: 1 }, { dr: 1, dc: -1 }
    ];
    const opponent = (player === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player) {
                directions.forEach(dir => {
                    if (checkPattern(board, r, c, dir, player, 5)) {
                        totalScore += PATTERN_SCORES.FIVE_IN_A_ROW;
                    } else if (checkPattern(board, r, c, dir, player, 4, true, true)) {
                        totalScore += PATTERN_SCORES.LIVE_FOUR;
                    } else if (checkPattern(board, r, c, dir, player, 4, true, false, opponent) ||
                               checkPattern(board, r, c, dir, player, 4, false, true, opponent)) {
                        totalScore += PATTERN_SCORES.RUSH_FOUR;
                    } else if (checkPattern(board, r, c, dir, player, 3, true, true)) {
                        totalScore += PATTERN_SCORES.LIVE_THREE;
                    } else if (checkPattern(board, r, c, dir, player, 3, true, false, opponent) ||
                               checkPattern(board, r, c, dir, player, 3, false, true, opponent)) {
                        totalScore += PATTERN_SCORES.SLEEP_THREE;
                    } else if (checkPattern(board, r, c, dir, player, 2, true, true)) {
                        totalScore += PATTERN_SCORES.LIVE_TWO;
                    } else if (checkPattern(board, r, c, dir, player, 2, true, false, opponent) ||
                               checkPattern(board, r, c, dir, player, 2, false, true, opponent)) {
                        totalScore += PATTERN_SCORES.SLEEP_TWO;
                    }
                });
            }
        }
    }
    return totalScore;
}

function checkPattern(board, r, c, dir, player, length, openStart = null, openEnd = null, opponent = null) {
    for (let i = 0; i < length; i++) {
        const curR = r + i * dir.dr;
        const curC = c + i * dir.dc;
        if (!isInBounds(curC, curR) || board[curR][curC] !== player) return false;
    }
    if (openStart !== null) {
        const beforeR = r - dir.dr;
        const beforeC = c - dir.dc;
        if (openStart === true) {
            if (!isInBounds(beforeC, beforeR) || board[beforeR][beforeC] !== EMPTY) return false;
        } else {
            if (opponent === null) { console.warn("checkPattern: opponent ID null for blocked start"); return false; }
            if (isInBounds(beforeC, beforeR) && board[beforeR][beforeC] !== opponent) return false;
        }
    }
    if (openEnd !== null) {
        const afterR = r + length * dir.dr;
        const afterC = c + length * dir.dc;
        if (openEnd === true) {
            if (!isInBounds(afterC, afterR) || board[afterR][afterC] !== EMPTY) return false;
        } else {
            if (opponent === null) { console.warn("checkPattern: opponent ID null for blocked end"); return false; }
            if (isInBounds(afterC, afterR) && board[afterR][afterC] !== opponent) return false;
        }
    }
    return true;
}

function findBestMove(board, depth, alpha, beta, maximizingPlayer, aiPlayer = PLAYER_WHITE) {
    if (depth === 0 || isGameOver(board, aiPlayer)) {
        return { score: evaluateBoard(board, aiPlayer), move: null };
    }
    const possibleMoves = getPossibleMoves(board);
    if (possibleMoves.length === 0) {
        return { score: evaluateBoard(board, aiPlayer), move: null };
    }
    let bestMove = null;
    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of possibleMoves) {
            const tempBoard = makeTemporaryMove(board, move.x, move.y, aiPlayer);
            const currentEval = findBestMove(tempBoard, depth - 1, alpha, beta, false, aiPlayer).score;
            if (currentEval > maxEval) {
                maxEval = currentEval;
                bestMove = move;
            }
            alpha = Math.max(alpha, currentEval);
            if (beta <= alpha) break;
        }
        return { score: maxEval, move: bestMove };
    } else {
        let minEval = Infinity;
        const opponentPlayer = (aiPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
        for (const move of possibleMoves) {
            const tempBoard = makeTemporaryMove(board, move.x, move.y, opponentPlayer);
            const currentEval = findBestMove(tempBoard, depth - 1, alpha, beta, true, aiPlayer).score;
            if (currentEval < minEval) {
                minEval = currentEval;
                bestMove = move;
            }
            beta = Math.min(beta, currentEval);
            if (beta <= alpha) break;
        }
        return { score: minEval, move: bestMove };
    }
}

function isGameOver(board, aiPlayer) {
    if (checkWinForPlayer(board, aiPlayer)) return true;
    const humanPlayer = (aiPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
    if (checkWinForPlayer(board, humanPlayer)) return true;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === EMPTY) return false;
        }
    }
    return true;
}

function checkWinForPlayer(currentBoard, player) {
    const directions = [
        { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }
    ];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (currentBoard[r][c] === player) {
                for (const dir of directions) {
                    let count = 0;
                    for (let i = 0; i < WINNING_LENGTH; i++) {
                        const x = c + i * dir.dx;
                        const y = r + i * dir.dy;
                        if (isInBounds(x, y) && currentBoard[y][x] === player) count++;
                        else break;
                    }
                    if (count === WINNING_LENGTH) return true;
                }
            }
        }
    }
    return false;
}

function getPossibleMoves(board) {
    const moves = [];
    const occupiedCells = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== EMPTY) occupiedCells.push({ r, c });
        }
    }
    if (occupiedCells.length === 0) {
        moves.push({ x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) });
        return moves;
    }
    const candidates = new Set();
    const range = 2;
    occupiedCells.forEach(cell => {
        for (let dr = -range; dr <= range; dr++) {
            for (let dc = -range; dc <= range; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = cell.r + dr;
                const c = cell.c + dc;
                if (isInBounds(c, r) && board[r][c] === EMPTY) candidates.add(`${c}-${r}`);
            }
        }
    });
    if (candidates.size === 0 && occupiedCells.length > 0 && occupiedCells.length < BOARD_SIZE * BOARD_SIZE) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === EMPTY) moves.push({ x: c, y: r });
            }
        }
        return moves;
    }
    candidates.forEach(str => {
        const [x, y] = str.split('-').map(Number);
        moves.push({ x, y });
    });
    return moves;
}

function makeTemporaryMove(originalBoard, x, y, player) {
    const tempBoard = originalBoard.map(row => [...row]); // Deep copy
    if (isInBounds(x, y) && tempBoard[y][x] === EMPTY) {
        tempBoard[y][x] = player;
    }
    return tempBoard;
}

// Worker message handler
self.onmessage = function(e) {
    console.log('ai.worker.js: Message received from main script:', e.data);
    const { board, searchDepth, aiPlayer } = e.data;

    if (!board || typeof searchDepth === 'undefined') {
        console.error('ai.worker.js: Invalid data received.');
        self.postMessage({ error: 'Invalid data received by worker' });
        return;
    }

    // Note: PLAYER_WHITE is assumed to be aiPlayer if not specified, but it's better to pass it.
    const bestMoveResult = findBestMove(board, searchDepth, -Infinity, Infinity, true, aiPlayer || PLAYER_WHITE);

    console.log('ai.worker.js: Calculation complete. Posting message back to main script:', bestMoveResult.move);
    self.postMessage({ move: bestMoveResult.move, score: bestMoveResult.score });
};

console.log("ai.worker.js loaded and ready for messages.");
