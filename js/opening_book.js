// Gomoku Opening Book

// The opening book stores board states (represented by their Zobrist hash strings)
// and the recommended move for that state.
// This assumes the Zobrist hash is ONLY based on piece positions, not whose turn it is.
// The book implies whose turn it is for a given position.

const openingBookData = new Map();

// NOTE: The hashes used here are placeholders.
// In a real scenario, these would be actual Zobrist hashes generated from
// known opening board states.
// For this implementation, we'll need a way to get these hashes,
// perhaps by playing out openings and logging the Zobrist hash from our Board class.

// Example Opening Moves (conceptual - needs actual hashes and board size context)
// Assume BOARD_SIZE is 15 for these examples (center is 7,7)

// 1. Empty Board (Black to play - hash of empty board) -> Black plays center
//    To get this hash, we'd need to:
//    `const tempBoard = new Board(15, PLAYER_BLACK, PLAYER_WHITE, EMPTY);`
//    `const emptyBoardHash = tempBoard.getHash().toString();`
//    openingBookData.set(emptyBoardHash, { y: 7, x: 7 }); // Example center

// 2. Board after Black plays center (7,7) (White to play - hash of this board) -> White plays adjacent
//    `tempBoard.put(7,7, PLAYER_BLACK);`
//    `const afterBlackCenterHash = tempBoard.getHash().toString();`
//    openingBookData.set(afterBlackCenterHash, { y: 7, x: 8 }); // Example response

// 3. Board after Black: (7,7), White: (7,8) (Black to play)
//    `tempBoard.put(7,8, PLAYER_WHITE);`
//    `const afterWhiteResponseHash = tempBoard.getHash().toString();`
//    openingBookData.set(afterWhiteResponseHash, { y: 8, x: 7 });


// For now, this will be empty. It needs to be populated with actual hashes
// from our Zobrist implementation. The AI itself can be used to generate these:
// - Create a new Board instance.
// - Log board.getHash().toString().
// - Make a known good opening move.
// - Log board.getHash().toString().
// - Add these (hash, move_to_make_from_that_hash_state) to the map.

function getOpeningMove(boardHashString) {
    if (openingBookData.has(boardHashString)) {
        const move = openingBookData.get(boardHashString);
        console.log("Opening book hit! Hash:", boardHashString, "Suggests move:", move);
        return move;
    }
    return null;
}

// Expose if loaded globally
if (typeof window !== 'undefined') {
    window.openingBook = {
        getOpeningMove: getOpeningMove,
        // For populating or debugging:
        _bookData: openingBookData, // Be careful exposing raw data
        _populateExampleOpening: function(boardSize, pBlack, pWhite, pEmpty) {
            if (boardSize !== 15) {
                console.warn("Opening book example population is for 15x15 board.");
                return;
            }
            if (!window.Board) {
                console.error("Cannot populate opening book: Board class not found.");
                return;
            }
            console.log("Populating opening book with example sequence (15x15)...");

            let tempBoard = new window.Board(boardSize, pBlack, pWhite, pEmpty);
            let hash;

            // 1. Empty board (Black's turn implicitly)
            hash = tempBoard.getHash().toString();
            this._bookData.set(hash, { y: 7, x: 7 });
            console.log(`Book entry: Empty board (hash ${hash}) -> move (7,7)`);
            tempBoard.put(7,7, pBlack); // Black plays center

            // 2. After Black center (White's turn implicitly)
            hash = tempBoard.getHash().toString();
            this._bookData.set(hash, { y: 7, x: 8 }); // White plays beside
            console.log(`Book entry: B:(7,7) (hash ${hash}) -> move (7,8)`);
            tempBoard.put(7,8, pWhite);

            // 3. After B:(7,7), W:(7,8) (Black's turn implicitly)
            hash = tempBoard.getHash().toString();
            this._bookData.set(hash, { y: 8, x: 7 });
            console.log(`Book entry: B:(7,7),W:(7,8) (hash ${hash}) -> move (8,7)`);
            // tempBoard.put(8,7, pBlack);
            // ... and so on.
            console.log("Example opening book population complete. Size:", this._bookData.size);
        }
    };
}
