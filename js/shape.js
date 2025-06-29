console.log("DEBUG: File loaded: js/shape.js"); // DBG_LOAD_SHAPE

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

    ONE: 10,        // (Live One - 010) - Placeholder
    BLOCK_ONE: 5,   // (Blocked One - X10 or 01X) - Placeholder
};
console.log("DEBUG: shape.js - 'shapes' object defined:", JSON.stringify(shapes)); // DBG_SHAPE_CONSTANTS

/**
 * Helper function for getShapeFast. Scans in one direction from a central point (not including the center).
 */
function countLineProperties(boardWithWalls, r, c, dr, dc, role) {
    // ... (rest of countLineProperties function as before) ...
    let selfCount = 0;
    let consecutiveSelf = 0;
    let currentConsecutive = 0;
    let totalLength = 0;
    let openEnded = false;
    let hasGap = false;
    let emptiesEncountered = 0;

    for (let i = 1; i <= 5; i++) {
        const nr = r + 1 + i * dr;
        const nc = c + 1 + i * dc;

        const piece = boardWithWalls[nr][nc];
        totalLength++;

        if (piece === role) {
            selfCount++;
            currentConsecutive++;
            if (emptiesEncountered > 0 && currentConsecutive > 0) {
                hasGap = true;
            }
            if (i === 1) consecutiveSelf = currentConsecutive;
            else if (!hasGap) consecutiveSelf = currentConsecutive;

        } else if (piece === 0) { // EMPTY
            openEnded = true;
            emptiesEncountered++;
            currentConsecutive = 0;
            if (emptiesEncountered >= 2 && i < selfCount + emptiesEncountered) {
                break;
            }
        } else {
            openEnded = false;
            break;
        }
    }
    return { selfCount, totalLength, openEnded, consecutiveSelf, hasGap, emptiesEncountered };
}


/**
 * Detects the shape formed by placing 'role' at (r,c) along a line defined by (dr,dc).
 */
export function getShapeFast(boardWithWalls, r, c, dr, dc, role) {
    // ... (rest of getShapeFast function as before) ...
    const left = countLineProperties(boardWithWalls, r, c, -dr, -dc, role);
    const right = countLineProperties(boardWithWalls, r, c, dr, dc, role);

    const totalSelf = left.selfCount + right.selfCount + 1;

    let consecutiveLine = 1;
    for (let i = 1; i <= 4; i++) {
        if (boardWithWalls[r + 1 + i * dr][c + 1 + i * dc] === role) consecutiveLine++;
        else break;
    }
    for (let i = 1; i <= 4; i++) {
        if (boardWithWalls[r + 1 - i * dr][c + 1 - i * dc] === role) consecutiveLine++;
        else break;
    }
    if (consecutiveLine >= 5) return [shapes.FIVE, consecutiveLine];

    if (left.consecutiveSelf + right.consecutiveSelf + 1 === 4) {
        if (left.openEnded && right.openEnded) {
            if ( (left.openEnded && boardWithWalls[r+1- (left.consecutiveSelf+1)*dr][c+1- (left.consecutiveSelf+1)*dc] === 0) &&
                 (right.openEnded && boardWithWalls[r+1+ (right.consecutiveSelf+1)*dr][c+1+ (right.consecutiveSelf+1)*dc] === 0) ) {
                return [shapes.FOUR, 4];
            }
        }
    }

    if (totalSelf === 4) {
        const openEnds = (left.openEnded ? 1:0) + (right.openEnded ? 1:0);
        const hasInternalGap = (left.hasGap || right.hasGap || (left.emptiesEncountered > left.selfCount) || (right.emptiesEncountered > right.selfCount) );

        if (consecutiveLine === 4) {
            if (openEnds === 1) return [shapes.BLOCK_FOUR, 4];
        } else if (!hasInternalGap && totalSelf === 4 && openEnds >=1 ) {
            if (openEnds === 1) return [shapes.BLOCK_FOUR, 4];
        }

        if (totalSelf === 4 && openEnds >= 1) {
            return [shapes.BLOCK_FOUR, 4];
        }
    }

    if (left.consecutiveSelf + right.consecutiveSelf + 1 === 3) {
        if (left.openEnded && right.openEnded) {
            if (boardWithWalls[r+1- (left.consecutiveSelf+1)*dr][c+1- (left.consecutiveSelf+1)*dc] === 0 &&
                boardWithWalls[r+1+ (right.consecutiveSelf+1)*dr][c+1+ (right.consecutiveSelf+1)*dc] === 0) {
                return [shapes.THREE, 3];
            }
        }
    }
    if (totalSelf === 3) {
        const openEnds = (left.openEnded ? 1:0) + (right.openEnded ? 1:0);
        if (openEnds === 2) {
            return [shapes.THREE, 3];
        } else if (openEnds === 1) {
            return [shapes.BLOCK_THREE, 3];
        }
    }

    if (left.consecutiveSelf + right.consecutiveSelf + 1 === 2) {
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

export const isFiveShape = (shape) => {
  return shape === shapes.FIVE;
};

export const isFourShape = (shape) => {
  return shape === shapes.FOUR || shape === shapes.BLOCK_FOUR || shape === shapes.FOUR_FOUR || shape === shapes.FOUR_THREE;
};

export function getAllShapesOfPointFromCache(shapeCache, x, y, role) {
  // ... (rest of getAllShapesOfPointFromCache function as before) ...
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

if (typeof window !== 'undefined') {
    console.log("DEBUG: shape.js - Attaching shapeUtils to window."); // DBG_SHAPE_WINDOW
    window.shapeUtils = {
        shapes: shapes,
        getShapeFast: getShapeFast,
        isFiveShape: isFiveShape,
        isFourShape: isFourShape,
        getAllShapesOfPointFromCache: getAllShapesOfPointFromCache
    };
}
console.log("DEBUG: End of shape.js script evaluation."); // DBG_LOAD_END_SHAPE
