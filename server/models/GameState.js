export class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      username: p.username,
      eliminated: false,
      firstMove: true,
      cells: Array(6).fill().map(() => ({
        stage: 0,
        isActive: false,
        bullets: 0
      }))
    }));
    this.currentPlayer = 0;
    this.lastRoll = null;
    this.gameLog = [];
  }

  nextTurn() {
    do {
      this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    } while (this.players[this.currentPlayer].eliminated);
  }

  checkWinner() {
    const activePlayers = this.players.filter(p => !p.eliminated);
    return activePlayers.length === 1 ? activePlayers[0] : null;
  }
}