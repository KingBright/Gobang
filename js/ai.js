// Gomoku AI Logic

// AI difficulty levels (maps to search depth)
const AI_DIFFICULTY_LEVELS = {
    1: 1, // Novice (depth 1)
    2: 2, // Beginner (depth 2)
    3: 3, // Intermediate (depth 3)
    4: 4, // Advanced (depth 4)
    5: 5  // Expert (depth 5, might be slow without Web Workers)
};
let currentAiDifficulty = 3; // Default to Intermediate
let currentSearchDepth = AI_DIFFICULTY_LEVELS[currentAiDifficulty];

// --- Heuristic Evaluation ---
// Scores for different patterns. Positive for AI, negative for Player.
// These values are critical and will need tuning.
const PATTERN_SCORES = {
    FIVE_IN_A_ROW: 100000,      // ⚫⚫⚫⚫⚫ (Victory)
    LIVE_FOUR: 10000,           // ⚪⚫⚫⚫⚫⚪
    RUSH_FOUR_ONE_SIDED_BLOCK: 9000, // ❌⚫⚫⚫⚫⚪ (AI perspective, if AI can make this)
    RUSH_FOUR_OTHER_SIDED_BLOCK: 8000, // ⚪⚫⚫⚫⚫❌ (AI perspective)
    DEAD_FOUR: 0, // Should not happen or means blocked - no immediate value.
    
    LIVE_THREE: 1000,           // ⚪⚫⚫⚫⚪
    SLEEP_THREE_ONE_BLOCK: 500, // ❌⚫⚫⚫⚪ or ⚪⚫⚫⚫❌
    SLEEP_THREE_MIDDLE_BLOCK: 400, // ⚪⚫⚫⚪⚫⚪ (less valuable than open ended)

    LIVE_TWO: 100,              // ⚪⚫⚫⚪
    SLEEP_TWO: 50,              // ❌⚫⚫⚪ or ⚪⚫⚫⚪

    LIVE_ONE: 10,               // ⚪⚫⚪
    SLEEP_ONE: 5,               // ❌⚫⚪ or ⚪⚫❌

    // Defensive scores (when evaluating opponent's patterns to block)
    // These might be implicitly handled by (AI_score - Player_score)
    // or we can explicitly add scores for blocking opponent's strong patterns.
};


// Heuristic evaluation function for the current board state
// Returns a score where positive is good for AI (PLAYER_WHITE), negative for Player (PLAYER_BLACK)
function evaluateBoard(board, aiPlayer = PLAYER_WHITE) {
    let aiScore = 0;
    let playerScore = 0;
    const humanPlayer = (aiPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;

    // Evaluate for AI
    aiScore += calculateScoreForPlayer(board, aiPlayer);
    // Evaluate for Human Player
    playerScore += calculateScoreForPlayer(board, humanPlayer);
    
    // If AI has a winning move, prioritize it heavily
    if (hasWinningPattern(board, aiPlayer, PATTERN_SCORES.FIVE_IN_A_ROW)) return PATTERN_SCORES.FIVE_IN_A_ROW * 10; // Ensure it's much higher
    // If human has a winning move, AI must block it, also very high (negative) score
    if (hasWinningPattern(board, humanPlayer, PATTERN_SCORES.FIVE_IN_A_ROW)) return -PATTERN_SCORES.FIVE_IN_A_ROW * 10;

    return aiScore - playerScore;
}

function hasWinningPattern(board, player, winScoreThreshold) {
    // This is a simplified check. A full pattern check is more robust.
    // For actual win condition, checkWin in game.js is used.
    // This is for the evaluator to see if a FIVE_IN_A_ROW pattern exists.
    // The detailed pattern matching in calculateScoreForPlayer should identify this.
    // Let's rely on calculateScoreForPlayer to return a very high score for five-in-a-row.
    // This function might be redundant if calculateScoreForPlayer handles win scores correctly.
    return false; // Placeholder
}


// Helper to calculate score for a specific player based on patterns
function calculateScoreForPlayer(board, player) {
    let totalScore = 0;
    const directions = [
        { dr: 0, dc: 1 }, // Horizontal
        { dr: 1, dc: 0 }, // Vertical
        { dr: 1, dc: 1 }, // Diagonal \
        { dr: 1, dc: -1 } // Diagonal /
    ];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            // Evaluate patterns starting at (r,c) only if it's player's stone or empty (for potential)
            // For simplicity, let's focus on existing stones for now.
            // A more advanced eval would check empty spots for potential patterns.

            if (board[r][c] === player || board[r][c] === EMPTY) {
                 directions.forEach(dir => {
                    // Check for 5-in-a-row
                    if (checkPattern(board, r, c, dir, player, 5, true)) totalScore += PATTERN_SCORES.FIVE_IN_A_ROW;
                    // Check for Live Four
                    else if (checkPattern(board, r, c, dir, player, 4, true, true)) totalScore += PATTERN_SCORES.LIVE_FOUR;
                    // Check for Rush Four (one side open)
                    else if (checkPattern(board, r, c, dir, player, 4, true, false) || checkPattern(board, r, c, dir, player, 4, false, true)) totalScore += PATTERN_SCORES.RUSH_FOUR_ONE_SIDED_BLOCK; // Simplified for now
                    // Check for Live Three
                    else if (checkPattern(board, r, c, dir, player, 3, true, true)) totalScore += PATTERN_SCORES.LIVE_THREE;
                    // Check for Sleep Three
                    else if (checkPattern(board, r, c, dir, player, 3, true, false) || checkPattern(board, r, c, dir, player, 3, false, true)) totalScore += PATTERN_SCORES.SLEEP_THREE_ONE_BLOCK;
                    // Check for Live Two
                    else if (checkPattern(board, r, c, dir, player, 2, true, true)) totalScore += PATTERN_SCORES.LIVE_TWO;
                    // Check for Sleep Two
                    else if (checkPattern(board, r, c, dir, player, 2, true, false) || checkPattern(board, r, c, dir, player, 2, false, true)) totalScore += PATTERN_SCORES.SLEEP_TWO;
                    // Add more patterns like live one, sleep one if needed
                });
            }
        }
    }
    return totalScore;
}

// Generalized pattern checker
// board: the game board
// r, c: starting row, col
// dir: direction {dr, dc}
// player: the player whose pattern we are checking
// length: expected length of the stone sequence (e.g., 4 for four-in-a-row)
// openStart: true if the spot before the sequence must be empty
// openEnd: true if the spot after the sequence must be empty
function checkPattern(board, r, c, dir, player, length, openStart = null, openEnd = null) {
    // Check sequence of stones
    for (let i = 0; i < length; i++) {
        const curR = r + i * dir.dr;
        const curC = c + i * dir.dc;
        if (!isInBounds(curR, curC) || board[curR][curC] !== player) {
            return false; // Sequence broken or out of bounds
        }
    }

    // Check open ends if specified
    if (openStart !== null) {
        const beforeR = r - dir.dr;
        const beforeC = c - dir.dc;
        if (openStart) { // Must be empty
            if (!isInBounds(beforeR, beforeC) || board[beforeR][beforeC] !== EMPTY) return false;
        } else { // Must be blocked (or edge)
            if (isInBounds(beforeR, beforeC) && board[beforeR][beforeC] === EMPTY) return false;
            // If it's out of bounds, it's considered blocked by the edge.
        }
    }

    if (openEnd !== null) {
        const afterR = r + length * dir.dr;
        const afterC = c + length * dir.dc;
        if (openEnd) { // Must be empty
            if (!isInBounds(afterR, afterC) || board[afterR][afterC] !== EMPTY) return false;
        } else { // Must be blocked (or edge)
            if (isInBounds(afterR, afterC) && board[afterR][afterC] === EMPTY) return false;
             // If it's out of bounds, it's considered blocked by the edge.
        }
    }
    return true;
}


// --- Minimax with Alpha-Beta Pruning ---
function findBestMove(board, depth, alpha, beta, maximizingPlayer, aiPlayer = PLAYER_WHITE) {
    if (depth === 0 || isGameOver(board, aiPlayer)) { // isGameOver needs to check for wins or draw
        return { score: evaluateBoard(board, aiPlayer), move: null };
    }

    const possibleMoves = getPossibleMoves(board, aiPlayer, maximizingPlayer);
    if (possibleMoves.length === 0) { // No moves left, should be a draw or handled by isGameOver
         return { score: evaluateBoard(board, aiPlayer), move: null };
    }

    let bestMove = null;

    if (maximizingPlayer) { // AI's turn (wants to maximize score)
        let maxEval = -Infinity;
        for (const move of possibleMoves) {
            const tempBoard = makeTemporaryMove(board, move.x, move.y, aiPlayer);
            const currentEval = findBestMove(tempBoard, depth - 1, alpha, beta, false, aiPlayer).score;
            if (currentEval > maxEval) {
                maxEval = currentEval;
                bestMove = move;
            }
            alpha = Math.max(alpha, currentEval);
            if (beta <= alpha) {
                break; // Beta cut-off
            }
        }
        return { score: maxEval, move: bestMove };
    } else { // Opponent's turn (wants to minimize AI's score)
        let minEval = Infinity;
        const opponentPlayer = (aiPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
        for (const move of possibleMoves) {
            const tempBoard = makeTemporaryMove(board, move.x, move.y, opponentPlayer);
            const currentEval = findBestMove(tempBoard, depth - 1, alpha, beta, true, aiPlayer).score;
            if (currentEval < minEval) {
                minEval = currentEval;
                bestMove = move; // This move is from opponent's perspective
            }
            beta = Math.min(beta, currentEval);
            if (beta <= alpha) {
                break; // Alpha cut-off
            }
        }
        // For the opponent's move, we return the minEval, but the 'move' itself
        // isn't directly used by the AI to make ITS move, rather to explore the tree.
        // The top-level call to findBestMove will use the 'move' from its maximizing context.
        return { score: minEval, move: bestMove };
    }
}

// Helper to check if game is over on a temporary board
function isGameOver(board, aiPlayer) {
    // Check for win for AI
    if (checkWinForPlayer(board, aiPlayer)) return true;
    // Check for win for Human
    const humanPlayer = (aiPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
    if (checkWinForPlayer(board, humanPlayer)) return true;
    // Check for draw
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === EMPTY) return false; // Game not over, empty cell exists
        }
    }
    return true; // Board is full, draw
}

// checkWinForPlayer: checks win for a specific player on a given board state
// This is different from game.js's checkWin which uses the last move.
// This needs to scan the board or be efficient.
function checkWinForPlayer(currentBoard, player) {
    // Iterate over all cells and use a similar logic to game.js's checkWin
    // but without relying on a "last move".
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
                        if (isInBounds(x, y) && currentBoard[y][x] === player) {
                            count++;
                        } else {
                            break;
                        }
                    }
                    if (count === WINNING_LENGTH) return true;
                }
            }
        }
    }
    return false;
}


// Get possible moves (empty cells, potentially optimized)
function getPossibleMoves(board, forPlayer, isMaximizingTurn) {
    const moves = [];
    // Optimization: only consider moves near existing stones
    const occupiedCells = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== EMPTY) {
                occupiedCells.push({ r, c });
            }
        }
    }

    if (occupiedCells.length === 0) { // First move of the game
        moves.push({ x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) }); // Center
        return moves;
    }

    const candidates = new Set();
    const range = 2; // Consider cells within this range of any existing stone

    occupiedCells.forEach(cell => {
        for (let dr = -range; dr <= range; dr++) {
            for (let dc = -range; dc <= range; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = cell.r + dr;
                const c = cell.c + dc;
                if (isInBounds(c, r) && board[r][c] === EMPTY) {
                    candidates.add(`${c}-${r}`);
                }
            }
        }
    });
    
    if (candidates.size === 0 && occupiedCells.length > 0 && occupiedCells.length < BOARD_SIZE * BOARD_SIZE) {
        // This case (no empty cells near existing stones, but board not full) should ideally not happen if range is sufficient.
        // Fallback to all empty cells if candidate generation is too restrictive.
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === EMPTY) {
                    moves.push({ x: c, y: r });
                }
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

// Make a temporary move on a copy of the board
function makeTemporaryMove(originalBoard, x, y, player) {
    const tempBoard = originalBoard.map(row => [...row]);
    if (isInBounds(x, y) && tempBoard[y][x] === EMPTY) {
        tempBoard[y][x] = player;
    }
    return tempBoard;
}

// Main function for AI to make a move
function aiMakeMove(currentBoard) {
    console.log(`AI (Player ${PLAYER_WHITE}) is thinking with depth ${currentSearchDepth}...`);
    const { score, move } = findBestMove(currentBoard, currentSearchDepth, -Infinity, Infinity, true, PLAYER_WHITE);
    
    if (move) {
        console.log(`AI chose move: (${move.x}, ${move.y}) with score: ${score}`);
        return move; // This move will be passed to game.js's makeMove
    } else {
        console.error("AI could not find a move.");
        // Fallback: find any valid empty spot (should not happen if getPossibleMoves is robust)
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (currentBoard[r][c] === EMPTY) return { x: c, y: r };
            }
        }
        return null; // No move possible (board full)
    }
}

function setAiDifficulty(level) {
    if (AI_DIFFICULTY_LEVELS[level]) {
        currentAiDifficulty = level;
        currentSearchDepth = AI_DIFFICULTY_LEVELS[level];
        console.log(`AI difficulty set to ${level}, search depth ${currentSearchDepth}`);
    } else {
        console.error(`Invalid AI difficulty level: ${level}`);
    }
}


// --- Omniscience Mode Helpers ---
// Simplified evaluation for a single point for Omniscience mode display
function evaluatePointOmniscience(board, x, y, player) {
    // This function needs to be fast.
    // It could check for immediate threats or opportunities if 'player' places a stone at (x,y).
    // For example, does placing here create a live three, rush four, or block opponent's similar pattern?

    let score = 0;
    const tempBoard = makeTemporaryMove(board, x, y, player);

    // Check for immediate win
    if (checkWinForPlayer(tempBoard, player)) {
        return PATTERN_SCORES.FIVE_IN_A_ROW;
    }

    // Check for creating a live four
    if (createsPattern(tempBoard, x, y, player, 4, true, true)) score += PATTERN_SCORES.LIVE_FOUR / 10; // Scaled down for point eval
    // Check for creating a rush four
    else if (createsPattern(tempBoard, x, y, player, 4, true, false) || createsPattern(tempBoard, x, y, player, 4, false, true)) score += PATTERN_SCORES.RUSH_FOUR_ONE_SIDED_BLOCK / 10;
    // Check for creating a live three
    else if (createsPattern(tempBoard, x, y, player, 3, true, true)) score += PATTERN_SCORES.LIVE_THREE / 10;
    
    // Check for blocking opponent's patterns
    const opponent = (player === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
    // If placing at (x,y) blocks an opponent's potential win/strong move.
    // This requires checking opponent's patterns around (x,y) *before* player places the stone.
    // For simplicity, evaluatePointOmniscience primarily focuses on the positive impact of the move for `player`.
    // Defensive hints can be generated by calling this for the opponent on the *original* board.
    
    return score;
}

// Helper for evaluatePointOmniscience: checks if placing stone at (lastX, lastY) creates a specific pattern
function createsPattern(board, lastX, lastY, player, length, openStart, openEnd) {
    const directions = [
        { dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 } 
    ];
    for (const dir of directions) {
        // Check patterns centered around or starting/ending at (lastX, lastY)
        // This requires checking up to 'length-1' stones in each direction from (lastX, lastY)
        for (let i = 0; i < length; i++) {
            const startR = lastY - i * dir.dr;
            const startC = lastX - i * dir.dc;
            if (checkPattern(board, startR, startC, dir, player, length, openStart, openEnd)) {
                return true;
            }
        }
    }
    return false;
}


console.log("ai.js loaded");

