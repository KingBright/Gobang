// Gomoku Utility Functions and Constants

// --- Board Constants ---
const BOARD_SIZE = 15;    // Standard 15x15 board
const EMPTY = 0;          // Represents an empty cell on the board
const PLAYER_BLACK = 1;   // Represents the black player (typically human)
const PLAYER_WHITE = 2;   // Represents the white player (typically AI)

// --- Game State Constants ---
const GAME_STATE_IDLE = 'idle';         // Game hasn't started or is reset
const GAME_STATE_PLAYING = 'playing';   // Game is active
const GAME_STATE_ENDED = 'ended';       // Game has finished (win/draw)
const GAME_STATE_PAUSED = 'paused';     // Game is paused (e.g., AI thinking, modal open)

// --- Game Logic Constants ---
const WINNING_LENGTH = 5; // Number of stones in a row to win

// --- AI Related Constants (can be expanded in ai.js) ---
// Example: const MAX_SEARCH_DEPTH = 5;

// --- DOM Helper Functions ---

/**
 * A simple DOM selector helper.
 * @param {string} selector CSS selector
 * @param {Document|Element} [context=document] The context to search within.
 * @returns {Element|null} The first matching element or null.
 */
function $(selector, context = document) {
    return context.querySelector(selector);
}

/**
 * A simple DOM selector helper for multiple elements.
 * @param {string} selector CSS selector
 * @param {Document|Element} [context=document] The context to search within.
 * @returns {NodeListOf<Element>} A NodeList of matching elements.
 */
function $$(selector, context = document) {
    return context.querySelectorAll(selector);
}

// --- Coordinate and Board Helper Functions ---

/**
 * Checks if the given coordinates (x, y) are within the board boundaries.
 * Assumes 0-indexed coordinates.
 * @param {number} x The x-coordinate (column).
 * @param {number} y The y-coordinate (row).
 * @returns {boolean} True if coordinates are in bounds, false otherwise.
 */
function isInBounds(x, y) {
    return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

/**
 * Helper function to get mouse position relative to a canvas element.
 * This is useful for converting click events to canvas-local coordinates.
 * @param {HTMLCanvasElement} canvas The canvas element.
 * @param {MouseEvent|TouchEvent} evt The mouse or touch event.
 * @returns {{x: number, y: number}} Object with x and y coordinates relative to the canvas.
 */
function getCanvasRelativePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (evt.touches && evt.touches.length > 0) {
        clientX = evt.touches[0].clientX;
        clientY = evt.touches[0].clientY;
    } else {
        clientX = evt.clientX;
        clientY = evt.clientY;
    }

    const scaleX = canvas.width / rect.width;    // Relationship bitmap vs. element for X
    const scaleY = canvas.height / rect.height;  // Relationship bitmap vs. element for Y

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
    // Note: ui.js might handle the conversion from these relative coords to grid coords.
}


/**
 * Creates a deep copy of a 2D array (the game board).
 * @param {Array<Array<number>>} board The board to copy.
 * @returns {Array<Array<number>>} A new 2D array with the same values.
 */
function deepCopyBoard(board) {
    return board.map(row => [...row]);
}


// --- Other Utility Functions ---

/**
 * Generates a random integer between min (inclusive) and max (inclusive).
 * @param {number} min The minimum value.
 * @param {number} max The maximum value.
 * @returns {number} A random integer.
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

console.log("utils.js loaded with enhanced utilities.");

