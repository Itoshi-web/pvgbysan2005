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
    this.gameLog = [];
    this.maxDiceValue = players.length === 5 ? 6 : players.length;
    this.turnTimer = 30; // 30 seconds per turn
    this.consecutiveSkips = new Map(); // Track consecutive skips for each player
  }

  nextTurn() {
    do {
      this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    } while (this.players[this.currentPlayer].eliminated);
    
    // Reset turn timer
    this.turnTimer = 30;
  }

  checkWinner() {
    const activePlayers = this.players.filter(p => !p.eliminated);
    return activePlayers.length === 1 ? activePlayers[0] : null;
  }

  handleSkip(playerId) {
    const skips = this.consecutiveSkips.get(playerId) || 0;
    this.consecutiveSkips.set(playerId, skips + 1);

    // If player skips twice in a row, freeze a random cell
    if (skips + 1 >= 2) {
      const player = this.players.find(p => p.id === playerId);
      if (player) {
        const activeCells = player.cells
          .map((cell, index) => ({ cell, index }))
          .filter(({ cell }) => cell.isActive);

        if (activeCells.length > 0) {
          const randomCell = activeCells[Math.floor(Math.random() * activeCells.length)];
          // Apply freeze effect to the cell
          this.gameLog.push({
            type: 'autoFreeze',
            player: player.username,
            cell: randomCell.index + 1,
            message: 'Cell frozen due to consecutive skips'
          });
        }
      }
      this.consecutiveSkips.set(playerId, 0);
    }
  }

  resetSkips(playerId) {
    this.consecutiveSkips.set(playerId, 0);
  }
}
