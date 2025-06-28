// Gomoku AI Logic - Main Thread Interface for Web Worker

// AI difficulty levels (maps to search depth)
const AI_DIFFICULTY_LEVELS = {
    1: 1, // Novice (depth 1)
    2: 2, // Beginner (depth 2)
    3: 3, // Intermediate (depth 3)
    4: 4, // Advanced (depth 4)
    5: 5  // Expert (depth 5)
};
let currentAiDifficulty = 3; // Default to Intermediate
let currentSearchDepth = AI_DIFFICULTY_LEVELS[currentAiDifficulty];

// PATTERN_SCORES are needed for Smart Undo if its logic remains on main thread
const PATTERN_SCORES = {
    FIVE_IN_A_ROW: 100000,
    // Other scores are not strictly needed by main thread if findBestMove for smart undo is simplified or removed.
};

let aiWorker;

function initAiWorker() {
    if (typeof(Worker) !== "undefined") {
        if (!aiWorker) {
            try {
                aiWorker = new Worker('js/ai.worker.js');
                console.log("AI Worker initialized.");

                aiWorker.onmessage = function(e) {
                    // This handler will be overridden by specific promises below
                    console.log("AI Worker generic message:", e.data);
                };
                aiWorker.onerror = function(e) {
                    console.error("Error in AI Worker:", e.message, e.filename, e.lineno);
                    // Potentially reject any pending promises or show error to user
                };
            } catch (err) {
                console.error("Failed to initialize AI Worker:", err);
                aiWorker = null; // Ensure worker is null if failed
            }
        }
    } else {
        console.warn("Web Workers not supported in this browser. AI will run on main thread (not yet implemented as fallback).");
        // Fallback to synchronous AI would be needed here if we want to support non-worker browsers.
        // For now, assume worker support or AI features might be degraded.
    }
}

// Call init on script load
initAiWorker();


// Main function for AI to make a move, now returns a Promise
function aiMakeMove(currentBoard) {
    return new Promise((resolve, reject) => {
        if (!aiWorker) {
            console.error("AI Worker not available. Cannot make move.");
            // Fallback: find any valid empty spot (synchronous)
            // This is a simplified fallback and doesn't use the sophisticated AI.
            console.log("Attempting synchronous fallback for aiMakeMove.");
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    // Assuming BOARD_SIZE and EMPTY are available (e.g. from utils.js)
                    if (currentBoard[r][c] === EMPTY) {
                        console.log(`Synchronous fallback found empty spot: (${c}, ${r})`);
                        resolve({ x: c, y: r }); // Resolve with the move object
                        return;
                    }
                }
            }
            reject(new Error("AI Worker not available and no empty spots for fallback."));
            return;
        }

        console.log(`AI (Player ${PLAYER_WHITE}) is thinking with depth ${currentSearchDepth} via Worker...`);

        aiWorker.postMessage({
            board: currentBoard, // Make sure this is a deep copy if needed by worker for safety, though worker should handle its own copies.
            searchDepth: currentSearchDepth,
            aiPlayer: PLAYER_WHITE // Assuming AI is always PLAYER_WHITE, or pass dynamically
            // Pass any other necessary constants if not imported by worker, e.g. BOARD_SIZE, EMPTY etc.
            // However, ai.worker.js tries to import utils.js which should define them.
        });

        aiWorker.onmessage = function(e) {
            if (e.data.error) {
                console.error("AI Worker returned an error:", e.data.error);
                reject(new Error(e.data.error));
            } else {
                console.log(`AI Worker chose move: (${e.data.move ? e.data.move.x : 'null'}, ${e.data.move ? e.data.move.y : 'null'}) with score: ${e.data.score}`);
                resolve(e.data.move); // Resolve the promise with the move object
            }
        };

        aiWorker.onerror = function(e) {
            console.error("Error from AI Worker:", e);
            reject(new Error(`AI Worker error: ${e.message}`));
        };
    });
}

function setAiDifficulty(level) {
    if (AI_DIFFICULTY_LEVELS[level]) {
        currentAiDifficulty = level;
        currentSearchDepth = AI_DIFFICULTY_LEVELS[level];
        console.log(`AI difficulty set to ${level}, search depth ${currentSearchDepth}. Worker will use this on next call.`);
    } else {
        console.error(`Invalid AI difficulty level: ${level}`);
    }
}

// --- Functions for Smart Undo / Omniscience (Main Thread Fallbacks or Simplifications) ---
// These are now more complex because the main AI logic is in the worker.
// For simplicity, Smart Undo's AI check will be temporarily disabled.
// Omniscience mode will also be non-functional for now.

function findBestMoveMainThreadLight(board, depth, aiPlayer = PLAYER_WHITE) {
    // This is a very simplified version for main-thread checks like smart undo.
    // It does NOT use alpha-beta and is only for shallow depths (e.g., depth 1).
    // It needs evaluateBoardLight and getPossibleMoves.
    // For now, let's make it return a dummy "no threat" response.
    console.warn("findBestMoveMainThreadLight is a simplified stub.");
    if (depth <= 0) return { score: 0, move: null}; // Simplified base case

    const possibleMoves = getPossibleMovesMainThreadLight(board);
    if (possibleMoves.length === 0) return {score: 0, move: null};

    // Just check if any move leads to an immediate win for aiPlayer (very basic)
    for (const move of possibleMoves) {
        const tempBoard = makeTemporaryMoveMainThread(board, move.x, move.y, aiPlayer);
        // Need a checkWinForPlayer or simplified evaluation here.
        // Let's assume for now no immediate win is found by this shallow check.
    }
    // Return a neutral score and the first possible move as a placeholder
    return { score: 0, move: possibleMoves[0] };
}

function getPossibleMovesMainThreadLight(board) {
    // Simplified getPossibleMoves: just return first few empty cells or center.
    // This is NOT for robust AI play, just for a quick check.
    const moves = [];
    if (!board) return moves; // Should not happen
    let count = 0;
    // Center first if empty
    const centerX = Math.floor(BOARD_SIZE / 2);
    const centerY = Math.floor(BOARD_SIZE / 2);
    if (board[centerY][centerX] === EMPTY) {
        moves.push({x: centerX, y: centerY});
        count++;
    }
    for (let r = 0; r < BOARD_SIZE && count < 5; r++) {
        for (let c = 0; c < BOARD_SIZE && count < 5; c++) {
            if (r === centerY && c === centerX) continue; // Skip center if already added
            if (board[r][c] === EMPTY) {
                moves.push({ x: c, y: r });
                count++;
            }
        }
    }
    return moves;
}

function makeTemporaryMoveMainThread(originalBoard, x, y, player) {
    // Simplified version, assumes BOARD_SIZE and EMPTY are available
    const tempBoard = originalBoard.map(row => [...row]);
    if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && tempBoard[y][x] === EMPTY) {
        tempBoard[y][x] = player;
    }
    return tempBoard;
}


console.log("ai.js (main thread) loaded. Initializing AI Worker...");

window.aiApi = {
    aiMakeMove: aiMakeMove, // This is now async and returns a Promise
    setAiDifficulty: setAiDifficulty,
    getPatternScores: () => { return {...PATTERN_SCORES}; }, // For smart undo, if it were to use PATTERN_SCORES directly

    // Temporarily, findBestMove and evaluatePointOmniscience will be stubs or removed
    // as their full logic is in the worker. Smart Undo and Omniscience will be affected.
    findBestMove: findBestMoveMainThreadLight, // Stub for smart undo on main thread
    evaluatePointOmniscience: () => 0, // Stub for omniscience
};

