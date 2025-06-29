// Gomoku AI Logic - Refactored for Negamax

// --- Board Class (Encapsulates board state, Zobrist, history, evaluator) ---
class Board {
    constructor(size, playerBlackConst, playerWhiteConst, emptyValConst, existingCellsArray = null, currentPlayerFromState = null, existingHistory = null) {
        this.size = size;
        this.PLAYER_BLACK = playerBlackConst;
        this.PLAYER_WHITE = playerWhiteConst;
        this.EMPTY = emptyValConst;

        this.cells = Array(size).fill(null).map(() => Array(size).fill(this.EMPTY));
        this.history = [];
        this.currentPlayer = currentPlayerFromState || this.PLAYER_BLACK;

        if (!window.Zobrist) {
            console.error("Zobrist class not found on window. Make sure zobrist.js is loaded.");
            this.zobrist = { togglePiece: () => {}, getHash: () => BigInt(0), computeFullHash: () => {} }; // Dummy
        } else {
            this.zobrist = new Zobrist(this.size, this.PLAYER_BLACK, this.PLAYER_WHITE);
        }

        if (!window.Evaluate) {
            console.error("Evaluate class not found on window. Make sure evaluate.js is loaded.");
            this.evaluator = {
                move: () => {}, undo: () => {}, evaluateBoard: () => 0,
                getMoves: () => []
            }; // Dummy
        } else {
            // Initialize evaluator AFTER cells might be populated if existingCellsArray is provided
        }

        if (existingCellsArray) {
            for (let r_idx = 0; r_idx < size; r_idx++) {
                for (let c_idx = 0; c_idx < size; c_idx++) {
                    this.cells[r_idx][c_idx] = existingCellsArray[r_idx][c_idx];
                }
            }
            this.zobrist.computeFullHash(this.cells, { EMPTY_VAL: this.EMPTY });
            if (window.Evaluate) {
                 this.evaluator = new Evaluate(this.size, this.PLAYER_BLACK, this.PLAYER_WHITE, this.EMPTY);
                 for (let r_idx = 0; r_idx < this.size; r_idx++) {
                    for (let c_idx = 0; c_idx < this.size; c_idx++) {
                        this.evaluator.board[r_idx+1][c_idx+1] = this.cells[r_idx][c_idx];
                    }
                 }
                 for (let r_idx = 0; r_idx < this.size; r_idx++) {
                    for (let c_idx = 0; c_idx < this.size; c_idx++) {
                        if (this.evaluator.board[r_idx + 1][c_idx + 1] === this.EMPTY) {
                            this.evaluator._updateSinglePointScore(r_idx, c_idx, this.PLAYER_BLACK);
                            this.evaluator._updateSinglePointScore(r_idx, c_idx, this.PLAYER_WHITE);
                        } else {
                            const pIdxBlack = this.evaluator.playerIndexMap[this.PLAYER_BLACK];
                            const pIdxWhite = this.evaluator.playerIndexMap[this.PLAYER_WHITE];
                            if (pIdxBlack !== undefined) this.evaluator.pointScores[pIdxBlack][r_idx][c_idx] = 0;
                            if (pIdxWhite !== undefined) this.evaluator.pointScores[pIdxWhite][r_idx][c_idx] = 0;
                        }
                    }
                }
            }
            if (existingHistory) {
                this.history = JSON.parse(JSON.stringify(existingHistory));
            }
        } else {
            if (window.Evaluate) {
                 this.evaluator = new Evaluate(this.size, this.PLAYER_BLACK, this.PLAYER_WHITE, this.EMPTY);
            }
        }
    }

    put(r, c, player) {
        const roleToPlay = player !== undefined ? player : this.currentPlayer;
        if (r < 0 || r >= this.size || c < 0 || c >= this.size || this.cells[r][c] !== this.EMPTY) {
            return false;
        }
        this.cells[r][c] = roleToPlay;
        this.history.push({ r, c, player: roleToPlay });
        this.zobrist.togglePiece(r, c, roleToPlay);
        if (this.evaluator && typeof this.evaluator.move === 'function') {
            this.evaluator.move(r, c, roleToPlay);
        }
        this.currentPlayer = (roleToPlay === this.PLAYER_BLACK) ? this.PLAYER_WHITE : this.PLAYER_BLACK;
        return true;
    }

    undo() {
        if (this.history.length === 0) return false;
        const lastMove = this.history.pop();
        const originalPlayerRole = lastMove.player;
        this.cells[lastMove.r][lastMove.c] = this.EMPTY;
        this.zobrist.togglePiece(lastMove.r, lastMove.c, originalPlayerRole);
        if (this.evaluator && typeof this.evaluator.undo === 'function') {
            this.evaluator.undo(lastMove.r, lastMove.c, originalPlayerRole);
        }
        this.currentPlayer = originalPlayerRole;
        return true;
    }

    getHash() {
        return this.zobrist.getHash();
    }

    getMoves(playerRole, currentSearchPly, onlyThree = false, onlyFour = false) {
        if (this.evaluator && typeof this.evaluator.getMoves === 'function') {
            return this.evaluator.getMoves(playerRole, currentSearchPly, onlyThree, onlyFour);
        }
        console.warn("Board.getMoves called but evaluator is not fully available. Returning basic moves.");
        // Basic fallback if evaluator is dummy or getMoves is missing
        let moves = [];
        for (let r_idx = 0; r_idx < this.size; r_idx++) {
            for (let c_idx = 0; c_idx < this.size; c_idx++) {
                if (this.cells[r_idx][c_idx] === this.EMPTY) {
                    moves.push({ y: r_idx, x: c_idx });
                }
            }
        }
        return moves;
    }

    evaluate(roleForPerspective) {
        if (this.evaluator && typeof this.evaluator.evaluateBoard === 'function') {
            return this.evaluator.evaluateBoard(roleForPerspective);
        }
        console.warn("Board.evaluate called but evaluator is not fully available. Returning 0.");
        return 0;
    }

    deepCopy() {
        const newBoardInst = new Board(
            this.size,
            this.PLAYER_BLACK,
            this.PLAYER_WHITE,
            this.EMPTY,
            this.cells,
            this.currentPlayer,
            this.history
        );
        return newBoardInst;
    }
}
// --- End Board Class ---


// AI difficulty levels (maps to search depth and randomness config)
const AI_DIFFICULTY_CONFIG = {
    1: { depth: 2, name: "Novice", topN: 5, randomChance: 0.80 },
    2: { depth: 4, name: "Apprentice", topN: 3, randomChance: 0.50 },
    3: { depth: 6, name: "Adept", topN: 2, randomChance: 0.10 },
    4: { depth: 8, name: "Expert", topN: 1, randomChance: 0 },
    5: { depth: 10, name: "Master", topN: 1, randomChance: 0 }
};
let currentAiDifficulty = 3; // Default to Adept

// --- Heuristics ---
const MAX_REMAINING_DEPTH_FOR_HEURISTICS = AI_DIFFICULTY_CONFIG[5].depth;
let killerMoves = Array(MAX_REMAINING_DEPTH_FOR_HEURISTICS).fill(null).map(() => [null, null]);
let historyTable = {};

function resetKillerMoves() {
    killerMoves = Array(MAX_REMAINING_DEPTH_FOR_HEURISTICS).fill(null).map(() => [null, null]);
}
// --- End Heuristics ---

// Transposition Table
let transpositionTable = {};
const TT_FLAG_EXACT = 0;
const TT_FLAG_LOWERBOUND = 1;
const TT_FLAG_UPPERBOUND = 2;

// Zobrist class is expected to be on window.Zobrist
// Evaluate class is expected to be on window.Evaluate
if (!window.Zobrist) {
    console.error("AI: Zobrist class (window.Zobrist) not available. Hashing will fail.");
}
if (!window.Evaluate) {
    console.error("AI: Evaluate class (window.Evaluate) not available. Evaluation and move gen will fail.");
}

const PATTERN_SCORES = { // Legacy, might be used if Evaluate class fails.
    FIVE_IN_A_ROW: 100000,
};

// --- Helper Functions ---
function reverseRole(role) {
    return role === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
}

// --- Negamax Algorithm ---
function negamax(boardInstance, remainingDepth, alpha, beta, role, aiPlayer) {
    const originalAlpha = alpha;
    const pieceHash = boardInstance.getHash();
    const ttKey = `${pieceHash.toString()}-${role}`;

    const ttEntry = transpositionTable[ttKey];
    let ttBestMove = null;

    if (ttEntry && ttEntry.depth >= remainingDepth && ttEntry.role === role) {
        if (ttEntry.bestMove) {
            ttBestMove = ttEntry.bestMove;
        }
        if (ttEntry.flag === TT_FLAG_EXACT) return ttEntry.score;
        if (ttEntry.flag === TT_FLAG_LOWERBOUND) alpha = Math.max(alpha, ttEntry.score);
        else if (ttEntry.flag === TT_FLAG_UPPERBOUND) beta = Math.min(beta, ttEntry.score);
        if (alpha >= beta) return ttEntry.score;
    }

    if (remainingDepth === 0) {
        return quiescenceSearch(boardInstance, alpha, beta, role, aiPlayer, MAX_QUIESCENCE_DEPTH);
    }

    let bestValue = -Infinity;
    const generatedMoves = boardInstance.getMoves(role, remainingDepth);
    let bestMoveForThisNode = null;

    let movesWithScores = [];
    if (ttBestMove) {
        let isValidTTMove = false;
        for(const genMove of generatedMoves) {
            if (genMove.x === ttBestMove.x && genMove.y === ttBestMove.y) {
                isValidTTMove = true;
                break;
            }
        }
        if (isValidTTMove) {
            movesWithScores.push({move: ttBestMove, orderScore: Infinity});
        } else {
            ttBestMove = null;
        }
    }

    for (const move of generatedMoves) {
        if (ttBestMove && move.x === ttBestMove.x && move.y === ttBestMove.y) {
            continue;
        }
        let orderScore = 0;
        // Killer Move Priority (only if remainingDepth is valid index)
        if (remainingDepth > 0 && remainingDepth < MAX_REMAINING_DEPTH_FOR_HEURISTICS) {
            if ((killerMoves[remainingDepth][0] && killerMoves[remainingDepth][0].x === move.x && killerMoves[remainingDepth][0].y === move.y) ||
                (killerMoves[remainingDepth][1] && killerMoves[remainingDepth][1].x === move.x && killerMoves[remainingDepth][1].y === move.y)) {
                orderScore += 100000;
            }
        }
        const historyKey = `${role}-${move.x}-${move.y}`;
        orderScore += historyTable[historyKey] || 0;
        // Skipping shallow eval for ordering here, assuming getMoves from evaluator is already somewhat prioritized
        movesWithScores.push({ move: move, orderScore: orderScore });
    }

    movesWithScores.sort((a, b) => b.orderScore - a.orderScore);

    let isFirstPvsMove = true;

    for (let i = 0; i < movesWithScores.length; i++) {
        const move = movesWithScores[i].move;

        if (!boardInstance.put(move.y, move.x, role)) {
            continue;
        }

        let val;
        if (isFirstPvsMove) {
            isFirstPvsMove = false;
            val = -negamax(boardInstance, remainingDepth - 1, -beta, -alpha, boardInstance.currentPlayer, aiPlayer);
        } else {
            val = -negamax(boardInstance, remainingDepth - 1, -alpha - 1, -alpha, boardInstance.currentPlayer, aiPlayer);
            if (val > alpha && val < beta) {
                val = -negamax(boardInstance, remainingDepth - 1, -beta, -val, boardInstance.currentPlayer, aiPlayer);
            }
        }
        boardInstance.undo();

        if (val > bestValue) {
            bestValue = val;
            bestMoveForThisNode = move;
        }
        if (bestValue > alpha) {
            alpha = bestValue;
        }
        if (alpha >= beta) {
            if (remainingDepth > 0 && remainingDepth < MAX_REMAINING_DEPTH_FOR_HEURISTICS) {
                 if (!killerMoves[remainingDepth][0] || (killerMoves[remainingDepth][0].x !== move.x || killerMoves[remainingDepth][0].y !== move.y)) {
                     if (!killerMoves[remainingDepth][1] || (killerMoves[remainingDepth][1].x !== move.x || killerMoves[remainingDepth][1].y !== move.y)) {
                        killerMoves[remainingDepth][1] = killerMoves[remainingDepth][0];
                        killerMoves[remainingDepth][0] = move;
                     } else if (killerMoves[remainingDepth][0].x !== move.x || killerMoves[remainingDepth][0].y !== move.y) {
                        killerMoves[remainingDepth][1] = killerMoves[remainingDepth][0];
                        killerMoves[remainingDepth][0] = move;
                     }
                }
            }
            const historyKeyCutoff = `${role}-${move.x}-${move.y}`;
            historyTable[historyKeyCutoff] = (historyTable[historyKeyCutoff] || 0) + (remainingDepth * remainingDepth);
            break;
        }
    }

    if (pieceHash !== BigInt(0)) {
        let flag;
        if (bestValue <= originalAlpha) flag = TT_FLAG_UPPERBOUND;
        else if (bestValue >= beta) flag = TT_FLAG_LOWERBOUND;
        else flag = TT_FLAG_EXACT;
        transpositionTable[ttKey] = {
            depth: remainingDepth,
            score: bestValue,
            flag: flag,
            bestMove: bestMoveForThisNode,
            role: role
        };
    }
    return bestValue;
}

const MAX_QUIESCENCE_DEPTH = 2;
function quiescenceSearch(boardInstance, alpha, beta, role, aiPlayer, quiesceDepth) {
    const pieceHash = boardInstance.getHash();
    const ttKey = `${pieceHash.toString()}-${role}`;

    const ttEntry = transpositionTable[ttKey];
    if (ttEntry && ttEntry.role === role && ttEntry.depth >= quiesceDepth ) {
        if (ttEntry.flag === TT_FLAG_EXACT) return ttEntry.score;
    }

    let standPatScore = boardInstance.evaluate(role);

    if (quiesceDepth === 0) {
        return standPatScore;
    }
    if (standPatScore >= beta) {
        return beta;
    }
    if (standPatScore > alpha) {
        alpha = standPatScore;
    }

    const forcingMoves = boardInstance.getMoves(role, quiesceDepth, true, true);

    for (const move of forcingMoves) {
        if (!boardInstance.put(move.y, move.x, role)) continue;
        let score = -quiescenceSearch(boardInstance, -beta, -alpha, boardInstance.currentPlayer, aiPlayer, quiesceDepth - 1);
        boardInstance.undo();

        if (score >= beta) {
            return beta;
        }
        if (score > alpha) {
            alpha = score;
        }
    }
    return alpha;
}

// --- Main AI Function ---
function aiMakeMove(initialBoardCells) {
    return new Promise((resolve, reject) => {
        resetKillerMoves();

        if (!openingBookInitialized) {
            initializeOpeningBookExamples();
        }

        const aiPlayerRole = window.gameApi.getCurrentPlayer();
        if (typeof BOARD_SIZE === 'undefined' || typeof PLAYER_BLACK === 'undefined' ||
            typeof PLAYER_WHITE === 'undefined' || typeof EMPTY === 'undefined') {
            console.error("Global constants (BOARD_SIZE, PLAYER_BLACK, etc.) not defined for Board constructor.");
            reject(new Error("Missing global constants for AI Board."));
            return;
        }
        const rootBoard = new Board(BOARD_SIZE, PLAYER_BLACK, PLAYER_WHITE, EMPTY, initialBoardCells, aiPlayerRole);

        if (!aiPlayerRole || (aiPlayerRole !== rootBoard.PLAYER_BLACK && aiPlayerRole !== rootBoard.PLAYER_WHITE)) {
            console.error("aiMakeMove: Could not determine a valid AI player role.", aiPlayerRole);
            reject(new Error("Invalid AI player role."));
            return;
        }
        rootBoard.currentPlayer = aiPlayerRole;

        if (aiConfig.openingBookEnabled && window.openingBook && typeof window.openingBook.getOpeningMove === 'function') {
            const currentBoardHashStr = rootBoard.getHash().toString(); // Hash before any AI moves
            const bookMove = window.openingBook.getOpeningMove(currentBoardHashStr);
            if (bookMove) {
                if (rootBoard.cells[bookMove.y][bookMove.x] === rootBoard.EMPTY) {
                    console.log(`AI: Using opening book move: (${bookMove.x}, ${bookMove.y}) for hash ${currentBoardHashStr}`);
                    resolve(bookMove);
                    return;
                } else {
                    console.warn("AI: Opening book suggested an invalid (occupied) move. Proceeding with search.", bookMove);
                }
            }
        }

        const maxDepthForDifficulty = AI_DIFFICULTY_CONFIG[currentAiDifficulty].depth;
        console.log(`AI (Lvl ${currentAiDifficulty}-${AI_DIFFICULTY_CONFIG[currentAiDifficulty].name}) starting iterative deepening up to depth ${maxDepthForDifficulty}...`);

        const startTime = Date.now();
        const TIME_LIMIT_PER_MOVE_MS = 5000;

        let allScoredMovesFromCompletedIteration = [];

        const rootMovesGenerated = rootBoard.getMoves(aiPlayerRole, 0);
        if (rootMovesGenerated.length === 0) {
            console.log("AI: No possible moves at root.");
            resolve(null);
            return;
        }

        for (let iterativePlyDepth = 1; iterativePlyDepth <= maxDepthForDifficulty; iterativePlyDepth++) {
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime > TIME_LIMIT_PER_MOVE_MS && iterativePlyDepth > 1) {
                console.log(`AI: Time limit (${TIME_LIMIT_PER_MOVE_MS}ms) reached before starting total ply depth ${iterativePlyDepth}. Using results from ${iterativePlyDepth - 1} plies.`);
                break;
            }
            console.log(`AI: Iterative deepening: Starting search for total ply depth ${iterativePlyDepth}. Time elapsed: ${elapsedTime}ms.`);

            let currentIterationScoredMoves = [];
            let alpha = -Infinity;
            let beta = Infinity;

            for (const rootMove of rootMovesGenerated) {
                const boardCopy = rootBoard.deepCopy();

                if (boardCopy.put(rootMove.y, rootMove.x, aiPlayerRole)) {
                    let score = -negamax(boardCopy, iterativePlyDepth - 1, -beta, -alpha, boardCopy.currentPlayer, aiPlayerRole);
                    currentIterationScoredMoves.push({ move: rootMove, score: score });

                    if (score > alpha) {
                        alpha = score;
                    }
                } else {
                    console.warn("aiMakeMove: boardCopy.put failed for a root move.", rootMove);
                }

                if ((Date.now() - startTime) > TIME_LIMIT_PER_MOVE_MS && iterativePlyDepth > 1) {
                    console.log(`AI: Time limit reached during total ply depth ${iterativePlyDepth} evaluation of root moves. Will use prior depth results if available.`);
                    break;
                }
            }

            const currentIterationTime = Date.now() - startTime;
            if (currentIterationTime > TIME_LIMIT_PER_MOVE_MS && iterativePlyDepth < maxDepthForDifficulty && iterativePlyDepth > 1) {
                 console.log(`AI: Total ply depth ${iterativePlyDepth} did not complete fully within time limit. Using results from ${iterativePlyDepth - 1} plies.`);
                 break;
            }

            if (currentIterationScoredMoves.length > 0) {
                currentIterationScoredMoves.sort((a, b) => b.score - a.score);
                allScoredMovesFromCompletedIteration = currentIterationScoredMoves;
                const currentBest = allScoredMovesFromCompletedIteration[0];
                 console.log(`AI: Total ply depth ${iterativePlyDepth} complete. Best move: (${currentBest.move.x}, ${currentBest.move.y}), Score: ${currentBest.score}. Time: ${currentIterationTime}ms`);
            } else if (iterativePlyDepth === 1 && rootMovesGenerated.length > 0) {
                 console.warn(`AI: Total ply depth 1 found no scorable moves. This is unusual. Fallback will be used.`);
            }

            if (allScoredMovesFromCompletedIteration.length > 0 &&
                allScoredMovesFromCompletedIteration[0].score >= SCORE_VALUES.FIVE / 2) {
                console.log(`AI: Decisive score found at total ply depth ${iterativePlyDepth}. Stopping deepening.`);
                break;
            }
        }

        let finalMoveToResolve;
        if (allScoredMovesFromCompletedIteration.length > 0) {
            const difficultySetting = AI_DIFFICULTY_CONFIG[currentAiDifficulty];
            const randomFactor = Math.random();
            if (randomFactor < difficultySetting.randomChance) {
                const topNCount = Math.min(difficultySetting.topN, allScoredMovesFromCompletedIteration.length);
                const selectedIndex = Math.floor(Math.random() * topNCount);
                finalMoveToResolve = allScoredMovesFromCompletedIteration[selectedIndex].move;
                console.log(`AI: Final choice (Lvl ${currentAiDifficulty}-${difficultySetting.name}) randomly from top ${topNCount}. Move: (${finalMoveToResolve.x}, ${finalMoveToResolve.y}), score: ${allScoredMovesFromCompletedIteration[selectedIndex].score}`);
            } else {
                finalMoveToResolve = allScoredMovesFromCompletedIteration[0].move;
                console.log(`AI: Final choice (Lvl ${currentAiDifficulty}-${difficultySetting.name}) is best. Move: (${finalMoveToResolve.x}, ${finalMoveToResolve.y}), score: ${allScoredMovesFromCompletedIteration[0].score}`);
            }
        } else if (rootMovesGenerated.length > 0) {
            console.warn("AI: Iterative deepening yielded no scorable moves. Picking first generated move as fallback.");
            finalMoveToResolve = rootMovesGenerated[0];
        } else {
            console.error("AI: No moves available at all.");
            reject(new Error("AI has no moves and could not make a decision."));
            return;
        }

        console.log(`AI: Total processing time: ${Date.now() - startTime}ms`);
        resolve(finalMoveToResolve);
    });
}

function setAiDifficulty(level) {
    if (AI_DIFFICULTY_CONFIG[level]) {
        currentAiDifficulty = level;
        console.log(`AI difficulty set to Level ${level} (${AI_DIFFICULTY_CONFIG[level].name}), Max search depth ${AI_DIFFICULTY_CONFIG[level].depth}.`);
    } else {
        console.error(`Invalid AI difficulty level: ${level}`);
    }
}

console.log("ai.js (refactored with Board class, Evaluate integration) loaded.");

window.aiApi = {
    aiMakeMove: aiMakeMove,
    setAiDifficulty: setAiDifficulty,
    getPatternScores: () => { return {}; }, // Return empty or actual Evaluate.SCORE_VALUES
};

// Assumed global constants/functions (should be loaded via utils.js or similar):
// PLAYER_BLACK, PLAYER_WHITE, EMPTY, BOARD_SIZE, WINNING_LENGTH
// isInBounds(x, y) // Used by old generateMoves if active, but Board.getMoves should be primary
// gameApi.getCurrentPlayer()
// window.Evaluate (from evaluate.js)
// window.Zobrist (from zobrist.js)
// window.shapeUtils (from shape.js)

// Global aiConfig (placeholder, ideally passed or properly scoped)
const aiConfig = {
    pointsLimit: 20,
    openingBookEnabled: true,
};

let openingBookInitialized = false;
function initializeOpeningBookExamples() {
    if (!openingBookInitialized && window.openingBook && typeof window.openingBook._populateExampleOpening === 'function' &&
        window.Board && typeof BOARD_SIZE !== 'undefined' &&
        typeof PLAYER_BLACK !== 'undefined' && typeof PLAYER_WHITE !== 'undefined' && typeof EMPTY !== 'undefined') {
        try {
            window.openingBook._populateExampleOpening(BOARD_SIZE, PLAYER_BLACK, PLAYER_WHITE, EMPTY);
            openingBookInitialized = true;
            console.log("AI: Example opening book populated.");
        } catch (e) {
            console.error("AI: Error populating example opening book:", e);
        }
    }
}
