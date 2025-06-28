// Gomoku Game Logic

// --- Module-scoped State Variables ---
let board = [];
let currentPlayer = PLAYER_BLACK; // Black (human) typically starts
let humanPlayer = PLAYER_BLACK;   // Stores the color chosen by the human player
let gameState = GAME_STATE_IDLE;  // Initial state
let moveHistory = [];             // Stack of moves: {x, y, player}

// --- Game Initialization and Reset ---
/**
 * Initializes or resets the game to its starting state.
 * @param {number} humanPlayerRole - The role chosen by the human player (PLAYER_BLACK or PLAYER_WHITE).
 */
function initGameInternal(humanPlayerRole) {
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));

    if (humanPlayerRole === PLAYER_BLACK || humanPlayerRole === PLAYER_WHITE) {
        humanPlayer = humanPlayerRole;
    } else {
        console.warn(`Invalid humanPlayerRole '${humanPlayerRole}' in initGame. Defaulting to PLAYER_BLACK.`);
        humanPlayer = PLAYER_BLACK;
    }

    currentPlayer = PLAYER_BLACK; // Black always makes the first move.
    gameState = GAME_STATE_PLAYING;
    moveHistory = [];
    console.log(`Game initialized. Human player is ${humanPlayer === PLAYER_BLACK ? 'Black' : 'White'}. Current turn: Player Black.`);
}

// --- Core Game Actions ---

/**
 * Attempts to make a move on the board for the currentPlayer.
 * Does NOT switch the player; player switching is handled by main.js.
 * @param {number} x The x-coordinate (column) of the move.
 * @param {number} y The y-coordinate (row) of the move.
 * @returns {boolean} True if the move was successful and board updated, false otherwise.
 */
function makeMoveInternal(x, y) { // Renamed
    if (gameState !== GAME_STATE_PLAYING) {
        console.warn(`Cannot make move: Game state is ${gameState}.`);
        return false;
    }
    if (!isInBounds(x, y)) { // isInBounds from utils.js
        console.warn(`Invalid move: (${x},${y}) is out of bounds.`);
        return false;
    }
    if (board[y][x] !== EMPTY) {
        console.warn(`Invalid move: Cell (${x},${y}) is already occupied by player ${board[y][x]}.`);
        return false;
    }

    board[y][x] = currentPlayer;
    moveHistory.push({ x, y, player: currentPlayer });
    console.log(`Move recorded for player ${currentPlayer} at (${x}, ${y}). History size: ${moveHistory.length}`);

    if (checkWinInternal(x, y)) { // Renamed
        gameState = GAME_STATE_ENDED;
        console.log(`Player ${currentPlayer} wins! Game ended.`);
    } else if (moveHistory.length === BOARD_SIZE * BOARD_SIZE) {
        gameState = GAME_STATE_ENDED;
        console.log("Board is full. Game is a draw!");
    }
    return true;
}

/**
 * Checks for a win condition starting from the last move (x, y).
 * @param {number} x The x-coordinate of the last move.
 * @param {number} y The y-coordinate of the last move.
 * @returns {boolean} True if the player who made the move at (x,y) wins, false otherwise.
 */
function checkWinInternal(x, y) { // Renamed
    const player = board[y][x];
    if (player === EMPTY) return false;

    const directions = [
        { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }
    ];

    for (const { dx, dy } of directions) {
        let count = 1;
        for (let i = 1; i < WINNING_LENGTH; i++) {
            const newX = x + i * dx;
            const newY = y + i * dy;
            if (isInBounds(newX, newY) && board[newY][newX] === player) count++; else break;
        }
        for (let i = 1; i < WINNING_LENGTH; i++) {
            const newX = x - i * dx;
            const newY = y - i * dy;
            if (isInBounds(newX, newY) && board[newY][newX] === player) count++; else break;
        }
        if (count >= WINNING_LENGTH) return true;
    }
    return false;
}

/**
 * Undoes the single last move from the move history.
 * Sets `currentPlayer` to be the player who made the undone move.
 * @returns {boolean} True if a move was undone, false if history was empty.
 */
function undoMoveInternal() { // Renamed
    if (moveHistory.length === 0) {
        console.log("No moves in history to undo.");
        return false;
    }

    const lastMove = moveHistory.pop();
    board[lastMove.y][lastMove.x] = EMPTY;
    
    console.log(`Undid move by player ${lastMove.player} at (${lastMove.x}, ${lastMove.y}). History size: ${moveHistory.length}`);

    if (gameState === GAME_STATE_ENDED) {
        gameState = GAME_STATE_PLAYING; 
    }
    
    currentPlayer = lastMove.player; 
    console.log(`Game state after undo: ${gameState}, Current player: ${currentPlayer}`);
    return true;
}

// --- State Getters (internal names) ---
function getBoardInternal() { return deepCopyBoard(board); } // deepCopyBoard from utils.js
function getCurrentPlayerInternal() { return currentPlayer; }
function getGameStateInternal() { return gameState; }
function getMoveHistoryInternal() { return [...moveHistory]; }
function getHumanPlayerInternal() { return humanPlayer; } // Getter for humanPlayer

// --- State Setters (internal names, for controlled modification) ---
function setCurrentPlayerInternal(playerID) {
    if (playerID === PLAYER_BLACK || playerID === PLAYER_WHITE) {
        currentPlayer = playerID;
    } else {
        console.error(`Invalid player ID for setCurrentPlayer: ${playerID}`);
    }
}

function setGameStateInternal(newGameState) {
    // Basic validation against known states from utils.js
    const validStates = [GAME_STATE_IDLE, GAME_STATE_PLAYING, GAME_STATE_ENDED, GAME_STATE_PAUSED];
    if (validStates.includes(newGameState)) {
        gameState = newGameState;
    } else {
        console.error(`Invalid game state for setGameState: ${newGameState}`);
    }
}

// Exposing functions to main.js and other modules via window.gameApi
// This makes it clear what is intended for external use.
window.gameApi = {
    initGame: initGameInternal,
    makeMove: makeMoveInternal,
    undoMove: undoMoveInternal,
    getBoard: getBoardInternal,
    getCurrentPlayer: getCurrentPlayerInternal,
    getGameState: getGameStateInternal,
    getMoveHistory: getMoveHistoryInternal,
    getHumanPlayer: getHumanPlayerInternal, // Expose the new getter
    setCurrentPlayer: setCurrentPlayerInternal,
    setGameState: setGameStateInternal,
    checkWin: checkWinInternal // Exposing checkWin for potential use by AI/UI for quick checks
};

console.log("game.js loaded and API exposed via window.gameApi.");
// Ensure utils.js is loaded before this script if using its functions directly like isInBounds or deepCopyBoard
// The order in index.html should handle this: utils.js, then game.js
if (typeof isInBounds !== 'function' || typeof deepCopyBoard !== 'function') {
    console.error("utils.js might not be loaded correctly or functions are missing.");
}

