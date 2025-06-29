// Gomoku Board Evaluation Logic based on Pattern Scoring

// Score constants (as per document)
const SCORE_PATTERNS = {
    FIVE: 100000,  // 连五
    FOUR: 10000,   // 活四
    SFOUR: 1000,   // 冲四/死四 (document uses SFOUR for 冲四)
    THREE: 1000,   // 活三
    STHREE: 100,   // 眠三
    TWO: 100,      // 活二
    STWO: 10,      // 眠二
    // DEAD patterns (block: 2) usually score 0 or very low, not explicitly listed for high scores.
};

// Helper to reverse player role (assuming PLAYER_BLACK and PLAYER_WHITE are globally defined)
function _reversePlayer(player) {
    if (typeof PLAYER_BLACK === 'undefined' || typeof PLAYER_WHITE === 'undefined') {
        // Fallback if globals are not defined when this file is parsed standalone.
        // This should not happen in the actual game environment.
        console.error("PLAYER_BLACK or PLAYER_WHITE not defined for _reversePlayer");
        return player === 1 ? 2 : 1; // Assuming 1 and 2 if not defined
    }
    return player === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
}

/**
 * Evaluates the board state from the perspective of the given 'player'.
 * A positive score is good for 'player', negative is good for opponent.
 * @param {Array<Array<number>>} board - The game board.
 * @param {number} player - The player for whom the evaluation perspective is taken.
 * @returns {number} The evaluated score.
 */
function evaluateBoardScore(board, player) {
    // Ensure constants are available. These should be globally defined by other scripts (e.g., utils.js or game.js)
    if (typeof BOARD_SIZE === 'undefined' || typeof EMPTY === 'undefined' ||
        typeof PLAYER_BLACK === 'undefined' || typeof PLAYER_WHITE === 'undefined' ||
        typeof WINNING_LENGTH === 'undefined') {
        console.error("Required global constants (BOARD_SIZE, EMPTY, etc.) are not defined. Evaluation cannot proceed.");
        return 0; // Cannot evaluate
    }

    const aiPlayerScore = _calculateScoreForPlayer(board, player);
    const opponentPlayerScore = _calculateScoreForPlayer(board, _reversePlayer(player));

    return aiPlayerScore - opponentPlayerScore;
}

/**
 * Calculates the total heuristic score for a single player by analyzing all lines on the board.
 * @param {Array<Array<number>>} board - The game board.
 * @param {number} targetPlayer - The player whose patterns are being scored.
 * @returns {number} The total score for this player.
 */
function _calculateScoreForPlayer(board, targetPlayer) {
    let totalScore = 0;

    // Pattern counts for this player, mainly for debugging or complex scoring rules (e.g. double three)
    // The current scoring logic sums scores directly, but counts can be useful.
    const patternCounts = { FIVE: 0, FOUR: 0, SFOUR: 0, THREE: 0, STHREE: 0, TWO: 0, STWO: 0 };

    // 1. Horizontal lines
    for (let r = 0; r < BOARD_SIZE; r++) {
        let line = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            line.push(board[r][c]);
        }
        totalScore += _scoreLine(line, targetPlayer, patternCounts);
    }

    // 2. Vertical lines
    for (let c = 0; c < BOARD_SIZE; c++) {
        let line = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            line.push(board[r][c]);
        }
        totalScore += _scoreLine(line, targetPlayer, patternCounts);
    }

    // 3. Diagonals (top-left to bottom-right style: r-c = constant)
    // k = r - c ranges from -(BOARD_SIZE-1) to (BOARD_SIZE-1)
    for (let k = -(BOARD_SIZE - 1); k < BOARD_SIZE; k++) {
        let line = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            let c = r - k;
            if (c >= 0 && c < BOARD_SIZE) {
                line.push(board[r][c]);
            }
        }
        if (line.length >= 2) { // Minimum length to form any pattern (e.g. STWO needs 2 pieces)
             totalScore += _scoreLine(line, targetPlayer, patternCounts);
        }
    }

    // 4. Anti-diagonals (top-right to bottom-left style: r+c = constant)
    // k = r + c ranges from 0 to 2*(BOARD_SIZE-1)
    for (let k = 0; k <= 2 * (BOARD_SIZE - 1); k++) {
        let line = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            let c = k - r;
            if (c >= 0 && c < BOARD_SIZE) {
                line.push(board[r][c]);
            }
        }
         if (line.length >= 2) {
            totalScore += _scoreLine(line, targetPlayer, patternCounts);
        }
    }

    // If a winning pattern (FIVE) is found, it should dominate all other scores.
    // The problem description implies summing scores for threats.
    // If player has a FIVE, their score should be very high.
    // The `_scoreLine` function adds SCORE_PATTERNS.FIVE.
    // If multiple lines contribute to score, they sum up.
    // This seems to align with the "AI Score - Opponent Score" method.

    // Special conditions like "double threes" or "three and four" are implicitly handled
    // by summing scores from different lines or different parts of lines.
    // The current `_scoreLine` tries to find the most valuable pattern in a segment.

    return totalScore;
}

/**
 * Analyzes a single 1D line (row, col, or diag) for a specific player.
 * Identifies patterns and returns their cumulative score.
 * Updates patternCounts for the player.
 * @param {Array<number>} line - The 1D array representing a line on the board.
 * @param {number} player - The player to score patterns for.
 * @param {object} patternCounts - Object to update with counts of found patterns.
 * @returns {number} The score from patterns found in this line.
 */
function _scoreLine(line, player, patternCounts) {
    let lineScore = 0;
    let i = 0;
    const len = line.length;

    while (i < len) {
        let consecutivePieces = 0;

        if (line[i] === player) {
            let startIndex = i;
            while (i < len && line[i] === player) {
                consecutivePieces++;
                i++;
            }
            // consecutivePieces of 'player' from startIndex to i-1

            let openEnds = 0;
            // Check left side (startIndex)
            if (startIndex === 0 || line[startIndex - 1] === EMPTY) {
                openEnds++;
            }
            // Check right side (i)
            if (i === len || line[i] === EMPTY) {
                openEnds++;
            }

            // Determine block count based on openEnds
            // block = 0 means two open ends (活)
            // block = 1 means one open end (冲/眠)
            // block = 2 means zero open ends (死)
            let block;
            if (openEnds === 2) block = 0; // Both ends open
            else if (openEnds === 1) block = 1; // One end open
            else block = 2; // Both ends blocked (or piece is against wall and other side blocked)

            // Adjust block for pieces at the very edge of the line if the other side is not EMPTY
            // Example: X X X _ _ : count=3. Left is edge. Right is EMPTY. openEnds = 1 (right). block = 1.
            // O X X X _ : count=3. Left is Opponent. Right is EMPTY. openEnds = 1 (right). block = 1.
            // O X X X O : count=3. Left Opponent, Right Opponent. openEnds = 0. block = 2.
            // _ X X X _ : count=3. Left EMPTY, Right EMPTY. openEnds = 2. block = 0.


            if (consecutivePieces >= WINNING_LENGTH) { // Typically 5 for Gomoku
                patternCounts.FIVE = (patternCounts.FIVE || 0) + 1;
                lineScore += SCORE_PATTERNS.FIVE;
            } else if (consecutivePieces === 4) {
                if (block === 0) { // 活四 _XXXX_
                    patternCounts.FOUR = (patternCounts.FOUR || 0) + 1;
                    lineScore += SCORE_PATTERNS.FOUR;
                } else if (block === 1) { // 冲四 OXXXX_ or _XXXXO
                    patternCounts.SFOUR = (patternCounts.SFOUR || 0) + 1;
                    lineScore += SCORE_PATTERNS.SFOUR;
                } // block === 2 is a dead four, score 0
            } else if (consecutivePieces === 3) {
                if (block === 0) { // 活三 _XXX_
                    patternCounts.THREE = (patternCounts.THREE || 0) + 1;
                    lineScore += SCORE_PATTERNS.THREE;
                } else if (block === 1) { // 眠三 OXXX_ or _XXXO
                    patternCounts.STHREE = (patternCounts.STHREE || 0) + 1;
                    lineScore += SCORE_PATTERNS.STHREE;
                } // block === 2 is a dead three
            } else if (consecutivePieces === 2) {
                if (block === 0) { // 活二 _XX_
                    patternCounts.TWO = (patternCounts.TWO || 0) + 1;
                    lineScore += SCORE_PATTERNS.TWO;
                } else if (block === 1) { // 眠二 OXX_ or _XXO
                    patternCounts.STWO = (patternCounts.STWO || 0) + 1;
                    lineScore += SCORE_PATTERNS.STWO;
                } // block === 2 is a dead two
            }
            // Reset for next segment or skip opponent's pieces
            consecutivePieces = 0;
        } else {
            i++; // Skip empty or opponent's piece
        }
    }
    return lineScore;
}

// Expose the main evaluation function if this script is loaded globally
if (typeof window !== 'undefined') {
    window.scoreUtils = {
        evaluateBoardScore: evaluateBoardScore,
        // For debugging or testing:
        _calculateScoreForPlayer: _calculateScoreForPlayer,
        _scoreLine: _scoreLine
    };
}
