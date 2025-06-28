// Gomoku Main Application Logic - Orchestrator

// --- Global References to APIs (set in window.onload) ---
let gameApi, uiApi, aiApi; // aiApi will be used when ai.js is fully integrated

// --- Initialization ---
window.onload = () => {
    console.log("Main.js: Window loaded. Initializing application...");

    // Ensure APIs from other modules are available
    if (!window.gameApi || !window.uiApi ) { // aiApi check will be added later
        console.error("Main.js Error: One or more module APIs (gameApi, uiApi) are not available. Check script loading order and API exposure in game.js and ui.js.");
        const body = document.querySelector('body');
        if (body) {
            body.innerHTML = '<p style="color:red; text-align:center; font-size:18px; margin-top: 50px;">Error: Application failed to load critical components. Please check the console for details.</p>';
        }
        return;
    }
    gameApi = window.gameApi;
    uiApi = window.uiApi;
    // Assign aiApi if available
    if (window.aiApi) {
        aiApi = window.aiApi;
        console.log("Main.js: aiApi successfully loaded.");
    } else {
        console.warn("Main.js: window.aiApi not found at onload. AI functionality might be limited until it loads or if not exposed correctly.");
        // The application will still try to use window.aiApi directly where needed,
        // relying on script load order. This local aiApi is for consistency if used.
    }

    // Initialize UI (which also handles initial canvas sizing and drawing)
    uiApi.initUI(); 

    // Initialize Game Logic (board, state, etc.)
    gameApi.initGame(); 

    // Setup Control Buttons from index.html
    setupControlListeners();

    // Initial draw of the game board and state
    uiApi.drawGame(); 

    console.log("Main.js: Game setup complete. Application is running.");
};

function setupControlListeners() {
    const newGameBtn = document.getElementById('new-game-btn');
    const undoBtn = document.getElementById('undo-btn');
    const aiDifficultySelect = document.getElementById('ai-difficulty');
    const omniscienceToggle = document.getElementById('omniscience-mode');

    if (newGameBtn) {
        newGameBtn.addEventListener('click', handleNewGame);
    } else { console.warn("Main.js: New Game button ('new-game-btn') not found."); }

    if (undoBtn) {
        undoBtn.addEventListener('click', handleUndo);
    } else { console.warn("Main.js: Undo button ('undo-btn') not found."); }

    if (aiDifficultySelect) {
        // Populate AI difficulty options
        // These levels correspond to depths in ai.js's AI_DIFFICULTY_LEVELS
        const difficultyOptions = { 
            1: "Novice (Depth 1)", 2: "Beginner (Depth 2)", 3: "Intermediate (Depth 3)", 
            4: "Advanced (Depth 4)", 5: "Expert (Depth 5)" 
        };
        let defaultAiLevel = 3; // Default to Intermediate

        // If ai.js is loaded and provides levels/default, use them
        if (window.aiApi && window.aiApi.getDifficultyLevels) {
            // This part depends on how ai.js exposes its levels.
            // For now, using the hardcoded difficultyOptions.
            // defaultAiLevel = window.aiApi.getCurrentAiLevel ? window.aiApi.getCurrentAiLevel() : 3;
        }
        
        Object.keys(difficultyOptions).forEach(levelKey => {
            const option = document.createElement('option');
            option.value = levelKey;
            option.textContent = difficultyOptions[levelKey];
            if (parseInt(levelKey) === defaultAiLevel) {
                option.selected = true;
            }
            aiDifficultySelect.appendChild(option);
        });
        
        aiDifficultySelect.addEventListener('change', (event) => {
            const newDifficulty = parseInt(event.target.value);
            if (window.aiApi && window.aiApi.setAiDifficulty) {
                window.aiApi.setAiDifficulty(newDifficulty);
                console.log(`Main.js: AI Difficulty changed to: ${newDifficulty} (${difficultyOptions[newDifficulty]})`);
            } else {
                console.warn("Main.js: aiApi.setAiDifficulty function not found. AI difficulty not changed.");
            }
        });
    } else { console.warn("Main.js: AI Difficulty select ('ai-difficulty') not found."); }

    if (omniscienceToggle) {
        omniscienceToggle.addEventListener('change', (event) => {
            const isActive = event.target.checked;
            uiApi.toggleOmniscienceMode(isActive); // uiApi handles redraw
            console.log(`Main.js: Omniscience Mode toggled: ${isActive}`);
        });
    } else { console.warn("Main.js: Omniscience Mode toggle ('omniscience-mode') not found."); }
}

// --- Control Event Handlers ---
function handleNewGame() {
    console.log("Main.js: New Game requested.");
    gameApi.initGame(); 
    if (window.aiApi && window.aiApi.resetAi) { // If AI needs a reset
        window.aiApi.resetAi();
    }
    uiApi.drawGame();   
}

function handleUndo() {
    console.log("Main.js: Undo requested.");
    const history = gameApi.getMoveHistory();
    if (history.length === 0) {
        console.log("Main.js: No moves to undo.");
        return;
    }

    // Undo player's move. If AI played just before player's current turn, undo AI's move too.
    // The design is: "弹出AI和玩家的最近一步棋"
    const lastMove = history[history.length - 1];
    
    gameApi.undoMove(); // Undo the topmost move (could be AI's or Player's previous if they are undoing before AI plays)
    
    // If the undone move was by AI (PLAYER_WHITE), and there's another move in history,
    // it must be the player's (PLAYER_BLACK) move that preceded AI's. So, undo that too.
    if (lastMove.player === PLAYER_WHITE && gameApi.getMoveHistory().length > 0) {
        const moveBeforeAi = gameApi.getMoveHistory()[gameApi.getMoveHistory().length -1];
        if(moveBeforeAi.player === PLAYER_BLACK) { // Ensure it's player's move
             gameApi.undoMove(); // Undo player's move
        }
    }
    // After undo(s), currentPlayer is set by gameApi.undoMove to the player of the last undone move.
    // So it should be PLAYER_BLACK's turn.
    // If it's not (e.g. only one move was on stack by black), gameApi.setCurrentPlayer might be needed
    // but gameApi.undoMove already sets currentPlayer = lastMove.player.
    // If the final state after undo is not PLAYER_BLACK's turn, explicitly set it.
    if(gameApi.getCurrentPlayer() !== PLAYER_BLACK) {
        gameApi.setCurrentPlayer(PLAYER_BLACK);
    }
    
    uiApi.drawGame(); // Redraw after undo
}


// --- Game Flow Management ---
window.handleHumanMove = function(x, y) {
    if (!gameApi || gameApi.getGameState() !== GAME_STATE_PLAYING || gameApi.getCurrentPlayer() !== PLAYER_BLACK) {
        console.log("Main.js: Human move ignored - not player's turn (PLAYER_BLACK) or game not active.");
        return;
    }

    const moveSuccessful = gameApi.makeMove(x, y); 

    if (moveSuccessful) {
        uiApi.drawGame(); 

        if (gameApi.getGameState() === GAME_STATE_ENDED) {
            console.log("Main.js: Game ended after human move.");
            return; 
        }

        // --- Smart Undo Pre-check ---
        let isRiskyMove = false;
        if (window.aiApi && window.aiApi.findBestMove && window.aiApi.getPatternScores) { 
            const boardAfterPlayer = gameApi.getBoard();
            const aiCheckResult = window.aiApi.findBestMove(boardAfterPlayer, 1, -Infinity, Infinity, true, PLAYER_WHITE); // Depth 1 check for AI
            if (aiCheckResult && aiCheckResult.score >= window.aiApi.getPatternScores().FIVE_IN_A_ROW) {
                isRiskyMove = true;
            }
        } else {
            // console.warn("Main.js (Smart Undo): Full AI check not available. Skipping risk assessment.");
        }

        if (isRiskyMove) {
            console.log("Main.js (Smart Undo): Player's move is risky! AI might win.");
            gameApi.setGameState(GAME_STATE_PAUSED); // Pause game for modal
            uiApi.drawGame(); // Update message
            uiApi.showSmartUndoModal(
                () => { // onConfirm: Player wants to proceed despite risk
                    console.log("Main.js (Smart Undo): Player confirmed risky move.");
                    gameApi.setGameState(GAME_STATE_PLAYING); // Resume
                    proceedToAiTurn(); 
                },
                () => { // onUndo: Player wants to undo their risky move
                    console.log("Main.js (Smart Undo): Player chose to undo risky move.");
                    gameApi.undoMove(); // Undoes player's last move
                    gameApi.setGameState(GAME_STATE_PLAYING); // Resume
                    uiApi.drawGame(); // Redraw, player can move again
                }
            );
        } else {
            proceedToAiTurn();
        }
    } else {
        console.log("Main.js: Human move failed (e.g., invalid spot).");
    }
};

function proceedToAiTurn() {
    if (!gameApi || gameApi.getGameState() === GAME_STATE_ENDED) return;

    gameApi.setCurrentPlayer(PLAYER_WHITE);
    gameApi.setGameState(GAME_STATE_PAUSED); // Indicate AI is thinking
    uiApi.drawGame(); // Update UI to show "AI is thinking..."

    console.log("Main.js: AI's turn (PLAYER_WHITE). Triggering AI move...");
    
    setTimeout(() => {
        if (!window.aiApi || !window.aiApi.aiMakeMove) {
            console.error("Main.js Error: aiApi or aiMakeMove not available. AI cannot make a move.");
            gameApi.setGameState(GAME_STATE_PLAYING); 
            gameApi.setCurrentPlayer(PLAYER_BLACK); 
            uiApi.drawGame();
            alert("Error: AI module is not available. Your turn again.");
            return;
        }
        // Ensure game hasn't been reset or ended while "thinking"
        if(gameApi.getGameState() !== GAME_STATE_PAUSED || gameApi.getCurrentPlayer() !== PLAYER_WHITE) {
            console.log("Main.js: Game state changed during AI thinking. Aborting AI move.");
            // Ensure state is consistent if it was paused by this flow
            if(gameApi.getGameState() === GAME_STATE_PAUSED) gameApi.setGameState(GAME_STATE_PLAYING);
            uiApi.drawGame();
            return;
        }

        const currentBoardForAI = gameApi.getBoard();
        const aiMove = window.aiApi.aiMakeMove(currentBoardForAI); 

        if (aiMove) { 
            // Set game state to PLAYING before AI makes its move, as makeMove checks this.
            gameApi.setGameState(GAME_STATE_PLAYING);
            const aiMoveSuccessful = gameApi.makeMove(aiMove.x, aiMove.y); 

            if (aiMoveSuccessful) {
                // gameApi.setGameState(GAME_STATE_PLAYING); // Already set before the move
                uiApi.drawGame(); 
                if (gameApi.getGameState() === GAME_STATE_ENDED) {
                    console.log("Main.js: Game ended after AI move.");
                } else {
                    gameApi.setCurrentPlayer(PLAYER_BLACK);
                    uiApi.drawGame(); 
                }
            } else {
                console.error("Main.js Error: AI made an invalid move:", aiMove);
                handleAiError("AI attempted an invalid move.");
            }
        } else {
            console.log("Main.js: AI has no move (board full or error in AI).");
            if (gameApi.getGameState() !== GAME_STATE_ENDED) {
                 handleAiError("AI could not determine a move.");
            }
        }
    }, 100); 
}

function handleAiError(message) {
    if (!gameApi || !uiApi) return;
    gameApi.setGameState(GAME_STATE_PLAYING); // Revert state
    gameApi.setCurrentPlayer(PLAYER_BLACK); // Give turn back to player
    uiApi.drawGame();
    alert(`AI Error: ${message} Your turn again.`);
}

console.log("main.js loaded. Waiting for window.onload to initialize.");

// Sanity check for API dependencies after load
window.addEventListener('load', () => {
    if (!window.gameApi) console.error("Main.js Critical Error: gameApi not found after window load!");
    if (!window.uiApi) console.error("Main.js Critical Error: uiApi not found after window load!");
    // Add similar check for aiApi when it's expected
});

