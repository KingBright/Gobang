console.log("DEBUG: File loaded: js/opening_book.js"); // DBG_LOAD_OB

// Gomoku Opening Book

const openingBookData = new Map();

function getOpeningMove(boardHashString) {
    // console.log("DEBUG: getOpeningMove called with hash:", boardHashString); // Can be verbose DBG_OB_GETMOVE_CALL
    if (openingBookData.has(boardHashString)) {
        const move = openingBookData.get(boardHashString);
        console.log("DEBUG: Opening book hit! Hash:", boardHashString, "Suggests move:", JSON.stringify(move)); // DBG_OB_HIT
        return move;
    }
    // console.log("DEBUG: Opening book miss for hash:", boardHashString); // Can be verbose DBG_OB_MISS
    return null;
}

// Expose if loaded globally
if (typeof window !== 'undefined') {
    console.log("DEBUG: opening_book.js - Attaching openingBook to window."); // DBG_OB_WINDOW
    window.openingBook = {
        getOpeningMove: getOpeningMove,
        _bookData: openingBookData,
        _populateExampleOpening: function(boardSize, pBlack, pWhite, pEmpty) {
            console.log("DEBUG: openingBook._populateExampleOpening called."); // DBG_OB_POPULATE_CALL
            console.log(`DEBUG: _populateExampleOpening - Globals: BOARD_SIZE=${typeof BOARD_SIZE}, PLAYER_BLACK=${typeof PLAYER_BLACK}, PLAYER_WHITE=${typeof PLAYER_WHITE}, EMPTY=${typeof EMPTY}`); // DBG_OB_POPULATE_GLOBALS
            console.log(`DEBUG: _populateExampleOpening - Params: boardSize=${boardSize}, pB=${pBlack}, pW=${pWhite}, pE=${pEmpty}`); // DBG_OB_POPULATE_PARAMS

            if (boardSize !== 15) {
                console.warn("DEBUG: Opening book example population is for 15x15 board. Current boardSize:", boardSize); // DBG_OB_POPULATE_SIZE_WARN
                // return; // Allow population attempt anyway, might be useful for debugging hashes
            }
            if (!window.Board) {
                console.error("DEBUG: Cannot populate opening book: Board class (window.Board) not found."); // DBG_OB_POPULATE_NO_BOARD
                return;
            }
            console.log("DEBUG: Populating opening book with example sequence (for 15x15)..."); // DBG_OB_POPULATE_START

            let tempBoard = new window.Board(boardSize, pBlack, pWhite, pEmpty);
            let hash;

            // 1. Empty board (Black's turn implicitly)
            hash = tempBoard.getHash().toString();
            this._bookData.set(hash, { y: 7, x: 7 });
            console.log(`DEBUG: Book entry ADDED: Empty board (hash ${hash}) -> move (7,7)`); // DBG_OB_POPULATE_ENTRY
            if (!tempBoard.put(7,7, pBlack)) console.error("DEBUG: _populate failed at put 1"); // Black plays center

            // 2. After Black center (White's turn implicitly)
            hash = tempBoard.getHash().toString();
            this._bookData.set(hash, { y: 7, x: 8 });
            console.log(`DEBUG: Book entry ADDED: B:(7,7) (hash ${hash}) -> move (7,8)`); // DBG_OB_POPULATE_ENTRY
            if (!tempBoard.put(7,8, pWhite)) console.error("DEBUG: _populate failed at put 2");

            // 3. After B:(7,7), W:(7,8) (Black's turn implicitly)
            hash = tempBoard.getHash().toString();
            this._bookData.set(hash, { y: 8, x: 7 });
            console.log(`DEBUG: Book entry ADDED: B:(7,7),W:(7,8) (hash ${hash}) -> move (8,7)`); // DBG_OB_POPULATE_ENTRY

            console.log("DEBUG: Example opening book population complete. Size:", this._bookData.size); // DBG_OB_POPULATE_END
        }
    };
}
console.log("DEBUG: End of opening_book.js script evaluation."); // DBG_LOAD_END_OB
