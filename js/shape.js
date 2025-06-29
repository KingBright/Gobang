// Gomoku Shape Definitions and Detection Logic
// Inspired by lihongxun945/gobang/src/ai/shape.js

// Numerical constants for different chess patterns/shapes
// These values are somewhat arbitrary but allow differentiation.
// Higher values might implicitly mean more important, but scoring is separate.
export const shapes = {
    NONE: 0,        // No significant shape

    // Winning states or direct threats
    FIVE: 100,      // 連五 (Five in a row) - Represents a win
    FOUR: 90,       // 活四 (Live Four - 011110)
    BLOCK_FOUR: 80, // 冲四 (Blocked Four - X11110 or 01111X) - Can also be called "dead four" if one end is player stone.
                    // The key is one end open, other blocked by opponent or edge.

    // Strong threats
    THREE: 70,      // 活三 (Live Three - 01110 or 010110 or 011010)
    THREE_THREE: 75, // 双三 (Double Live Threes forming at one point) - Composite
    FOUR_THREE: 85,  // 冲四活三 (A point forms both a Blocked Four and a Live Three) - Composite
    FOUR_FOUR: 88,   // 双冲四 (Double Blocked Fours) - Composite

    // Lesser threats / development
    BLOCK_THREE: 60, // 眠三 (Blocked Three - X1110 or 0111X with one end blocked by opponent/edge, other open)
    TWO: 50,        // 活二 (Live Two - 0110)
    TWO_TWO: 55,    // 双活二 (Double Live Twos) - Composite
    BLOCK_TWO: 40,  // 眠二 (Blocked Two - X110 or 011X)

    // Single pieces might have low value in some evaluations but not typically a "shape"
    ONE: 10,        // (Live One - 010) - Placeholder, might not be used directly as a shape
    BLOCK_ONE: 5,   // (Blocked One - X10 or 01X) - Placeholder

    // Special case for a "five" that's blocked by opponent at one or both ends but still a line of 5.
    // Some systems score this differently from an open FIVE if it's not an immediate win.
    // For simplicity, a line of 5 of player's stones is 'FIVE'.
    // lihongxun945/gobang has BLOCK_FIVE, let's include it conceptually.
    // If it means "a line of 5 that is blocked and thus not an immediate win", its score would be less than true FIVE.
    // However, their eval.js uses BLOCK_FIVE score as FIVE, which is confusing.
    // Let's assume any line of 5 is `shapes.FIVE` for detection, scoring will handle win.
    // For pattern matching, a string like "X11111" (blocked five) is distinct from "0111110" (live six, which is a FIVE).
    // Let's refine `BLOCK_FIVE` if its specific pattern string becomes clear.
    // For now, `getShapeFast` will aim to return `shapes.FIVE` for any sequence of 5+ same color.
};

/**
 * Helper function for getShapeFast. Scans in one direction from a central point (not including the center).
 * @param {Array<Array<number>>} boardWithWalls - Board array with boundary walls.
 * @param {number} r - Center row (0-indexed relative to original board).
 * @param {number} c - Center col (0-indexed relative to original board).
 * @param {number} dr - Row direction delta.
 * @param {number} dc - Col direction delta.
 * @param {number} role - The player making the move.
 * @returns {object} { selfCount, totalLength, openEnded, consecutiveSelf, hasGap }
 *         selfCount: number of 'role' pieces.
 *         totalLength: number of cells scanned before hitting opponent/wall or too many empties.
 *         openEnded: true if the line ends with an empty cell (or board edge if we scan far enough).
 *         consecutiveSelf: count of player's pieces immediately connected to center.
 *         hasGap: true if there was an empty cell between player's pieces.
 */
function countLineProperties(boardWithWalls, r, c, dr, dc, role) {
    let selfCount = 0;
    let consecutiveSelf = 0;
    let currentConsecutive = 0;
    let totalLength = 0;
    let openEnded = false;
    let hasGap = false;
    let emptiesEncountered = 0;

    for (let i = 1; i <= 5; i++) { // Scan up to 5 cells away (enough for forming up to 6-in-a-row)
        const nr = r + 1 + i * dr; // +1 for wall offset
        const nc = c + 1 + i * dc; // +1 for wall offset

        const piece = boardWithWalls[nr][nc];
        totalLength++;

        if (piece === role) {
            selfCount++;
            currentConsecutive++;
            if (emptiesEncountered > 0 && currentConsecutive > 0) { // A piece after a gap
                hasGap = true;
            }
            if (i === 1) consecutiveSelf = currentConsecutive; // For the first piece right next to center
            else if (!hasGap) consecutiveSelf = currentConsecutive;

        } else if (piece === 0) { // EMPTY
            openEnded = true; // If the line ends here, it's open
            emptiesEncountered++;
            currentConsecutive = 0; // Reset consecutive count for player
            if (emptiesEncountered >= 2 && i < selfCount + emptiesEncountered) {
                // More than one empty before enough pieces for a five, or two empties in a row.
                // This heuristic limits scan for typical patterns. e.g. 10101_ / 11001_
                // For shapes like 11011 (FOUR), this needs care.
                // A simpler totalLength limit might be better.
                break;
            }
        } else { // Opponent piece or wall
            openEnded = false;
            break; // Line is blocked by opponent or wall
        }
    }
    return { selfCount, totalLength, openEnded, consecutiveSelf, hasGap, emptiesEncountered };
}


/**
 * Detects the shape formed by placing 'role' at (r,c) along a line defined by (dr,dc).
 * (r,c) are 0-indexed relative to the original board.
 * boardWithWalls is assumed to have a 1-cell boundary/wall.
 * @returns {[number, number]} [shape_constant, count_of_role_in_pattern]
 */
export function getShapeFast(boardWithWalls, r, c, dr, dc, role) {
    // Temporarily place the piece for analysis (caller should ensure it's undone if this is a simulation)
    // This function assumes boardWithWalls ALREADY has the piece at r+1, c+1 for 'role'
    // as it's called from updateSinglePoint *after* the piece is temp placed.

    const left = countLineProperties(boardWithWalls, r, c, -dr, -dc, role);
    const right = countLineProperties(boardWithWalls, r, c, dr, dc, role);

    const totalSelf = left.selfCount + right.selfCount + 1; // +1 for the piece at (r,c)

    // --- FIVE detection ---
    // Count consecutive pieces including the center.
    // This is simpler: just count continuous line of `role` including (r,c)
    let consecutiveLine = 1;
    // Count right
    for (let i = 1; i <= 4; i++) {
        if (boardWithWalls[r + 1 + i * dr][c + 1 + i * dc] === role) consecutiveLine++;
        else break;
    }
    // Count left
    for (let i = 1; i <= 4; i++) {
        if (boardWithWalls[r + 1 - i * dr][c + 1 - i * dc] === role) consecutiveLine++;
        else break;
    }
    if (consecutiveLine >= 5) return [shapes.FIVE, consecutiveLine];

    // --- FOUR detection ---
    // Live Four: 011110 (totalSelf = 4, both ends open)
    // Pattern: _ R R R R _ (R is role, _ is empty). Center piece is one of the R's.
    // Example: Left has 1 R ( L.consecutiveSelf=1), Right has 2 R (R.consecutiveSelf=2), total = 1+2+1 = 4.
    // Needs left.openEnded and right.openEnded.
    if (left.consecutiveSelf + right.consecutiveSelf + 1 === 4) {
        if (left.openEnded && right.openEnded) {
            // Check for "011110" specifically.
            // Requires 1 empty on left, 1 empty on right, and 4 of 'role' in between.
            // Example: board at (r+1 -dr -dr) is empty AND board at (r+1 +dr +dr +dr +dr +dr) is empty
            // This needs careful boundary checks for the empty slots.
            // The countLineProperties' openEnded gives a hint.
            // If left.consecutiveSelf = 1, right.consecutiveSelf = 2: needs empty at L-2 and R+3
            // A more robust check:
            // Stringify a segment of 6: L-Empty, L-Role, Center-Role, R-Role, R-Role, R-Empty
            // Example: (c-2*dc) (c-dc) (c) (c+dc) (c+2*dc) (c+3*dc)
            // Check board[r+1-2*dr][c+1-2*dc] === 0 && board[r+1+3*dr][c+1+3*dc] === 0
            // This is complex. Using the sum of consecutive pieces and openEnded flags:
            if ( (left.openEnded && boardWithWalls[r+1- (left.consecutiveSelf+1)*dr][c+1- (left.consecutiveSelf+1)*dc] === 0) &&
                 (right.openEnded && boardWithWalls[r+1+ (right.consecutiveSelf+1)*dr][c+1+ (right.consecutiveSelf+1)*dc] === 0) ) {
                return [shapes.FOUR, 4];
            }
        }
    }

    // Blocked Four: X11110 or 01111X (totalSelf = 4, one end open, one blocked by opponent/wall)
    // Or 10111 or 11011 or 11101 (with one piece gap)
    if (totalSelf === 4) { // Can be 1111 or 1_111 or 11_11 or 111_1
        const openEnds = (left.openEnded ? 1:0) + (right.openEnded ? 1:0);
        const hasInternalGap = (left.hasGap || right.hasGap || (left.emptiesEncountered > left.selfCount) || (right.emptiesEncountered > right.selfCount) );

        if (consecutiveLine === 4) { // Solid X11110 or 01111X
            if (openEnds === 1) return [shapes.BLOCK_FOUR, 4];
        } else if (!hasInternalGap && totalSelf === 4 && openEnds >=1 ) {
            // This means it's a solid line of 4, and at least one side is open.
            // If openEnds === 2, it's live four (covered above IF logic for live four is perfect)
            // If openEnds === 1, it's blocked four.
             // This condition might be redundant if live four is caught perfectly.
             // For now, if totalSelf is 4 and at least one open end, and not live four:
            if (openEnds === 1) return [shapes.BLOCK_FOUR, 4];
        }

        // Check for gapped fours like 11011 or 10111
        // This requires analyzing patterns like "110110" (live gapped four) or "X110110" (blocked gapped four)
        // The original lihongxun `getShapeFast` has specific logic for this.
        // Simplified: if totalSelf is 4, and it's not a live four, and has at least one open end, it's some kind of BLOCK_FOUR or gapped FOUR.
        if (totalSelf === 4 && openEnds >= 1) { // Not caught by live four, implies it's blocked or gapped.
            // A more precise classification would be needed from their full shape logic for gapped ones.
            // For now, this is a general catch for non-live-fours that are still potent.
            return [shapes.BLOCK_FOUR, 4];
        }
    }


    // --- THREE detection ---
    // Live Three: 01110 (totalSelf = 3, both ends open, no internal gaps)
    // Or gapped live threes like 010110, 011010
    if (left.consecutiveSelf + right.consecutiveSelf + 1 === 3) { // Solid 111
        if (left.openEnded && right.openEnded) {
             // Check for "0011100" or "0_111_0" (need two empties on each side for some definitions of live three)
             // Simpler: "01110" - one empty on each immediate side.
            if (boardWithWalls[r+1- (left.consecutiveSelf+1)*dr][c+1- (left.consecutiveSelf+1)*dc] === 0 &&
                boardWithWalls[r+1+ (right.consecutiveSelf+1)*dr][c+1+ (right.consecutiveSelf+1)*dc] === 0) {
                return [shapes.THREE, 3];
            }
        }
    }
    // More general THREE check (includes gapped like 1011 or 1101)
    if (totalSelf === 3) {
        const openEnds = (left.openEnded ? 1:0) + (right.openEnded ? 1:0);
        if (openEnds === 2) { // Potential live three (solid or gapped)
            // Example 010110: left.self=1, left.hasGap=false. right.self=1, right.hasGap=true (gap between center and right.self)
            // This needs more detailed checks based on exact empty/piece sequence.
            // For now, if totalSelf=3 and two open ends, classify as THREE.
            return [shapes.THREE, 3];
        } else if (openEnds === 1) { // Potential blocked three
            return [shapes.BLOCK_THREE, 3];
        }
    }

    // --- TWO detection ---
    // Live Two: 0110 (totalSelf = 2, both ends open, no internal gaps)
    if (left.consecutiveSelf + right.consecutiveSelf + 1 === 2) { // Solid 11
         if (left.openEnded && right.openEnded) {
            if (boardWithWalls[r+1- (left.consecutiveSelf+1)*dr][c+1- (left.consecutiveSelf+1)*dc] === 0 &&
                boardWithWalls[r+1+ (right.consecutiveSelf+1)*dr][c+1+ (right.consecutiveSelf+1)*dc] === 0) {
                 return [shapes.TWO, 2];
            }
        }
    }
    if (totalSelf === 2) {
        const openEnds = (left.openEnded ? 1:0) + (right.openEnded ? 1:0);
        if (openEnds === 2) return [shapes.TWO, 2];
        else if (openEnds === 1) return [shapes.BLOCK_TWO, 2];
    }

    return [shapes.NONE, totalSelf];
}


// Helper to check if a shape is a five (win condition)
export const isFiveShape = (shape) => {
  return shape === shapes.FIVE;
};

// Helper to check if a shape is a four (live or blocked)
export const isFourShape = (shape) => {
  return shape === shapes.FOUR || shape === shapes.BLOCK_FOUR || shape === shapes.FOUR_FOUR || shape === shapes.FOUR_THREE;
};

// Helper to get all shapes for a point (used in eval.js for composite shapes)
// This would require the shapeCache from the Evaluate class.
// For now, this is a conceptual placeholder.
export function getAllShapesOfPointFromCache(shapeCache, x, y, role) {
  const pointShapes = [];
  if (shapeCache && shapeCache[role]) {
    for (let dir = 0; dir < 4; dir++) {
      if (shapeCache[role][dir] && shapeCache[role][dir][x] && shapeCache[role][dir][x][y] > shapes.NONE) {
        pointShapes.push(shapeCache[role][dir][x][y]);
      }
    }
  }
  return pointShapes;
}

// Expose if loaded globally
if (typeof window !== 'undefined') {
    window.shapeUtils = {
        shapes: shapes,
        getShapeFast: getShapeFast,
        isFiveShape: isFiveShape,
        isFourShape: isFourShape,
        getAllShapesOfPointFromCache: getAllShapesOfPointFromCache
    };
}
