// Gomoku AI Logic - Web Worker

// Attempt to import utilities and constants
try {
    importScripts('utils.js');
    console.log("ai.worker.js: utils.js imported successfully.");
} catch (e) {
    console.error("ai.worker.js: Failed to import utils.js. Essential constants/functions might be missing.", e);
    self.BOARD_SIZE = 15;
    self.EMPTY = 0;
    self.PLAYER_BLACK = 1;
    self.PLAYER_WHITE = 2;
    self.WINNING_LENGTH = 5;
    self.isInBounds = function(x, y) {
        return x >= 0 && x < self.BOARD_SIZE && y >= 0 && y < self.BOARD_SIZE;
    };
}

// --- AI Pattern Type Constants ---
const PT_FIVE = 'FIVE';
const PT_LIVE_FOUR = 'LIVE_FOUR';
const PT_DOUBLE_THREE = 'DOUBLE_THREE';
const PT_DEAD_FOUR = 'DEAD_FOUR';
const PT_LIVE_THREE = 'LIVE_THREE';
const PT_DEAD_THREE = 'DEAD_THREE';
const PT_LIVE_TWO = 'LIVE_TWO';
const PT_DEAD_TWO = 'DEAD_TWO';
const PT_SINGLE = 'SINGLE';
const PT_LIVE_JUMP_THREE = 'LIVE_JUMP_THREE'; // _X_X_
const PT_DEAD_JUMP_THREE = 'DEAD_JUMP_THREE'; // e.g. OX_X_ or _X_XO

// --- Heuristic Evaluation Scores ---
const PATTERN_SCORES = {
    [PT_FIVE]:            { offensive: 100000000, defensive: 100000000 },
    [PT_LIVE_FOUR]:       { offensive: 10000000,  defensive: 10000000 },
    [PT_DOUBLE_THREE]:    { offensive: 5000000,   defensive: 5000000 },
    [PT_DEAD_FOUR]:       { offensive: 50000,     defensive: 100000 },
    [PT_LIVE_THREE]:      { offensive: 1000,      defensive: 5000 },
    [PT_LIVE_JUMP_THREE]: { offensive: 300,       defensive: 600 },
    [PT_DEAD_JUMP_THREE]: { offensive: 70,        defensive: 150 },
    [PT_DEAD_THREE]:      { offensive: 100,       defensive: 200 },
    [PT_LIVE_TWO]:        { offensive: 50,        defensive: 100 },
    [PT_DEAD_TWO]:        { offensive: 10,        defensive: 20 },
    [PT_SINGLE]:          { offensive: 1,         defensive: 2 }
};

// --- Bitboard Representation ---
const NUM_BITBOARDS_PER_PLAYER = 4;
const BITS_PER_BIGINT = BigInt(64);
let bitboards = {};

// Masks for board edges
const LEFT_EDGE_MASK_ARRAY = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
const RIGHT_EDGE_MASK_ARRAY = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
const ALL_ONES_64 = BigInt("0xffffffffffffffff"); // All 64 bits set for masking

function initializeHelperBitmasks() {
    // Ensure these are reset if called multiple times, though it should be once.
    LEFT_EDGE_MASK_ARRAY.fill(BigInt(0));
    RIGHT_EDGE_MASK_ARRAY.fill(BigInt(0));

    for (let r = 0; r < BOARD_SIZE; r++) {
        // Left edge (column 0)
        let bitPosLeft = r * BOARD_SIZE + 0;
        let boardIndexLeft = Math.floor(bitPosLeft / 64);
        let bitInBoardLeft = BigInt(bitPosLeft % 64);
        if (boardIndexLeft < NUM_BITBOARDS_PER_PLAYER) {
            LEFT_EDGE_MASK_ARRAY[boardIndexLeft] |= (BigInt(1) << bitInBoardLeft);
        }

        // Right edge (column BOARD_SIZE - 1)
        let bitPosRight = r * BOARD_SIZE + (BOARD_SIZE - 1);
        let boardIndexRight = Math.floor(bitPosRight / 64);
        let bitInBoardRight = BigInt(bitPosRight % 64);
        if (boardIndexRight < NUM_BITBOARDS_PER_PLAYER) {
            RIGHT_EDGE_MASK_ARRAY[boardIndexRight] |= (BigInt(1) << bitInBoardRight);
        }
    }
    console.log("Edge masks initialized for bitboards.");
}
// Call initialization for masks and global bitboards
initializeHelperBitmasks();

function initializeGlobalBitboards() {
    bitboards[PLAYER_BLACK] = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
    bitboards[PLAYER_WHITE] = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
}
initializeGlobalBitboards();


function getCellBitPosition(r, c) {
    return r * BOARD_SIZE + c;
}

function setCellBit(playerBitboardArray, r, c) {
    const bitPos = getCellBitPosition(r, c);
    const boardIndex = Math.floor(bitPos / 64);
    const bitInBoard = BigInt(bitPos % 64);
    if (boardIndex < NUM_BITBOARDS_PER_PLAYER) playerBitboardArray[boardIndex] |= (BigInt(1) << bitInBoard);
    else console.error(`setCellBit: boardIndex ${boardIndex} out of range for bitPos ${bitPos}`);
}

function clearCellBit(playerBitboardArray, r, c) {
    const bitPos = getCellBitPosition(r, c);
    const boardIndex = Math.floor(bitPos / 64);
    const bitInBoard = BigInt(bitPos % 64);
    if (boardIndex < NUM_BITBOARDS_PER_PLAYER) playerBitboardArray[boardIndex] &= ~(BigInt(1) << bitInBoard);
    else console.error(`clearCellBit: boardIndex ${boardIndex} out of range for bitPos ${bitPos}`);
}

function getCellBit(playerBitboardArray, r, c) {
    const bitPos = getCellBitPosition(r, c);
    const boardIndex = Math.floor(bitPos / 64);
    const bitInBoard = BigInt(bitPos % 64);
    if (boardIndex < NUM_BITBOARDS_PER_PLAYER && r >=0 && r < BOARD_SIZE && c >=0 && c < BOARD_SIZE) {
        return (playerBitboardArray[boardIndex] & (BigInt(1) << bitInBoard)) !== BigInt(0);
    }
    return false;
}

function initGlobalBitboardsFrom2DArray(board2D) {
    initializeGlobalBitboards();
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board2D[r][c] === PLAYER_BLACK) setCellBit(bitboards[PLAYER_BLACK], r, c);
            else if (board2D[r][c] === PLAYER_WHITE) setCellBit(bitboards[PLAYER_WHITE], r, c);
        }
    }
}

function getCellStatus(r, c) {
    if (!isInBounds(c, r)) return 'EDGE';
    if (getCellBit(bitboards[PLAYER_BLACK], r, c)) return PLAYER_BLACK;
    if (getCellBit(bitboards[PLAYER_WHITE], r, c)) return PLAYER_WHITE;
    return EMPTY;
}

// --- Zobrist Hashing ---
let zobristTable = [];
function generateRandomBigInt() {
    if (self.crypto && self.crypto.getRandomValues) {
        const buffer = new BigUint64Array(1); self.crypto.getRandomValues(buffer); return buffer[0];
    } else {
        console.warn("Crypto API not available for Zobrist key generation, using Math.random().");
        const p1 = BigInt(Math.floor(Math.random()*(2**32))); const p2 = BigInt(Math.floor(Math.random()*(2**32))); return (p1<<BigInt(32))|p2;
    }
}
function initZobrist() {
    zobristTable = Array(BOARD_SIZE);
    for (let r = 0; r < BOARD_SIZE; r++) {
        zobristTable[r] = Array(BOARD_SIZE);
        for (let c = 0; c < BOARD_SIZE; c++) {
            zobristTable[r][c] = {};
            zobristTable[r][c][PLAYER_BLACK] = generateRandomBigInt();
            zobristTable[r][c][PLAYER_WHITE] = generateRandomBigInt();
        }
    }
    console.log("Zobrist table initialized.");
}
initZobrist();

function computeZobristHashFromArray(boardArray) {
    let hash = BigInt(0);
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
        if (boardArray[r][c] !== EMPTY) hash ^= zobristTable[r][c][boardArray[r][c]];
    }
    return hash;
}
function computeZobristHashFromBitboards() {
    let hash = BigInt(0);
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
        if (getCellBit(bitboards[PLAYER_BLACK], r, c)) hash ^= zobristTable[r][c][PLAYER_BLACK];
        else if (getCellBit(bitboards[PLAYER_WHITE], r, c)) hash ^= zobristTable[r][c][PLAYER_WHITE];
    }
    return hash;
}
function updateZobristHash(currentHash, r, c, player) {
    return currentHash ^ zobristTable[r][c][player];
}

// --- Opening Book ---
const openingBook = new Map();
function initOpeningBook() {
    let emptyBoardArray = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
    let hashStateStr;
    hashStateStr = computeZobristHashFromArray(emptyBoardArray).toString();
    openingBook.set(hashStateStr, [{ x: 7, y: 7 }]);
    emptyBoardArray[7][7] = PLAYER_BLACK;
    hashStateStr = computeZobristHashFromArray(emptyBoardArray).toString();
    openingBook.set(hashStateStr, [ { x: 7, y: 6 }, { x: 6, y: 7 }, { x: 8, y: 7 }, { x: 7, y: 8 }, { x: 6, y: 6 }, { x: 8, y: 8 }, { x: 6, y: 8 }, { x: 8, y: 6 } ]);
    emptyBoardArray[7][7] = EMPTY;
    console.log(`Opening book initialized with ${openingBook.size} states.`);
}
initOpeningBook();

// --- Transposition Table ---
const transpositionTable = new Map();
const TT_FLAG_EXACT = 0; const TT_FLAG_LOWERBOUND = 1; const TT_FLAG_UPPERBOUND = 2;

// --- Bitboard Pattern Detection & Helpers ---
function PopCount(bigIntValue) {
    let count = 0; let n = bigIntValue;
    while (n > BigInt(0)) { n &= (n - BigInt(1)); count++; }
    return count;
}
function PopCountBoardArray(bbArray) {
    let totalCount = 0;
    for (const bb of bbArray) totalCount += PopCount(bb);
    return totalCount;
}
function BitwiseANDBoardArrays(bbA, bbB) {
    const result = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
    for (let i = 0; i < NUM_BITBOARDS_PER_PLAYER; i++) result[i] = bbA[i] & bbB[i];
    return result;
}
function BitwiseORBoardArrays(bbA, bbB) {
    const result = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
    for (let i = 0; i < NUM_BITBOARDS_PER_PLAYER; i++) result[i] = bbA[i] | bbB[i];
    return result;
}

function shiftBoardHorizontalRight(inputBoardArray, count) {
    if (count === 0) return inputBoardArray.map(b => b);
    if (count < 0) { return shiftBoardHorizontalLeft(inputBoardArray, -count); }
    const resultBoardArray = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
        const src_c = c + count;
        if (src_c < BOARD_SIZE && getCellBit(inputBoardArray, r, src_c)) setCellBit(resultBoardArray, r, c);
    }
    return resultBoardArray;
}
function shiftBoardHorizontalLeft(inputBoardArray, count) {
    if (count === 0) return inputBoardArray.map(b => b);
    if (count < 0) { return shiftBoardHorizontalRight(inputBoardArray, -count); }
    const resultBoardArray = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
        const src_c = c - count;
        if (src_c >= 0 && getCellBit(inputBoardArray, r, src_c)) setCellBit(resultBoardArray, r, c);
    }
    return resultBoardArray;
}
function shiftBoardVertical(inputBoardArray, count) { // +ve down, -ve up
    if (count === 0) return inputBoardArray.map(b => b);
    const resultBoardArray = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
    if (count > 0) {
        for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
            const src_r = r - count;
            if (src_r >= 0 && getCellBit(inputBoardArray, src_r, c)) setCellBit(resultBoardArray, r, c);
        }
    } else {
        const absCount = -count;
        for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
            const src_r = r + absCount;
            if (src_r < BOARD_SIZE && getCellBit(inputBoardArray, src_r, c)) setCellBit(resultBoardArray, r, c);
        }
    }
    return resultBoardArray;
}
function shiftBoardDiagonalDownRight(inputBoardArray, count) {
    if (count === 0) return inputBoardArray.map(b => b);
    const resultBoardArray = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
        const src_r = r - count; const src_c = c - count;
        if (src_r >= 0 && src_c >= 0 && getCellBit(inputBoardArray, src_r, src_c)) setCellBit(resultBoardArray, r, c);
    }
    return resultBoardArray;
}
function shiftBoardDiagonalDownLeft(inputBoardArray, count) {
    if (count === 0) return inputBoardArray.map(b => b);
    const resultBoardArray = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
        const src_r = r - count; const src_c = c + count;
        if (src_r >= 0 && src_c < BOARD_SIZE && getCellBit(inputBoardArray, src_r, src_c)) setCellBit(resultBoardArray, r, c);
    }
    return resultBoardArray;
}

function detectHorizontalFiveBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardHorizontalRight(playerBB, 1); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardHorizontalRight(playerBB, 2); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardHorizontalRight(playerBB, 3); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardHorizontalRight(playerBB, 4); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectVerticalFiveBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardVertical(playerBB, -1); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardVertical(playerBB, -2); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardVertical(playerBB, -3); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardVertical(playerBB, -4); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectDiagonalDownRightFiveBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardDiagonalDownRight(playerBB, 1); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardDiagonalDownRight(playerBB, 2); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardDiagonalDownRight(playerBB, 3); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardDiagonalDownRight(playerBB, 4); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectDiagonalDownLeftFiveBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardDiagonalDownLeft(playerBB, 1); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardDiagonalDownLeft(playerBB, 2); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardDiagonalDownLeft(playerBB, 3); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardDiagonalDownLeft(playerBB, 4); t = BitwiseANDBoardArrays(t, s);
    return t;
}

function detectHorizontalFourBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardHorizontalRight(playerBB, 1); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardHorizontalRight(playerBB, 2); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardHorizontalRight(playerBB, 3); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function computeEmptyCellsBitboard() {
    const emptyBB = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
    const occupiedBB = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
    for (let i = 0; i < NUM_BITBOARDS_PER_PLAYER; i++) {
        occupiedBB[i] = bitboards[PLAYER_BLACK][i] | bitboards[PLAYER_WHITE][i];
    }
    const fullBoardMask = Array(NUM_BITBOARDS_PER_PLAYER).fill(BigInt(0));
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            setCellBit(fullBoardMask, r, c);
        }
    }
    for (let i = 0; i < NUM_BITBOARDS_PER_PLAYER; i++) {
        emptyBB[i] = (~occupiedBB[i]) & fullBoardMask[i];
    }
    return emptyBB;
}
function detectHorizontalLiveFourBitwise(playerBB, emptyBB) {
    const p_bb = playerBB; const e_bb = emptyBB;
    let P0 = p_bb;
    let P1 = shiftBoardHorizontalLeft(p_bb, 1);
    let P2 = shiftBoardHorizontalLeft(p_bb, 2);
    let P3 = shiftBoardHorizontalLeft(p_bb, 3);
    let E_neg1 = shiftBoardHorizontalRight(e_bb, 1);
    let E_pos4 = shiftBoardHorizontalLeft(e_bb, 4);

    let liveFours = BitwiseANDBoardArrays(E_neg1, P0);
    liveFours = BitwiseANDBoardArrays(liveFours, P1);
    liveFours = BitwiseANDBoardArrays(liveFours, P2);
    liveFours = BitwiseANDBoardArrays(liveFours, P3);
    liveFours = BitwiseANDBoardArrays(liveFours, E_pos4);
    return liveFours;
}
function detectHorizontalDeadFourBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb = playerBB; const o_bb = opponentBB; const e_bb = emptyBB;
    let P0=p_bb, P1=shiftBoardHorizontalLeft(p_bb,1), P2=shiftBoardHorizontalLeft(p_bb,2), P3=shiftBoardHorizontalLeft(p_bb,3);

    let O_neg1 = shiftBoardHorizontalRight(o_bb, 1);
    let E_pos4 = shiftBoardHorizontalLeft(e_bb, 4);
    let df1 = BitwiseANDBoardArrays(O_neg1, P0); df1 = BitwiseANDBoardArrays(df1, P1); df1 = BitwiseANDBoardArrays(df1, P2); df1 = BitwiseANDBoardArrays(df1, P3); df1 = BitwiseANDBoardArrays(df1, E_pos4);

    let E_neg1 = shiftBoardHorizontalRight(e_bb, 1);
    let O_pos4 = shiftBoardHorizontalLeft(o_bb, 4);
    let df2 = BitwiseANDBoardArrays(E_neg1, P0); df2 = BitwiseANDBoardArrays(df2, P1); df2 = BitwiseANDBoardArrays(df2, P2); df2 = BitwiseANDBoardArrays(df2, P3); df2 = BitwiseANDBoardArrays(df2, O_pos4);

    return BitwiseORBoardArrays(df1, df2);
}

function detectVerticalFourBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardVertical(playerBB, -1); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardVertical(playerBB, -2); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardVertical(playerBB, -3); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectVerticalLiveFourBitwise(playerBB, emptyBB) {
    const p_bb = playerBB; const e_bb = emptyBB;
    let E_neg1 = shiftBoardVertical(e_bb, 1);
    let P0 = p_bb;
    let P1 = shiftBoardVertical(p_bb, -1);
    let P2 = shiftBoardVertical(p_bb, -2);
    let P3 = shiftBoardVertical(p_bb, -3);
    let E_pos4 = shiftBoardVertical(e_bb, -4);
    let lf = BitwiseANDBoardArrays(E_neg1, P0); lf = BitwiseANDBoardArrays(lf, P1); lf = BitwiseANDBoardArrays(lf, P2); lf = BitwiseANDBoardArrays(lf, P3); lf = BitwiseANDBoardArrays(lf, E_pos4);
    return lf;
}
function detectVerticalDeadFourBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb=playerBB, o_bb=opponentBB, e_bb=emptyBB;
    let P0=p_bb, P1=shiftBoardVertical(p_bb,-1), P2=shiftBoardVertical(p_bb,-2), P3=shiftBoardVertical(p_bb,-3);
    let O_neg1=shiftBoardVertical(o_bb,1), E_pos4=shiftBoardVertical(e_bb,-4);
    let df1 = BitwiseANDBoardArrays(O_neg1,P0); df1=BitwiseANDBoardArrays(df1,P1); df1=BitwiseANDBoardArrays(df1,P2); df1=BitwiseANDBoardArrays(df1,P3); df1=BitwiseANDBoardArrays(df1,E_pos4);
    let E_neg1=shiftBoardVertical(e_bb,1), O_pos4=shiftBoardVertical(o_bb,-4);
    let df2 = BitwiseANDBoardArrays(E_neg1,P0); df2=BitwiseANDBoardArrays(df2,P1); df2=BitwiseANDBoardArrays(df2,P2); df2=BitwiseANDBoardArrays(df2,P3); df2=BitwiseANDBoardArrays(df2,O_pos4);
    return BitwiseORBoardArrays(df1,df2);
}

function detectDiagonalDownRightFourBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardDiagonalDownRight(playerBB, 1); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardDiagonalDownRight(playerBB, 2); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardDiagonalDownRight(playerBB, 3); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectDiagonalDownRightLiveFourBitwise(playerBB, emptyBB) {
    const p_bb=playerBB, e_bb=emptyBB;
    let E_n1 = shiftBoardDiagonalDownRight(e_bb,1), P0=p_bb, P1=shiftBoardDiagonalDownRight(p_bb,-1), P2=shiftBoardDiagonalDownRight(p_bb,-2), P3=shiftBoardDiagonalDownRight(p_bb,-3), E_p4=shiftBoardDiagonalDownRight(e_bb,-4);
    let lf=BitwiseANDBoardArrays(E_n1,P0); lf=BitwiseANDBoardArrays(lf,P1); lf=BitwiseANDBoardArrays(lf,P2); lf=BitwiseANDBoardArrays(lf,P3); lf=BitwiseANDBoardArrays(lf,E_p4);
    return lf;
}
function detectDiagonalDownRightDeadFourBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb=playerBB, o_bb=opponentBB, e_bb=emptyBB;
    let P0=p_bb, P1=shiftBoardDiagonalDownRight(p_bb,-1), P2=shiftBoardDiagonalDownRight(p_bb,-2), P3=shiftBoardDiagonalDownRight(p_bb,-3);
    let O_n1=shiftBoardDiagonalDownRight(o_bb,1), E_p4=shiftBoardDiagonalDownRight(e_bb,-4);
    let df1=BitwiseANDBoardArrays(O_n1,P0); df1=BitwiseANDBoardArrays(df1,P1); df1=BitwiseANDBoardArrays(df1,P2); df1=BitwiseANDBoardArrays(df1,P3); df1=BitwiseANDBoardArrays(df1,E_p4);
    let E_n1=shiftBoardDiagonalDownRight(e_bb,1), O_p4=shiftBoardDiagonalDownRight(o_bb,-4);
    let df2=BitwiseANDBoardArrays(E_n1,P0); df2=BitwiseANDBoardArrays(df2,P1); df2=BitwiseANDBoardArrays(df2,P2); df2=BitwiseANDBoardArrays(df2,P3); df2=BitwiseANDBoardArrays(df2,O_p4);
    return BitwiseORBoardArrays(df1,df2);
}

function detectDiagonalDownLeftFourBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardDiagonalDownLeft(playerBB, 1); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardDiagonalDownLeft(playerBB, 2); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardDiagonalDownLeft(playerBB, 3); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectDiagonalDownLeftLiveFourBitwise(playerBB, emptyBB) {
    const p_bb=playerBB, e_bb=emptyBB;
    let E_n1=shiftBoardDiagonalDownLeft(e_bb,1), P0=p_bb, P1=shiftBoardDiagonalDownLeft(p_bb,-1), P2=shiftBoardDiagonalDownLeft(p_bb,-2), P3=shiftBoardDiagonalDownLeft(p_bb,-3), E_p4=shiftBoardDiagonalDownLeft(e_bb,-4);
    let lf=BitwiseANDBoardArrays(E_n1,P0); lf=BitwiseANDBoardArrays(lf,P1); lf=BitwiseANDBoardArrays(lf,P2); lf=BitwiseANDBoardArrays(lf,P3); lf=BitwiseANDBoardArrays(lf,E_p4);
    return lf;
}
function detectDiagonalDownLeftDeadFourBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb=playerBB, o_bb=opponentBB, e_bb=emptyBB;
    let P0=p_bb, P1=shiftBoardDiagonalDownLeft(p_bb,-1), P2=shiftBoardDiagonalDownLeft(p_bb,-2), P3=shiftBoardDiagonalDownLeft(p_bb,-3);
    let O_n1=shiftBoardDiagonalDownLeft(o_bb,1), E_p4=shiftBoardDiagonalDownLeft(e_bb,-4);
    let df1=BitwiseANDBoardArrays(O_n1,P0); df1=BitwiseANDBoardArrays(df1,P1); df1=BitwiseANDBoardArrays(df1,P2); df1=BitwiseANDBoardArrays(df1,P3); df1=BitwiseANDBoardArrays(df1,E_p4);
    let E_n1=shiftBoardDiagonalDownLeft(e_bb,1), O_p4=shiftBoardDiagonalDownLeft(o_bb,-4);
    let df2=BitwiseANDBoardArrays(E_n1,P0); df2=BitwiseANDBoardArrays(df2,P1); df2=BitwiseANDBoardArrays(df2,P2); df2=BitwiseANDBoardArrays(df2,P3); df2=BitwiseANDBoardArrays(df2,O_p4);
    return BitwiseORBoardArrays(df1,df2);
}

// --- Bitwise Pattern Detection for Threes ---
function detectHorizontalThreeBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardHorizontalRight(playerBB, 1); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardHorizontalRight(playerBB, 2); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectHorizontalLiveThreeBitwise(playerBB, emptyBB) {
    const p_bb = playerBB; const e_bb = emptyBB;
    let P0=p_bb, P1=shiftBoardHorizontalLeft(p_bb,1), P2=shiftBoardHorizontalLeft(p_bb,2);
    let E_neg1 = shiftBoardHorizontalRight(e_bb, 1);
    let E_pos3 = shiftBoardHorizontalLeft(e_bb, 3);
    let lt = BitwiseANDBoardArrays(E_neg1, P0); lt = BitwiseANDBoardArrays(lt, P1); lt = BitwiseANDBoardArrays(lt, P2); lt = BitwiseANDBoardArrays(lt, E_pos3);
    return lt;
}
function detectHorizontalDeadThreeBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb=playerBB, o_bb=opponentBB, e_bb=emptyBB;
    let P0=p_bb, P1=shiftBoardHorizontalLeft(p_bb,1), P2=shiftBoardHorizontalLeft(p_bb,2);
    let O_neg1=shiftBoardHorizontalRight(o_bb,1), E_pos3=shiftBoardHorizontalLeft(e_bb,3);
    let dt1=BitwiseANDBoardArrays(O_neg1,P0); dt1=BitwiseANDBoardArrays(dt1,P1); dt1=BitwiseANDBoardArrays(dt1,P2); dt1=BitwiseANDBoardArrays(dt1,E_pos3);
    let E_neg1=shiftBoardHorizontalRight(e_bb,1), O_pos3=shiftBoardHorizontalLeft(o_bb,3);
    let dt2=BitwiseANDBoardArrays(E_neg1,P0); dt2=BitwiseANDBoardArrays(dt2,P1); dt2=BitwiseANDBoardArrays(dt2,P2); dt2=BitwiseANDBoardArrays(dt2,O_pos3);
    return BitwiseORBoardArrays(dt1,dt2);
}

function detectVerticalThreeBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardVertical(playerBB, -1); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardVertical(playerBB, -2); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectVerticalLiveThreeBitwise(playerBB, emptyBB) {
    const p_bb=playerBB, e_bb=emptyBB;
    let E_n1=shiftBoardVertical(e_bb,1), P0=p_bb, P1=shiftBoardVertical(p_bb,-1), P2=shiftBoardVertical(p_bb,-2), E_p3=shiftBoardVertical(e_bb,-3);
    let lt=BitwiseANDBoardArrays(E_n1,P0); lt=BitwiseANDBoardArrays(lt,P1); lt=BitwiseANDBoardArrays(lt,P2); lt=BitwiseANDBoardArrays(lt,E_p3);
    return lt;
}
function detectVerticalDeadThreeBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb=playerBB, o_bb=opponentBB, e_bb=emptyBB;
    let P0=p_bb, P1=shiftBoardVertical(p_bb,-1), P2=shiftBoardVertical(p_bb,-2);
    let O_n1=shiftBoardVertical(o_bb,1), E_p3=shiftBoardVertical(e_bb,-3);
    let dt1=BitwiseANDBoardArrays(O_n1,P0); dt1=BitwiseANDBoardArrays(dt1,P1); dt1=BitwiseANDBoardArrays(dt1,P2); dt1=BitwiseANDBoardArrays(dt1,E_p3);
    let E_n1=shiftBoardVertical(e_bb,1), O_p3=shiftBoardVertical(o_bb,-3);
    let dt2=BitwiseANDBoardArrays(E_n1,P0); dt2=BitwiseANDBoardArrays(dt2,P1); dt2=BitwiseANDBoardArrays(dt2,P2); dt2=BitwiseANDBoardArrays(dt2,O_p3);
    return BitwiseORBoardArrays(dt1,dt2);
}

function detectDiagonalDownRightThreeBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardDiagonalDownRight(playerBB, 1); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardDiagonalDownRight(playerBB, 2); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectDiagonalDownRightLiveThreeBitwise(playerBB, emptyBB) {
    const p_bb=playerBB, e_bb=emptyBB;
    let E_n1=shiftBoardDiagonalDownRight(e_bb,1), P0=p_bb, P1=shiftBoardDiagonalDownRight(p_bb,-1), P2=shiftBoardDiagonalDownRight(p_bb,-2), E_p3=shiftBoardDiagonalDownRight(e_bb,-3);
    let lt=BitwiseANDBoardArrays(E_n1,P0); lt=BitwiseANDBoardArrays(lt,P1); lt=BitwiseANDBoardArrays(lt,P2); lt=BitwiseANDBoardArrays(lt,E_p3);
    return lt;
}
function detectDiagonalDownRightDeadThreeBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb=playerBB, o_bb=opponentBB, e_bb=emptyBB;
    let P0=p_bb, P1=shiftBoardDiagonalDownRight(p_bb,-1), P2=shiftBoardDiagonalDownRight(p_bb,-2);
    let O_n1=shiftBoardDiagonalDownRight(o_bb,1), E_p3=shiftBoardDiagonalDownRight(e_bb,-3);
    let dt1=BitwiseANDBoardArrays(O_n1,P0); dt1=BitwiseANDBoardArrays(dt1,P1); dt1=BitwiseANDBoardArrays(dt1,P2); dt1=BitwiseANDBoardArrays(dt1,E_p3);
    let E_n1=shiftBoardDiagonalDownRight(e_bb,1), O_p3=shiftBoardDiagonalDownRight(o_bb,-3);
    let dt2=BitwiseANDBoardArrays(E_n1,P0); dt2=BitwiseANDBoardArrays(dt2,P1); dt2=BitwiseANDBoardArrays(dt2,P2); dt2=BitwiseANDBoardArrays(dt2,O_p3);
    return BitwiseORBoardArrays(dt1,dt2);
}

function detectDiagonalDownLeftThreeBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardDiagonalDownLeft(playerBB, 1); t = BitwiseANDBoardArrays(t, s);
    s = shiftBoardDiagonalDownLeft(playerBB, 2); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectDiagonalDownLeftLiveThreeBitwise(playerBB, emptyBB) {
    const p_bb=playerBB, e_bb=emptyBB;
    let E_n1=shiftBoardDiagonalDownLeft(e_bb,1), P0=p_bb, P1=shiftBoardDiagonalDownLeft(p_bb,-1), P2=shiftBoardDiagonalDownLeft(p_bb,-2), E_p3=shiftBoardDiagonalDownLeft(e_bb,-3);
    let lt=BitwiseANDBoardArrays(E_n1,P0); lt=BitwiseANDBoardArrays(lt,P1); lt=BitwiseANDBoardArrays(lt,P2); lt=BitwiseANDBoardArrays(lt,E_p3);
    return lt;
}
function detectDiagonalDownLeftDeadThreeBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb=playerBB, o_bb=opponentBB, e_bb=emptyBB;
    let P0=p_bb, P1=shiftBoardDiagonalDownLeft(p_bb,-1), P2=shiftBoardDiagonalDownLeft(p_bb,-2);
    let O_n1=shiftBoardDiagonalDownLeft(o_bb,1), E_p3=shiftBoardDiagonalDownLeft(e_bb,-3);
    let dt1=BitwiseANDBoardArrays(O_n1,P0); dt1=BitwiseANDBoardArrays(dt1,P1); dt1=BitwiseANDBoardArrays(dt1,P2); dt1=BitwiseANDBoardArrays(dt1,E_p3);
    let E_n1=shiftBoardDiagonalDownLeft(e_bb,1), O_p3=shiftBoardDiagonalDownLeft(o_bb,-3);
    let dt2=BitwiseANDBoardArrays(E_n1,P0); dt2=BitwiseANDBoardArrays(dt2,P1); dt2=BitwiseANDBoardArrays(dt2,P2); dt2=BitwiseANDBoardArrays(dt2,O_p3);
    return BitwiseORBoardArrays(dt1,dt2);
}

// --- Bitwise Pattern Detection for Twos ---
function detectHorizontalTwoBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardHorizontalRight(playerBB, 1); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectHorizontalLiveTwoBitwise(playerBB, emptyBB) {
    const p_bb=playerBB, e_bb=emptyBB;
    let E_n1=shiftBoardHorizontalRight(e_bb,1), P0=p_bb, P1=shiftBoardHorizontalLeft(p_bb,1), E_p2=shiftBoardHorizontalLeft(e_bb,2);
    let lt=BitwiseANDBoardArrays(E_n1,P0); lt=BitwiseANDBoardArrays(lt,P1); lt=BitwiseANDBoardArrays(lt,E_p2);
    return lt;
}
function detectHorizontalDeadTwoBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb=playerBB, o_bb=opponentBB, e_bb=emptyBB;
    let P0=p_bb,P1=shiftBoardHorizontalLeft(p_bb,1);
    let O_n1=shiftBoardHorizontalRight(o_bb,1),E_p2=shiftBoardHorizontalLeft(e_bb,2);
    let dt1=BitwiseANDBoardArrays(O_n1,P0);dt1=BitwiseANDBoardArrays(dt1,P1);dt1=BitwiseANDBoardArrays(dt1,E_p2);
    let E_n1=shiftBoardHorizontalRight(e_bb,1),O_p2=shiftBoardHorizontalLeft(o_bb,2);
    let dt2=BitwiseANDBoardArrays(E_n1,P0);dt2=BitwiseANDBoardArrays(dt2,P1);dt2=BitwiseANDBoardArrays(dt2,O_p2);
    return BitwiseORBoardArrays(dt1,dt2);
}

function detectVerticalTwoBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardVertical(playerBB, -1); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectVerticalLiveTwoBitwise(playerBB, emptyBB) {
    const p_bb=playerBB, e_bb=emptyBB;
    let E_n1=shiftBoardVertical(e_bb,1), P0=p_bb, P1=shiftBoardVertical(p_bb,-1), E_p2=shiftBoardVertical(e_bb,-2);
    let lt=BitwiseANDBoardArrays(E_n1,P0); lt=BitwiseANDBoardArrays(lt,P1); lt=BitwiseANDBoardArrays(lt,E_p2);
    return lt;
}
function detectVerticalDeadTwoBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb=playerBB, o_bb=opponentBB, e_bb=emptyBB;
    let P0=p_bb,P1=shiftBoardVertical(p_bb,-1);
    let O_n1=shiftBoardVertical(o_bb,1),E_p2=shiftBoardVertical(e_bb,-2);
    let dt1=BitwiseANDBoardArrays(O_n1,P0);dt1=BitwiseANDBoardArrays(dt1,P1);dt1=BitwiseANDBoardArrays(dt1,E_p2);
    let E_n1=shiftBoardVertical(e_bb,1),O_p2=shiftBoardVertical(o_bb,-2);
    let dt2=BitwiseANDBoardArrays(E_n1,P0);dt2=BitwiseANDBoardArrays(dt2,P1);dt2=BitwiseANDBoardArrays(dt2,O_p2);
    return BitwiseORBoardArrays(dt1,dt2);
}

function detectDiagonalDownRightTwoBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardDiagonalDownRight(playerBB, 1); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectDiagonalDownRightLiveTwoBitwise(playerBB, emptyBB) {
    const p_bb=playerBB, e_bb=emptyBB;
    let E_n1=shiftBoardDiagonalDownRight(e_bb,1), P0=p_bb, P1=shiftBoardDiagonalDownRight(p_bb,-1), E_p2=shiftBoardDiagonalDownRight(e_bb,-2);
    let lt=BitwiseANDBoardArrays(E_n1,P0); lt=BitwiseANDBoardArrays(lt,P1); lt=BitwiseANDBoardArrays(lt,E_p2);
    return lt;
}
function detectDiagonalDownRightDeadTwoBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb=playerBB, o_bb=opponentBB, e_bb=emptyBB;
    let P0=p_bb,P1=shiftBoardDiagonalDownRight(p_bb,-1);
    let O_n1=shiftBoardDiagonalDownRight(o_bb,1),E_p2=shiftBoardDiagonalDownRight(e_bb,-2);
    let dt1=BitwiseANDBoardArrays(O_n1,P0);dt1=BitwiseANDBoardArrays(dt1,P1);dt1=BitwiseANDBoardArrays(dt1,E_p2);
    let E_n1=shiftBoardDiagonalDownRight(e_bb,1),O_p2=shiftBoardDiagonalDownRight(o_bb,-2);
    let dt2=BitwiseANDBoardArrays(E_n1,P0);dt2=BitwiseANDBoardArrays(dt2,P1);dt2=BitwiseANDBoardArrays(dt2,O_p2);
    return BitwiseORBoardArrays(dt1,dt2);
}

function detectDiagonalDownLeftTwoBitwise(playerBB) {
    let t = playerBB.map(b=>b); let s;
    s = shiftBoardDiagonalDownLeft(playerBB, 1); t = BitwiseANDBoardArrays(t, s);
    return t;
}
function detectDiagonalDownLeftLiveTwoBitwise(playerBB, emptyBB) {
    const p_bb=playerBB, e_bb=emptyBB;
    let E_n1=shiftBoardDiagonalDownLeft(e_bb,1), P0=p_bb, P1=shiftBoardDiagonalDownLeft(p_bb,-1), E_p2=shiftBoardDiagonalDownLeft(e_bb,-2);
    let lt=BitwiseANDBoardArrays(E_n1,P0); lt=BitwiseANDBoardArrays(lt,P1); lt=BitwiseANDBoardArrays(lt,E_p2);
    return lt;
}
function detectDiagonalDownLeftDeadTwoBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb=playerBB, o_bb=opponentBB, e_bb=emptyBB;
    let P0=p_bb,P1=shiftBoardDiagonalDownLeft(p_bb,-1);
    let O_n1=shiftBoardDiagonalDownLeft(o_bb,1),E_p2=shiftBoardDiagonalDownLeft(e_bb,-2);
    let dt1=BitwiseANDBoardArrays(O_n1,P0);dt1=BitwiseANDBoardArrays(dt1,P1);dt1=BitwiseANDBoardArrays(dt1,E_p2);
    let E_n1=shiftBoardDiagonalDownLeft(e_bb,1),O_p2=shiftBoardDiagonalDownLeft(o_bb,-2);
    let dt2=BitwiseANDBoardArrays(E_n1,P0);dt2=BitwiseANDBoardArrays(dt2,P1);dt2=BitwiseANDBoardArrays(dt2,O_p2);
    return BitwiseORBoardArrays(dt1,dt2);
}

// --- Gapped Pattern Detection ---
function detectHorizontalLiveJumpThreeBitwise(playerBB, emptyBB) { // _P_P_
    const p_bb = playerBB;
    const e_bb = emptyBB;
    let E_neg1 = shiftBoardHorizontalRight(e_bb, 1);
    let P0     = p_bb;
    let E_pos1 = shiftBoardHorizontalLeft(e_bb, 1);
    let P_pos2 = shiftBoardHorizontalLeft(p_bb, 2);
    let E_pos3 = shiftBoardHorizontalLeft(e_bb, 3);
    let r = BitwiseANDBoardArrays(E_neg1, P0); r = BitwiseANDBoardArrays(r, E_pos1); r = BitwiseANDBoardArrays(r, P_pos2); r = BitwiseANDBoardArrays(r, E_pos3);
    return r;
}
function detectVerticalLiveJumpThreeBitwise(playerBB, emptyBB) { // _P_P_ stacked
    const p_bb = playerBB;
    const e_bb = emptyBB;
    let E_neg1 = shiftBoardVertical(e_bb, 1);
    let P0     = p_bb;
    let E_pos1 = shiftBoardVertical(e_bb, -1);
    let P_pos2 = shiftBoardVertical(p_bb, -2);
    let E_pos3 = shiftBoardVertical(e_bb, -3);
    let r = BitwiseANDBoardArrays(E_neg1, P0); r = BitwiseANDBoardArrays(r, E_pos1); r = BitwiseANDBoardArrays(r, P_pos2); r = BitwiseANDBoardArrays(r, E_pos3);
    return r;
}
function detectDiagonalDownRightLiveJumpThreeBitwise(playerBB, emptyBB) { // '\' _P_P_
    const p_bb = playerBB; const e_bb = emptyBB;
    let E_n1 = shiftBoardDiagonalDownRight(e_bb,1), P0=p_bb, E_p1=shiftBoardDiagonalDownRight(e_bb,-1), P_p2=shiftBoardDiagonalDownRight(p_bb,-2), E_p3=shiftBoardDiagonalDownRight(e_bb,-3);
    let r = BitwiseANDBoardArrays(E_n1,P0); r=BitwiseANDBoardArrays(r,E_p1); r=BitwiseANDBoardArrays(r,P_p2); r=BitwiseANDBoardArrays(r,E_p3);
    return r;
}
function detectDiagonalDownLeftLiveJumpThreeBitwise(playerBB, emptyBB) { // '/' _P_P_
    const p_bb = playerBB; const e_bb = emptyBB;
    let E_n1=shiftBoardDiagonalDownLeft(e_bb,1), P0=p_bb, E_p1=shiftBoardDiagonalDownLeft(e_bb,-1), P_p2=shiftBoardDiagonalDownLeft(p_bb,-2), E_p3=shiftBoardDiagonalDownLeft(e_bb,-3);
    let r=BitwiseANDBoardArrays(E_n1,P0); r=BitwiseANDBoardArrays(r,E_p1); r=BitwiseANDBoardArrays(r,P_p2); r=BitwiseANDBoardArrays(r,E_p3);
    return r;
}
function detectHorizontalDeadJumpThreeBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb = playerBB; const o_bb = opponentBB; const e_bb = emptyBB;
    let P0 = p_bb;
    let E_pos1 = shiftBoardHorizontalLeft(e_bb, 1);
    let P_pos2 = shiftBoardHorizontalLeft(p_bb, 2);

    // Case 1: O P E P _
    let O_neg1 = shiftBoardHorizontalRight(o_bb, 1);
    let E_pos3_c1 = shiftBoardHorizontalLeft(e_bb, 3);
    let r1 = BitwiseANDBoardArrays(O_neg1, P0); r1 = BitwiseANDBoardArrays(r1, E_pos1); r1 = BitwiseANDBoardArrays(r1, P_pos2); r1 = BitwiseANDBoardArrays(r1, E_pos3_c1);

    // Case 2: _ P E P O
    let E_neg1 = shiftBoardHorizontalRight(e_bb, 1);
    let O_pos3 = shiftBoardHorizontalLeft(o_bb, 3);
    let r2 = BitwiseANDBoardArrays(E_neg1, P0); r2 = BitwiseANDBoardArrays(r2, E_pos1); r2 = BitwiseANDBoardArrays(r2, P_pos2); r2 = BitwiseANDBoardArrays(r2, O_pos3);

    return BitwiseORBoardArrays(r1, r2);
}
function detectVerticalDeadJumpThreeBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb = playerBB; const o_bb = opponentBB; const e_bb = emptyBB;
    let P0 = p_bb;
    let E_pos1 = shiftBoardVertical(e_bb, -1);
    let P_pos2 = shiftBoardVertical(p_bb, -2);

    let O_neg1 = shiftBoardVertical(o_bb, 1);
    let E_pos3_c1 = shiftBoardVertical(e_bb, -3);
    let r1 = BitwiseANDBoardArrays(O_neg1, P0); r1 = BitwiseANDBoardArrays(r1, E_pos1); r1 = BitwiseANDBoardArrays(r1, P_pos2); r1 = BitwiseANDBoardArrays(r1, E_pos3_c1);

    let E_neg1 = shiftBoardVertical(e_bb, 1);
    let O_pos3 = shiftBoardVertical(o_bb, -3);
    let r2 = BitwiseANDBoardArrays(E_neg1, P0); r2 = BitwiseANDBoardArrays(r2, E_pos1); r2 = BitwiseANDBoardArrays(r2, P_pos2); r2 = BitwiseANDBoardArrays(r2, O_pos3);

    return BitwiseORBoardArrays(r1, r2);
}
function detectDiagonalDownRightDeadJumpThreeBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb=playerBB, o_bb=opponentBB, e_bb=emptyBB;
    let P0=p_bb, E_p1=shiftBoardDiagonalDownRight(e_bb,-1), P_p2=shiftBoardDiagonalDownRight(p_bb,-2);
    let O_n1=shiftBoardDiagonalDownRight(o_bb,1), E_p3=shiftBoardDiagonalDownRight(e_bb,-3);
    let r1=BitwiseANDBoardArrays(O_n1,P0); r1=BitwiseANDBoardArrays(r1,E_p1); r1=BitwiseANDBoardArrays(r1,P_p2); r1=BitwiseANDBoardArrays(r1,E_p3);
    let E_n1=shiftBoardDiagonalDownRight(e_bb,1), O_p3=shiftBoardDiagonalDownRight(o_bb,-3);
    let r2=BitwiseANDBoardArrays(E_n1,P0); r2=BitwiseANDBoardArrays(r2,E_p1); r2=BitwiseANDBoardArrays(r2,P_p2); r2=BitwiseANDBoardArrays(r2,O_p3);
    return BitwiseORBoardArrays(r1,r2);
}
function detectDiagonalDownLeftDeadJumpThreeBitwise(playerBB, opponentBB, emptyBB) {
    const p_bb=playerBB, o_bb=opponentBB, e_bb=emptyBB;
    let P0=p_bb, E_p1=shiftBoardDiagonalDownLeft(e_bb,-1), P_p2=shiftBoardDiagonalDownLeft(p_bb,-2);
    let O_n1=shiftBoardDiagonalDownLeft(o_bb,1), E_p3=shiftBoardDiagonalDownLeft(e_bb,-3);
    let r1=BitwiseANDBoardArrays(O_n1,P0); r1=BitwiseANDBoardArrays(r1,E_p1); r1=BitwiseANDBoardArrays(r1,P_p2); r1=BitwiseANDBoardArrays(r1,E_p3);
    let E_n1=shiftBoardDiagonalDownLeft(e_bb,1), O_p3=shiftBoardDiagonalDownLeft(o_bb,-3);
    let r2=BitwiseANDBoardArrays(E_n1,P0); r2=BitwiseANDBoardArrays(r2,E_p1); r2=BitwiseANDBoardArrays(r2,P_p2); r2=BitwiseANDBoardArrays(r2,O_p3);
    return BitwiseORBoardArrays(r1,r2);
}


// Iterative pattern analysis (fallback for complex DoubleThrees in scoreMoveHeuristically for now)
function analyzePatternOnLine(r, c, dr, dc, player) {
    const opponent = (player === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
    let current_r = r; let current_c = c;
    for (let i = 1; i < WINNING_LENGTH; i++) {
        const prev_r = r - i * dr; const prev_c = c - i * dc;
        if (getCellStatus(prev_r, prev_c) === player) { current_r = prev_r; current_c = prev_c; }
        else break;
    }
    const start_r = current_r; const start_c = current_c;
    let stonesInRow = 0;
    for (let i = 0; i < BOARD_SIZE; i++) {
        const curR = start_r + i * dr; const curC = start_c + i * dc;
        if (getCellStatus(curR, curC) === player) stonesInRow++; else break;
    }
    if (stonesInRow === 0) return null;
    const end_r = start_r + (stonesInRow - 1) * dr; const end_c = start_c + (stonesInRow - 1) * dc;
    const p1_status_val = getCellStatus(start_r - dr, start_c - dc);
    const p2_status_val = getCellStatus(end_r + dr, end_c + dc);

    if (stonesInRow >= WINNING_LENGTH) return { type: PT_FIVE, length: stonesInRow, start_r, start_c, end_r, end_c };
    if (stonesInRow === 4) {
        if (p1_status_val === EMPTY && p2_status_val === EMPTY) return { type: PT_LIVE_FOUR, length: 4, start_r, start_c, end_r, end_c };
        if ((p1_status_val === EMPTY && (p2_status_val === opponent || p2_status_val === 'EDGE')) ||
            (p2_status_val === EMPTY && (p1_status_val === opponent || p1_status_val === 'EDGE'))) return { type: PT_DEAD_FOUR, length: 4, start_r, start_c, end_r, end_c };
    }
    if (stonesInRow === 3) {
        if (p1_status_val === EMPTY && p2_status_val === EMPTY) return { type: PT_LIVE_THREE, length: 3, start_r, start_c, end_r, end_c };
        if ((p1_status_val === EMPTY && (p2_status_val === opponent || p2_status_val === 'EDGE')) ||
            (p2_status_val === EMPTY && (p1_status_val === opponent || p1_status_val === 'EDGE'))) return { type: PT_DEAD_THREE, length: 3, start_r, start_c, end_r, end_c };
    }
    if (stonesInRow === 2) {
        if (p1_status_val === EMPTY && p2_status_val === EMPTY) return { type: PT_LIVE_TWO, length: 2, start_r, start_c, end_r, end_c };
        if ((p1_status_val === EMPTY && (p2_status_val === opponent || p2_status_val === 'EDGE')) ||
            (p2_status_val === EMPTY && (p1_status_val === opponent || p1_status_val === 'EDGE'))) return { type: PT_DEAD_TWO, length: 2, start_r, start_c, end_r, end_c };
    }
    return null;
}

// Calculates offensive score for a player using global bitboards
function calculateScoreForPlayerOffensive(player, heuristicLevel) {
    let totalScore = 0;
    const playerBB = bitboards[player];
    const opponent = (player === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
    const opponentBB = bitboards[opponent];
    const emptyBB = computeEmptyCellsBitboard();

    // Bitwise Fours
    let score_lf4 = PATTERN_SCORES[PT_LIVE_FOUR].offensive; // Base 10,000,000
    if (heuristicLevel === 'novice') {
        score_lf4 *= 0.001; // e.g., 10,000
    } else if (heuristicLevel === 'apprentice') {
        score_lf4 *= 0.01;  // e.g., 100,000
    }
    // Adept, Expert, Master use full score_lf4
    if (score_lf4 > 0) {
        totalScore += PopCountBoardArray(detectHorizontalLiveFourBitwise(playerBB, emptyBB)) * score_lf4;
        totalScore += PopCountBoardArray(detectVerticalLiveFourBitwise(playerBB, emptyBB)) * score_lf4;
        totalScore += PopCountBoardArray(detectDiagonalDownRightLiveFourBitwise(playerBB, emptyBB)) * score_lf4;
        totalScore += PopCountBoardArray(detectDiagonalDownLeftLiveFourBitwise(playerBB, emptyBB)) * score_lf4;
    }

    let score_df4 = PATTERN_SCORES[PT_DEAD_FOUR].offensive; // Base 50,000
    if (heuristicLevel === 'novice') {
        score_df4 *= 0.01; // e.g., 500
    } else if (heuristicLevel === 'apprentice') {
        score_df4 *= 0.1;  // e.g., 5,000
    }
    // Adept, Expert, Master use full score_df4
    if (score_df4 > 0) {
        totalScore += PopCountBoardArray(detectHorizontalDeadFourBitwise(playerBB, opponentBB, emptyBB)) * score_df4;
        totalScore += PopCountBoardArray(detectVerticalDeadFourBitwise(playerBB, opponentBB, emptyBB)) * score_df4;
        totalScore += PopCountBoardArray(detectDiagonalDownRightDeadFourBitwise(playerBB, opponentBB, emptyBB)) * score_df4;
        totalScore += PopCountBoardArray(detectDiagonalDownLeftDeadFourBitwise(playerBB, opponentBB, emptyBB)) * score_df4;
    }

    // Bitwise Threes
    let score_lt3 = PATTERN_SCORES[PT_LIVE_THREE].offensive; // Base 1,000
    if (heuristicLevel === 'novice') score_lt3 *= 0.1; // Was 0.05 (50), now 100
    else if (heuristicLevel === 'apprentice') score_lt3 *= 0.25; // Was 0.2 (200), now 250
    // Adept, Expert, Master use full score
    if (score_lt3 > 0) { // Check if positive after potential reduction
        totalScore += PopCountBoardArray(detectHorizontalLiveThreeBitwise(playerBB, emptyBB)) * score_lt3;
        totalScore += PopCountBoardArray(detectVerticalLiveThreeBitwise(playerBB, emptyBB)) * score_lt3;
        totalScore += PopCountBoardArray(detectDiagonalDownRightLiveThreeBitwise(playerBB, emptyBB)) * score_lt3;
        totalScore += PopCountBoardArray(detectDiagonalDownLeftLiveThreeBitwise(playerBB, emptyBB)) * score_lt3;
    }

    let score_dt3 = PATTERN_SCORES[PT_DEAD_THREE].offensive; // Base 100
    if (heuristicLevel === 'novice') score_dt3 *= 0.1; // Was 0.05 (5), now 10
    else if (heuristicLevel === 'apprentice') score_dt3 *= 0.25; // Was 0.2 (20), now 25
    // Adept, Expert, Master use full score
    if (score_dt3 > 0) {
        totalScore += PopCountBoardArray(detectHorizontalDeadThreeBitwise(playerBB, opponentBB, emptyBB)) * score_dt3;
        totalScore += PopCountBoardArray(detectVerticalDeadThreeBitwise(playerBB, opponentBB, emptyBB)) * score_dt3;
        totalScore += PopCountBoardArray(detectDiagonalDownRightDeadThreeBitwise(playerBB, opponentBB, emptyBB)) * score_dt3;
        totalScore += PopCountBoardArray(detectDiagonalDownLeftDeadThreeBitwise(playerBB, opponentBB, emptyBB)) * score_dt3;
    }

    // Bitwise Twos
    let score_lt2 = PATTERN_SCORES[PT_LIVE_TWO].offensive;
    // No change for twos based on heuristic level in this proposal, but could be added if needed.
    if (score_lt2 > 0) {
        totalScore += PopCountBoardArray(detectHorizontalLiveTwoBitwise(playerBB, emptyBB)) * score_lt2;
        totalScore += PopCountBoardArray(detectVerticalLiveTwoBitwise(playerBB, emptyBB)) * score_lt2;
        totalScore += PopCountBoardArray(detectDiagonalDownRightLiveTwoBitwise(playerBB, emptyBB)) * score_lt2;
        totalScore += PopCountBoardArray(detectDiagonalDownLeftLiveTwoBitwise(playerBB, emptyBB)) * score_lt2;
    }
    let score_dt2 = PATTERN_SCORES[PT_DEAD_TWO].offensive;
    if (score_dt2 > 0) {
        totalScore += PopCountBoardArray(detectHorizontalDeadTwoBitwise(playerBB, opponentBB, emptyBB)) * score_dt2;
        totalScore += PopCountBoardArray(detectVerticalDeadTwoBitwise(playerBB, opponentBB, emptyBB)) * score_dt2;
        totalScore += PopCountBoardArray(detectDiagonalDownRightDeadTwoBitwise(playerBB, opponentBB, emptyBB)) * score_dt2;
        totalScore += PopCountBoardArray(detectDiagonalDownLeftDeadTwoBitwise(playerBB, opponentBB, emptyBB)) * score_dt2;
    }

    // Bitwise Gapped Patterns
    let score_ljt3 = PATTERN_SCORES[PT_LIVE_JUMP_THREE].offensive; // Base 300
    if (heuristicLevel === 'novice') score_ljt3 *= 0.05; // Was 0, now ~15
    else if (heuristicLevel === 'apprentice') score_ljt3 *= 0.2; // Stays 60
    // Adept, Expert, Master use full score
    if (score_ljt3 > 0) {
        totalScore += PopCountBoardArray(detectHorizontalLiveJumpThreeBitwise(playerBB, emptyBB)) * score_ljt3;
        totalScore += PopCountBoardArray(detectVerticalLiveJumpThreeBitwise(playerBB, emptyBB)) * score_ljt3;
        totalScore += PopCountBoardArray(detectDiagonalDownRightLiveJumpThreeBitwise(playerBB, emptyBB)) * score_ljt3;
        totalScore += PopCountBoardArray(detectDiagonalDownLeftLiveJumpThreeBitwise(playerBB, emptyBB)) * score_ljt3;
    }

    let score_djt3 = PATTERN_SCORES[PT_DEAD_JUMP_THREE].offensive; // Base 70
    if (heuristicLevel === 'novice') score_djt3 *= 0.05; // Was 0, now ~3
    else if (heuristicLevel === 'apprentice') score_djt3 *= 0.2; // Stays 14
    // Adept, Expert, Master use full score
    if (score_djt3 > 0) {
        totalScore += PopCountBoardArray(detectHorizontalDeadJumpThreeBitwise(playerBB, opponentBB, emptyBB)) * score_djt3;
        totalScore += PopCountBoardArray(detectVerticalDeadJumpThreeBitwise(playerBB, opponentBB, emptyBB)) * score_djt3;
        totalScore += PopCountBoardArray(detectDiagonalDownRightDeadJumpThreeBitwise(playerBB, opponentBB, emptyBB)) * score_djt3;
        totalScore += PopCountBoardArray(detectDiagonalDownLeftDeadJumpThreeBitwise(playerBB, opponentBB, emptyBB)) * score_djt3;
    }

    // Dynamic Double Three check
    let doubleThreeScoreToAdd = PATTERN_SCORES[PT_DOUBLE_THREE].offensive; // Base 5,000,000
    if (heuristicLevel === 'novice') {
        doubleThreeScoreToAdd = 0; // Still 0 for Novice, too complex.
    } else if (heuristicLevel === 'apprentice') {
        doubleThreeScoreToAdd *= 0.0001; // e.g., 500 - very low awareness
    } else if (heuristicLevel === 'adept') {
        doubleThreeScoreToAdd *= 0.01; // e.g., 50,000 - Adept starts to see them
    }
    // Expert, Master use full score

    if (doubleThreeScoreToAdd > 0) {
        const staticPatternDirections = [ { dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 } ];
        for (let r_empty = 0; r_empty < BOARD_SIZE; r_empty++) {
            for (let c_empty = 0; c_empty < BOARD_SIZE; c_empty++) {
                if (getCellStatus(r_empty, c_empty) === EMPTY) {
                    setCellBit(bitboards[player], r_empty, c_empty);
                    let liveThreesFormedByThisMove = 0; const liveThreeLocations = [];
                    for (const dir of staticPatternDirections) {
                        const patternInfo = analyzePatternOnLine(r_empty, c_empty, dir.dr, dir.dc, player);
                        if (patternInfo && patternInfo.type === PT_LIVE_THREE) {
                            let key_r1 = patternInfo.start_r, key_c1 = patternInfo.start_c, key_r2 = patternInfo.end_r, key_c2 = patternInfo.end_c;
                            if (patternInfo.start_r > patternInfo.end_r || (patternInfo.start_r === patternInfo.end_r && patternInfo.start_c > patternInfo.end_c)) {
                                key_r1 = patternInfo.end_r; key_c1 = patternInfo.end_c; key_r2 = patternInfo.start_r; key_c2 = patternInfo.start_c;
                            }
                            const liveThreeKey = `${key_r1},${key_c1}:${key_r2},${key_c2}`;
                            if (!liveThreeLocations.includes(liveThreeKey)) { liveThreesFormedByThisMove++; liveThreeLocations.push(liveThreeKey); }
                        }
                    }
                    clearCellBit(bitboards[player], r_empty, c_empty);
                    if (liveThreesFormedByThisMove >= 2) {
                        totalScore += doubleThreeScoreToAdd;
                    }
                }
            }
        }
    }
    return totalScore;
}

// Fully bitwise checkWinForPlayer for fives
function checkWinForPlayer(player) {
    const playerBB = bitboards[player];
    if (PopCountBoardArray(detectHorizontalFiveBitwise(playerBB)) > 0) return true;
    if (PopCountBoardArray(detectVerticalFiveBitwise(playerBB)) > 0) return true;
    if (PopCountBoardArray(detectDiagonalDownRightFiveBitwise(playerBB)) > 0) return true;
    if (PopCountBoardArray(detectDiagonalDownLeftFiveBitwise(playerBB)) > 0) return true;
    return false;
}

// scoreMoveHeuristically using global bitboards
function scoreMoveHeuristically(r_move, c_move, player) {
    const opponent = (player === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
    const directions = [ { dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 } ];

    let heuristicScore = 0;

    // 1. Evaluate AI's move (player)
    setCellBit(bitboards[player], r_move, c_move);
    if (checkWinForPlayer(player)) {
        clearCellBit(bitboards[player], r_move, c_move);
        return PATTERN_SCORES[PT_FIVE].offensive * 10;
    }

    let offensiveScore = 0;
    const emptyBB_after_player_move = computeEmptyCellsBitboard();
    offensiveScore += PopCountBoardArray(detectHorizontalLiveFourBitwise(bitboards[player], emptyBB_after_player_move)) * PATTERN_SCORES[PT_LIVE_FOUR].offensive;
    offensiveScore += PopCountBoardArray(detectVerticalLiveFourBitwise(bitboards[player], emptyBB_after_player_move)) * PATTERN_SCORES[PT_LIVE_FOUR].offensive;
    offensiveScore += PopCountBoardArray(detectDiagonalDownRightLiveFourBitwise(bitboards[player], emptyBB_after_player_move)) * PATTERN_SCORES[PT_LIVE_FOUR].offensive;
    offensiveScore += PopCountBoardArray(detectDiagonalDownLeftLiveFourBitwise(bitboards[player], emptyBB_after_player_move)) * PATTERN_SCORES[PT_LIVE_FOUR].offensive;

    offensiveScore += PopCountBoardArray(detectHorizontalDeadFourBitwise(bitboards[player], bitboards[opponent], emptyBB_after_player_move)) * PATTERN_SCORES[PT_DEAD_FOUR].offensive;
    offensiveScore += PopCountBoardArray(detectVerticalDeadFourBitwise(bitboards[player], bitboards[opponent], emptyBB_after_player_move)) * PATTERN_SCORES[PT_DEAD_FOUR].offensive;
    offensiveScore += PopCountBoardArray(detectDiagonalDownRightDeadFourBitwise(bitboards[player], bitboards[opponent], emptyBB_after_player_move)) * PATTERN_SCORES[PT_DEAD_FOUR].offensive;
    offensiveScore += PopCountBoardArray(detectDiagonalDownLeftDeadFourBitwise(bitboards[player], bitboards[opponent], emptyBB_after_player_move)) * PATTERN_SCORES[PT_DEAD_FOUR].offensive;

    offensiveScore += PopCountBoardArray(detectHorizontalLiveThreeBitwise(bitboards[player], emptyBB_after_player_move)) * PATTERN_SCORES[PT_LIVE_THREE].offensive;
    offensiveScore += PopCountBoardArray(detectVerticalLiveThreeBitwise(bitboards[player], emptyBB_after_player_move)) * PATTERN_SCORES[PT_LIVE_THREE].offensive;
    offensiveScore += PopCountBoardArray(detectDiagonalDownRightLiveThreeBitwise(bitboards[player], emptyBB_after_player_move)) * PATTERN_SCORES[PT_LIVE_THREE].offensive;
    offensiveScore += PopCountBoardArray(detectDiagonalDownLeftLiveThreeBitwise(bitboards[player], emptyBB_after_player_move)) * PATTERN_SCORES[PT_LIVE_THREE].offensive;

    offensiveScore += PopCountBoardArray(detectHorizontalLiveJumpThreeBitwise(bitboards[player], emptyBB_after_player_move)) * PATTERN_SCORES[PT_LIVE_JUMP_THREE].offensive;
    offensiveScore += PopCountBoardArray(detectVerticalLiveJumpThreeBitwise(bitboards[player], emptyBB_after_player_move)) * PATTERN_SCORES[PT_LIVE_JUMP_THREE].offensive;
    offensiveScore += PopCountBoardArray(detectDiagonalDownRightLiveJumpThreeBitwise(bitboards[player], emptyBB_after_player_move)) * PATTERN_SCORES[PT_LIVE_JUMP_THREE].offensive;
    offensiveScore += PopCountBoardArray(detectDiagonalDownLeftLiveJumpThreeBitwise(bitboards[player], emptyBB_after_player_move)) * PATTERN_SCORES[PT_LIVE_JUMP_THREE].offensive;
    // Add DeadJumpThrees to offensive score
    offensiveScore += PopCountBoardArray(detectHorizontalDeadJumpThreeBitwise(bitboards[player], bitboards[opponent], emptyBB_after_player_move)) * PATTERN_SCORES[PT_DEAD_JUMP_THREE].offensive;
    offensiveScore += PopCountBoardArray(detectVerticalDeadJumpThreeBitwise(bitboards[player], bitboards[opponent], emptyBB_after_player_move)) * PATTERN_SCORES[PT_DEAD_JUMP_THREE].offensive;
    offensiveScore += PopCountBoardArray(detectDiagonalDownRightDeadJumpThreeBitwise(bitboards[player], bitboards[opponent], emptyBB_after_player_move)) * PATTERN_SCORES[PT_DEAD_JUMP_THREE].offensive;
    offensiveScore += PopCountBoardArray(detectDiagonalDownLeftDeadJumpThreeBitwise(bitboards[player], bitboards[opponent], emptyBB_after_player_move)) * PATTERN_SCORES[PT_DEAD_JUMP_THREE].offensive;


    let liveThreesFormedCount = 0;
    for (const dir of directions) {
        const patternInfo = analyzePatternOnLine(r_move, c_move, dir.dr, dir.dc, player);
        if (patternInfo && patternInfo.type === PT_LIVE_THREE) liveThreesFormedCount++;
    }
    if (liveThreesFormedCount >= 2) offensiveScore += PATTERN_SCORES[PT_DOUBLE_THREE].offensive;

    clearCellBit(bitboards[player], r_move, c_move);

    setCellBit(bitboards[opponent], r_move, c_move);
    let defensiveScore = 0;
    let opponentWinsIfPlaysHere = false;
    for (const dir of directions) {
        const patternInfo = analyzePatternOnLine(r_move, c_move, dir.dr, dir.dc, opponent);
        if (patternInfo && patternInfo.type === PT_FIVE) { opponentWinsIfPlaysHere = true; break; }
    }
    if (!opponentWinsIfPlaysHere) opponentWinsIfPlaysHere = checkWinForPlayer(opponent);

    if (opponentWinsIfPlaysHere) {
        clearCellBit(bitboards[opponent], r_move, c_move);
        return PATTERN_SCORES[PT_FIVE].defensive * 9;
    }

    const emptyBB_after_opponent_move = computeEmptyCellsBitboard();
    defensiveScore += PopCountBoardArray(detectHorizontalLiveFourBitwise(bitboards[opponent], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_LIVE_FOUR].defensive;
    defensiveScore += PopCountBoardArray(detectVerticalLiveFourBitwise(bitboards[opponent], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_LIVE_FOUR].defensive;
    defensiveScore += PopCountBoardArray(detectDiagonalDownRightLiveFourBitwise(bitboards[opponent], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_LIVE_FOUR].defensive;
    defensiveScore += PopCountBoardArray(detectDiagonalDownLeftLiveFourBitwise(bitboards[opponent], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_LIVE_FOUR].defensive;

    defensiveScore += PopCountBoardArray(detectHorizontalDeadFourBitwise(bitboards[opponent], bitboards[player], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_DEAD_FOUR].defensive;
    defensiveScore += PopCountBoardArray(detectVerticalDeadFourBitwise(bitboards[opponent], bitboards[player], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_DEAD_FOUR].defensive;
    defensiveScore += PopCountBoardArray(detectDiagonalDownRightDeadFourBitwise(bitboards[opponent], bitboards[player], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_DEAD_FOUR].defensive;
    defensiveScore += PopCountBoardArray(detectDiagonalDownLeftDeadFourBitwise(bitboards[opponent], bitboards[player], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_DEAD_FOUR].defensive;

    defensiveScore += PopCountBoardArray(detectHorizontalLiveThreeBitwise(bitboards[opponent], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_LIVE_THREE].defensive;
    defensiveScore += PopCountBoardArray(detectVerticalLiveThreeBitwise(bitboards[opponent], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_LIVE_THREE].defensive;
    defensiveScore += PopCountBoardArray(detectDiagonalDownRightLiveThreeBitwise(bitboards[opponent], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_LIVE_THREE].defensive;
    defensiveScore += PopCountBoardArray(detectDiagonalDownLeftLiveThreeBitwise(bitboards[opponent], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_LIVE_THREE].defensive;

    defensiveScore += PopCountBoardArray(detectHorizontalLiveJumpThreeBitwise(bitboards[opponent], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_LIVE_JUMP_THREE].defensive;
    defensiveScore += PopCountBoardArray(detectVerticalLiveJumpThreeBitwise(bitboards[opponent], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_LIVE_JUMP_THREE].defensive;
    defensiveScore += PopCountBoardArray(detectDiagonalDownRightLiveJumpThreeBitwise(bitboards[opponent], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_LIVE_JUMP_THREE].defensive;
    defensiveScore += PopCountBoardArray(detectDiagonalDownLeftLiveJumpThreeBitwise(bitboards[opponent], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_LIVE_JUMP_THREE].defensive;

    defensiveScore += PopCountBoardArray(detectHorizontalDeadJumpThreeBitwise(bitboards[opponent], bitboards[player], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_DEAD_JUMP_THREE].defensive;
    defensiveScore += PopCountBoardArray(detectVerticalDeadJumpThreeBitwise(bitboards[opponent], bitboards[player], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_DEAD_JUMP_THREE].defensive;
    defensiveScore += PopCountBoardArray(detectDiagonalDownRightDeadJumpThreeBitwise(bitboards[opponent], bitboards[player], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_DEAD_JUMP_THREE].defensive;
    defensiveScore += PopCountBoardArray(detectDiagonalDownLeftDeadJumpThreeBitwise(bitboards[opponent], bitboards[player], emptyBB_after_opponent_move)) * PATTERN_SCORES[PT_DEAD_JUMP_THREE].defensive;


    let oppLiveThreesFormedCount = 0;
    for (const dir of directions) {
        const patternInfo = analyzePatternOnLine(r_move, c_move, dir.dr, dir.dc, opponent);
        if (patternInfo && patternInfo.type === PT_LIVE_THREE) oppLiveThreesFormedCount++;
    }
    if (oppLiveThreesFormedCount >= 2) defensiveScore += PATTERN_SCORES[PT_DOUBLE_THREE].defensive;

    clearCellBit(bitboards[opponent], r_move, c_move);

    heuristicScore = offensiveScore + defensiveScore;
    for (let dr_adj = -1; dr_adj <= 1; dr_adj++) {
        for (let dc_adj = -1; dc_adj <= 1; dc_adj++) {
            if (dr_adj === 0 && dc_adj === 0) continue;
            if (getCellStatus(r_move + dr_adj, c_move + dc_adj) !== EMPTY && getCellStatus(r_move + dr_adj, c_move + dc_adj) !== 'EDGE') {
                heuristicScore += 0.5;
            }
        }
    }
    return heuristicScore;
}

// Modified getPossibleMoves to use global bitboards
function getPossibleMoves() {
    const moves = []; let occupiedCount = 0;
    const candidateMap = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) if (getCellStatus(r, c) !== EMPTY) occupiedCount++;
    if (occupiedCount === 0) { moves.push({ x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) }); return moves; }
    const range = 2;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (getCellStatus(r, c) !== EMPTY) {
                for (let dr = -range; dr <= range; dr++) for (let dc = -range; dc <= range; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr; const nc = c + dc;
                    if (isInBounds(nc, nr) && getCellStatus(nr, nc) === EMPTY && !candidateMap[nr][nc]) {
                        candidateMap[nr][nc] = true; moves.push({ x: nc, y: nr });
                    }
                }
            }
        }
    }
    if (moves.length === 0 && occupiedCount < BOARD_SIZE * BOARD_SIZE) {
        for (let r_fb = 0; r_fb < BOARD_SIZE; r_fb++) for (let c_fb = 0; c_fb < BOARD_SIZE; c_fb++) {
            if (getCellStatus(r_fb, c_fb) === EMPTY && !candidateMap[r_fb][c_fb]) {
                moves.push({ x: c_fb, y: r_fb }); candidateMap[r_fb][c_fb] = true;
            }
        }
    }
    return moves;
}

// Evaluate board state using global bitboards
function evaluateBoard(aiPlayer = PLAYER_WHITE, heuristicLevel) {
    const humanPlayer = (aiPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
    const aiOffensiveScore = calculateScoreForPlayerOffensive(aiPlayer, heuristicLevel);
    const humanOffensiveScore = calculateScoreForPlayerOffensive(humanPlayer, 'master');
    const fiveScore = PATTERN_SCORES[PT_FIVE].offensive;
    if (calculateScoreForPlayerOffensive(aiPlayer, 'master') >= fiveScore) return fiveScore * 10;
    if (calculateScoreForPlayerOffensive(humanPlayer, 'master') >= fiveScore) return -fiveScore * 10;
    return aiOffensiveScore - humanOffensiveScore;
}

// Minimax using global bitboards
function findBestMove(currentSearchDepth, heuristicLevel, alpha, beta, maximizingPlayer, aiPlayer, currentHash) {
    const originalAlpha = alpha;
    if (transpositionTable.has(currentHash)) {
        const entry = transpositionTable.get(currentHash);
        if (entry.depth >= currentSearchDepth) {
            if (entry.flag === TT_FLAG_EXACT) return { score: entry.score, move: entry.bestMove };
            if (entry.flag === TT_FLAG_LOWERBOUND) alpha = Math.max(alpha, entry.score);
            else if (entry.flag === TT_FLAG_UPPERBOUND) beta = Math.min(beta, entry.score);
            if (alpha >= beta) return { score: entry.score, move: entry.bestMove };
        }
    }

    if (currentSearchDepth === 0 || isGameOver(aiPlayer)) {
        return { score: evaluateBoard(aiPlayer, heuristicLevel), move: null };
    }
    let possibleMoves = getPossibleMoves();
    if (possibleMoves.length === 0) {
        return { score: evaluateBoard(aiPlayer, heuristicLevel), move: null };
    }

    let ttBestMoveFromEntry = null;
    if (transpositionTable.has(currentHash)) {
        const entry = transpositionTable.get(currentHash);
        if (entry.bestMove) {
            ttBestMoveFromEntry = entry.bestMove;
            let foundInPossible = false;
            for(const m of possibleMoves) if(m.x === ttBestMoveFromEntry.x && m.y === ttBestMoveFromEntry.y) { foundInPossible = true; break; }
            if (foundInPossible) {
                possibleMoves = possibleMoves.filter(m => !(m.x === ttBestMoveFromEntry.x && m.y === ttBestMoveFromEntry.y));
                possibleMoves.unshift(ttBestMoveFromEntry);
            } else ttBestMoveFromEntry = null;
        }
    }

    const movesToScoreSort = ttBestMoveFromEntry ? possibleMoves.slice(1) : possibleMoves;
    if (currentSearchDepth > 1 && movesToScoreSort.length > 1) {
        const currentPlayerForSort = maximizingPlayer ? aiPlayer : ((aiPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK);
        const scoredSortedMoves = movesToScoreSort.map(move => {
            let score;
            if (getCellStatus(move.y, move.x) === EMPTY) {
                score = scoreMoveHeuristically(move.y, move.x, currentPlayerForSort);
            } else {
                score = -Infinity;
            }
            return { move: move, score: score };
        }).sort((a, b) => b.score - a.score);
        const sortedMovesPortion = scoredSortedMoves.map(sm => sm.move);
        possibleMoves = ttBestMoveFromEntry ? [ttBestMoveFromEntry, ...sortedMovesPortion] : sortedMovesPortion;
    }

    let bestMoveForThisNode = null; let bestValue;
    if (maximizingPlayer) {
        bestValue = -Infinity;
        for (const move of possibleMoves) {
            setCellBit(bitboards[aiPlayer], move.y, move.x);
            const newHash = updateZobristHash(currentHash, move.y, move.x, aiPlayer);
            const evalNode = findBestMove(currentSearchDepth - 1, heuristicLevel, alpha, beta, false, aiPlayer, newHash);
            clearCellBit(bitboards[aiPlayer], move.y, move.x);
            if (evalNode.score > bestValue) { bestValue = evalNode.score; bestMoveForThisNode = move; }
            alpha = Math.max(alpha, bestValue);
            if (beta <= alpha) break;
        }
    } else {
        bestValue = Infinity; const opponentPlayer = (aiPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
        for (const move of possibleMoves) {
            setCellBit(bitboards[opponentPlayer], move.y, move.x);
            const newHash = updateZobristHash(currentHash, move.y, move.x, opponentPlayer);
            const evalNode = findBestMove(currentSearchDepth - 1, heuristicLevel, alpha, beta, true, aiPlayer, newHash);
            clearCellBit(bitboards[opponentPlayer], move.y, move.x);
            if (evalNode.score < bestValue) { bestValue = evalNode.score; bestMoveForThisNode = move; }
            beta = Math.min(beta, bestValue);
            if (beta <= alpha) break;
        }
    }
    let flag;
    if (bestValue <= originalAlpha) flag = TT_FLAG_UPPERBOUND;
    else if (bestValue >= beta) flag = TT_FLAG_LOWERBOUND;
    else flag = TT_FLAG_EXACT;
    transpositionTable.set(currentHash, { score: bestValue, depth: currentSearchDepth, flag: flag, bestMove: bestMoveForThisNode });
    return { score: bestValue, move: bestMoveForThisNode };
}

// Check if game is over using global bitboards
function isGameOver(aiPlayer) {
    if (checkWinForPlayer(aiPlayer)) return true;
    const humanPlayer = (aiPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
    if (checkWinForPlayer(humanPlayer)) return true;
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) if (getCellStatus(r,c) === EMPTY) return false;
    return true;
}

// --- Omniscience functions (remain largely unchanged, use 2D arrays and getCellStatusFromArray) ---
function getCellStatusFromArray(boardArray, r, c) {
    if (!isInBounds(c, r)) return 'EDGE';
    if (boardArray[r][c] === EMPTY) return 'EMPTY';
    return boardArray[r][c];
}
function checkLine(board, r, c, player, length, checkOpenStart = false, checkOpenEnd = false) {
    const directions = [ { dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 } ];
    for (const dir of directions) {
        for (let i = 0; i < length; i++) {
            const startR = r - i * dir.dr; const startC = c - i * dir.dc;
            let currentLength = 0;
            for (let k = 0; k < length; k++) {
                const curR = startR + k * dir.dr; const curC = startC + k * dir.dc;
                if (!isInBounds(curC, curR)) break;
                if (k === i && getCellStatusFromArray(board, curR, curC) !== 'EMPTY' && getCellStatusFromArray(board, curR, curC) !== player) break;
                if (k !== i && getCellStatusFromArray(board, curR, curC) !== player) break;
                if (getCellStatusFromArray(board, curR, curC) === player || (k === i && getCellStatusFromArray(board, curR, curC) === 'EMPTY') ) {
                    currentLength++;
                } else { break; }
            }
            if (currentLength === length) {
                let lineForms = true;
                if (checkOpenStart || checkOpenEnd) {
                    const beforeR = startR - dir.dr; const beforeC = startC - dir.dc;
                    const afterR = startR + length * dir.dr; const afterC = startC + length * dir.dc;
                    let isOpenStart = (isInBounds(beforeC, beforeR) && getCellStatusFromArray(board, beforeR, beforeC) === 'EMPTY');
                    let isOpenEnd = (isInBounds(afterC, afterR) && getCellStatusFromArray(board, afterR, afterC) === 'EMPTY');
                    if (checkOpenStart && !isOpenStart) lineForms = false;
                    if (checkOpenEnd && !isOpenEnd) lineForms = false;
                }
                if(lineForms) return true;
            }
        }
    }
    return false;
}
function checkFiveOmni(boardArray, r, c, player) {
    boardArray[r][c] = player; let wins = false;
    const directions = [{dx:1,dy:0},{dx:0,dy:1},{dx:1,dy:1},{dx:1,dy:-1}];
    for (const dir of directions) {
        let count = 1;
        for (let i = 1; i < WINNING_LENGTH; i++) { const newR = r + i * dir.dy; const newC = c + i * dir.dx; if (isInBounds(newC, newR) && boardArray[newR][newC] === player) count++; else break; }
        for (let i = 1; i < WINNING_LENGTH; i++) { const newR = r - i * dir.dy; const newC = c - i * dir.dx; if (isInBounds(newC, newR) && boardArray[newR][newC] === player) count++; else break; }
        if (count >= WINNING_LENGTH) { wins = true; break; }
    }
    boardArray[r][c] = EMPTY; return wins;
}
function checkLineOfFourOmni(board, r, c, player) {
    board[r][c] = player; let isFour = false;
    const directions = [{dx:1,dy:0},{dx:0,dy:1},{dx:1,dy:1},{dx:1,dy:-1}];
    for (const dir of directions) {
        let count = 1;
        for (let i = 1; i < 4; i++) { if (isInBounds(c + i * dir.dx, r + i * dir.dy) && board[r + i * dir.dy][c + i * dir.dx] === player) count++; else break; }
        for (let i = 1; i < 4; i++) { if (isInBounds(c - i * dir.dx, r - i * dir.dy) && board[r - i * dir.dy][c - i * dir.dx] === player) count++; else break; }
        if (count >= 4) { isFour = true; break; }
    }
    board[r][c] = EMPTY;
    if (isFour) {
        board[r][c] = player; let canBecomeFive = false;
        for (const dir of directions) {
            let stones = [{r,c}];
            for (let i = 1; i < 4; i++) { const nextR = r + i * dir.dy; const nextC = c + i * dir.dx; if (isInBounds(nextC, nextR) && board[nextR][nextC] === player) stones.push({r: nextR, c: nextC}); else break; }
            for (let i = 1; i < 4; i++) { const prevR = r - i * dir.dy; const prevC = c - i * dir.dx; if (isInBounds(prevC, prevR) && board[prevR][prevC] === player) stones.unshift({r: prevR, c: prevC}); else break; }
            if (stones.length >= 4) {
                stones.sort((a,b) => a.r === b.r ? a.c - b.c : a.r - b.r); if (dir.dx === 0) stones.sort((a,b) => a.c === b.c ? a.r - b.r : a.c - b.c);
                for (let i = 0; i <= stones.length - 4; i++) {
                    const subSegment = stones.slice(i, i + 4); let actualDir = { dr: 0, dc: 0 };
                    if (subSegment.length > 1) { actualDir.dr = Math.sign(subSegment[1].r - subSegment[0].r); actualDir.dc = Math.sign(subSegment[1].c - subSegment[0].c); }
                    const firstStone = subSegment[0]; const lastStone = subSegment[3];
                    const r_before = firstStone.r - actualDir.dr; const c_before = firstStone.c - actualDir.dc;
                    const r_after = lastStone.r + actualDir.dr; const c_after = lastStone.c + actualDir.dc;
                    if ((isInBounds(c_before, r_before) && board[r_before][c_before] === EMPTY) || (isInBounds(c_after, r_after) && board[r_after][c_after] === EMPTY)) { canBecomeFive = true; break; }
                }
            }
            if (canBecomeFive) break;
        }
        board[r][c] = EMPTY; return canBecomeFive;
    }
    return false;
}
function countOpenThreesFormedOmni(board, r, c, player) {
    board[r][c] = player; let openThreeCount = 0;
    const directions = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }]; const checkedLines = [];
    for (const dir of directions) {
        const normDir = (dir.dc < 0 || (dir.dc === 0 && dir.dr < 0)) ? { dr: -dir.dr, dc: -dir.dc } : dir; const dirKey = `${normDir.dr}_${normDir.dc}`; if (checkedLines.includes(dirKey)) continue;
        for (let i = 0; i < 3; i++) {
            const sR = r - i * dir.dr; const sC = c - i * dir.dc; let isThreeInARow = true;
            for (let k = 0; k < 3; k++) { const curR = sR + k * dir.dr; const curC = sC + k * dir.dc; if (!isInBounds(curC, curR) || board[curR][curC] !== player) { isThreeInARow = false; break; } }
            if (isThreeInARow) {
                const beforeR = sR - dir.dr; const beforeC = sC - dir.dc; const afterR = sR + 3 * dir.dr; const afterC = sC + 3 * dir.dc;
                if (isInBounds(beforeC, beforeR) && board[beforeR][beforeC] === EMPTY && isInBounds(afterC, afterR) && board[afterR][afterC] === EMPTY) { openThreeCount++; checkedLines.push(dirKey); break; }
            }
        }
    }
    board[r][c] = EMPTY; return openThreeCount;
}
function checkDoubleThreeOmni(board, r, c, player) { return countOpenThreesFormedOmni(board, r, c, player) >= 2; }
function countFoursFormedOmni(board, r, c, player) {
    board[r][c] = player; let fourCount = 0;
    const directions = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }]; const checkedLines = [];
    for (const dir of directions) {
        const normDir = (dir.dc < 0 || (dir.dc === 0 && dir.dr < 0)) ? { dr: -dir.dr, dc: -dir.dc } : dir; const dirKey = `${normDir.dr}_${normDir.dc}`; if (checkedLines.includes(dirKey)) continue;
        for (let i = 0; i < 4; i++) {
            const sR = r - i * dir.dr; const sC = c - i * dir.dc; let isFourInARow = true;
            for (let k = 0; k < 4; k++) { const curR = sR + k * dir.dr; const curC = sC + k * dir.dc; if (!isInBounds(curC, curR) || board[curR][curC] !== player) { isFourInARow = false; break; } }
            if (isFourInARow) {
                const r_before = sR - dir.dr; const c_before = sC - dir.dc; const r_after = sR + 4 * dir.dr; const c_after = sC + 4 * dir.dc; let extendable = false;
                if (isInBounds(c_before, r_before) && board[r_before][c_before] === EMPTY) extendable = true;
                if (!extendable && isInBounds(c_after, r_after) && board[r_after][c_after] === EMPTY) extendable = true;
                if (extendable) { fourCount++; checkedLines.push(dirKey); } break;
            }
        }
    }
    board[r][c] = EMPTY; return fourCount;
}
function checkThreeFourOmni(board, r, c, player) {
    board[r][c] = player; const openThrees = countOpenThreesFormedOmni(board, r, c, player); let fourCount = 0;
    const directions = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }]; const checkedFourLines = [];
    for (const dir of directions) {
        const normDir = (dir.dc < 0 || (dir.dc === 0 && dir.dr < 0)) ? { dr: -dir.dr, dc: -dir.dc } : dir; const dirKey = `${normDir.dr}_${normDir.dc}`; if (checkedFourLines.includes(dirKey)) continue;
        for (let i = 0; i < 4; i++) {
            const sR = r - i * dir.dr; const sC = c - i * dir.dc; let isFourInARow = true;
            for (let k = 0; k < 4; k++) { const curR = sR + k * dir.dr; const curC = sC + k * dir.dc; if (!isInBounds(curC, curR) || board[curR][curC] !== player) { isFourInARow = false; break; } }
            if (isFourInARow) { fourCount++; checkedFourLines.push(dirKey); break; }
        }
    }
    board[r][c] = EMPTY;
    if (openThrees > 0 && fourCount > 0) {
        board[r][c] = player; let isGenuineThreeFour = false; const threeDirections = []; const fourDirections = [];
        const d3 = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }]; const chk3L = [];
        for (const dir of d3) {
            const nDir = (dir.dc < 0 || (dir.dc === 0 && dir.dr < 0)) ? { dr: -dir.dr, dc: -dir.dc } : dir; const dKey = `${nDir.dr}_${nDir.dc}`; if (chk3L.includes(dKey)) continue;
            for (let i = 0; i < 3; i++) {
                const sR = r - i * dir.dr; const sC = c - i * dir.dc; let is3 = true;
                for (let k = 0; k < 3; k++) { const cR = sR + k * dir.dr; const cC = sC + k * dir.dc; if (!isInBounds(cC, cR) || board[cR][cC] !== player) { is3 = false; break; } }
                if (is3) { const bR = sR - dir.dr; const bC = sC - dir.dc; const aR = sR + 3 * dir.dr; const aC = sC + 3 * dir.dc; if (isInBounds(bC, bR) && board[bR][bC] === EMPTY && isInBounds(aC, aR) && board[aR][aC] === EMPTY) { threeDirections.push(nDir); chk3L.push(dKey); break; } }
            }
        }
        const d4 = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }]; const chk4L = [];
        for (const dir of d4) {
            const nDir = (dir.dc < 0 || (dir.dc === 0 && dir.dr < 0)) ? { dr: -dir.dr, dc: -dir.dc } : dir; const dKey = `${nDir.dr}_${nDir.dc}`; if (chk4L.includes(dKey)) continue;
            for (let i = 0; i < 4; i++) {
                const sR = r - i * dir.dr; const sC = c - i * dir.dc; let is4 = true;
                for (let k = 0; k < 4; k++) { const cR = sR + k * dir.dr; const cC = sC + k * dir.dc; if (!isInBounds(cC, cR) || board[cR][cC] !== player) { is4 = false; break; } }
                if (is4) {
                    const r_before_four = sR - dir.dr; const c_before_four = sC - dir.dc; const r_after_four = sR + 4 * dir.dr; const c_after_four = sC + 4 * dir.dc; let extendableFour = false;
                    if (isInBounds(c_before_four, r_before_four) && board[r_before_four][c_before_four] === EMPTY) extendableFour = true;
                    if (!extendableFour && isInBounds(c_after_four, r_after_four) && board[r_after_four][c_after_four] === EMPTY) extendableFour = true;
                    if (extendableFour) { fourDirections.push(nDir); chk4L.push(dKey); } break;
                }
            }
        }
        board[r][c] = EMPTY;
        for (const tDir of threeDirections) { for (const fDir of fourDirections) { if (tDir.dr !== fDir.dr || tDir.dc !== fDir.dc) { isGenuineThreeFour = true; break; } } if (isGenuineThreeFour) break; }
        return isGenuineThreeFour;
    }
    return false;
}
function checkDoubleFourOmni(board, r, c, player) { return countFoursFormedOmni(board, r, c, player) >= 2; }
function getDetailedPatternHints(board, player) {
    const hints = []; const opponent = (player === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
    const hintCategory = (player === self.playerForOmniInternal) ? HINT_TYPE_PLAYER_OPPORTUNITY : HINT_TYPE_OPPONENT_THREAT;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === EMPTY) {
                if (checkFiveOmni(board, r, c, player)) { hints.push({ x: c, y: r, patternType: PATTERN_TYPE_FIVE_IN_A_ROW, hintCategory }); continue; }
                if (checkDoubleFourOmni(board, r, c, player)) { hints.push({ x: c, y: r, patternType: PATTERN_TYPE_DOUBLE_FOUR, hintCategory }); }
                else if (checkThreeFourOmni(board, r, c, player)) { hints.push({ x: c, y: r, patternType: PATTERN_TYPE_THREE_FOUR, hintCategory }); }
                let alreadyProcessedForStrongerPattern = hints.some(h => h.x === c && h.y === r && h.hintCategory === hintCategory);
                if (!alreadyProcessedForStrongerPattern && checkLineOfFourOmni(board, r, c, player)) { hints.push({ x: c, y: r, patternType: PATTERN_TYPE_LINE_OF_FOUR, hintCategory }); }
                alreadyProcessedForStrongerPattern = hints.some(h => h.x === c && h.y === r && h.hintCategory === hintCategory);
                if (!alreadyProcessedForStrongerPattern && checkDoubleThreeOmni(board, r, c, player)) { hints.push({ x: c, y: r, patternType: PATTERN_TYPE_DOUBLE_THREE, hintCategory }); }
            }
        }
    }
    return hints;
}
self.playerForOmniInternal = null;


// Worker message handler
self.onmessage = function(e) {
    console.log('ai.worker.js: Message received from main script:', e.data);
    const { type, board, difficultyProfile, aiPlayer, playerForOmni: playerForOmniFromData } = e.data;

    if (type === 'findBestMove') {
        if (!board || !difficultyProfile) {
            console.error('ai.worker.js: Invalid data received for findBestMove. Board or difficultyProfile missing.');
            self.postMessage({ type: 'error', error: 'Invalid data for findBestMove: board or difficultyProfile missing' });
            return;
        }
        const effectiveAiPlayer = (aiPlayer === PLAYER_BLACK || aiPlayer === PLAYER_WHITE) ? aiPlayer : PLAYER_WHITE;

        initGlobalBitboardsFrom2DArray(board);
        const initialBoardHash = computeZobristHashFromBitboards();

        if (difficultyProfile.useOpeningBook && openingBook.has(initialBoardHash.toString())) {
            const bookMoves = openingBook.get(initialBoardHash.toString());
            if (bookMoves && bookMoves.length > 0) {
                const selectedBookMove = bookMoves[Math.floor(Math.random() * bookMoves.length)];
                console.log("AI Worker: Using opening book move:", selectedBookMove);
                self.postMessage({ type: 'bestMoveFound', move: selectedBookMove, score: PATTERN_SCORES[PT_FIVE].offensive / 2 });
                return;
            }
        }

        transpositionTable.clear();
        console.log(`Transposition table cleared. Size: ${transpositionTable.size}. AI Profile: ${JSON.stringify(difficultyProfile)}`);

        const startTime = performance.now();
        const bestMoveResult = findBestMove(
            difficultyProfile.searchDepth,
            difficultyProfile.heuristicLevel,
            -Infinity, Infinity, true, effectiveAiPlayer, initialBoardHash
        );
        const endTime = performance.now();
        console.log(`AI Worker: findBestMove took ${(endTime - startTime).toFixed(2)} ms. TT size: ${transpositionTable.size}, Depth: ${difficultyProfile.searchDepth}, Heuristic: ${difficultyProfile.heuristicLevel}`);

        let finalMove = bestMoveResult.move;
        if (difficultyProfile.randomness > 0 && Math.random() < difficultyProfile.randomness && bestMoveResult.move) {
            console.log(`AI Worker: Applying randomness (chance: ${difficultyProfile.randomness}, topN: ${difficultyProfile.randomTopN})`);
            let possibleMoves = getPossibleMoves();
            if (possibleMoves.length > 1) {
                let scoredMoves = possibleMoves.map(m => {
                    let score;
                    if(getCellStatus(m.y, m.x) === EMPTY) {
                        setCellBit(bitboards[effectiveAiPlayer], m.y, m.x);
                        score = evaluateBoard(effectiveAiPlayer, difficultyProfile.heuristicLevel);
                        clearCellBit(bitboards[effectiveAiPlayer], m.y, m.x);
                    } else {
                        score = -Infinity;
                    }
                    return { move: m, score: score };
                });
                scoredMoves.sort((a, b) => b.score - a.score);
                const topNToConsider = Math.min(scoredMoves.length, difficultyProfile.randomTopN);
                const topNMoves = scoredMoves.slice(0, topNToConsider);
                if (topNMoves.length > 0) {
                    const randomIndex = Math.floor(Math.random() * topNMoves.length);
                    finalMove = topNMoves[randomIndex].move;
                    console.log(`AI Worker: Randomly selected move (${finalMove.x},${finalMove.y}) from top ${topNMoves.length} options (Original best: ${bestMoveResult.move.x},${bestMoveResult.move.y}).`);
                } else {
                    console.log(`AI Worker: Randomness triggered, but no alternative moves found after shallow eval. Sticking to minimax best.`);
                }
            } else if (possibleMoves.length === 1 && bestMoveResult.move && (possibleMoves[0].x !== bestMoveResult.move.x || possibleMoves[0].y !== bestMoveResult.move.y)) {
                 console.warn(`AI Worker: Randomness context - Minimax best move differs from the only possible move. Opting for the single possible move.`);
                finalMove = possibleMoves[0];
            }
             else {
                console.log(`AI Worker: Randomness triggered, but only one possible move or no initial best move. Sticking to it.`);
            }
        }
        console.log('ai.worker.js: Calculation complete. Posting final move to main script:', finalMove);
        self.postMessage({ type: 'bestMoveFound', move: finalMove, score: bestMoveResult.score });
    } else if (type === 'evaluateAllPoints') {
        const { board: omniBoard, playerForOmni: omniPlayer } = e.data;
        if (!omniBoard || !omniPlayer) {
            console.error('ai.worker.js: Invalid data received for evaluateAllPoints. Board or playerForOmni missing.');
            self.postMessage({ type: 'error', error: 'Invalid data received by worker for evaluateAllPoints' });
            return;
        }
        // Omniscience uses 2D array logic
        self.playerForOmniInternal = omniPlayer;
        const opponent = (omniPlayer === PLAYER_BLACK) ? PLAYER_WHITE : PLAYER_BLACK;
        const playerOpportunities = getDetailedPatternHints(omniBoard, omniPlayer);
        const opponentThreats = getDetailedPatternHints(omniBoard, opponent);

        let combinedHints = [];
        const playerOpportunityCoords = new Set();
        playerOpportunities.forEach(hint => {
            const coordKey = `${hint.x},${hint.y}`;
            if (!playerOpportunityCoords.has(coordKey)) { combinedHints.push(hint); playerOpportunityCoords.add(coordKey); }
        });
        opponentThreats.forEach(threat => {
            const isPlayerWinAtSameSpot = playerOpportunities.find(op => op.x === threat.x && op.y === threat.y && op.patternType === PATTERN_TYPE_FIVE_IN_A_ROW);
            if (!isPlayerWinAtSameSpot) {
                const isPlayerOpportunityAtSameSpot = playerOpportunities.find(op => op.x === threat.x && op.y === threat.y);
                if (threat.patternType === PATTERN_TYPE_FIVE_IN_A_ROW || !isPlayerOpportunityAtSameSpot) {
                    const alreadyExists = combinedHints.some(h => h.x === threat.x && h.y === threat.y && h.hintCategory === threat.hintCategory && h.patternType === threat.patternType);
                    if(!alreadyExists) { combinedHints.push(threat); }
                }
            }
        });
        const finalHints = combinedHints.map(({ x, y, patternType, hintCategory }) => ({ x, y, patternType, hintCategory }));
        console.log(`ai.worker.js: Evaluated points for omniscience (using 2D array logic). Player OPs: ${playerOpportunities.length}, Opponent Threats: ${opponentThreats.length}. Total unique hints sent: ${finalHints.length}`);
        self.postMessage({ type: 'omniEvaluationComplete', hints: finalHints });
        self.playerForOmniInternal = null;
    } else {
        console.error('ai.worker.js: Unknown message type received:', type);
        self.postMessage({ type: 'error', error: `Unknown message type: ${type}` });
    }
};
console.log("ai.worker.js loaded and ready for messages.");
