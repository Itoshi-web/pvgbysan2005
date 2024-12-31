export class GameState {
  constructor(players) {
    const cellCount = players.length;
    
    this.players = players.map(p => ({
      id: p.id,
      username: p.username,
      eliminated: false,
      firstMove: true,
      cells: Array(cellCount).fill().map(() => ({
        stage: 0,
        isActive: false,
        bullets: 0,
        frozen: false,
        shielded: false
      })),
      powerUp: null,
      powerUpCooldown: 0,
      skipNextTurn: false
    }));
    this.currentPlayer = 0;
    this.lastRoll = null;
    this.gameLog = [];
    this.doubleShotActive = false;
  }

  nextTurn() {
    this.players.forEach(player => {
      if (player.powerUpCooldown > 0) {
        player.powerUpCooldown--;
      }
      player.cells.forEach(cell => {
        cell.frozen = false;
        cell.shielded = false;
      });
    });

    do {
      this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    } while (this.players[this.currentPlayer].eliminated || 
             this.players[this.currentPlayer].skipNextTurn);

    // Reset skip next turn flag
    if (this.players[this.currentPlayer].skipNextTurn) {
      this.players[this.currentPlayer].skipNextTurn = false;
    }
  }

  checkWinner() {
    const activePlayers = this.players.filter(p => !p.eliminated);
    return activePlayers.length === 1 ? activePlayers[0] : null;
  }
}