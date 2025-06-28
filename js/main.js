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
    // gameApi.initGame(); // Will be called by handleNewGame or setup, with player choice
    // No, it's better to initialize it here once, then handleNewGame can re-initialize.
    // Default to human as PLAYER_BLACK for the very first game load.
    gameApi.initGame(PLAYER_BLACK);


    // Setup Control Buttons from index.html
    setupControlListeners(); // This will also call handleNewGame for the first setup if we want.
                             // For now, explicit initGame above and explicit drawGame below.

    // Initial draw of the game board and state
    uiApi.drawGame(); 

    // If human chose white for the very first game (not typical, as selection happens on "New Game")
    // This logic is more for subsequent new games.
    // For initial load, human is Black by default in gameApi.initGame(PLAYER_BLACK).
    // const humanIsWhite = gameApi.getHumanPlayer() === PLAYER_WHITE;
    // if (humanIsWhite && gameApi.getCurrentPlayer() === PLAYER_BLACK && gameApi.getMoveHistory().length === 0) {
    //     console.log("Main.js: Initial load, human is White. AI (Black) makes the first move.");
    //     proceedToAiTurn();
    // }


    console.log("Main.js: Game setup complete. Application is running.");
};

function setupControlListeners() {
    const newGameBtn = document.getElementById('new-game-btn');
    // Player color selectors
    const selectBlackRadio = document.getElementById('select-black');
    const selectWhiteRadio = document.getElementById('select-white');
    const undoBtn = document.getElementById('undo-btn');
    const aiDifficultySelect = document.getElementById('ai-difficulty');
    const assistModeToggle = document.getElementById('assist-mode'); // Changed ID

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
            1: "新手 (深度 1)", // Novice (Depth 1)
            2: "入门 (深度 2)", // Beginner (Depth 2)
            3: "中级 (深度 3)", // Intermediate (Depth 3)
            4: "高级 (深度 4)", // Advanced (Depth 4)
            5: "专家 (深度 5)"  // Expert (Depth 5)
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

    if (assistModeToggle) { // Changed variable name
        assistModeToggle.addEventListener('change', (event) => {
            const isActive = event.target.checked;
            if (uiApi && uiApi.toggleAssistMode) { // Changed function call
                uiApi.toggleAssistMode(isActive); // uiApi handles redraw
                console.log(`Main.js: Assist Mode toggled: ${isActive}`);
            } else {
                console.warn("Main.js: uiApi.toggleAssistMode function not found.");
            }
        });
    } else { console.warn("Main.js: Assist Mode toggle ('assist-mode') not found."); }
}

// --- Control Event Handlers ---
function handleNewGame() {
    console.log("Main.js: New Game requested.");

    // Determine player's chosen color
    const selectWhiteRadio = document.getElementById('select-white');
    const humanPlayerRole = selectWhiteRadio && selectWhiteRadio.checked ? PLAYER_WHITE : PLAYER_BLACK;
    console.log(`Main.js: Human player chose to be ${humanPlayerRole === PLAYER_BLACK ? 'Black (First)' : 'White (Second)'}.`);

    gameApi.initGame(humanPlayerRole);
    if (window.aiApi && window.aiApi.resetAi) { // If AI needs a reset
        window.aiApi.resetAi();
    }

    // Clear assist mode indicator if it exists (assuming its ID might change or be removed, for now, this is a placeholder if such an element existed)
    // const assistIndicator = document.getElementById('assist-mode-indicator'); // Example if it existed
    // if (assistIndicator) {
    //     assistIndicator.remove();
    // }

    // Reset the assist mode toggle and internal state
    const assistModeToggle = document.getElementById('assist-mode'); // Changed ID
    if (assistModeToggle && assistModeToggle.checked) {
        assistModeToggle.checked = false; // Visually uncheck the toggle
        if (uiApi && uiApi.toggleAssistMode) { // Ensure uiApi and function exist & changed function name
            uiApi.toggleAssistMode(false); // Update internal state and trigger related UI changes (like removing hints)
        }
    }

    uiApi.drawGame();   // This will redraw the board, and with assist mode off, hints won't be drawn.

    // If human chose White, AI (Black) makes the first move.
    // gameApi.getCurrentPlayer() will be PLAYER_BLACK because black always starts.
    // gameApi.getMoveHistory().length will be 0.
    if (gameApi.getHumanPlayer() === PLAYER_WHITE &&
        gameApi.getCurrentPlayer() === PLAYER_BLACK &&
        gameApi.getMoveHistory().length === 0) {
        console.log("Main.js: Human chose White. AI (Black) makes the first move.");
        // Ensure game state is appropriate for AI to start
        gameApi.setGameState(GAME_STATE_PLAYING); // Should already be this from initGame
        proceedToAiTurn();
    }
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
    const humanPlayer = gameApi.getHumanPlayer();
    const aiPlayer = humanPlayer === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
    
    gameApi.undoMove(); // Undo the topmost move (could be AI's or Player's)
    
    // If the undone move was by AI, and there's another move in history,
    // it must be the player's move that preceded AI's. So, undo that too.
    if (lastMove.player === aiPlayer && gameApi.getMoveHistory().length > 0) {
        const moveBeforeAi = gameApi.getMoveHistory()[gameApi.getMoveHistory().length -1];
        // Ensure the move before AI's was indeed by the human player
        if(moveBeforeAi.player === humanPlayer) {
             gameApi.undoMove(); // Undo human player's move
        }
    }

    // After undo(s), currentPlayer is set by gameApi.undoMove to the player of the last undone move.
    // We want to ensure it's now the human player's turn to make a move.
    gameApi.setCurrentPlayer(humanPlayer);
    
    uiApi.drawGame(); // Redraw after undo
    // NEW: Trigger assist mode update after general undo
    if (uiApi.triggerAssistModeUpdateIfActive) { // Changed function name
        uiApi.triggerAssistModeUpdateIfActive();
    }
}


// --- Game Flow Management ---
window.handleHumanMove = function(x, y) {
    if (!gameApi || !gameApi.getHumanPlayer) { // Ensure gameApi and getHumanPlayer are loaded
        console.error("Main.js: gameApi or gameApi.getHumanPlayer not available.");
        return;
    }
    const humanPlayer = gameApi.getHumanPlayer();
    if (gameApi.getGameState() !== GAME_STATE_PLAYING || gameApi.getCurrentPlayer() !== humanPlayer) {
        console.log(`Main.js: Human move ignored - not player's turn (current: ${gameApi.getCurrentPlayer()}, human: ${humanPlayer}) or game not active.`);
        return;
    }

    const moveSuccessful = gameApi.makeMove(x, y); 

    if (moveSuccessful) {
        uiApi.drawGame(); 

        // Trigger assist mode update if active, after player's move is drawn
        if (uiApi.triggerAssistModeUpdateIfActive) { // Changed function name
            uiApi.triggerAssistModeUpdateIfActive();
        }

        if (gameApi.getGameState() === GAME_STATE_ENDED) {
            console.log("Main.js: Game ended after human move.");
            let endMessage = "游戏结束!"; // Default Game Over!
            const history = gameApi.getMoveHistory();
            const lastPlayerMove = history.length > 0 ? history[history.length - 1] : null;

            if (lastPlayerMove && gameApi.checkWin(lastPlayerMove.x, lastPlayerMove.y)) {
                endMessage = `玩家 ${lastPlayerMove.player === PLAYER_BLACK ? '黑棋' : '白棋'} 胜利!`;
            } else if (history.length === (BOARD_SIZE * BOARD_SIZE)) { // Check against BOARD_SIZE from utils.js if possible, or ensure consistency
                endMessage = "平局!";
            }
            if (uiApi.showGameMessageModal) uiApi.showGameMessageModal(endMessage);
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
                    // NEW: Trigger assist mode update after undo
                    if (uiApi.triggerAssistModeUpdateIfActive) { // Changed function name
                        uiApi.triggerAssistModeUpdateIfActive();
                    }
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
    if (!gameApi || gameApi.getGameState() === GAME_STATE_ENDED || !gameApi.getHumanPlayer) return;

    const humanPlayer = gameApi.getHumanPlayer();
    const aiPlayerColor = humanPlayer === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;

    // It's crucial that gameApi.getCurrentPlayer() is the AI's color *before* AI makes a move.
    // gameApi.makeMove uses gameApi.getCurrentPlayer() to record the move.
    gameApi.setCurrentPlayer(aiPlayerColor);
    gameApi.setGameState(GAME_STATE_PAUSED); // Indicate AI is thinking
    uiApi.drawGame(); // Update UI to show "AI is thinking..." for the correct AI color

    console.log(`Main.js: AI's turn (Player ${aiPlayerColor}). Triggering AI move...`);
    
    setTimeout(() => {
        if (!window.aiApi || !window.aiApi.aiMakeMove) {
            console.error("Main.js Error: aiApi or aiMakeMove not available. AI cannot make a move.");
            gameApi.setGameState(GAME_STATE_PLAYING); 
            gameApi.setCurrentPlayer(humanPlayer); // Turn back to human
            uiApi.drawGame();
            if (window.uiApi && uiApi.showGameMessageModal) {
                uiApi.showGameMessageModal("错误: AI模块不可用。请您继续。");
            } else {
                alert("错误: AI模块不可用。请您继续。"); // Fallback
            }
            return;
        }
        // Ensure game hasn't been reset or ended while "thinking"
        // And ensure it's still supposed to be AI's turn with the correct color
        const currentAiPlayerColor = gameApi.getHumanPlayer() === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
        if(gameApi.getGameState() !== GAME_STATE_PAUSED || gameApi.getCurrentPlayer() !== currentAiPlayerColor) {
            console.log(`Main.js: Game state changed during AI thinking (State: ${gameApi.getGameState()}, CurrentPlayer: ${gameApi.getCurrentPlayer()}, Expected AI: ${currentAiPlayerColor}). Aborting AI move.`);
            // Ensure state is consistent if it was paused by this flow
            if(gameApi.getGameState() === GAME_STATE_PAUSED) gameApi.setGameState(GAME_STATE_PLAYING);
            uiApi.drawGame();
            return;
        }

        const currentBoardForAI = gameApi.getBoard();

        window.aiApi.aiMakeMove(currentBoardForAI)
            .then(aiMove => {
                if (aiMove) {
                    const stillAiTurnColor = gameApi.getHumanPlayer() === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
                    // Ensure game is still in a state to make an AI move (e.g. not reset by user)
                    // This check is similar to the one at the start of the setTimeout
                    if(gameApi.getGameState() !== GAME_STATE_PAUSED || gameApi.getCurrentPlayer() !== stillAiTurnColor) {
                        console.log(`Main.js: Game state changed during AI worker computation (State: ${gameApi.getGameState()}, CurrentPlayer: ${gameApi.getCurrentPlayer()}, Expected AI: ${stillAiTurnColor}). Aborting AI move.`);
                        if(gameApi.getGameState() === GAME_STATE_PAUSED) gameApi.setGameState(GAME_STATE_PLAYING);
                        uiApi.drawGame();
                        return;
                    }

                    gameApi.setGameState(GAME_STATE_PLAYING); // Set to PLAYING before AI makes its actual move
                    // gameApi.makeMove uses gameApi.getCurrentPlayer(), which should be aiPlayerColor set at the start of proceedToAiTurn
                    const aiMoveSuccessful = gameApi.makeMove(aiMove.x, aiMove.y);

                    if (aiMoveSuccessful) {
                        uiApi.drawGame(); // Draw AI's move

                        // Trigger assist mode update if active, after AI's move is drawn
                        if (uiApi.triggerAssistModeUpdateIfActive) { // Changed function name
                            uiApi.triggerAssistModeUpdateIfActive();
                        }

                        if (gameApi.getGameState() === GAME_STATE_ENDED) {
                            console.log("Main.js: Game ended after AI move.");
                            let endMessage = "游戏结束!";
                            const history = gameApi.getMoveHistory();
                            const lastPlayerMove = history.length > 0 ? history[history.length - 1] : null;
                            if (lastPlayerMove && gameApi.checkWin(lastPlayerMove.x, lastPlayerMove.y)) {
                                endMessage = `玩家 ${lastPlayerMove.player === PLAYER_BLACK ? '黑棋' : '白棋'} 胜利!`;
                            } else if (history.length === (BOARD_SIZE * BOARD_SIZE)) {
                                endMessage = "平局!";
                            }
                            if (uiApi.showGameMessageModal) uiApi.showGameMessageModal(endMessage);
                        } else {
                            // Game continues, set current player to human
                            const humanPlayer = gameApi.getHumanPlayer();
                            gameApi.setCurrentPlayer(humanPlayer);
                            uiApi.drawGame(); // This will refresh the game message to human's turn
                        }
                    } else {
                        console.error("Main.js Error: AI made an invalid move:", aiMove);
                        handleAiError("AI尝试了无效的走法。"); // handleAiError will set turn back to human
                    }
                } else { // aiMove is null
                    console.log("Main.js: AI has no move (board full or error in AI worker).");
                    if (gameApi.getGameState() !== GAME_STATE_ENDED) {
                        if(gameApi.getGameState() === GAME_STATE_PAUSED) gameApi.setGameState(GAME_STATE_PLAYING);
                        const humanPlayer = gameApi.getHumanPlayer();
                        gameApi.setCurrentPlayer(humanPlayer); // Give turn back to player
                        handleAiError("AI无法确定走法。"); // This will also call drawGame
                    } else {
                         uiApi.drawGame(); // Game already ended (e.g. draw by board full)
                    }
                }
            })
            .catch(error => {
                console.error("Main.js Error: AI move promise rejected:", error);
                if(gameApi.getGameState() === GAME_STATE_PAUSED) gameApi.setGameState(GAME_STATE_PLAYING);
                const humanPlayer = gameApi.getHumanPlayer();
                gameApi.setCurrentPlayer(humanPlayer); // Give turn back to player in case of AI error
                handleAiError(`AI计算出错: ${error.message}`); // This will also call drawGame
            });
    }, 100); 
}

function handleAiError(message) {
    if (!gameApi || !uiApi || !gameApi.getHumanPlayer) return;
    const humanPlayer = gameApi.getHumanPlayer();
    gameApi.setGameState(GAME_STATE_PLAYING); // Revert state
    gameApi.setCurrentPlayer(humanPlayer); // Give turn back to player
    uiApi.drawGame();
    // Use custom modal for AI errors
    if (uiApi.showGameMessageModal) {
        uiApi.showGameMessageModal(`AI错误: ${message} 请您继续。`);
    } else {
        alert(`AI错误: ${message} 请您继续。`); // Fallback
    }
}

console.log("main.js loaded. Waiting for window.onload to initialize.");

// Sanity check for API dependencies after load
window.addEventListener('load', () => {
    if (!window.gameApi) console.error("Main.js Critical Error: gameApi not found after window load!");
    if (!window.uiApi) console.error("Main.js Critical Error: uiApi not found after window load!");
    // Add similar check for aiApi when it's expected
});

