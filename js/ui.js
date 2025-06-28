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
let omniHints = []; // Stores {x, y, type: 'attack' | 'defend', score: number}

// --- Initialization ---
function initUIInternal() {
    canvas = document.getElementById('gomoku-board');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    ctx = canvas.getContext('2d');
    messageEl = document.getElementById('game-message'); // From index.html

    // Initial canvas setup is triggered by the first call to resizeCanvasInternal
    resizeCanvasInternal(); 

    // Event listeners
    // Note: handleBoardClickInternal will now also need to check for modal clicks
    canvas.addEventListener('click', handleBoardClickInternal);
    // Add touch support for mobile devices
    canvas.addEventListener('touchend', handleBoardClickInternal, { passive: false });


    window.addEventListener('resize', resizeCanvasInternal); // Make canvas responsive

    console.log("UI Initialized (internal). Canvas ready, responsive sizing active.");
}


// --- Canvas Modal Control Functions ---
function showMessageModalInternal(message) {
    isModalVisible = true;
    modalType = 'message';
    modalMessage = message;
    modalButtons = []; // Will be populated by drawModalInternal
    modalOnYes = null; // Not used for message modal
    modalOnNo = null;  // Not used for message modal
    console.log("UI: Showing canvas message modal:", message);
    drawGameInternal(); // Redraw to show modal
}

function showConfirmModalInternal(message, onYesCallback, onNoCallback) {
    isModalVisible = true;
    modalType = 'confirm';
    modalMessage = message;
    modalOnYes = onYesCallback;
    modalOnNo = onNoCallback;
    modalButtons = []; // Will be populated by drawModalInternal
    console.log("UI: Showing canvas confirm modal:", message);
    drawGameInternal(); // Redraw to show modal
}

function closeModalInternal() {
    isModalVisible = false;
    modalType = null;
    modalMessage = "";
    modalOnYes = null;
    modalOnNo = null;
    modalButtons = [];
    drawGameInternal(); // Redraw to hide modal
}

// --- Responsive Canvas Sizing ---
function resizeCanvasInternal() {
    if (!canvas || !document.body) return;

    const controlsPanel = document.getElementById('controls-panel');
    let availableWidth = window.innerWidth - 40; // Base available width (e.g. body padding)
    let availableHeight = window.innerHeight - 40; // Base available height

    // Adjust available space based on layout (desktop vs. mobile)
    // This assumes controls-panel is visible and has dimensions.
    if (window.innerWidth >= 768 && controlsPanel) { // Desktop: controls likely on the side
        availableWidth -= (controlsPanel.offsetWidth + 20); // Subtract controls panel width + some margin
    } else if (controlsPanel) { // Mobile: controls likely below
        availableHeight -= (controlsPanel.offsetHeight + 20); // Subtract controls panel height + some margin
    }
    
    // Ensure a minimum size for usability
    const size = Math.max(15 * 15, Math.min(availableWidth, availableHeight) * 0.95); // Min board size = 15*15px, use 95%
    
    currentCellSize = Math.floor(size / BOARD_SIZE);
    currentStoneRadius = Math.max(5, currentCellSize / 2 * 0.85); // Min radius 5px
    currentBoardDim = currentCellSize * BOARD_SIZE;

    canvas.width = currentBoardDim;
    canvas.height = currentBoardDim;

    console.log(`Canvas resized: ${canvas.width}x${canvas.height}. Cell: ${currentCellSize}px`);
    
    // Redraw game with new dimensions if game is active
    // Check if gameApi exists and game has started
    if (window.gameApi && window.gameApi.getGameState && window.gameApi.getGameState() !== GAME_STATE_IDLE) {
        drawGameInternal();
    } else {
        // If game not started, or gameApi not ready, at least draw the empty grid
        if (ctx) drawBoardGridInternal();
    }
}

// --- Core Drawing Functions ---
function drawGameInternal() {
    if (!ctx || !window.gameApi || !window.gameApi.getBoard) { // Ensure gameApi and getBoard are available
        console.warn("UI: Cannot draw game - context or gameApi not ready.");
        return;
    }
    const board = window.gameApi.getBoard();
    const currentPlayer = window.gameApi.getCurrentPlayer();
    const gameState = window.gameApi.getGameState();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoardGridInternal();
    drawStonesInternal(board);

    // Omniscience Mode hints (full implementation later)
    if (isOmniscienceModeActive && gameState === GAME_STATE_PLAYING && currentPlayer === PLAYER_BLACK) {
        if (window.aiApi && window.aiApi.evaluatePointOmniscience) { // Check if aiApi is ready
            calculateAndDrawOmniHintsInternal(board);
        }
    }
    
    updateGameMessageInternal(currentPlayer, gameState);

    // Draw modal if visible
    if (isModalVisible) {
        drawModalInternal();
    }
}

function drawModalInternal() {
    if (!ctx || !canvas) return;
    modalButtons = []; // Reset buttons before drawing

    // Style constants (can be adjusted for appearance)
    const modalPadding = Math.max(15, currentCellSize * 0.5);
    const modalWidth = Math.min(canvas.width * 0.8, 400); // Max width 400px or 80% of canvas
    const modalMinHeight = currentCellSize * 4;
    const buttonHeight = Math.max(30, currentCellSize * 0.8);
    const buttonPadding = currentCellSize * 0.3;
    const cornerRadius = 10;
    const shadowOffset = 5;
    const fontSize = Math.max(14, currentCellSize * 0.45);

    // Background overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate text height (simple approximation)
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = modalMessage.split('\n');
    const textHeight = lines.length * fontSize * 1.5; // Approximate line height

    // Modal Content box height (dynamic based on text and buttons)
    let modalContentHeight = textHeight + modalPadding * 2;
    if (modalType === 'message' || modalType === 'confirm') {
        modalContentHeight += buttonHeight + buttonPadding; // Space for buttons
    }
    modalContentHeight = Math.max(modalMinHeight, modalContentHeight);

    const modalX = (canvas.width - modalWidth) / 2;
    const modalY = (canvas.height - modalContentHeight) / 2;

    // Modal Shadow (optional, for depth)
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.roundRect(modalX + shadowOffset, modalY + shadowOffset, modalWidth, modalContentHeight, cornerRadius);
    ctx.fill();

    // Modal Background
    ctx.fillStyle = "#f0f0f0"; // Light grey background
    ctx.beginPath();
    ctx.roundRect(modalX, modalY, modalWidth, modalContentHeight, cornerRadius);
    ctx.fill();
    ctx.strokeStyle = "#cccccc"; // Border
    ctx.lineWidth = 1;
    ctx.stroke();


    // Modal Message Text
    ctx.fillStyle = "#333333"; // Dark text color
    let currentTextY = modalY + modalPadding + (fontSize / 2) * lines.length;
    if (lines.length > 1) currentTextY -= (lines.length -1) * fontSize * 0.5; // Adjust for multi-line centering

    lines.forEach((line, index) => {
        ctx.fillText(line, modalX + modalWidth / 2, currentTextY + index * fontSize * 1.3);
    });

    // Buttons
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

    // Button background
    ctx.fillStyle = "#6c757d"; // A pleasant grey, can be themed
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fill();

    // Button text
    ctx.fillStyle = "#ffffff"; // White text
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + width / 2, y + height / 2);

    // Store button info for click detection
    modalButtons.push({ text, x, y, width, height, action });
}


function drawBoardGridInternal() {
    if (!ctx) return;
    ctx.beginPath();
    ctx.strokeStyle = "#4a4a4a"; // Grid line color from style.css
    ctx.lineWidth = Math.max(1, Math.floor(currentCellSize / 25)); // Dynamic line width

    for (let i = 0; i < BOARD_SIZE; i++) {
        // Offset by half a pixel for sharper lines if lineWidth is odd.
        const lineOffset = (ctx.lineWidth % 2 === 0) ? 0 : 0.5; 
        const pos = Math.floor(currentCellSize / 2 + i * currentCellSize) + lineOffset;
        
        // Vertical lines
        ctx.moveTo(pos, Math.floor(currentCellSize / 2) + lineOffset);
        ctx.lineTo(pos, Math.floor(currentBoardDim - currentCellSize / 2) + lineOffset);
        // Horizontal lines
        ctx.moveTo(Math.floor(currentCellSize / 2) + lineOffset, pos);
        ctx.lineTo(Math.floor(currentBoardDim - currentCellSize / 2) + lineOffset, pos);
    }
    ctx.stroke();

    // Star points (traditional Gomoku styling)
    if (BOARD_SIZE === 15) { // Only for 15x15 board
        const starPoints = [ { x: 3, y: 3 }, { x: 11, y: 3 }, { x: 3, y: 11 }, { x: 11, y: 11 }, { x: 7, y: 7 } ];
        ctx.fillStyle = "#333"; // Star point color
        starPoints.forEach(p => {
            ctx.beginPath();
            ctx.arc(
                currentCellSize / 2 + p.x * currentCellSize,
                currentCellSize / 2 + p.y * currentCellSize,
                Math.max(2, currentCellSize / 10), 0, 2 * Math.PI // Dynamic star point size
            );
            ctx.fill();
        });
    }
}

function drawStonesInternal(board) {
    if (!ctx || !board) return;
    for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            if (board[y][x] !== EMPTY) {
                drawStoneInternal(x, y, board[y][x]);
            }
        }
    }
}

function drawStoneInternal(x, y, player) {
    if (!ctx) return;
    const canvasX = currentCellSize / 2 + x * currentCellSize;
    const canvasY = currentCellSize / 2 + y * currentCellSize;

    ctx.beginPath();
    ctx.arc(canvasX, canvasY, currentStoneRadius, 0, 2 * Math.PI);
    ctx.fillStyle = (player === PLAYER_BLACK) ? '#1a1a1a' : '#f0f0f0'; // Slightly off-black/white for better visuals
    ctx.fill();

    // Add a subtle border to white stones to make them more distinct, especially on light board backgrounds
    if (player === PLAYER_WHITE) {
        ctx.strokeStyle = '#cccccc'; // Light grey border for white stones
        ctx.lineWidth = Math.max(1, Math.floor(currentCellSize / 20)); // Dynamic border width
        ctx.stroke();
    }
}

// --- Event Handling ---
function handleBoardClickInternal(event) {
    event.preventDefault(); // Crucial for touchend to prevent ghost clicks and scrolling
    if (!canvas || !ctx) return;

    const { x: canvasX, y: canvasY } = getCanvasRelativePos(canvas, event);

    if (isModalVisible) {
        // Handle modal button clicks
        for (const button of modalButtons) {
            if (canvasX >= button.x && canvasX <= button.x + button.width &&
                canvasY >= button.y && canvasY <= button.y + button.height) {

                console.log(`UI: Modal button clicked: ${button.action}`);
                closeModalInternal(); // Close modal on any button click first

                if (button.action === 'yes' && modalOnYes) {
                    modalOnYes();
                } else if (button.action === 'no' && modalOnNo) {
                    modalOnNo();
                }
                // 'close' action simply closes the modal, which is already done.
                return; // Stop further processing
            }
        }
        // If click is outside buttons but modal is visible, do nothing (consume click)
        return;
    }

    // If modal is not visible, proceed with game board click logic
    if (!window.gameApi || !window.gameApi.getGameState || window.gameApi.getGameState() !== GAME_STATE_PLAYING) return;
    
    // Ensure it's human player's turn (assuming human is PLAYER_BLACK)
    if (window.gameApi.getCurrentPlayer() !== PLAYER_BLACK) {
        console.log("UI: Not human player's turn.");
        return;
    }
    
    const boardX = Math.floor(canvasX / currentCellSize);
    const boardY = Math.floor(canvasY / currentCellSize);

    if (isInBounds(boardX, boardY)) { // isInBounds from utils.js
        console.log(`UI: Click/Touch on board -> Grid (${boardX}, ${boardY})`);
        // Delegate the move to main.js which will orchestrate game logic
        if (window.handleHumanMove) { 
            window.handleHumanMove(boardX, boardY);
        } else {
            console.error("UI Error: window.handleHumanMove function is not defined in main.js");
        }
    }
}

// --- UI Updates ---
function updateGameMessageInternal(currentPlayer, gameState) {
    if (!messageEl || !window.gameApi || !window.gameApi.checkWin) return; // Ensure dependent APIs are available
    
    let message = "";
    if (gameState === GAME_STATE_ENDED) {
        const history = window.gameApi.getMoveHistory();
        const lastMove = history.length > 0 ? history[history.length - 1] : null;
        
        // Check win condition using gameApi.checkWin for accuracy
        if (lastMove && window.gameApi.checkWin(lastMove.x, lastMove.y)) {
            message = `玩家 ${lastMove.player === PLAYER_BLACK ? '黑棋' : '白棋'} 胜利!`; // Player Black/White wins!
        } else if (history.length === BOARD_SIZE * BOARD_SIZE) {
            message = "平局!"; // It's a draw!
        } else {
            // This case might occur if game ended for other reasons or state is inconsistent
            message = "游戏结束!"; // Game Over!
        }
    } else if (gameState === GAME_STATE_PLAYING) {
        message = `轮到 ${currentPlayer === PLAYER_BLACK ? '黑棋' : '白棋'} 行棋`; // Player Black/White's turn
    } else if (gameState === GAME_STATE_PAUSED) {
        message = "AI 思考中..."; // AI is thinking...
    } else if (gameState === GAME_STATE_IDLE) {
        message = "欢迎来到五子棋! 请选择选项开始新游戏。"; // Welcome to Gomoku! Select options and click New Game.
    } else {
        message = "五子棋AI训练器"; // Gomoku AI Trainer (Default or unknown state)
    }
    messageEl.textContent = message;
}

// --- Omniscience Mode UI (Placeholder for actual hint calculation, full implementation in Phase 3) ---
function toggleOmniscienceModeInternal(isActive) {
    isOmniscienceModeActive = isActive;
    console.log(`UI: Omniscience Mode toggled to ${isOmniscienceModeActive}`);
    drawGameInternal(); // Redraw to show/hide hints if game is active
}

function calculateAndDrawOmniHintsInternal(board) {
    if (!isOmniscienceModeActive || !ctx || !window.aiApi || !window.aiApi.evaluatePointOmniscience) return;
    omniHints = []; // Clear previous hints

    // Placeholder: In Phase 3, this will iterate empty cells and call aiApi.evaluatePointOmniscience
    // For now, just log that it would be calculating.
    // console.log("UI: Calculating Omniscience hints (placeholder).");

    drawOmniHintsInternal();
}

function drawOmniHintsInternal() {
    if (!ctx || !omniHints.length) return;
    // Example drawing logic (actual drawing based on scores in Phase 3)
    omniHints.forEach(hint => {
        const canvasX = currentCellSize / 2 + hint.x * currentCellSize;
        const canvasY = currentCellSize / 2 + hint.y * currentCellSize;
        ctx.beginPath();
        ctx.strokeStyle = hint.type === 'attack' ? 'rgba(0, 200, 0, 0.6)' : 'rgba(200, 0, 0, 0.6)'; // Green/Red
        ctx.lineWidth = Math.max(1, currentCellSize / 15);
        // Draw a small circle or square as a hint
        ctx.rect(
            canvasX - currentStoneRadius / 2, 
            canvasY - currentStoneRadius / 2, 
            currentStoneRadius, 
            currentStoneRadius
        );
        ctx.stroke();
    });
}

// --- Smart Undo UI (Modal - Placeholder for now, full implementation in Phase 3) ---
// This function now uses the new showConfirmModalInternal
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
    showSmartUndoModal: showSmartUndoModalInternal, // For smart undo risk
    showGameMessageModal: showMessageModalInternal // For win/loss/draw messages
    // resizeCanvas is self-managed via event listener
};

console.log("ui.js loaded and API exposed via window.uiApi. Responsive canvas enabled.");

// Sanity checks for dependencies (constants and functions from utils.js)
if (typeof getCanvasRelativePos !== 'function' || typeof isInBounds !== 'function' || typeof PLAYER_BLACK === 'undefined' || typeof GAME_STATE_IDLE === 'undefined') {
    console.error("UI Error: Critical functions or constants from utils.js might not be loaded or available.");
}

