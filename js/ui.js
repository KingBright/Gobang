// Gomoku UI Rendering and Interaction

// --- Module-scoped Variables ---
let canvas, ctx;
let messageEl; // For the inline game message

// Canvas-based Modal state
let isModalVisible = false;
let modalType = null; // 'message' or 'confirm'
let modalMessage = "";
let modalOnYes = null;
let modalOnNo = null;
let modalButtons = []; // Array of {text, x, y, width, height, action}

// Dynamic drawing parameters, will be updated by resizeCanvasInternal
let currentCellSize = 30; // Default, will be recalculated
let currentStoneRadius = currentCellSize / 2 * 0.85; // Default
let currentBoardDim = currentCellSize * BOARD_SIZE; // Default

// Omniscience Mode Visuals (dependent on currentCellSize)
let isOmniscienceModeActive = false;
let omniHints = []; // Stores {x, y, score: number, type: string}

// Local approximation of pattern scores for UI decisions if not directly accessible
const localPatternScoreRefs = {
    LIVE_FOUR: 10000, // From PATTERN_SCORES in ai.worker.js
    LIVE_THREE: 1000, // From PATTERN_SCORES in ai.worker.js
    // Add others if needed for more nuanced hint styling
};


// --- Initialization ---
function initUIInternal() {
    canvas = document.getElementById('gomoku-board');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    ctx = canvas.getContext('2d');
    messageEl = document.getElementById('game-message'); // From index.html

    resizeCanvasInternal(); 

    canvas.addEventListener('click', handleBoardClickInternal);
    canvas.addEventListener('touchend', handleBoardClickInternal, { passive: false });
    window.addEventListener('resize', resizeCanvasInternal);

    console.log("UI Initialized (internal). Canvas ready, responsive sizing active.");
}


// --- Canvas Modal Control Functions ---

// Helper to manage external button states
const controlButtonIds = ['new-game-btn', 'undo-btn', 'ai-difficulty', 'omniscience-mode'];
function setExternalControlsDisabled(disabled) {
    controlButtonIds.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.disabled = disabled;
        }
    });
}

function showMessageModalInternal(message) {
    isModalVisible = true;
    modalType = 'message';
    modalMessage = message;
    modalButtons = [];
    modalOnYes = null;
    modalOnNo = null;
    setExternalControlsDisabled(true); // Disable HTML buttons
    console.log("UI: Showing canvas message modal:", message);
    drawGameInternal();
}

function showConfirmModalInternal(message, onYesCallback, onNoCallback) {
    isModalVisible = true;
    modalType = 'confirm';
    modalMessage = message;
    modalOnYes = onYesCallback;
    modalOnNo = onNoCallback;
    modalButtons = [];
    setExternalControlsDisabled(true); // Disable HTML buttons for confirm modal too
    console.log("UI: Showing canvas confirm modal:", message);
    drawGameInternal();
}

function closeModalInternal() {
    if (isModalVisible) { // Only re-enable if a modal was actually visible
        setExternalControlsDisabled(false); // Re-enable HTML buttons
    }
    isModalVisible = false;
    modalType = null;
    modalMessage = "";
    modalOnYes = null;
    modalOnNo = null;
    modalButtons = [];
    drawGameInternal();
}

// --- Responsive Canvas Sizing ---
function resizeCanvasInternal() {
    if (!canvas || !document.body) return;

    const controlsPanel = document.getElementById('controls-panel');
    let availableWidth = window.innerWidth - 40;
    let availableHeight = window.innerHeight - 40;

    if (window.innerWidth >= 768 && controlsPanel) {
        availableWidth -= (controlsPanel.offsetWidth + 20);
    } else if (controlsPanel) {
        availableHeight -= (controlsPanel.offsetHeight + 20);
    }
    
    const size = Math.max(15 * 15, Math.min(availableWidth, availableHeight) * 0.95);
    
    currentCellSize = Math.floor(size / BOARD_SIZE);
    currentStoneRadius = Math.max(5, currentCellSize / 2 * 0.85);
    currentBoardDim = currentCellSize * BOARD_SIZE;

    canvas.width = currentBoardDim;
    canvas.height = currentBoardDim;

    console.log(`Canvas resized: ${canvas.width}x${canvas.height}. Cell: ${currentCellSize}px`);
    
    if (window.gameApi && window.gameApi.getGameState && window.gameApi.getGameState() !== GAME_STATE_IDLE) {
        drawGameInternal();
    } else {
        if (ctx) drawBoardGridInternal();
    }
}

// --- Core Drawing Functions ---
function drawGameInternal() {
    if (!ctx || !window.gameApi || !window.gameApi.getBoard) {
        console.warn("UI: Cannot draw game - context or gameApi not ready.");
        return;
    }
    const board = window.gameApi.getBoard();
    const currentPlayer = window.gameApi.getCurrentPlayer();
    const gameState = window.gameApi.getGameState();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoardGridInternal();
    drawStonesInternal(board);

    // Omniscience Mode: Call to calculate if active, or draw existing hints
    // calculateAndDrawOmniHintsInternal is now async and handles its own drawing upon completion
    if (isOmniscienceModeActive) {
        // If hints are already populated (e.g. by toggle or previous calculation), draw them.
        // The main calculation is triggered by toggleOmniscienceModeInternal.
        // This ensures hints persist during simple redraws not involving state change for hints.
        drawOmniHintsInternal();
    }
    
    updateGameMessageInternal(currentPlayer, gameState);

    if (isModalVisible) {
        drawModalInternal();
    }
}

function drawModalInternal() {
    if (!ctx || !canvas) return;
    modalButtons = [];

    const modalPadding = Math.max(15, currentCellSize * 0.5);
    const modalWidth = Math.min(canvas.width * 0.8, 400);
    const modalMinHeight = currentCellSize * 4;
    const buttonHeight = Math.max(30, currentCellSize * 0.8);
    const buttonPadding = currentCellSize * 0.3;
    const cornerRadius = 10;
    const shadowOffset = 5;
    const fontSize = Math.max(14, currentCellSize * 0.45);

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = modalMessage.split('\n');
    const textHeight = lines.length * fontSize * 1.5;

    let modalContentHeight = textHeight + modalPadding * 2;
    if (modalType === 'message' || modalType === 'confirm') {
        modalContentHeight += buttonHeight + buttonPadding;
    }
    modalContentHeight = Math.max(modalMinHeight, modalContentHeight);

    const modalX = (canvas.width - modalWidth) / 2;
    const modalY = (canvas.height - modalContentHeight) / 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.roundRect(modalX + shadowOffset, modalY + shadowOffset, modalWidth, modalContentHeight, cornerRadius);
    ctx.fill();

    ctx.fillStyle = "#f0f0f0";
    ctx.beginPath();
    ctx.roundRect(modalX, modalY, modalWidth, modalContentHeight, cornerRadius);
    ctx.fill();
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#333333";
    let currentTextY = modalY + modalPadding + (fontSize / 2) * lines.length;
    if (lines.length > 1) currentTextY -= (lines.length -1) * fontSize * 0.5;

    lines.forEach((line, index) => {
        ctx.fillText(line, modalX + modalWidth / 2, currentTextY + index * fontSize * 1.3);
    });

    const buttonY = modalY + modalContentHeight - modalPadding - buttonHeight;
    if (modalType === 'message') {
        const closeButtonWidth = modalWidth * 0.4;
        const closeButtonX = modalX + (modalWidth - closeButtonWidth) / 2;
        drawModalButtonInternal("关闭", closeButtonX, buttonY, closeButtonWidth, buttonHeight, 'close');
    } else if (modalType === 'confirm') {
        const buttonWidth = modalWidth * 0.35;
        const spaceBetweenButtons = modalWidth * 0.1;
        const yesButtonX = modalX + (modalWidth / 2) - buttonWidth - (spaceBetweenButtons / 2);
        const noButtonX = modalX + (modalWidth / 2) + (spaceBetweenButtons / 2);

        drawModalButtonInternal("是", yesButtonX, buttonY, buttonWidth, buttonHeight, 'yes');
        drawModalButtonInternal("否", noButtonX, buttonY, buttonWidth, buttonHeight, 'no');
    }
}

function drawModalButtonInternal(text, x, y, width, height, action) {
    if (!ctx) return;
    const cornerRadius = 5;
    const fontSize = Math.max(14, currentCellSize * 0.4);

    ctx.fillStyle = "#6c757d";
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + width / 2, y + height / 2);

    modalButtons.push({ text, x, y, width, height, action });
}


function drawBoardGridInternal() {
    if (!ctx) return;
    ctx.beginPath();
    ctx.strokeStyle = "#4a4a4a";
    ctx.lineWidth = Math.max(1, Math.floor(currentCellSize / 25));

    for (let i = 0; i < BOARD_SIZE; i++) {
        const lineOffset = (ctx.lineWidth % 2 === 0) ? 0 : 0.5; 
        const pos = Math.floor(currentCellSize / 2 + i * currentCellSize) + lineOffset;
        
        ctx.moveTo(pos, Math.floor(currentCellSize / 2) + lineOffset);
        ctx.lineTo(pos, Math.floor(currentBoardDim - currentCellSize / 2) + lineOffset);
        ctx.moveTo(Math.floor(currentCellSize / 2) + lineOffset, pos);
        ctx.lineTo(Math.floor(currentBoardDim - currentCellSize / 2) + lineOffset, pos);
    }
    ctx.stroke();

    if (BOARD_SIZE === 15) {
        const starPoints = [ { x: 3, y: 3 }, { x: 11, y: 3 }, { x: 3, y: 11 }, { x: 11, y: 11 }, { x: 7, y: 7 } ];
        ctx.fillStyle = "#333";
        starPoints.forEach(p => {
            ctx.beginPath();
            ctx.arc(
                currentCellSize / 2 + p.x * currentCellSize,
                currentCellSize / 2 + p.y * currentCellSize,
                Math.max(2, currentCellSize / 10), 0, 2 * Math.PI
            );
            ctx.fill();
        });
    }
}

function drawStonesInternal(board) {
    if (!ctx || !board) return;

    const moveHistory = window.gameApi && window.gameApi.getMoveHistory ? window.gameApi.getMoveHistory() : [];
    const lastMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;

    for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            if (board[y][x] !== EMPTY) {
                let isLast = false;
                if (lastMove && lastMove.x === x && lastMove.y === y) {
                    isLast = true;
                }
                drawStoneInternal(x, y, board[y][x], isLast); // Pass isLast flag
            }
        }
    }
}

function drawStoneInternal(x, y, player, isLastMove = false) { // Added isLastMove parameter
    if (!ctx) return;
    const canvasX = currentCellSize / 2 + x * currentCellSize;
    const canvasY = currentCellSize / 2 + y * currentCellSize;

    ctx.beginPath();
    ctx.arc(canvasX, canvasY, currentStoneRadius, 0, 2 * Math.PI);
    ctx.fillStyle = (player === PLAYER_BLACK) ? '#1a1a1a' : '#f0f0f0';
    ctx.fill();

    if (player === PLAYER_WHITE) {
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = Math.max(1, Math.floor(currentCellSize / 20));
        ctx.stroke();
    }

    // Highlight for the last move
    if (isLastMove) {
        ctx.beginPath();
        const dotRadius = Math.max(1, currentStoneRadius * 0.25); // Ensure dot is visible
        // Use a color that contrasts well with both black and white stones
        // A bright red or orange often works.
        // If using a dot, its color should contrast with the stone it's on.
        ctx.fillStyle = (player === PLAYER_BLACK) ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'; // White dot on black, black dot on white
        // For a more prominent marker, consider a fixed color like red:
        // ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.arc(canvasX, canvasY, dotRadius, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// --- Event Handling ---
function handleBoardClickInternal(event) {
    event.preventDefault();
    if (!canvas || !ctx) return;

    const { x: canvasX, y: canvasY } = getCanvasRelativePos(canvas, event);

    if (isModalVisible) {
        for (const button of modalButtons) {
            if (canvasX >= button.x && canvasX <= button.x + button.width &&
                canvasY >= button.y && canvasY <= button.y + button.height) {
                console.log(`UI: Modal button clicked: ${button.action}`);
                closeModalInternal();
                if (button.action === 'yes' && modalOnYes) modalOnYes();
                else if (button.action === 'no' && modalOnNo) modalOnNo();
                return;
            }
        }
        return;
    }

    if (!window.gameApi || !window.gameApi.getGameState || window.gameApi.getGameState() !== GAME_STATE_PLAYING) return;
    if (window.gameApi.getCurrentPlayer() !== PLAYER_BLACK) {
        console.log("UI: Not human player's turn.");
        return;
    }
    
    const boardX = Math.floor(canvasX / currentCellSize);
    const boardY = Math.floor(canvasY / currentCellSize);

    if (isInBounds(boardX, boardY)) {
        console.log(`UI: Click/Touch on board -> Grid (${boardX}, ${boardY})`);
        if (window.handleHumanMove) { 
            window.handleHumanMove(boardX, boardY);
        } else {
            console.error("UI Error: window.handleHumanMove function is not defined in main.js");
        }
    }
}

// --- UI Updates ---
function updateGameMessageInternal(currentPlayer, gameState) {
    if (!messageEl || !window.gameApi || !window.gameApi.checkWin) return;
    
    let message = "";
    if (gameState === GAME_STATE_ENDED) {
        const history = window.gameApi.getMoveHistory();
        const lastMove = history.length > 0 ? history[history.length - 1] : null;
        
        if (lastMove && window.gameApi.checkWin(lastMove.x, lastMove.y)) {
            message = `玩家 ${lastMove.player === PLAYER_BLACK ? '黑棋' : '白棋'} 胜利!`;
        } else if (history.length === BOARD_SIZE * BOARD_SIZE) {
            message = "平局!";
        } else {
            message = "游戏结束!";
        }
    } else if (gameState === GAME_STATE_PLAYING) {
        message = `轮到 ${currentPlayer === PLAYER_BLACK ? '黑棋' : '白棋'} 行棋`;
    } else if (gameState === GAME_STATE_PAUSED) {
        message = "AI 思考中...";
    } else if (gameState === GAME_STATE_IDLE) {
        message = "欢迎来到五子棋! 请选择选项开始新游戏。";
    } else {
        message = "五子棋AI训练器";
    }
    messageEl.textContent = message;
}

// --- Omniscience Mode UI ---
function toggleOmniscienceModeInternal(isActive) {
    isOmniscienceModeActive = isActive;
    console.log(`UI: Omniscience Mode toggled to ${isOmniscienceModeActive}`);

    if (isOmniscienceModeActive) {
        const board = window.gameApi.getBoard();
        const gameState = window.gameApi.getGameState();
        const currentPlayer = window.gameApi.getCurrentPlayer();
        // Only calculate hints if game is playing and it's human's turn (PLAYER_BLACK)
        if (gameState === GAME_STATE_PLAYING && currentPlayer === PLAYER_BLACK) {
            calculateAndDrawOmniHintsInternal(board); // This is async now
        } else {
            omniHints = [];
            drawGameInternal(); // Redraw to clear any existing hints
        }
    } else {
        omniHints = []; // Clear hints when turning off
        drawGameInternal(); // Redraw to remove hints
    }
}

function calculateAndDrawOmniHintsInternal(board) {
    if (!isOmniscienceModeActive || !ctx || !window.aiApi || !window.aiApi.evaluateAllPointsForOmniscience) {
        omniHints = [];
        drawOmniHintsInternal();
        return;
    }

    // Omniscience hints are always from the perspective of the human player (PLAYER_BLACK)
    const playerForOmniscience = PLAYER_BLACK;

    console.log("UI: Requesting Omniscience hints from AI (perspective: PLAYER_BLACK).");
    omniHints = []; // Clear old hints immediately, a loading state could be set here
    // messageEl.textContent = "全知模式：计算提示中..."; // Example loading message

    window.aiApi.evaluateAllPointsForOmniscience(board, playerForOmniscience)
        .then(evaluatedHints => {
            console.log("UI: Received omniscience hints:", evaluatedHints);
            if (!isOmniscienceModeActive) return; // Mode might have been turned off

            // Hints are now directly in the format {x, y, patternType, hintCategory}
            // No need to process score or old types like 'critical' or 'strong_suggestion'.
            // Also, no need to slice to top 5, we want all relevant markers.
            omniHints = evaluatedHints;

            // Restore game message or indicate hints are ready
            // updateGameMessageInternal(window.gameApi.getCurrentPlayer(), window.gameApi.getGameState());
            console.log(`UI: Received ${omniHints.length} hints for drawing from AI.`);
            drawGameInternal(); // Redraw with new hints
        })
        .catch(error => {
            console.error("UI: Error getting omniscience hints:", error);
            omniHints = [];
            // updateGameMessageInternal(window.gameApi.getCurrentPlayer(), window.gameApi.getGameState());
            // messageEl.textContent += " (提示获取失败)";
            drawGameInternal();
        });
}

function drawOmniHintsInternal() {
    if (!ctx || !omniHints || omniHints.length === 0) {
        // console.log("UI: No omni hints to draw or context not ready.");
        return;
    }
    console.log("UI: Drawing omniscience hints:", omniHints.length);

    omniHints.forEach(hint => {
        const canvasX = currentCellSize / 2 + hint.x * currentCellSize;
        const canvasY = currentCellSize / 2 + hint.y * currentCellSize;
        const markerRadius = currentStoneRadius * 0.5; // Smaller than a stone
        const lineWidth = Math.max(2, currentCellSize / 15);

        ctx.beginPath();
        ctx.lineWidth = lineWidth;

        if (hint.hintCategory === HINT_TYPE_PLAYER_OPPORTUNITY) {
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)'; // Green for player opportunities
        } else if (hint.hintCategory === HINT_TYPE_OPPONENT_THREAT) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; // Red for opponent threats
        } else {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'; // Default/fallback (should not happen)
        }

        // Draw a simple circle marker. Can be changed to square or other shapes.
        // Example: Small circle outline
        ctx.arc(canvasX, canvasY, markerRadius, 0, 2 * Math.PI);
        ctx.stroke();

        // Example: Small square marker (alternative)
        // const sideLength = markerRadius * 1.5;
        // ctx.strokeRect(canvasX - sideLength / 2, canvasY - sideLength / 2, sideLength, sideLength);

        // Optional: Add text for pattern type if needed for debugging or more detail, but problem asks to remove other hints
        // if (DEBUG_MODE) { // Assuming a global DEBUG_MODE for this
        //    ctx.fillStyle = ctx.strokeStyle; // use same color as stroke
        //    ctx.font = `${Math.max(8, currentCellSize * 0.2)}px Arial`;
        //    ctx.textAlign = 'center';
        //    ctx.textBaseline = 'bottom';
        //    let shortPattern = hint.patternType.replace('pattern_type_', '').substring(0,3).toUpperCase();
        //    if (hint.patternType === PATTERN_TYPE_FIVE_IN_A_ROW) shortPattern = "WIN";
        //    if (hint.patternType === PATTERN_TYPE_LINE_OF_FOUR) shortPattern = "L4";
        //    if (hint.patternType === PATTERN_TYPE_DOUBLE_THREE) shortPattern = "D3";
        //    if (hint.patternType === PATTERN_TYPE_THREE_FOUR) shortPattern = "34";
        //    if (hint.patternType === PATTERN_TYPE_DOUBLE_FOUR) shortPattern = "D4";
        //    ctx.fillText(shortPattern, canvasX, canvasY - markerRadius - 2);
        // }

    });
}

// --- Smart Undo UI (Modal) ---
function showSmartUndoModalInternal(onConfirmCallback, onUndoCallback) {
    const message = "警告: 此步有风险!\n对手下一步可能获胜。\n\n您确定要下这一步，还是悔棋?";
    console.log("UI: Smart Undo - Displaying risk prompt using custom modal.");
    showConfirmModalInternal(message, onConfirmCallback, onUndoCallback);
}

// --- API Exposure for main.js ---
window.uiApi = {
    initUI: initUIInternal,
    drawGame: drawGameInternal,
    toggleOmniscienceMode: toggleOmniscienceModeInternal,
    showSmartUndoModal: showSmartUndoModalInternal,
    showGameMessageModal: showMessageModalInternal,
    triggerOmniscienceUpdateIfActive: function() { // Expose the trigger function
        if (isOmniscienceModeActive) {
            const board = window.gameApi.getBoard();
            const gameState = window.gameApi.getGameState();
        // Hints should update if mode is active and game is playing, regardless of whose turn it is.
        // The perspective for hints is always for the human player (PLAYER_BLACK).
        if (gameState === GAME_STATE_PLAYING) {
                console.log("UI: Externally triggered omniscience update.");
            // Pass the board, calculateAndDrawOmniHintsInternal will handle using PLAYER_BLACK perspective
            calculateAndDrawOmniHintsInternal(board);
            }
        }
    }
};

console.log("ui.js loaded and API exposed via window.uiApi. Responsive canvas enabled.");

if (typeof getCanvasRelativePos !== 'function' || typeof isInBounds !== 'function' || typeof PLAYER_BLACK === 'undefined' || typeof GAME_STATE_IDLE === 'undefined') {
    console.error("UI Error: Critical functions or constants from utils.js might not be loaded or available.");
}

