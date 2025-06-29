console.log("DEBUG: File loaded: js/evaluate.js"); // DBG_LOAD_EVAL

// Gomoku Incremental Evaluation Logic
// Inspired by lihongxun945/gobang/src/ai/eval.js

// Assumes shapeUtils (from js/shape.js) is available on window.shapeUtils
// Assumes global constants: BOARD_SIZE, PLAYER_BLACK, PLAYER_WHITE, EMPTY
// Assumes aiConfig for things like pointsLimit might be globally available or passed.

// Score constants for evaluating points based on shapes formed
const SCORE_VALUES = {
    FIVE: 1000000,    // A place that makes a five for the current player
    FOUR: 20000,      // A place that makes a live four
    BLOCK_FOUR: 5000, // A place that makes a blocked four
    THREE_THREE: 10000,// A place that makes two live threes (critical)
    FOUR_THREE: 18000, // A place that makes a four (live/blocked) AND a live three
    THREE: 2000,      // A place that makes a live three
    BLOCK_THREE: 500, // A place that makes a blocked three
    TWO_TWO: 300,     // A place that makes two live twos
    TWO: 100,         // A place that makes a live two
    BLOCK_TWO: 50,    // A place that makes a blocked two
};

class Evaluate {
    constructor(size, pBlack, pWhite, pEmpty) {
        console.log("DEBUG: Evaluate constructor entered."); // DBG_EVAL_CONSTRUCTOR
        console.log(`DEBUG: Evaluate constructor - Globals: BOARD_SIZE=${typeof BOARD_SIZE}, PLAYER_BLACK=${typeof PLAYER_BLACK}, PLAYER_WHITE=${typeof PLAYER_WHITE}, EMPTY=${typeof EMPTY}`); // DBG_EVAL_GLOBALS
        console.log(`DEBUG: Evaluate constructor - Params: size=${size}, pB=${pBlack}, pW=${pWhite}, pE=${pEmpty}`); // DBG_EVAL_PARAMS
        if (!window.shapeUtils || !window.shapeUtils.shapes) {
            console.error("DEBUG: Evaluate constructor - window.shapeUtils or window.shapeUtils.shapes not found! This is critical."); // DBG_EVAL_SHAPEUTILS
        }


        this.size = size;
        this.PLAYER_BLACK = pBlack;
        this.PLAYER_WHITE = pWhite;
        this.EMPTY = pEmpty;

        this.board = Array(this.size + 2).fill(null).map((_, r) =>
            Array(this.size + 2).fill(null).map((_, c) =>
                (r === 0 || c === 0 || r === this.size + 1 || c === this.size + 1) ? 2 : this.EMPTY // 2 for wall
            )
        );

        this.pointScores = [
            Array(this.size).fill(null).map(() => Array(this.size).fill(0)),
            Array(this.size).fill(null).map(() => Array(this.size).fill(0))
        ];
        this.playerIndexMap = {
            [this.PLAYER_BLACK]: 0,
            [this.PLAYER_WHITE]: 1
        };

        const defaultShapeNone = (window.shapeUtils && window.shapeUtils.shapes) ? window.shapeUtils.shapes.NONE : 0;
        this.shapeCache = [
            Array(4).fill(null).map(() => Array(this.size).fill(null).map(() => Array(this.size).fill(defaultShapeNone))),
            Array(4).fill(null).map(() => Array(this.size).fill(null).map(() => Array(this.size).fill(defaultShapeNone)))
        ];

        this.allDirections = [
            { dr: 0, dc: 1,  idx: 0 }, { dr: 1, dc: 0,  idx: 1 },
            { dr: 1, dc: 1,  idx: 2 }, { dr: 1, dc: -1, idx: 3 }
        ];

        console.log("DEBUG: Evaluate constructor - Initializing point scores for empty board."); // DBG_EVAL_INIT_SCORES
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.board[r + 1][c + 1] === this.EMPTY) {
                    // Check if shapeUtils are available before calling methods that use them
                    if (window.shapeUtils && window.shapeUtils.getShapeFast) {
                        this._updateSinglePointScore(r, c, this.PLAYER_BLACK);
                        this._updateSinglePointScore(r, c, this.PLAYER_WHITE);
                    } else {
                        // console.warn(`DEBUG: Evaluate constructor - shapeUtils not fully ready during initial score update for ${r},${c}`);
                    }
                }
            }
        }
        console.log("DEBUG: Evaluate constructor exited."); // DBG_EVAL_CONSTRUCTOR_END
    }

    _getScoreForShape(shape) {
        const s = (window.shapeUtils && window.shapeUtils.shapes) ? window.shapeUtils.shapes : {}; // Fallback
        switch (shape) {
            case s.FIVE: return SCORE_VALUES.FIVE;
            case s.FOUR: return SCORE_VALUES.FOUR;
            case s.BLOCK_FOUR: return SCORE_VALUES.BLOCK_FOUR;
            case s.THREE_THREE: return SCORE_VALUES.THREE_THREE;
            case s.FOUR_THREE: return SCORE_VALUES.FOUR_THREE;
            case s.THREE: return SCORE_VALUES.THREE;
            case s.BLOCK_THREE: return SCORE_VALUES.BLOCK_THREE;
            case s.TWO_TWO: return SCORE_VALUES.TWO_TWO;
            case s.TWO: return SCORE_VALUES.TWO;
            case s.BLOCK_TWO: return SCORE_VALUES.BLOCK_TWO;
            default: return 0;
        }
    }

    _updateSinglePointScore(r, c, playerRole) {
        if (!window.shapeUtils || !window.shapeUtils.getShapeFast || !window.shapeUtils.shapes) {
            // console.warn("DEBUG: _updateSinglePointScore - shapeUtils not available. Skipping update.");
            return;
        }
        const defaultShapeNone = window.shapeUtils.shapes.NONE;

        if (this.board[r + 1][c + 1] !== this.EMPTY) {
            const pIdx = this.playerIndexMap[playerRole];
            if (pIdx === undefined) return;
            this.pointScores[pIdx][r][c] = 0;
            for (let dirIdx = 0; dirIdx < 4; dirIdx++) {
                this.shapeCache[pIdx][dirIdx][r][c] = defaultShapeNone;
            }
            return;
        }

        const pIdx = this.playerIndexMap[playerRole];
        if (pIdx === undefined) return;

        this.board[r + 1][c + 1] = playerRole;

        for (const dir of this.allDirections) {
            const [shapeEnumVal, /*count*/] = window.shapeUtils.getShapeFast(this.board, r, c, dir.dr, dir.dc, playerRole);
            this.shapeCache[pIdx][dir.idx][r][c] = shapeEnumVal;
        }

        const combinedScore = this._calculateCombinedScoreForPoint(r, c, pIdx);
        this.pointScores[pIdx][r][c] = combinedScore;

        this.board[r + 1][c + 1] = this.EMPTY;
    }

    _calculateCombinedScoreForPoint(r, c, pIdx) {
        if (!window.shapeUtils || !window.shapeUtils.shapes) {
            // console.warn("DEBUG: _calculateCombinedScoreForPoint - shapeUtils not available. Returning 0.");
            return 0;
        }
        let score = 0;
        let liveThrees = 0;
        let blockedFours = 0;
        let liveFours = 0;
        const s = window.shapeUtils.shapes;

        for (let dirIdx = 0; dirIdx < 4; dirIdx++) {
            const shape = this.shapeCache[pIdx][dirIdx][r][c];
            if (shape === s.FIVE) return SCORE_VALUES.FIVE;
            if (shape === s.FOUR) liveFours++;
            if (shape === s.BLOCK_FOUR) blockedFours++;
            if (shape === s.THREE) liveThrees++;
            score += this._getScoreForShape(shape);
        }

        if (liveFours >= 1 && liveThrees >=1) score = Math.max(score, SCORE_VALUES.FOUR_THREE);
        else if (liveFours >= 1) score = Math.max(score, SCORE_VALUES.FOUR);
        else if (blockedFours >= 2) score = Math.max(score, SCORE_VALUES.FOUR_FOUR);
        else if (blockedFours >= 1 && liveThrees >=1) score = Math.max(score, SCORE_VALUES.FOUR_THREE);
        else if (liveThrees >= 2) score = Math.max(score, SCORE_VALUES.THREE_THREE);

        return score;
    }

    _updateAffectedPoints(r, c, _placedPlayerRole) {
        const defaultShapeNone = (window.shapeUtils && window.shapeUtils.shapes) ? window.shapeUtils.shapes.NONE : 0;
        const pIdxBlack = this.playerIndexMap[this.PLAYER_BLACK];
        const pIdxWhite = this.playerIndexMap[this.PLAYER_WHITE];

        if (pIdxBlack !== undefined) this.pointScores[pIdxBlack][r][c] = 0;
        if (pIdxWhite !== undefined) this.pointScores[pIdxWhite][r][c] = 0;

        for (let dirIdx = 0; dirIdx < 4; dirIdx++) {
            if (pIdxBlack !== undefined) this.shapeCache[pIdxBlack][dirIdx][r][c] = defaultShapeNone;
            if (pIdxWhite !== undefined) this.shapeCache[pIdxWhite][dirIdx][r][c] = defaultShapeNone;
        }

        for (let dr_offset = -5; dr_offset <= 5; dr_offset++) {
            for (let dc_offset = -5; dc_offset <= 5; dc_offset++) {
                if (dr_offset === 0 && dc_offset === 0) continue;
                const nr = r + dr_offset;
                const nc = c + dc_offset;
                if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
                    if (this.board[nr + 1][nc + 1] === this.EMPTY) {
                        this._updateSinglePointScore(nr, nc, this.PLAYER_BLACK);
                        this._updateSinglePointScore(nr, nc, this.PLAYER_WHITE);
                    }
                }
            }
        }
    }

    move(r, c, playerRole) {
        if (r < 0 || r >= this.size || c < 0 || c >= this.size || this.board[r+1][c+1] !== this.EMPTY) {
            return false;
        }
        this.board[r + 1][c + 1] = playerRole;
        this._updateAffectedPoints(r, c, playerRole);
        return true;
    }

    undo(r, c, originalPlayerRole) {
        if (r < 0 || r >= this.size || c < 0 || c >= this.size || this.board[r+1][c+1] === this.EMPTY) {
            return false;
        }
        this.board[r + 1][c + 1] = this.EMPTY;
        this._updateAffectedPoints(r, c, originalPlayerRole);
        return true;
    }

    evaluateBoard(playerToEvaluate) {
        let blackTotalScore = 0;
        let whiteTotalScore = 0;
        const blackIdx = this.playerIndexMap[this.PLAYER_BLACK];
        const whiteIdx = this.playerIndexMap[this.PLAYER_WHITE];

        if (blackIdx === undefined || whiteIdx === undefined) {
            console.error("DEBUG: evaluateBoard - playerIndexMap not correctly initialized for PLAYER_BLACK or PLAYER_WHITE.");
            return 0;
        }

        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (this.board[i+1][j+1] === this.EMPTY) {
                    blackTotalScore += this.pointScores[blackIdx][i][j];
                    whiteTotalScore += this.pointScores[whiteIdx][i][j];
                }
            }
        }
        return playerToEvaluate === this.PLAYER_BLACK ? (blackTotalScore - whiteTotalScore) : (whiteTotalScore - blackTotalScore);
    }

    getMoves(playerRole, depth, onlyThree = false, onlyFour = false) {
        if (!window.shapeUtils || !window.shapeUtils.shapes) {
            console.warn("DEBUG: getMoves - shapeUtils not available. Returning empty array.");
            return [];
        }
        const s = window.shapeUtils.shapes;
        const pIdx = this.playerIndexMap[playerRole];
        const oppRole = (playerRole === this.PLAYER_BLACK) ? this.PLAYER_WHITE : this.PLAYER_BLACK;
        const oppIdx = this.playerIndexMap[oppRole];

        if (pIdx === undefined || oppIdx === undefined) {
            console.error("DEBUG: getMoves - playerIndexMap not correctly initialized.");
            return [];
        }

        let movesByType = {
            playerFives: new Set(), opponentBlockFives: new Set(),
            playerFours: new Set(), opponentBlockFours: new Set(),
            playerFourThrees: new Set(), playerThreeThrees: new Set(),
            opponentFourThrees: new Set(), opponentThreeThrees: new Set(),
            playerThrees: new Set(), opponentBlockThrees: new Set(),
            playerTwos: new Set(),
            fallbackPoints: []
        };

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.board[r + 1][c + 1] !== this.EMPTY) continue;
                const move = { y: r, x: c };
                const moveStr = `${r}-${c}`;

                let pLiveThrees = 0, pBlockedFours = 0, pLiveFours = 0;
                for (let dirIdx = 0; dirIdx < 4; dirIdx++) {
                    const playerShape = this.shapeCache[pIdx][dirIdx][r][c];
                    if (playerShape === s.FIVE) { movesByType.playerFives.add(moveStr); break; }
                    if (playerShape === s.FOUR) pLiveFours++;
                    if (playerShape === s.BLOCK_FOUR) pBlockedFours++;
                    if (playerShape === s.THREE) pLiveThrees++;
                }
                if (movesByType.playerFives.has(moveStr)) continue;

                if (pLiveFours >= 1 && pLiveThrees >= 1) movesByType.playerFourThrees.add(moveStr);
                else if (pBlockedFours >= 2) movesByType.playerFourThrees.add(moveStr);
                else if (pLiveThrees >= 2) movesByType.playerThreeThrees.add(moveStr);

                if (pLiveFours >= 1 && !movesByType.playerFourThrees.has(moveStr)) movesByType.playerFours.add(moveStr);
                if (pLiveThrees >= 1 && !movesByType.playerThreeThrees.has(moveStr) && !movesByType.playerFourThrees.has(moveStr)) movesByType.playerThrees.add(moveStr);

                let oLiveThrees = 0, oBlockedFours = 0, oLiveFours = 0;
                 for (let dirIdx = 0; dirIdx < 4; dirIdx++) {
                    const shape = this.shapeCache[oppIdx][dirIdx][r][c];
                    if (shape === s.FIVE) { movesByType.opponentBlockFives.add(moveStr); break; }
                    if (shape === s.FOUR) oLiveFours++;
                    if (shape === s.BLOCK_FOUR) oBlockedFours++;
                    if (shape === s.THREE) oLiveThrees++;
                }
                if (movesByType.opponentBlockFives.has(moveStr)) continue;

                if (oLiveFours >= 1 && oLiveThrees >= 1) movesByType.opponentFourThrees.add(moveStr);
                else if (oBlockedFours >= 2) movesByType.opponentFourThrees.add(moveStr);
                else if (oLiveThrees >= 2) movesByType.opponentThreeThrees.add(moveStr);

                if (oLiveFours >= 1 && !movesByType.opponentFourThrees.has(moveStr)) movesByType.opponentBlockFours.add(moveStr);
                if (oLiveThrees >= 1 && !movesByType.opponentThreeThrees.has(moveStr) && !movesByType.opponentFourThrees.has(moveStr)) movesByType.opponentBlockThrees.add(moveStr);

                const currentPointScorePlayer = this.pointScores[pIdx] && this.pointScores[pIdx][r] ? this.pointScores[pIdx][r][c] : 0;
                if (currentPointScorePlayer > SCORE_VALUES.BLOCK_TWO) {
                    movesByType.fallbackPoints.push({ move: move, score: currentPointScorePlayer });
                }
            }
        }

        const parseMoves = (strSet) => Array.from(strSet).map(str => {
            const [y,x] = str.split('-').map(Number); return {y,x};
        });

        if (movesByType.playerFives.size > 0) return parseMoves(movesByType.playerFives);
        if (movesByType.opponentBlockFives.size > 0) return parseMoves(movesByType.opponentBlockFives);

        let result = [];
        if (onlyFour) {
            result.push(...parseMoves(movesByType.playerFours), ...parseMoves(movesByType.opponentBlockFours));
        } else if (onlyThree) {
            result.push(...parseMoves(movesByType.playerFourThrees), ...parseMoves(movesByType.playerThreeThrees),
                        ...parseMoves(movesByType.playerThrees), ...parseMoves(movesByType.playerFours),
                        ...parseMoves(movesByType.opponentBlockFours), ...parseMoves(movesByType.opponentBlockThrees),
                        ...parseMoves(movesByType.opponentFourThrees), ...parseMoves(movesByType.opponentThreeThrees)
                        );
        } else {
            result.push(...parseMoves(movesByType.playerFourThrees), ...parseMoves(movesByType.playerFours),
                        ...parseMoves(movesByType.opponentBlockFours), ...parseMoves(movesByType.opponentFourThrees),
                        ...parseMoves(movesByType.playerThreeThrees), ...parseMoves(movesByType.opponentThreeThrees),
                        ...parseMoves(movesByType.playerThrees), ...parseMoves(movesByType.opponentBlockThrees)
                        );
            if (result.length < 5) {
                movesByType.fallbackPoints.sort((a,b) => b.score - a.score);
                result.push(...movesByType.fallbackPoints.map(fm => fm.move));
            }
        }

        const uniqueMoveMap = new Map();
        for(const moveObj of result) {
            if(moveObj && moveObj.y !== undefined && moveObj.x !== undefined) { // Ensure moveObj is valid
               uniqueMoveMap.set(`${moveObj.y}-${moveObj.x}`, moveObj);
            }
        }
        result = Array.from(uniqueMoveMap.values());

        const limit = (typeof aiConfig !== 'undefined' && aiConfig.pointsLimit) ? aiConfig.pointsLimit : 20;
        return result.slice(0, limit);
    }
}

if (typeof window !== 'undefined') {
    window.Evaluate = Evaluate;
}
console.log("DEBUG: End of evaluate.js script evaluation."); // DBG_LOAD_END_EVAL
