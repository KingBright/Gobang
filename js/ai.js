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
// Scores for different patterns, consistent with design.md "棋型库"
// Positive for AI (PLAYER_WHITE), negative for Player (PLAYER_BLACK) when evaluated by (AI_score - Player_score)
const PATTERN_SCORES = {
    FIVE_IN_A_ROW: 100000,  // 连五 (Victory)
    LIVE_FOUR: 10000,       // 活四 (⚪⚫⚫⚫⚫⚪)
    RUSH_FOUR: 1000,        // 冲四 (e.g., ❌⚫⚫⚫⚫⚪ or ⚪⚫⚫⚫⚫❌) - design.md had 1000, was 9000/8000
    LIVE_THREE: 1000,       // 活三 (⚪⚫⚫⚫⚪) - design.md had 1000
    SLEEP_THREE: 100,       // 眠三 (e.g., ❌⚫⚫⚫⚪) - design.md had 100, was 500/400
    LIVE_TWO: 100,          // 活二 (⚪⚫⚫⚪) - design.md had 100
    SLEEP_TWO: 10,          // 眠二 (❌⚫⚫⚪) - design.md had 10, was 50
    // LIVE_ONE and SLEEP_ONE are less critical for strategic evaluation, can be omitted for now or given very low scores if added.
    // DEAD_FOUR (e.g. XOOOOX) or other fully blocked patterns are typically score 0 or very low.
};


// Heuristic evaluation function for the current board state
// Returns a score where positive is good for AI (PLAYER_WHITE), negative for Player (PLAYER_BLACK)
function evaluateBoard(board, aiPlayer = PLAYER_WHITE) {
    const humanPlayer = (aiPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;

    const aiScore = calculateScoreForPlayer(board, aiPlayer);
    const playerScore = calculateScoreForPlayer(board, humanPlayer);

    // Check for immediate win/loss, which overrides other scores
    // Note: calculateScoreForPlayer should return PATTERN_SCORES.FIVE_IN_A_ROW if a five-in-a-row is found.
    // So, we can check this directly from the returned scores.
    // A score of PATTERN_SCORES.FIVE_IN_A_ROW or more signifies a win.
    if (aiScore >= PATTERN_SCORES.FIVE_IN_A_ROW) return PATTERN_SCORES.FIVE_IN_A_ROW * 10; // Prioritize AI win
    if (playerScore >= PATTERN_SCORES.FIVE_IN_A_ROW) return -PATTERN_SCORES.FIVE_IN_A_ROW * 10; // Prioritize blocking player win

    return aiScore - playerScore;
}

// Helper to calculate score for a specific player based on patterns
// This function iterates through each cell and, if it's the player's stone,
// checks for patterns starting at that stone in all directions.
function calculateScoreForPlayer(board, player) {
    let totalScore = 0;
    const directions = [
        { dr: 0, dc: 1 }, // Horizontal
        { dr: 1, dc: 0 }, // Vertical
        { dr: 1, dc: 1 }, // Diagonal \ (down-right)
        { dr: 1, dc: -1 } // Diagonal / (down-left)
    ];

    // To avoid counting the same pattern multiple times (e.g. a horizontal line of 5 starting at (0,0) and also at (0,1), etc.)
    // we can use a Set to store coordinates of stones already part of a counted valuable pattern in a specific direction.
    // However, a simpler approach for now is to ensure that `checkPattern` is robust and we sum scores.
    // The primary risk of overcounting is if a single line of stones forms multiple patterns (e.g. a live four also contains live threes).
    // The current `if/else if` structure in the plan will prevent this for a single starting point and direction.
    // We need to ensure that a line of 5 isn't also counted as a line of 4, 3 etc.
    // The order of checks (longest to shortest) handles this.

    const opponent = (player === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            // Only evaluate patterns originating from the player's own stones
            if (board[r][c] === player) {
                directions.forEach(dir => {
                    // Order of checks is important: from most valuable/longest to least.
                    // This prevents a five-in-a-row from also being counted as a four, three, etc., from the same starting point and direction.

                    // Check for 5-in-a-row (Victory Condition)
                    // For FIVE_IN_A_ROW, open ends are not strictly necessary as it's a win.
                    // The checkPattern for length 5 can ignore openStart/openEnd or pass null.
                    if (checkPattern(board, r, c, dir, player, 5)) { // No open-end check needed for win
                        totalScore += PATTERN_SCORES.FIVE_IN_A_ROW;
                    }
                    // Check for Live Four: ⚪⚫⚫⚫⚫⚪
                    else if (checkPattern(board, r, c, dir, player, 4, true, true)) {
                        totalScore += PATTERN_SCORES.LIVE_FOUR;
                    }
                    // Check for Rush Four: e.g., ❌⚫⚫⚫⚫⚪ (blocked one side, open other) or ⚪⚫⚫⚫⚫❌
                    else if (checkPattern(board, r, c, dir, player, 4, true, false, opponent) || // Open start, blocked end
                               checkPattern(board, r, c, dir, player, 4, false, true, opponent)) { // Blocked start, open end
                        totalScore += PATTERN_SCORES.RUSH_FOUR;
                    }
                    // Check for Live Three: ⚪⚫⚫⚫⚪
                    else if (checkPattern(board, r, c, dir, player, 3, true, true)) {
                        totalScore += PATTERN_SCORES.LIVE_THREE;
                    }
                    // Check for Sleep Three: e.g., ❌⚫⚫⚫⚪ or ⚪⚫⚫⚫❌
                    else if (checkPattern(board, r, c, dir, player, 3, true, false, opponent) || // Open start, blocked end
                               checkPattern(board, r, c, dir, player, 3, false, true, opponent)) { // Blocked start, open end
                        totalScore += PATTERN_SCORES.SLEEP_THREE;
                    }
                    // Check for Live Two: ⚪⚫⚫⚪
                    else if (checkPattern(board, r, c, dir, player, 2, true, true)) {
                        totalScore += PATTERN_SCORES.LIVE_TWO;
                    }
                    // Check for Sleep Two: e.g., ❌⚫⚫⚪ or ⚪⚫⚫⚪
                    else if (checkPattern(board, r, c, dir, player, 2, true, false, opponent) || // Open start, blocked end
                               checkPattern(board, r, c, dir, player, 2, false, true, opponent)) { // Blocked start, open end
                        totalScore += PATTERN_SCORES.SLEEP_TWO;
                    }
                });
            }
        }
    }
    return totalScore;
}

// Generalized pattern checker
// board: the game board
// r, c: starting row, col of the pattern sequence
// dir: direction {dr, dc}
// player: the player whose pattern we are checking
// length: expected length of the stone sequence (e.g., 4 for four-in-a-row)
// openStart (optional): Boolean. If true, spot before sequence must be EMPTY. If false, spot must be opponent or edge. If null, not checked.
// openEnd (optional): Boolean. If true, spot after sequence must be EMPTY. If false, spot must be opponent or edge. If null, not checked.
// opponent (optional): Player ID of the opponent. Required if openStart/openEnd is false (and not null).
function checkPattern(board, r, c, dir, player, length, openStart = null, openEnd = null, opponent = null) {
    // 1. Check if the sequence of `length` stones belongs to `player`
    // The pattern must start at (r,c) and extend for `length` stones.
    for (let i = 0; i < length; i++) {
        const curR = r + i * dir.dr;
        const curC = c + i * dir.dc;
        // If any stone in the sequence is out of bounds or not the player's, it's not this pattern.
        if (!isInBounds(curC, curR) || board[curR][curC] !== player) {
            return false;
        }
    }

    // 2. Check the status of the spot *before* the sequence (openStart)
    if (openStart !== null) { // Only check if openStart is true or false (not null)
        const beforeR = r - dir.dr;
        const beforeC = c - dir.dc;

        if (openStart === true) { // Must be EMPTY
            // If 'before' spot is out of bounds, it's not empty.
            // If 'before' spot is not EMPTY, condition fails.
            if (!isInBounds(beforeC, beforeR) || board[beforeR][beforeC] !== EMPTY) {
                return false;
            }
        } else { // openStart === false, means must be BLOCKED (by opponent or edge)
            if (opponent === null) {
                // This case should ideally be prevented by calling code, but as a safeguard:
                console.warn("checkPattern: opponent ID is null when checking for a blocked start.");
                return false; // Cannot confirm blockage without opponent ID
            }
            if (isInBounds(beforeC, beforeR)) { // If 'before' spot is in bounds...
                // ...it must be occupied by the opponent. If it's EMPTY or player's own, it's not correctly blocked.
                if (board[beforeR][beforeC] !== opponent) {
                    return false;
                }
            }
            // If 'before' spot is out of bounds (e.g., r - dir.dr < 0), it's considered blocked by the edge. This is valid.
        }
    }

    // 3. Check the status of the spot *after* the sequence (openEnd)
    if (openEnd !== null) { // Only check if openEnd is true or false (not null)
        const afterR = r + length * dir.dr; // Position of stone *after* the sequence of `length`
        const afterC = c + length * dir.dc;

        if (openEnd === true) { // Must be EMPTY
            // If 'after' spot is out of bounds, it's not empty.
            // If 'after' spot is not EMPTY, condition fails.
            if (!isInBounds(afterC, afterR) || board[afterR][afterC] !== EMPTY) {
                return false;
            }
        } else { // openEnd === false, means must be BLOCKED (by opponent or edge)
            if (opponent === null) {
                console.warn("checkPattern: opponent ID is null when checking for a blocked end.");
                return false; // Cannot confirm blockage
            }
            if (isInBounds(afterC, afterR)) { // If 'after' spot is in bounds...
                // ...it must be occupied by the opponent.
                if (board[afterR][afterC] !== opponent) {
                    return false;
                }
            }
            // If 'after' spot is out of bounds (e.g., r + length * dir.dr >= BOARD_SIZE), it's considered blocked by the edge. This is valid.
        }
    }

    return true; // All conditions for the pattern are met
}


// --- Minimax with Alpha-Beta Pruning ---
function findBestMove(board, depth, alpha, beta, maximizingPlayer, aiPlayer = PLAYER_WHITE) {
    if (depth === 0 || isGameOver(board, aiPlayer)) { // isGameOver needs to check for wins or draw
        return { score: evaluateBoard(board, aiPlayer), move: null };
    }

    const possibleMoves = getPossibleMoves(board); // Removed unused parameters
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
function getPossibleMoves(board) {
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
    // createsPattern internally determines opponent, so no need to pass it here.
    else if (createsPattern(tempBoard, x, y, player, 4, true, false) || createsPattern(tempBoard, x, y, player, 4, false, true)) score += PATTERN_SCORES.RUSH_FOUR / 10;
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

// Helper for evaluatePointOmniscience: checks if placing stone at (lastX, lastY) by `player` creates a specific pattern.
// `lastX`, `lastY` is the coordinate of the stone just placed by `player`.
function createsPattern(board, lastX, lastY, player, length, openStart, openEnd) {
    const directions = [
        { dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }
    ];
    const opponent = (player === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;

    for (const dir of directions) {
        // We need to check all possible start positions of a pattern of `length`
        // such that the pattern includes the stone at (lastX, lastY).
        // A pattern of `length` stones has `length` possible positions for the stone (lastX, lastY).
        // If (lastX, lastY) is the k-th stone in the pattern (0-indexed), then the pattern starts at:
        // startR = lastY - k * dir.dr
        // startC = lastX - k * dir.dc
        for (let k = 0; k < length; k++) { // k is the 0-indexed position of (lastX, lastY) within the pattern
            const startR = lastY - k * dir.dr;
            const startC = lastX - k * dir.dc;

            // Ensure the pattern actually starts at a valid stone of the player,
            // although checkPattern will verify the whole sequence.
            // More importantly, ensure (lastX, lastY) is indeed part of this checked pattern.
            // The current (r,c) for checkPattern is (startR, startC).
            // The stone at (lastX, lastY) must be board[startR + k*dir.dr][startC + k*dir.dc]
            // which is board[lastY][lastX], and it must be `player`. This is given.

            if (checkPattern(board, startR, startC, dir, player, length, openStart, openEnd, opponent)) {
                return true;
            }
        }
    }
    return false;
}


console.log("ai.js loaded. Exposing API via window.aiApi...");

window.aiApi = {
    aiMakeMove: aiMakeMove,
    setAiDifficulty: setAiDifficulty,
    // Exposing for Smart Undo and Omniscience features that might need them
    findBestMove: findBestMove,
    getPatternScores: () => { return {...PATTERN_SCORES}; }, // Return a copy to prevent modification
    evaluatePointOmniscience: evaluatePointOmniscience,
    // getCurrentAiLevel: () => currentAiDifficulty, // Example if main.js needed to read it
    // getDifficultyLevels: () => { return {...AI_DIFFICULTY_LEVELS}; }, // Example
};

