console.log("DEBUG: File loaded: js/zobrist.js"); // DBG_LOAD_ZOBRIST

// Gomoku Zobrist Hashing Logic - Refactored to Class with BigInt and Incremental Updates

class Zobrist {
    constructor(size, playerBlackConstant, playerWhiteConstant) {
        console.log("DEBUG: Zobrist constructor entered."); // DBG_ZOBRIST_CONSTRUCTOR
        console.log(`DEBUG: Zobrist constructor - Params: size=${size}, pBConst=${playerBlackConstant}, pWConst=${playerWhiteConstant}`); // DBG_ZOBRIST_PARAMS

        if (typeof size === 'undefined' || size <= 0 ||
            typeof playerBlackConstant === 'undefined' ||
            typeof playerWhiteConstant === 'undefined') {
            console.error("DEBUG: Zobrist constructor failed: invalid size or player constants not provided.", `size: ${size}`, `pBlack: ${playerBlackConstant}`, `pWhite: ${playerWhiteConstant}`); // DBG_ZOBRIST_INVALID_PARAMS
            this.size = 0;
            this.zobristTable = [];
            this.hash = BigInt(0);
            this.PLAYER_MAP = {};
            return;
        }

        // Check if crypto API is available (it should be in modern browsers and workers)
        if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
            console.error("DEBUG: Zobrist constructor - crypto.getRandomValues is not available! Cannot generate secure random numbers for Zobrist keys."); // DBG_ZOBRIST_NO_CRYPTO
            // Fallback or throw error - for now, let it proceed but hashes will be weak if Math.random is used by a polyfill or similar.
            // This class relies on crypto.getRandomValues in _initializeZobristTable.
        }


        this.size = size;
        this.PLAYER_MAP = {
            [playerBlackConstant]: 0, // Map actual player value to index 0
            [playerWhiteConstant]: 1  // Map actual player value to index 1
        };

        this.zobristTable = this._initializeZobristTable(size);
        this.hash = BigInt(0);
        console.log("DEBUG: Zobrist instance created and table initialized successfully."); // DBG_ZOBRIST_SUCCESS
    }

    _initializeZobristTable(size) {
        console.log("DEBUG: Zobrist _initializeZobristTable called."); // DBG_ZOBRIST_INIT_TABLE
        let table = [];
        const NUM_PIECE_TYPES_FOR_HASH = 2; // Black, White

        for (let i = 0; i < size; i++) {
            table[i] = [];
            for (let j = 0; j < size; j++) {
                table[i][j] = Array(NUM_PIECE_TYPES_FOR_HASH);
                for (let k = 0; k < NUM_PIECE_TYPES_FOR_HASH; k++) {
                    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
                        let randomBytes = new Uint8Array(8);
                        crypto.getRandomValues(randomBytes);
                        let bigIntValue = BigInt(0);
                        for (let byte of randomBytes) {
                            bigIntValue = (bigIntValue << BigInt(8)) | BigInt(byte);
                        }
                        table[i][j][k] = bigIntValue;
                    } else {
                        // Fallback to Math.random if crypto is not available (less ideal for hash quality)
                        table[i][j][k] = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)) << BigInt(32) | BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
                        if (i===0 && j===0 && k===0) console.warn("DEBUG: Zobrist using Math.random fallback for key generation."); // DBG_ZOBRIST_MATH_RANDOM
                    }
                }
            }
        }
        console.log("DEBUG: Zobrist _initializeZobristTable finished."); // DBG_ZOBRIST_INIT_TABLE_END
        return table;
    }

    togglePiece(x, y, playerRole) {
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            // console.error("DEBUG: Zobrist togglePiece: coordinates out of bounds.", x, y); // Can be verbose
            return;
        }
        const pieceTypeIndex = this.PLAYER_MAP[playerRole];
        if (typeof pieceTypeIndex !== 'undefined' && this.zobristTable[x] && this.zobristTable[x][y]) {
            this.hash ^= this.zobristTable[x][y][pieceTypeIndex];
        } else {
            // console.warn(`DEBUG: Zobrist togglePiece: Unknown playerRole ${playerRole} or invalid table access at ${x},${y}.`); // Can be verbose
        }
    }

    getHash() {
        return this.hash;
    }

    computeFullHash(boardArray, playerConstants) {
        // console.log("DEBUG: Zobrist computeFullHash called."); // DBG_ZOBRIST_FULLHASH (can be verbose)
        this.hash = BigInt(0);
        if (!playerConstants || typeof playerConstants.EMPTY_VAL === 'undefined') {
            console.error("DEBUG: Zobrist computeFullHash: playerConstants.EMPTY_VAL is undefined.");
            return this.hash;
        }
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const piece = boardArray[r][c];
                if (piece !== playerConstants.EMPTY_VAL) {
                    const pieceTypeIndex = this.PLAYER_MAP[piece];
                    if (typeof pieceTypeIndex !== 'undefined' && this.zobristTable[r] && this.zobristTable[r][c]) {
                         this.hash ^= this.zobristTable[r][c][pieceTypeIndex];
                    }
                }
            }
        }
        return this.hash;
    }
}

if (typeof window !== 'undefined') {
    console.log("DEBUG: zobrist.js - Attaching Zobrist class to window."); // DBG_ZOBRIST_WINDOW
    window.Zobrist = Zobrist;
    if (window.zobristUtils) { // Clean up old global if present
        console.log("DEBUG: zobrist.js - Deleting old window.zobristUtils."); // DBG_ZOBRIST_CLEANUP
        delete window.zobristUtils;
    }
}
console.log("DEBUG: End of zobrist.js script evaluation."); // DBG_LOAD_END_ZOBRIST
