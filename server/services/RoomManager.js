export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.playerSessions = new Map();
  }

  createRoom(roomId, maxPlayers, password = null) {
    if (maxPlayers < 2 || maxPlayers > 5) {
      throw new Error('Invalid number of players. Must be between 2 and 5.');
    }
    const room = new Room(roomId, maxPlayers, password);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  findQuickMatch(username) {
    for (const [roomId, room] of this.rooms.entries()) {
      if (!room.password && !room.isFull() && !room.started) {
        return roomId;
      }
    }
    return null;
  }

  joinRoom(roomId, player, password = null) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    if (room.password && room.password !== password) {
      throw new Error('Invalid password');
    }
    if (room.isFull()) throw new Error('Room is full');
    
    room.addPlayer(player);
    this.playerSessions.set(player.username, {
      socketId: player.id,
      roomId: roomId
    });
    
    return room;
  }

  togglePlayerReady(roomId, username) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('Room not found');

    const player = room.players.find(p => p.username === username);
    if (!player) throw new Error('Player not found');

    player.ready = !player.ready;
    return room;
  }

  removeRoom(roomId) {
    this.rooms.delete(roomId);
  }
}
