export class Room {
  constructor(id, maxPlayers, password = null) {
    this.id = id;
    this.maxPlayers = maxPlayers;
    this.password = password;
    this.players = [];
    this.started = false;
    this.gameState = null;
  }

  addPlayer(player) {
    if (this.players.length >= this.maxPlayers) {
      throw new Error('Room is full');
    }
    this.players.push(player);
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  isFull() {
    return this.players.length >= this.maxPlayers;
  }

  isEmpty() {
    return this.players.length === 0;
  }
}