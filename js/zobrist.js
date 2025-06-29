// Gomoku Zobrist Hashing Logic - Refactored to Class with BigInt and Incremental Updates

class Zobrist {
    constructor(size, playerBlackConstant, playerWhiteConstant) {
        if (typeof size === 'undefined' ||
            typeof playerBlackConstant === 'undefined' ||
            typeof playerWhiteConstant === 'undefined') {
            console.error("Zobrist constructor failed: size or player constants not provided.");
            this.size = 0;
            this.zobristTable = [];
            this.hash = BigInt(0);
            this.PLAYER_MAP = {};
            return;
        }

        this.size = size;
        this.PLAYER_MAP = {
            [playerBlackConstant]: 0, // Map actual player value to index 0
            [playerWhiteConstant]: 1  // Map actual player value to index 1
        };
        // For roles that are not playerBlack or playerWhite (e.g. EMPTY), they won't be in PLAYER_MAP
        // and thus won't be part of zobristTable piece types, which is correct.

        this.zobristTable = this._initializeZobristTable(size);
        this.hash = BigInt(0); // Initial hash for an empty board
        // Note: playerTurn hashing is removed from this class.
        // It will be handled by the TT key composition if needed, or by storing role in TT entry.
        console.log("Zobrist instance created and table initialized.");
    }

    _initializeZobristTable(size) {
        let table = [];
        const NUM_PIECE_TYPES_FOR_HASH = 2; // Black, White

        for (let i = 0; i < size; i++) {
            table[i] = [];
            for (let j = 0; j < size; j++) {
                table[i][j] = Array(NUM_PIECE_TYPES_FOR_HASH);
                for (let k = 0; k < NUM_PIECE_TYPES_FOR_HASH; k++) {
                    // Generate a random 64-bit BigInt
                    let randomBytes = new Uint8Array(8); // 8 bytes = 64 bits
                    crypto.getRandomValues(randomBytes);
                    let bigIntValue = BigInt(0);
                    for (let byte of randomBytes) {
                        bigIntValue = (bigIntValue << BigInt(8)) | BigInt(byte);
                    }
                    table[i][j][k] = bigIntValue;
                }
            }
        }
        return table;
    }

    // Removed randomBitString as crypto.getRandomValues is more robust for BigInt generation

    /**
     * Updates the hash by XORing the piece's Zobrist key.
     * Call this when a piece is added or removed.
     * @param {number} x - The row index.
     * @param {number} y - The column index.
     * @param {number} playerRole - The role of the piece (e.g., PLAYER_BLACK, PLAYER_WHITE).
     */
    togglePiece(x, y, playerRole) {
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            console.error("Zobrist togglePiece: coordinates out of bounds.", x, y);
            return;
        }
        const pieceTypeIndex = this.PLAYER_MAP[playerRole];
        if (typeof pieceTypeIndex !== 'undefined') {
            this.hash ^= this.zobristTable[x][y][pieceTypeIndex];
        } else {
            // This is expected if role is EMPTY or an invalid playerRole
            // console.warn(`Zobrist togglePiece: Unknown playerRole ${playerRole} at ${x},${y}. No hash change.`);
        }
    }

    /**
     * Gets the current Zobrist hash value for the board state.
     * @returns {BigInt} The Zobrist hash.
     */
    getHash() {
        return this.hash;
    }

    /**
     * Calculates the hash from scratch for a given board.
     * Useful for initialization or verification, but togglePiece is used for updates.
     * @param {Array<Array<number>>} boardArray - The 2D array representing the board.
     * @param {object} playerConstants - Object like { EMPTY_VAL, PLAYER_BLACK_VAL, PLAYER_WHITE_VAL }
     */
    computeFullHash(boardArray, playerConstants) {
        this.hash = BigInt(0);
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const piece = boardArray[r][c];
                if (piece !== playerConstants.EMPTY_VAL) { // Only hash actual pieces
                    const pieceTypeIndex = this.PLAYER_MAP[piece];
                    if (typeof pieceTypeIndex !== 'undefined') {
                         this.hash ^= this.zobristTable[r][c][pieceTypeIndex];
                    }
                }
            }
        }
        return this.hash;
    }
}

// Expose the class if this script is loaded globally
// In a module system, this would be `export default Zobrist;`
if (typeof window !== 'undefined') {
    window.Zobrist = Zobrist;
    // Remove old global utils if they conflict
    if (window.zobristUtils) {
        delete window.zobristUtils;
    }
}
