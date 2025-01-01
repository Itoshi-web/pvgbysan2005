export class GameState {
  constructor(players) {
    const cellCount = players.length;
    
    this.players = players.map(p => ({
      id: p.id,
      username: p.username,
      eliminated: false,
      firstMove: true, // All players start with firstMove true
      cells: Array(cellCount).fill().map(() => ({
        stage: 0,
        isActive: false,
        bullets: 0
      }))
    }));
    
    // Randomly select first player
    this.currentPlayer = Math.floor(Math.random() * players.length);
    this.lastRoll = null;
    this.gameLog = [];
    this.maxDiceValue = players.length === 5 ? 6 : players.length;
    this.turnTimer = 30;
    this.consecutiveSkips = new Map();
  }

  nextTurn() {
    let nextPlayer;
    let attempts = 0;
    const maxAttempts = this.players.length;

    do {
      nextPlayer = (this.currentPlayer + 1) % this.players.length;
      attempts++;

      // Prevent infinite loop if all players are eliminated
      if (attempts >= maxAttempts) {
        const winner = this.checkWinner();
        if (winner) {
          this.gameLog.push({
            type: 'gameEnd',
            player: winner.username,
            message: 'Game Over - Winner!'
          });
        }
        break;
      }

      this.currentPlayer = nextPlayer;
    } while (this.players[nextPlayer].eliminated);
    
    this.turnTimer = 30;
    this.lastRoll = null;
  }

  checkWinner() {
    const activePlayers = this.players.filter(p => !p.eliminated);
    return activePlayers.length === 1 ? activePlayers[0] : null;
  }

  handleSkip(playerId) {
    const skips = this.consecutiveSkips.get(playerId) || 0;
    this.consecutiveSkips.set(playerId, skips + 1);

    if (skips + 1 >= 2) {
      const player = this.players.find(p => p.id === playerId);
      if (player) {
        const activeCells = player.cells
          .map((cell, index) => ({ cell, index }))
          .filter(({ cell }) => cell.isActive);

        if (activeCells.length > 0) {
          const randomCell = activeCells[Math.floor(Math.random() * activeCells.length)];
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
