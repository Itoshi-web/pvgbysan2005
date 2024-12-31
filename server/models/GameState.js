export class GameState {
  constructor(players, firstPlayer = 0) {
    this.players = players.map(p => ({
      id: p.id,
      username: p.username,
      eliminated: false,
      firstMove: true,
      cells: Array(players.length).fill().map(() => ({
        stage: 0,
        isActive: false,
        bullets: 0
      }))
    }));
    this.currentPlayer = firstPlayer;
    this.lastRoll = null;
    this.gameLog = [];
    this.turnSkips = new Map(); // Track consecutive turn skips
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

  addTurnSkip(playerId) {
    const skips = (this.turnSkips.get(playerId) || 0) + 1;
    this.turnSkips.set(playerId, skips);
    return skips;
  }

  resetTurnSkips(playerId) {
    this.turnSkips.set(playerId, 0);
  }
}
