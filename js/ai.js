// Gomoku AI Logic - Refactored for Negamax

// AI difficulty levels (maps to search depth and randomness config)
const AI_DIFFICULTY_CONFIG = {
    1: { depth: 2, name: "Novice", topN: 5, randomChance: 0.80 },    // 80% chance from top 5
    2: { depth: 4, name: "Apprentice", topN: 3, randomChance: 0.50 }, // 50% chance from top 3
    3: { depth: 6, name: "Adept", topN: 2, randomChance: 0.10 },      // 10% chance from top 2 (次优)
    4: { depth: 8, name: "Expert", topN: 1, randomChance: 0 },       // Always best
    5: { depth: 10, name: "Master", topN: 1, randomChance: 0 }       // Always best (depth 10-12, using 10)
};
let currentAiDifficulty = 3; // Default to Adept
let currentSearchDepth = AI_DIFFICULTY_CONFIG[currentAiDifficulty].depth;

// Transposition Table
let transpositionTable = {};
const TT_FLAG_EXACT = 0;
const TT_FLAG_LOWERBOUND = 1; // Value is at least this score (fail-high)
const TT_FLAG_UPPERBOUND = 2; // Value is at most this score (fail-low)

// Attempt to initialize Zobrist hashing.
// This relies on global constants (BOARD_SIZE, PLAYER_BLACK, etc.) being available.
// If they are loaded by a script after zobrist.js but before ai.js, this should work.
if (window.zobristUtils && typeof window.zobristUtils.initZobrist === 'function') {
    if (!window.zobristUtils.initZobrist()) {
        console.error("AI: Zobrist initialization failed. Transposition table will be ineffective.");
    }
} else {
    console.error("AI: zobristUtils not available. Transposition table will be ineffective.");
}


// Placeholder, will be replaced by js/score.js
const PATTERN_SCORES = {
    FIVE_IN_A_ROW: 100000,
    FOUR_IN_A_ROW: 10000,
    THREE_IN_A_ROW: 1000,
    TWO_IN_A_ROW: 100,
};

// --- Helper Functions ---
function reverseRole(role) {
    return role === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
}

// Heuristic move generation: only considers moves near existing pieces.
function generateMoves(board) {
    const moves = new Set(); // Use a Set to avoid duplicate moves
    const occupiedCells = [];
    let hasPieces = false;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== EMPTY) {
                hasPieces = true;
                occupiedCells.push({ r, c });
            }
        }
    }

    if (!hasPieces) {
        // Board is empty, suggest center move or a few strategic points
        // For simplicity, just the center. If BOARD_SIZE is even, pick one of the 4 centers.
        const centerR = Math.floor((BOARD_SIZE -1) / 2);
        const centerC = Math.floor((BOARD_SIZE -1) / 2);
        moves.add(`${centerR}-${centerC}`); // Store as string to manage in Set easily
        // Add other center points if board size is even
        if (BOARD_SIZE % 2 === 0) {
            moves.add(`${centerR+1}-${centerC}`);
            moves.add(`${centerR}-${centerC+1}`);
            moves.add(`${centerR+1}-${centerC+1}`);
        }

    } else {
        const vicinityRadius = 1; // Consider cells within 1-unit distance (Manhattan or Chebyshev)
                                 // Let's use Chebyshev distance (a square around the piece)
        occupiedCells.forEach(cell => {
            for (let dr = -vicinityRadius; dr <= vicinityRadius; dr++) {
                for (let dc = -vicinityRadius; dc <= vicinityRadius; dc++) {
                    if (dr === 0 && dc === 0) continue; // Skip the piece itself

                    const nr = cell.r + dr;
                    const nc = cell.c + dc;

                    if (isInBounds(nc, nr) && board[nr][nc] === EMPTY) { // isInBounds from utils.js
                        moves.add(`${nr}-${nc}`);
                    }
                }
            }
        });
    }

    // Convert string coordinates back to objects
    const uniqueMoves = [];
    moves.forEach(mStr => {
        const parts = mStr.split('-');
        uniqueMoves.push({ y: parseInt(parts[0], 10), x: parseInt(parts[1], 10) });
    });

    // Fallback if no moves are generated (e.g., board is full but no win, or error in logic)
    if (uniqueMoves.length === 0 && hasPieces) {
        console.warn("Heuristic move generation resulted in no moves. Falling back to all empty cells.");
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === EMPTY) {
                    uniqueMoves.push({ y: r, x: c });
                }
            }
        }
    }

    return uniqueMoves;
}

// Evaluation function to be replaced by score.js integration
// This function is now a wrapper around the more sophisticated evaluation in score.js
function evaluateBoard(board, playerForPerspective) {
    if (window.scoreUtils && typeof window.scoreUtils.evaluateBoardScore === 'function') {
        // The evaluateBoardScore from score.js should return score from perspective of 'playerForPerspective'
        // Positive good for playerForPerspective, negative good for opponent.
        return window.scoreUtils.evaluateBoardScore(board, playerForPerspective);
    } else {
        console.error("scoreUtils.evaluateBoardScore is not available. Falling back to basic evaluation.");
        // Fallback to a very basic evaluation if score.js is not loaded (should not happen in production)
        // This rudimentary check is NOT a substitute for the real evaluation.
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] !== EMPTY) {
                    // Simplified win check (assumes WINNING_LENGTH and isInBounds are available)
                    const isWin = (b, p, y, x) => {
                        if (p === EMPTY) return false;
                        const DIRS = [[0,1],[1,0],[1,1],[1,-1]];
                        for(const [dr, dc] of DIRS) {
                            let count = 1;
                            for(let i=1;i<WINNING_LENGTH;i++) { if(isInBounds(y+dr*i,x+dc*i) && b[y+dr*i][x+dc*i]===p) count++; else break; }
                            for(let i=1;i<WINNING_LENGTH;i++) { if(isInBounds(y-dr*i,x-dc*i) && b[y-dr*i][x-dc*i]===p) count++; else break; }
                            if(count>=WINNING_LENGTH) return true;
                        }
                        return false;
                    };
                    if (isWin(board, board[r][c], r, c)) {
                         return board[r][c] === playerForPerspective ? PATTERN_SCORES.FIVE_IN_A_ROW : -PATTERN_SCORES.FIVE_IN_A_ROW;
                    }
                }
            }
        }
        return 0;
    }
}


// --- Negamax Algorithm ---
/**
 * Negamax search with Alpha-Beta Pruning. Operates on the provided board copy.
 * @param {Array<Array<number>>} board - The current game board state (should be a mutable copy).
 * @param {number} depth - Current search depth.
 * @param {number} alpha - Alpha value for pruning.
 * @param {number} beta - Beta value for pruning.
 * @param {number} role - The current player's role (PLAYER_BLACK or PLAYER_WHITE) for this node.
 * @param {number} aiPlayer - The AI's actual color (used for consistent evaluation perspective if needed by eval).
 * @returns {number} The score of the current board state for the 'role' player.
 */
function negamax(board, depth, alpha, beta, role, aiPlayer) {
    const originalAlpha = alpha; // Store original alpha for TT flag determination

    // --- Transposition Table Lookup ---
    let hash = -1; // Default if Zobrist fails
    if (window.zobristUtils && typeof window.zobristUtils.computeZobristHash === 'function') {
        hash = window.zobristUtils.computeZobristHash(board, role);
        const ttEntry = transpositionTable[hash];
        if (ttEntry && ttEntry.depth >= depth) {
            if (ttEntry.flag === TT_FLAG_EXACT) {
                return ttEntry.score;
            } else if (ttEntry.flag === TT_FLAG_LOWERBOUND) {
                alpha = Math.max(alpha, ttEntry.score);
            } else if (ttEntry.flag === TT_FLAG_UPPERBOUND) {
                beta = Math.min(beta, ttEntry.score);
            }
            if (alpha >= beta) {
                return ttEntry.score; // Or the bound that caused cutoff (alpha or beta)
            }
        }
    }
    // --- End TT Lookup ---

    if (depth === 0) {
        const evalScore = evaluateBoard(board, role);
        // Store leaf node evaluations if hash is valid
        if (hash !== -1 && window.zobristUtils) { // Check zobristUtils to ensure it was available for hash
             transpositionTable[hash] = { depth: 0, score: evalScore, flag: TT_FLAG_EXACT };
        }
        return evalScore;
    }

    let bestValue = -Infinity;
    const generatedMoves = generateMoves(board);

    // --- Move Ordering ---
    const scoredMoves = [];
    for (const move of generatedMoves) {
        if (board[move.y][move.x] === EMPTY) {
            board[move.y][move.x] = role; // Try the move
            // Evaluate from the perspective of the current player (role)
            // A higher score means this move is immediately better for 'role'
            const score = evaluateBoard(board, role);
            board[move.y][move.x] = EMPTY; // Undo the move
            scoredMoves.push({ move: move, score: score });
        } else {
            // Should not happen if generateMoves is correct
            console.warn("Move ordering: generated move was on an occupied cell", move);
        }
    }
    // Sort moves by score in descending order (best moves first)
    scoredMoves.sort((a, b) => b.score - a.score);
    // --- End of Move Ordering ---

    for (let i = 0; i < scoredMoves.length; i++) {
        const move = scoredMoves[i].move; // Get the move object from sorted list

        // Directly manipulate the 'board' copy passed to this function
        // No need to check for EMPTY again if generateMoves and ordering logic are correct
        board[move.y][move.x] = role; // Make move

        let val = -negamax(board, depth - 1, -beta, -alpha, reverseRole(role), aiPlayer);

        board[move.y][move.x] = EMPTY; // Undo move

        if (val > bestValue) {
            bestValue = val;
        }
        if (bestValue > alpha) {
            alpha = bestValue;
        }
        if (alpha >= beta) {
            break; // Beta cut-off
        }
    }

    // --- Store in Transposition Table ---
    if (hash !== -1 && window.zobristUtils) { // Check zobristUtils to ensure hash is valid
        let flag;
        if (bestValue <= originalAlpha) { // Failed low (actual score might be even lower)
            flag = TT_FLAG_UPPERBOUND;
        } else if (bestValue >= beta) { // Failed high (actual score might be even higher)
            flag = TT_FLAG_LOWERBOUND;
        } else { // Score is exact within the original alpha-beta window
            flag = TT_FLAG_EXACT;
        }
        transpositionTable[hash] = { depth: depth, score: bestValue, flag: flag };
    }
    // --- End TT Store ---

    return bestValue;
}


// --- Main AI Function ---
function aiMakeMove(initialBoard) { // initialBoard is from gameApi.getBoard() which is a deep copy
    return new Promise((resolve, reject) => {
        // Determine AI's role from the game state if not fixed.
        // For now, assuming AI is always the current player when this is called.
        // This might need adjustment if gameApi.getCurrentPlayer() changes during AI's turn by other means.
        const aiPlayerRole = window.gameApi.getCurrentPlayer();
        if (!aiPlayerRole || (aiPlayerRole !== PLAYER_BLACK && aiPlayerRole !== PLAYER_WHITE)) {
            console.error("aiMakeMove: Could not determine a valid AI player role.", aiPlayerRole);
            reject(new Error("Invalid AI player role."));
            return;
        }

        console.log(`AI (Player ${aiPlayerRole}) is thinking with depth ${currentSearchDepth}...`);

        const rootMoves = generateMoves(initialBoard);
        if (rootMoves.length === 0) {
            console.log("AI: No possible moves.");
            resolve(null);
            return;
        }

        let allScoredRootMoves = [];
        let alpha = -Infinity;
        let beta = Infinity;

        // Evaluate all root moves
        for (let i = 0; i < rootMoves.length; i++) {
            const move = rootMoves[i];
            const boardCopy = window.deepCopyBoard ? window.deepCopyBoard(initialBoard) : JSON.parse(JSON.stringify(initialBoard));

            if (boardCopy[move.y][move.x] === EMPTY) {
                boardCopy[move.y][move.x] = aiPlayerRole;
                let score = -negamax(boardCopy, currentSearchDepth - 1, -beta, -alpha, reverseRole(aiPlayerRole), aiPlayerRole);
                allScoredRootMoves.push({ move: move, score: score });

                // Update alpha for the root, as negamax calls might have improved it.
                // This helps subsequent negamax calls for other root moves be more efficient.
                if (score > alpha) {
                    alpha = score;
                }
            }
        }

        // Sort all evaluated root moves by score in descending order
        allScoredRootMoves.sort((a, b) => b.score - a.score);

        if (allScoredRootMoves.length === 0) {
             // Fallback if something went wrong and no moves were scored (e.g. all were invalid somehow)
            if (rootMoves.length > 0) {
                console.warn("AI: No valid moves were scored, picking first generated move.");
                resolve(rootMoves[0]);
            } else { // Should be caught by earlier check
                reject(new Error("AI has no moves and could not make a decision."));
            }
            return;
        }

        let finalMove;
        const difficultySetting = AI_DIFFICULTY_CONFIG[currentAiDifficulty];
        const randomFactor = Math.random();

        if (randomFactor < difficultySetting.randomChance && allScoredRootMoves.length > 0) {
            // Select randomly from top N moves
            const topNCount = Math.min(difficultySetting.topN, allScoredRootMoves.length);
            const selectedIndex = Math.floor(Math.random() * topNCount);
            finalMove = allScoredRootMoves[selectedIndex].move;
            console.log(`AI (Lvl ${currentAiDifficulty}-${difficultySetting.name}) randomly chose from top ${topNCount}. Move: (${finalMove.x}, ${finalMove.y}), score: ${allScoredRootMoves[selectedIndex].score}`);
        } else {
            // Select the best move
            finalMove = allScoredRootMoves[0].move;
            console.log(`AI (Lvl ${currentAiDifficulty}-${difficultySetting.name}) chose best move: (${finalMove.x}, ${finalMove.y}), score: ${allScoredRootMoves[0].score}`);
        }

        resolve(finalMove);
    });
}


function setAiDifficulty(level) {
    if (AI_DIFFICULTY_CONFIG[level]) {
        currentAiDifficulty = level;
        currentSearchDepth = AI_DIFFICULTY_CONFIG[level].depth;
        console.log(`AI difficulty set to Level ${level} (${AI_DIFFICULTY_CONFIG[level].name}), search depth ${currentSearchDepth}.`);
    } else {
        console.error(`Invalid AI difficulty level: ${level}`);
    }
}

console.log("ai.js (refactored with Negamax - corrected board handling) loaded.");

window.aiApi = {
    aiMakeMove: aiMakeMove,
    setAiDifficulty: setAiDifficulty,
    getPatternScores: () => { return {...PATTERN_SCORES}; },
};

// Assumed global constants/functions (should be loaded via utils.js or similar):
// PLAYER_BLACK, PLAYER_WHITE, EMPTY, BOARD_SIZE, WINNING_LENGTH
// isInBounds(x, y)
// deepCopyBoard(board) - from utils.js, used in aiMakeMove for safety.
// If deepCopyBoard is not available, a simple JSON.parse(JSON.stringify(board)) is used as a fallback.
// gameApi.getCurrentPlayer() - used to determine AI's role.
