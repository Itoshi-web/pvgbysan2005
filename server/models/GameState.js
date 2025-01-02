export class GameState {
  constructor(players) {
    // Number of cells equals number of players
    const cellCount = players.length;
    
    this.players = players.map(p => ({
      id: p.id,
      username: p.username,
      eliminated: false,
      firstMove: true,
      // Create cells array with length equal to number of players
      cells: Array(cellCount).fill().map(() => ({
        stage: 0,
        isActive: false,
        bullets: 0
      }))
    }));
    this.currentPlayer = 0;
    this.lastRoll = null;
    this.gameLog = []; // Array to store game logs
  }

  /**
   * Move to the next player's turn.
   */
  nextTurn() {
    do {
      this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    } while (this.players[this.currentPlayer].eliminated);
  }

  /**
   * Check if there's a winner.
   * @returns {object|null} The winning player or null if no winner.
   */
  checkWinner() {
    const activePlayers = this.players.filter(p => !p.eliminated);
    return activePlayers.length === 1 ? activePlayers[0] : null;
  }

  /**
   * Log an action performed in the game.
   * @param {string} type - The type of action (e.g., 'roll', 'shoot', 'activate').
   * @param {string} player - The player who performed the action.
   * @param {string} message - A descriptive message about the action.
   */
  logAction(type, player, message) {
    this.gameLog.push({
      type,
      player,
      message,
      timestamp: new Date()
    });
  }

  /**
   * Get the game logs.
   * @returns {Array} Array of logged game actions.
   */
  getLogs() {
    return this.gameLog;
  }
}
