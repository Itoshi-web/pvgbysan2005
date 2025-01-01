export class GameState {
  constructor(players) {
    // Initialize players with default values
    this.players = players.map(player => ({
      id: player.id,
      username: player.username,
      bullets: 5, // Initialize with 5 bullets by default
      cells: Array(6).fill({ isDestroyed: false }) // Assuming 6 cells per player
    }));
    this.currentPlayerIndex = 0; // Track the current player by index
  }

  // Get the current player based on the current player index
  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  // Move to the next turn by updating the current player index
  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
  }
}
