// Gomoku AI Logic - Main Thread Interface for Web Worker

const AI_DIFFICULTY_PROFILES = {
    1: { // Novice
        name: "Novice",
        searchDepth: 2, // Increased from 1, was originally 2
        heuristicLevel: 'novice',
        randomness: 0.5, // Tuned from 0.6
        randomTopN: 4    // Tuned from 5
    },
    2: { // Apprentice
        name: "Apprentice",
        searchDepth: 2, // Kept at 2
        heuristicLevel: 'apprentice',
        randomness: 0.25, // Tuned from 0.3
        randomTopN: 3     // Kept at 3
    },
    3: { // Adept
        name: "Adept",
        searchDepth: 3,
        heuristicLevel: 'adept',
        randomness: 0.1,
        randomTopN: 2
    },
    4: { // Expert
        name: "Expert",
        searchDepth: 4,
        heuristicLevel: 'expert',
        randomness: 0,
        randomTopN: 1
    },
    5: { // Master
        name: "Master",
        searchDepth: 4,
        heuristicLevel: 'master',
        randomness: 0,
        randomTopN: 1,
        useOpeningBook: true
    }
};
let currentSelectedDifficultyLevel = 3; // Default to Adept (level 3)
let currentAiProfile = AI_DIFFICULTY_PROFILES[currentSelectedDifficultyLevel];


// const PATTERN_SCORES = { // This was for main thread, not really used. Worker has its own.
//     FIVE_IN_A_ROW: 100000,
// };

let aiWorker;

// For Omniscience Promise
let omniEvaluationPromise = null;
let omniResolve = null;
let omniReject = null;

function initAiWorker() {
    if (typeof(Worker) !== "undefined") {
        if (!aiWorker) {
            try {
                aiWorker = new Worker('js/ai.worker.js');
                console.log("AI Worker initialized.");

                // Set up global handlers. Specific operations can temporarily override these.
                aiWorker.onmessage = globalWorkerMessageHandler;
                aiWorker.onerror = globalWorkerErrorHandler;

            } catch (err) {
                console.error("Failed to initialize AI Worker:", err);
                aiWorker = null;
            }
        }
    } else {
        console.warn("Web Workers not supported. AI features requiring worker will be unavailable.");
    }
}

// Global message handler for worker messages not tied to a specific short-lived promise
const globalWorkerMessageHandler = function(e) {
    console.log("Global AI Worker message handler in ai.js:", e.data);
    if (e.data.type === 'omniEvaluationComplete') {
        if (omniResolve) {
            omniResolve(e.data.hints);
        } else {
            console.warn("Received omniEvaluationComplete but no pending promise found.");
        }
        omniEvaluationPromise = null; // Clear promise variables
        omniResolve = null;
        omniReject = null;
    } else if (e.data.type === 'error') { // General errors from worker
        console.error("AI Worker reported a global error:", e.data.error);
        if (omniReject) {
            omniReject(new Error(e.data.error));
        }
        omniEvaluationPromise = null;
        omniResolve = null;
        omniReject = null;
    } else {
        console.log("AI Worker generic message (unhandled by global handler):", e.data);
    }
};

const globalWorkerErrorHandler = function(e) {
    console.error("Global error from AI Worker in ai.js:", e.message, e.filename, e.lineno);
    if (omniReject) {
        omniReject(new Error(`AI Worker global error: ${e.message}`));
    }
    omniEvaluationPromise = null;
    omniResolve = null;
    omniReject = null;
};

// Call init on script load
initAiWorker();

function aiMakeMove(currentBoard) {
    return new Promise((resolve, reject) => {
        if (!aiWorker) {
            console.error("AI Worker not available. Cannot make move.");
            // Synchronous fallback (simplified)
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (currentBoard[r][c] === EMPTY) {
                        resolve({ x: c, y: r }); return;
                    }
                }
            }
            reject(new Error("AI Worker not available and no empty spots for fallback."));
            return;
        }

        console.log(`AI (Player ${PLAYER_WHITE}) is thinking with profile: ${currentAiProfile.name} (Depth: ${currentAiProfile.searchDepth}) via Worker...`);

        const tempOnMessage = function(e) {
            aiWorker.onmessage = globalWorkerMessageHandler; // Restore global handler
            aiWorker.onerror = globalWorkerErrorHandler;   // Restore global handler

            if (e.data.type === 'bestMoveFound') {
                console.log(`AI Worker chose move: (${e.data.move ? e.data.move.x : 'N/A'}, ${e.data.move ? e.data.move.y : 'N/A'}) score: ${e.data.score}`);
                resolve(e.data.move);
            } else if (e.data.type === 'error' || e.data.error) { // Catch worker-reported errors
                console.error("AI Worker returned an error during aiMakeMove:", e.data.error);
                reject(new Error(e.data.error || "Unknown error from AI worker during move calculation."));
            } else {
                console.warn("AI Worker returned unexpected message during aiMakeMove:", e.data);
                reject(new Error("Unexpected message from AI worker during move calculation."));
            }
        };

        const tempOnError = function(e) {
            aiWorker.onmessage = globalWorkerMessageHandler; // Restore global handler
            aiWorker.onerror = globalWorkerErrorHandler;   // Restore global handler
            console.error("Error from AI Worker during aiMakeMove:", e.message, e.filename, e.lineno);
            reject(new Error(`AI Worker error: ${e.message}`));
        };

        // Temporarily override handlers for this specific call
        aiWorker.onmessage = tempOnMessage;
        aiWorker.onerror = tempOnError;

        aiWorker.postMessage({
            type: 'findBestMove',
            board: currentBoard, // Worker should handle copying if it modifies the board.
            difficultyProfile: { // Send necessary parts of the profile
                searchDepth: currentAiProfile.searchDepth,
                heuristicLevel: currentAiProfile.heuristicLevel,
                randomness: currentAiProfile.randomness,
                randomTopN: currentAiProfile.randomTopN
            },
            aiPlayer: PLAYER_WHITE // Assuming AI is always PLAYER_WHITE for now
        });
    });
}

function evaluateAllPointsForOmniscience(board, player) {
    if (!aiWorker) {
        console.error("AI Worker not available. Cannot evaluate for omniscience.");
        return Promise.reject(new Error("AI Worker not available."));
    }

    if (omniEvaluationPromise) {
        // Optionally, cancel the previous request or let it run.
        // For now, we'll let the new one supersede the promise variables.
        console.warn("New omniscience evaluation requested while previous one might be pending.");
        // If omniReject was set, you might call it:
        // if (omniReject) omniReject(new Error("Superseded by new omniscience request"));
    }

    omniEvaluationPromise = new Promise((resolve, reject) => {
        omniResolve = resolve;
        omniReject = reject;

        // Global handlers (globalWorkerMessageHandler, globalWorkerErrorHandler)
        // are already set up to handle 'omniEvaluationComplete' and errors.

        aiWorker.postMessage({
            type: 'evaluateAllPoints',
            board: board,
            playerForOmni: player
        });
    });
    return omniEvaluationPromise;
}


function setAiDifficulty(level) {
    if (AI_DIFFICULTY_PROFILES[level]) {
        currentSelectedDifficultyLevel = level;
        currentAiProfile = AI_DIFFICULTY_PROFILES[currentSelectedDifficultyLevel];
        console.log(`AI difficulty set to ${level} (${currentAiProfile.name}). Search Depth: ${currentAiProfile.searchDepth}, Heuristic: ${currentAiProfile.heuristicLevel}, Randomness: ${currentAiProfile.randomness}, TopN for random: ${currentAiProfile.randomTopN}`);
    } else {
        console.error(`Invalid AI difficulty level: ${level}`);
    }
}

// Stub for potential main-thread light checks, if ever needed.
// Currently, major AI logic is in worker.
// function findBestMoveMainThreadLight(board, depth, aiPlayer = PLAYER_WHITE) {
//     console.warn("findBestMoveMainThreadLight is a simplified stub and not recommended for primary use.");
//     return { score: 0, move: null}; // Placeholder
// }

console.log("ai.js (main thread) loaded. Initializing AI Worker...");

window.aiApi = {
    aiMakeMove: aiMakeMove,
    setAiDifficulty: setAiDifficulty,
    // getPatternScores: () => { return {...PATTERN_SCORES}; }, // PATTERN_SCORES removed from ai.js
    evaluateAllPointsForOmniscience: evaluateAllPointsForOmniscience,
};

