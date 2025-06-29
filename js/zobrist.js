// Gomoku Zobrist Hashing Logic

// These will be populated by initZobrist once global constants are available
let zobristTable = [];
let zobristTurnKeys = []; // For hashing whose turn it is

// Mapping from actual player values (PLAYER_BLACK, PLAYER_WHITE) to array indices (0, 1)
const ZOBRIST_PLAYER_INDICES = {};
const ZOBRIST_INDEX_TO_PLAYER = {};


/**
 * Initializes the Zobrist hash table with random numbers.
 * Must be called once after global constants (BOARD_SIZE, PLAYER_BLACK, PLAYER_WHITE) are defined.
 */
function initZobrist() {
    if (typeof BOARD_SIZE === 'undefined' ||
        typeof PLAYER_BLACK === 'undefined' ||
        typeof PLAYER_WHITE === 'undefined' ||
        typeof EMPTY === 'undefined') {
        console.error("Zobrist init failed: Critical global constants (BOARD_SIZE, PLAYER_BLACK, PLAYER_WHITE, EMPTY) are not defined.");
        return false; // Indicate failure
    }

    // Check if already initialized to prevent re-initialization if called multiple times
    if (zobristTable.length > 0) {
        // console.log("Zobrist already initialized.");
        return true;
    }

    ZOBRIST_PLAYER_INDICES[PLAYER_BLACK] = 0;
    ZOBRIST_PLAYER_INDICES[PLAYER_WHITE] = 1;
    ZOBRIST_INDEX_TO_PLAYER[0] = PLAYER_BLACK;
    ZOBRIST_INDEX_TO_PLAYER[1] = PLAYER_WHITE;

    const NUM_PIECE_TYPES_FOR_HASH = 2; // Black, White (EMPTY is not hashed by piece type)

    zobristTable = Array(BOARD_SIZE);
    for (let i = 0; i < BOARD_SIZE; i++) {
        zobristTable[i] = Array(BOARD_SIZE);
        for (let j = 0; j < BOARD_SIZE; j++) {
            zobristTable[i][j] = Array(NUM_PIECE_TYPES_FOR_HASH);
            for (let k = 0; k < NUM_PIECE_TYPES_FOR_HASH; k++) {
                // Generate a random 32-bit integer (JavaScript numbers are floats, but bitwise ops treat them as 32-bit)
                zobristTable[i][j][k] = Math.floor(Math.random() * Math.pow(2, 32));
            }
        }
    }

    // Zobrist keys for player turn
    zobristTurnKeys[ZOBRIST_PLAYER_INDICES[PLAYER_BLACK]] = Math.floor(Math.random() * Math.pow(2, 32));
    zobristTurnKeys[ZOBRIST_PLAYER_INDICES[PLAYER_WHITE]] = Math.floor(Math.random() * Math.pow(2, 32));

    console.log("Zobrist table initialized successfully.");
    return true; // Indicate success
}

/**
 * Computes the Zobrist hash for a given board state and player turn.
 * @param {Array<Array<number>>} board - The game board.
 * @param {number} playerTurn - The player whose turn it is.
 * @returns {number} The Zobrist hash value (32-bit integer).
 */
function computeZobristHash(board, playerTurn) {
    if (zobristTable.length === 0) {
        console.warn("Zobrist table not initialized. Attempting to initialize now.");
        if (!initZobrist()) {
            console.error("Failed to compute Zobrist hash: table initialization failed.");
            return 0; // Error or default hash
        }
    }

    const playerTurnIndex = ZOBRIST_PLAYER_INDICES[playerTurn];
    if (typeof playerTurnIndex === 'undefined') {
        console.error("Invalid playerTurn for Zobrist hash computation:", playerTurn);
        return 0; // Error or default hash
    }

    let hash = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = board[r][c];
            if (piece !== EMPTY) {
                const pieceTypeIndex = ZOBRIST_PLAYER_INDICES[piece];
                if (typeof pieceTypeIndex !== 'undefined') {
                    hash ^= zobristTable[r][c][pieceTypeIndex];
                } else {
                    // Should not happen if board contains only valid player pieces or EMPTY
                    console.warn(`Unknown piece type ${piece} at (${r},${c}) during Zobrist hash computation.`);
                }
            }
        }
    }
    hash ^= zobristTurnKeys[playerTurnIndex];
    return hash;
}

// Expose utility if loaded globally
if (typeof window !== 'undefined') {
    window.zobristUtils = {
        initZobrist: initZobrist,
        computeZobristHash: computeZobristHash
        // No need to expose the table itself generally
    };
}
