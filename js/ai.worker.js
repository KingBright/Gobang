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

// --- Advanced Pattern Detection for Omniscience ---

/**
 * Checks if placing a stone at (x,y) for player creates a line of 'length' stones.
 * Optionally checks for open ends.
 * @param {Array<Array<number>>} board The game board.
 * @param {number} r Row index.
 * @param {number} c Column index.
 * @param {number} player The player making the move.
 * @param {number} length The required length of the line.
 * @param {boolean} [checkOpenStart=false] If true, checks if the start of the line is open.
 * @param {boolean} [checkOpenEnd=false] If true, checks if the end of the line is open.
 * @returns {boolean} True if the pattern is formed, false otherwise.
 */
function checkLine(board, r, c, player, length, checkOpenStart = false, checkOpenEnd = false) {
    const directions = [
        { dr: 0, dc: 1 }, { dr: 1, dc: 0 }, // Horizontal, Vertical
        { dr: 1, dc: 1 }, { dr: 1, dc: -1 }  // Diagonal
    ];

    for (const dir of directions) {
        // Check in one direction (e.g., right, down, down-right, down-left)
        // Then check in the opposite direction and combine
        for (let i = 0; i < length; i++) { // i is the number of stones *before* the current placement (r,c) along the line
            const startR = r - i * dir.dr;
            const startC = c - i * dir.dc;

            let currentLength = 0;
            let openEnds = 0;
            let actualStones = []; // Store {r, c} of stones in the line

            // Check towards dir
            for (let k = 0; k < length; k++) {
                const curR = startR + k * dir.dr;
                const curC = startC + k * dir.dc;

                if (!isInBounds(curC, curR)) break;
                if (k === i && board[curR][curC] !== EMPTY && board[curR][curC] !== player) break; // The target spot must be empty or player's
                if (k !== i && board[curR][curC] !== player) break; // Other spots must be player's

                if (board[curR][curC] === player || (k === i && board[curR][curC] === EMPTY) ) {
                     if (k===i) actualStones.push({r:curR, c:curC, isHypothetical:true}); // Mark the hypothetical stone
                     else actualStones.push({r:curR, c:curC});
                    currentLength++;
                } else {
                    break;
                }
            }

            if (currentLength === length) {
                let lineForms = true;
                if (checkOpenStart || checkOpenEnd) {
                    const beforeR = startR - dir.dr;
                    const beforeC = startC - dir.dc;
                    const afterR = startR + length * dir.dr;
                    const afterC = startC + length * dir.dc;

                    let isOpenStart = false;
                    if (isInBounds(beforeC, beforeR) && board[beforeR][beforeC] === EMPTY) {
                        isOpenStart = true;
                    }

                    let isOpenEnd = false;
                    if (isInBounds(afterC, afterR) && board[afterR][afterC] === EMPTY) {
                        isOpenEnd = true;
                    }

                    if (checkOpenStart && !isOpenStart) lineForms = false;
                    if (checkOpenEnd && !isOpenEnd) lineForms = false;
                }
                if(lineForms) return true;
            }
        }
    }
    return false;
}


/**
 * Checks if placing stone at (r,c) for player creates a five-in-a-row.
 */
function checkFive(board, r, c, player) {
    // Temporarily place stone for check
    board[r][c] = player;
    let wins = false;
    // Use existing checkWinForPlayer but adapt it if it checks the whole board
    // For now, let's use a localized check around (r,c)
    const directions = [{dx:1,dy:0},{dx:0,dy:1},{dx:1,dy:1},{dx:1,dy:-1}];
    for (const dir of directions) {
        let count = 1; // Count the stone we just placed
        // Check in positive direction
        for (let i = 1; i < WINNING_LENGTH; i++) {
            const newR = r + i * dir.dy;
            const newC = c + i * dir.dx;
            if (isInBounds(newC, newR) && board[newR][newC] === player) count++; else break;
        }
        // Check in negative direction
        for (let i = 1; i < WINNING_LENGTH; i++) {
            const newR = r - i * dir.dy;
            const newC = c - i * dir.dx;
            if (isInBounds(newC, newR) && board[newR][newC] === player) count++; else break;
        }
        if (count >= WINNING_LENGTH) {
            wins = true;
            break;
        }
    }
    board[r][c] = EMPTY; // Revert
    return wins;
}

/**
 * Checks if placing stone at (r,c) for player creates a line of four.
 * This can be an open four or a closed four (where one end is blocked by opponent or edge).
 * For omniscience, we just need to know if it *becomes* a four.
 */
function checkLineOfFour(board, r, c, player) {
    board[r][c] = player;
    let isFour = false;
    const directions = [{dx:1,dy:0},{dx:0,dy:1},{dx:1,dy:1},{dx:1,dy:-1}];
    for (const dir of directions) {
        let count = 1;
        for (let i = 1; i < 4; i++) { // Check up to 3 more stones in one dir
            if (isInBounds(c + i * dir.dx, r + i * dir.dy) && board[r + i * dir.dy][c + i * dir.dx] === player) count++; else break;
        }
        for (let i = 1; i < 4; i++) { // Check up to 3 more stones in other dir
            if (isInBounds(c - i * dir.dx, r - i * dir.dy) && board[r - i * dir.dy][c - i * dir.dx] === player) count++; else break;
        }
        if (count >= 4) { // If placing the stone makes it 4 or more (e.g. completing a 4, or extending a 3 to 4)
            isFour = true;
            break;
        }
    }
    board[r][c] = EMPTY;
    return isFour;
}


/**
 * Counts open threes formed by placing a stone at (r,c) for player.
 * An open three is X-O-O-O-X where O is player and X is empty.
 * @returns {number} Count of distinct open threes formed.
 */
function countOpenThreesFormed(board, r, c, player) {
    board[r][c] = player; // Place stone
    let openThreeCount = 0;
    const directions = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
    const checkedLines = []; // To avoid double counting for a line (e.g. horizontal line counted once)

    for (const dir of directions) {
        // Normalize direction to avoid duplicates (e.g. horizontal right and horizontal left)
        const normDir = (dir.dc < 0 || (dir.dc === 0 && dir.dr < 0)) ? { dr: -dir.dr, dc: -dir.dc } : dir;
        const dirKey = `${normDir.dr}_${normDir.dc}`;
        if (checkedLines.includes(dirKey)) continue;

        // Iterate through all possible 3-in-a-row patterns that include the new stone (r,c)
        for (let i = 0; i < 3; i++) { // i is the offset of (r,c) within the potential 3-in-a-row
            const sR = r - i * dir.dr; // Start row of the 3-group
            const sC = c - i * dir.dc; // Start col of the 3-group

            // Check if this forms a 3-in-a-row of 'player'
            let isThreeInARow = true;
            for (let k = 0; k < 3; k++) {
                const curR = sR + k * dir.dr;
                const curC = sC + k * dir.dc;
                if (!isInBounds(curC, curR) || board[curR][curC] !== player) {
                    isThreeInARow = false;
                    break;
                }
            }

            if (isThreeInARow) {
                // Check for open ends: _OOO_
                const beforeR = sR - dir.dr;
                const beforeC = sC - dir.dc;
                const afterR = sR + 3 * dir.dr;
                const afterC = sC + 3 * dir.dc;

                if (isInBounds(beforeC, beforeR) && board[beforeR][beforeC] === EMPTY &&
                    isInBounds(afterC, afterR) && board[afterR][afterC] === EMPTY) {
                    openThreeCount++;
                    checkedLines.push(dirKey); // Mark this line direction as counted
                    break; // Found an open three in this direction, move to next direction
                }
            }
        }
    }
    board[r][c] = EMPTY; // Revert
    return openThreeCount;
}

/**
 * Checks for Double Three: placing a stone creates two open threes simultaneously.
 */
function checkDoubleThree(board, r, c, player) {
    return countOpenThreesFormed(board, r, c, player) >= 2;
}

/**
 * Counts fours (live or dead) formed by placing a stone at (r,c) for player.
 * @returns {number} Count of distinct fours formed.
 */
function countFoursFormed(board, r, c, player) {
    board[r][c] = player; // Place stone
    let fourCount = 0;
    const directions = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
    const checkedLines = [];

    for (const dir of directions) {
        const normDir = (dir.dc < 0 || (dir.dc === 0 && dir.dr < 0)) ? { dr: -dir.dr, dc: -dir.dc } : dir;
        const dirKey = `${normDir.dr}_${normDir.dc}`;
        if (checkedLines.includes(dirKey)) continue;

        for (let i = 0; i < 4; i++) { // i is the offset of (r,c) within the potential 4-in-a-row
            const sR = r - i * dir.dr;
            const sC = c - i * dir.dc;

            let isFourInARow = true;
            for (let k = 0; k < 4; k++) {
                const curR = sR + k * dir.dr;
                const curC = sC + k * dir.dc;
                if (!isInBounds(curC, curR) || board[curR][curC] !== player) {
                    isFourInARow = false;
                    break;
                }
            }

            if (isFourInARow) {
                fourCount++;
                checkedLines.push(dirKey);
                break;
            }
        }
    }
    board[r][c] = EMPTY; // Revert
    return fourCount;
}

/**
 * Checks for Three-Four: placing a stone creates an open three AND a four simultaneously.
 */
function checkThreeFour(board, r, c, player) {
    // Place stone once for all checks for this spot
    board[r][c] = player;
    const openThrees = countOpenThreesFormed(board, r, c, player); // This function expects the stone to be NOT on board yet

    // For counting fours, the stone should be on the board, so we already placed it.
    // Re-implement a local four count that assumes stone is at (r,c)
    let fourCount = 0;
    const directions = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
    const checkedFourLines = [];
    for (const dir of directions) {
        const normDir = (dir.dc < 0 || (dir.dc === 0 && dir.dr < 0)) ? { dr: -dir.dr, dc: -dir.dc } : dir;
        const dirKey = `${normDir.dr}_${normDir.dc}`;
        if (checkedFourLines.includes(dirKey)) continue;

        for (let i = 0; i < 4; i++) {
            const sR = r - i * dir.dr;
            const sC = c - i * dir.dc;
            let isFourInARow = true;
            for (let k = 0; k < 4; k++) {
                const curR = sR + k * dir.dr;
                const curC = sC + k * dir.dc;
                if (!isInBounds(curC, curR) || board[curR][curC] !== player) {
                    isFourInARow = false;
                    break;
                }
            }
            if (isFourInARow) {
                fourCount++;
                checkedFourLines.push(dirKey);
                break;
            }
        }
    }
    board[r][c] = EMPTY; // Revert stone

    // To be a 3-4, the specific stone at (r,c) must contribute to *both* an open three and a four.
    // The countOpenThreesFormed and countFoursFormed are general.
    // A more precise check might be needed if a single stone completes one pattern, and another existing stone completes the other.
    // However, for highlighting (r,c), if placing stone there makes any open-three and any four, it's a 3-4 threat/opportunity.
    // The logic in countOpenThreesFormed and the local fourCount already correctly attribute the formation to the stone at (r,c)
    // because they check patterns *including* (r,c).

    // Re-evaluate with the stone placed for the counts
    // This is tricky: does (r,c) complete an open three AND a four that are distinct lines?
    // Or does it extend one line to be an open three and another line to be a four?
    // The current check is: placing (r,c) results in >=1 open three and >=1 four existing on the board that include (r,c).
    if (openThrees > 0 && fourCount > 0) {
         // More refined check: ensure (r,c) is part of different lines for 3 and 4
        board[r][c] = player;
        let isGenuineThreeFour = false;

        const threeDirections = []; // Directions of open threes formed through (r,c)
        const fourDirections = [];  // Directions of fours formed through (r,c)

        // Find directions for open threes
        const d3 = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
        const chk3L = [];
        for (const dir of d3) {
            const nDir = (dir.dc < 0 || (dir.dc === 0 && dir.dr < 0)) ? { dr: -dir.dr, dc: -dir.dc } : dir;
            const dKey = `${nDir.dr}_${nDir.dc}`;
            if (chk3L.includes(dKey)) continue;
            for (let i = 0; i < 3; i++) {
                const sR = r - i * dir.dr; const sC = c - i * dir.dc;
                let is3 = true;
                for (let k = 0; k < 3; k++) {
                    const cR = sR + k * dir.dr; const cC = sC + k * dir.dc;
                    if (!isInBounds(cC, cR) || board[cR][cC] !== player) { is3 = false; break; }
                }
                if (is3) {
                    const bR = sR - dir.dr; const bC = sC - dir.dc;
                    const aR = sR + 3 * dir.dr; const aC = sC + 3 * dir.dc;
                    if (isInBounds(bC, bR) && board[bR][bC] === EMPTY && isInBounds(aC, aR) && board[aR][aC] === EMPTY) {
                        threeDirections.push(nDir);
                        chk3L.push(dKey);
                        break;
                    }
                }
            }
        }

        // Find directions for fours
        const d4 = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
        const chk4L = [];
        for (const dir of d4) {
            const nDir = (dir.dc < 0 || (dir.dc === 0 && dir.dr < 0)) ? { dr: -dir.dr, dc: -dir.dc } : dir;
            const dKey = `${nDir.dr}_${nDir.dc}`;
            if (chk4L.includes(dKey)) continue;
            for (let i = 0; i < 4; i++) {
                const sR = r - i * dir.dr; const sC = c - i * dir.dc;
                let is4 = true;
                for (let k = 0; k < 4; k++) {
                    const cR = sR + k * dir.dr; const cC = sC + k * dir.dc;
                    if (!isInBounds(cC, cR) || board[cR][cC] !== player) { is4 = false; break; }
                }
                if (is4) {
                    fourDirections.push(nDir);
                    chk4L.push(dKey);
                    break;
                }
            }
        }
        board[r][c] = EMPTY; // Revert

        // Check if there's at least one three-direction and one four-direction that are different
        for (const tDir of threeDirections) {
            for (const fDir of fourDirections) {
                if (tDir.dr !== fDir.dr || tDir.dc !== fDir.dc) { // If directions are different
                    isGenuineThreeFour = true;
                    break;
                }
            }
            if (isGenuineThreeFour) break;
        }
        return isGenuineThreeFour;
    }
    return false;
}


/**
 * Checks for Double Four: placing a stone creates two fours simultaneously.
 */
function checkDoubleFour(board, r, c, player) {
    // This is simpler: if placing the stone results in 2 or more fours.
    // The countFoursFormed function already correctly counts distinct lines of four formed by (r,c).
    return countFoursFormed(board, r, c, player) >= 2;
}


/**
 * Gets detailed pattern hints for a given player.
 * Iterates over empty cells, simulates placing a stone, and checks for patterns.
 */
function getDetailedPatternHints(board, player) {
    const hints = [];
    const opponent = (player === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
    const hintCategory = (player === self.playerForOmniInternal) ? HINT_TYPE_PLAYER_OPPORTUNITY : HINT_TYPE_OPPONENT_THREAT;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === EMPTY) {
                // Highest priority: Winning move
                if (checkFive(board, r, c, player)) {
                    hints.push({ x: c, y: r, patternType: PATTERN_TYPE_FIVE_IN_A_ROW, hintCategory });
                    continue; // If it's a win, no need to check other patterns for this spot for this player
                }

                // Check for opponent's immediate win if player *doesn't* move here.
                // This is a defensive check. If opponent can win at (r,c), then (r,c) is critical for player.
                // This is slightly different from standard "opponent threat" which is about opponent's *next* move.
                // For this version, we focus on what the current player's move at (r,c) achieves or blocks.
                // The "opponent_threat" category will be for opponent's potential moves.

                // Check for Double Four
                if (checkDoubleFour(board, r, c, player)) {
                    hints.push({ x: c, y: r, patternType: PATTERN_TYPE_DOUBLE_FOUR, hintCategory });
                }
                // Check for Three-Four (ensure it's not also a double four already counted)
                // A double four might also be a three-four, but double-four is stronger.
                // To avoid redundant highlights, we can prioritize.
                // For now, let them stack if logic permits, UI can decide or we refine here.
                else if (checkThreeFour(board, r, c, player)) { // Use 'else if' to avoid double counting with DF
                    hints.push({ x: c, y: r, patternType: PATTERN_TYPE_THREE_FOUR, hintCategory });
                }

                // Check for Line of Four (that isn't part of a DF or TF already pushed for this spot)
                // A simple line of four is less than DF or TF.
                // To avoid multiple markers on the same spot from the same player, we can use flags or check existing hints.
                let alreadyProcessedForStrongerPattern = hints.some(h => h.x === c && h.y === r && h.hintCategory === hintCategory);
                if (!alreadyProcessedForStrongerPattern && checkLineOfFour(board, r, c, player)) {
                     hints.push({ x: c, y: r, patternType: PATTERN_TYPE_LINE_OF_FOUR, hintCategory });
                }

                // Check for Double Three
                // Reset flag for this check
                alreadyProcessedForStrongerPattern = hints.some(h => h.x === c && h.y === r && h.hintCategory === hintCategory);
                if (!alreadyProcessedForStrongerPattern && checkDoubleThree(board, r, c, player)) {
                    hints.push({ x: c, y: r, patternType: PATTERN_TYPE_DOUBLE_THREE, hintCategory });
                }
            }
        }
    }
    return hints;
}

// Store playerForOmni when evaluateAllPoints is called
// This is a bit of a hack due to the self.onmessage structure, ideally it's passed around.
self.playerForOmniInternal = null;


// Worker message handler
self.onmessage = function(e) {
    console.log('ai.worker.js: Message received from main script:', e.data);
    const { type, board, searchDepth, aiPlayer, playerForOmni } = e.data; // Added type and playerForOmni

    if (type === 'findBestMove') { // Existing functionality
        if (!board || typeof searchDepth === 'undefined') {
            console.error('ai.worker.js: Invalid data received for findBestMove.');
            self.postMessage({ type: 'error', error: 'Invalid data received by worker for findBestMove' });
            return;
        }
        // Ensure aiPlayer is valid, default to PLAYER_WHITE if not provided or invalid
        const effectiveAiPlayer = (aiPlayer === PLAYER_BLACK || aiPlayer === PLAYER_WHITE) ? aiPlayer : PLAYER_WHITE;

        const bestMoveResult = findBestMove(board, searchDepth, -Infinity, Infinity, true, effectiveAiPlayer);
        console.log('ai.worker.js: Calculation complete for findBestMove. Posting message back to main script:', bestMoveResult.move);
        self.postMessage({ type: 'bestMoveFound', move: bestMoveResult.move, score: bestMoveResult.score });

    } else if (type === 'evaluateAllPoints') { // New functionality for Omniscience
        if (!board || !playerForOmni) {
            console.error('ai.worker.js: Invalid data received for evaluateAllPoints. Board or playerForOmni missing.');
            self.postMessage({ type: 'error', error: 'Invalid data received by worker for evaluateAllPoints' });
            return;
        }

        const hints = [];
        // Make a copy of the board to ensure the original is not modified by scoreMoveHeuristically
        const boardCopy = board.map(row => [...row]);

        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                if (boardCopy[y][x] === EMPTY) {
                    // Pass the copy of the board to scoreMoveHeuristically
                    const score = scoreMoveHeuristically(boardCopy, x, y, playerForOmni);
                    // Only send back hints that have a positive score, indicating a potentially good move.
                    // A score of 0 might mean neutral or no specific advantage found by the heuristic.
                    if (score > 0) {
                        hints.push({ x, y, score });
                    }
                }
            }
        }
        // Store the player for whom omniscience is being calculated.
        self.playerForOmniInternal = playerForOmni;
        const opponent = (playerForOmni === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;

        // Get hints for the player's opportunities
        const playerOpportunities = getDetailedPatternHints(boardCopy, playerForOmni);

        // Get hints for the opponent's threats
        const opponentThreats = getDetailedPatternHints(boardCopy, opponent);

        // Combine hints. Prioritize more severe threats/opportunities if spots overlap.
        // For now, a simple concatenation. UI might need to handle overlaps if one spot is both.
        // Or, we can refine here. For example, if (x,y) is a win for player AND a win for opponent (unlikely but possible if board is nearly full), what to show?
        // Current getDetailedPatternHints prioritizes WIN for a player, so an opponent WIN threat might not be generated if player can WIN at the same spot.
        // This implies the player's WIN takes precedence in consideration.

        let combinedHints = [];

        // Add player opportunities, ensuring no duplicate coordinates from this category
        const playerOpportunityCoords = new Set();
        playerOpportunities.forEach(hint => {
            const coordKey = `${hint.x},${hint.y}`;
            if (!playerOpportunityCoords.has(coordKey)) {
                combinedHints.push(hint);
                playerOpportunityCoords.add(coordKey);
            }
        });

        // Add opponent threats, potentially filtering if a player opportunity is a win at the same spot.
        // If player can win at (x,y), that's the most important hint for that spot.
        opponentThreats.forEach(threat => {
            const isPlayerWinAtSameSpot = playerOpportunities.find(
                op => op.x === threat.x && op.y === threat.y && op.patternType === PATTERN_TYPE_FIVE_IN_A_ROW
            );
            if (!isPlayerWinAtSameSpot) {
                 // Avoid adding if the same spot is already a player opportunity (unless threat is a win and player op is not)
                const isPlayerOpportunityAtSameSpot = playerOpportunities.find(op => op.x === threat.x && op.y === threat.y);
                if (threat.patternType === PATTERN_TYPE_FIVE_IN_A_ROW || !isPlayerOpportunityAtSameSpot) {
                    // Add if threat is a win, or if no player opportunity exists there,
                    // or if we decide to allow both if they are different types (e.g. player forms 3, opp forms 4)
                    // For now, simple add if not a direct conflict with player win.
                    // We might need more sophisticated merging if a spot is, e.g., a player L4 and an opponent L4.
                    // The current getDetailedPatternHints structure should prevent multiple hints for the *same player* at one spot.
                    // But it allows one hint for player, one for opponent at the same spot.

                    // Check if this exact threat (coord + type) is already there (e.g. from player making a defensive five)
                    // This check is mostly redundant if categories are distinct, but good for safety.
                    const alreadyExists = combinedHints.some(h => h.x === threat.x && h.y === threat.y && h.hintCategory === threat.hintCategory && h.patternType === threat.patternType);
                    if(!alreadyExists) {
                        // If a player opportunity exists at the same spot, but it's NOT a win,
                        // and the opponent threat IS a win, the opponent threat should take precedence or be shown.
                        // For now, let's add opponent threats unless the player has a winning move there.
                        // The UI will ultimately decide how to display overlapping hints if any.
                         combinedHints.push(threat);
                    }
                }
            }
        });

        // Remove score as it's not used by the new system; patternType is key.
        const finalHints = combinedHints.map(({ x, y, patternType, hintCategory }) => ({ x, y, patternType, hintCategory }));

        console.log(`ai.worker.js: Evaluated points for omniscience. Player OPs: ${playerOpportunities.length}, Opponent Threats: ${opponentThreats.length}. Total unique hints sent: ${finalHints.length}`);
        self.postMessage({ type: 'omniEvaluationComplete', hints: finalHints });
        self.playerForOmniInternal = null; // Reset after use

    } else {
        console.error('ai.worker.js: Unknown message type received:', type);
        self.postMessage({ type: 'error', error: `Unknown message type: ${type}` });
    }
};

console.log("ai.worker.js loaded and ready for messages.");
