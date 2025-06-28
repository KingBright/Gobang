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

// New helper function to score a single potential move heuristically
function scoreMoveHeuristically(board, x, y, player) {
    let score = 0;
    const opponent = (player === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;

    // Temporarily place the stone to check patterns formed
    board[y][x] = player; // Make the move

    // 1. Check for immediate win for 'player'
    if (checkWinForPlayer(board, player)) {
        board[y][x] = EMPTY; // Revert
        return PATTERN_SCORES.FIVE_IN_A_ROW * 10; // Very high score for immediate win
    }

    // 2. Check if this move blocks an immediate win for the opponent
    // To do this, see if opponent *would have won* if they played at x,y
    board[y][x] = opponent; // Simulate opponent playing here instead
    if (checkWinForPlayer(board, opponent)) {
        // If opponent would have won here, then 'player' playing here is a critical block.
        score += PATTERN_SCORES.LIVE_FOUR * 2; // High score for blocking opponent's win
    }

    // Revert to player's stone for further offensive checks (if any)
    board[y][x] = player;

    // 3. Basic offensive heuristic: count adjacent same-color stones (simplified)
    // This encourages clustering but is not a full pattern analysis.
    const directions = [{dr:0,dc:1},{dr:1,dc:0},{dr:1,dc:1},{dr:1,dc:-1}];
    for(const dir of directions) {
        for(let i = 1; i < 3; i++) { // Check 1-2 steps in each of 8 directions
            if (isInBounds(x + i * dir.dc, y + i * dir.dr) && board[y + i * dir.dr][x + i * dir.dc] === player) score += 30; else break;
        }
         for(let i = 1; i < 3; i++) {
            if (isInBounds(x - i * dir.dc, y - i * dir.dr) && board[y - i * dir.dr][x - i * dir.dc] === player) score += 30; else break;
        }
    }
    // (Could add more sophisticated local pattern checks here if needed, e.g., forming live threes)

    board[y][x] = EMPTY; // IMPORTANT: Always revert the board to original state before returning
    return score;
}


function findBestMove(board, depth, alpha, beta, maximizingPlayer, aiPlayer = PLAYER_WHITE) {
    if (depth === 0 || isGameOver(board, aiPlayer)) {
        return { score: evaluateBoard(board, aiPlayer), move: null };
    }

    let possibleMoves = getPossibleMoves(board);
    if (possibleMoves.length === 0) {
        return { score: evaluateBoard(board, aiPlayer), move: null };
    }

    // Sort possible moves to improve alpha-beta pruning efficiency
    if (depth >= 1 && possibleMoves.length > 1) { // Sort if there's depth and choice
        const currentPlayerForSort = maximizingPlayer ? aiPlayer : ((aiPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK);
        const scoredMoves = possibleMoves.map(move => {
            // Score is based on the immediate impact of the move by currentPlayerForSort
            const score = scoreMoveHeuristically(board, move.x, move.y, currentPlayerForSort);
            return { move, score };
        });
        scoredMoves.sort((a, b) => b.score - a.score); // Higher scores first
        possibleMoves = scoredMoves.map(sm => sm.move);
    }

    let bestMoveForThisNode = null; // Tracks the best move found at this particular node/depth

    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of possibleMoves) {
            board[move.y][move.x] = aiPlayer; // Make move on the shared board
            const currentEval = findBestMove(board, depth - 1, alpha, beta, false, aiPlayer).score;
            board[move.y][move.x] = EMPTY; // Undo move

            if (currentEval > maxEval) {
                maxEval = currentEval;
                bestMoveForThisNode = move;
            }
            alpha = Math.max(alpha, currentEval);
            if (beta <= alpha) break;
        }
        return { score: maxEval, move: bestMoveForThisNode };
    } else { // Minimizing player
        let minEval = Infinity;
        const opponentPlayer = (aiPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
        for (const move of possibleMoves) {
            board[move.y][move.x] = opponentPlayer; // Make move on the shared board
            const currentEval = findBestMove(board, depth - 1, alpha, beta, true, aiPlayer).score;
            board[move.y][move.x] = EMPTY; // Undo move

            if (currentEval < minEval) {
                minEval = currentEval;
                bestMoveForThisNode = move; // Though for min player, this move is less critical to return up
            }
            beta = Math.min(beta, currentEval);
            if (beta <= alpha) break;
        }
        return { score: minEval, move: bestMoveForThisNode };
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
    let occupiedCount = 0;
    const candidateMap = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== EMPTY) {
                occupiedCount++;
            }
        }
    }

    if (occupiedCount === 0) {
        moves.push({ x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) });
        return moves;
    }

    const range = 1; // Consider only adjacent cells (range 1) for higher performance. Can be increased to 2 if needed.

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== EMPTY) { // For each existing stone
                for (let dr = -range; dr <= range; dr++) {
                    for (let dc = -range; dc <= range; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = r + dr;
                        const nc = c + dc;
                        if (isInBounds(nc, nr) && board[nr][nc] === EMPTY && !candidateMap[nr][nc]) {
                            candidateMap[nr][nc] = true;
                            moves.push({ x: nc, y: nr });
                        }
                    }
                }
            }
        }
    }

    // Fallback if no moves are found adjacent to existing stones (e.g. board is nearly full with isolated empty spots)
    // This also handles the case where the board is full and occupiedCount == BOARD_SIZE * BOARD_SIZE, returning an empty moves list.
    if (moves.length === 0 && occupiedCount < BOARD_SIZE * BOARD_SIZE) {
        for (let r_fb = 0; r_fb < BOARD_SIZE; r_fb++) {
            for (let c_fb = 0; c_fb < BOARD_SIZE; c_fb++) {
                if (board[r_fb][c_fb] === EMPTY) {
                    moves.push({ x: c_fb, y: r_fb });
                }
            }
        }
    }
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
