import { GameState } from '../models/GameState.js';
import { Room } from '../models/Room.js';

export class GameService {
  constructor() {
    this.rooms = new Map();
    this.playerSessions = new Map();
  }

  createRoom(roomId, maxPlayers, password = null) {
    const room = new Room(roomId, maxPlayers, password);
    this.rooms.set(roomId, room);
    return room;
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

  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    
    room.started = true;
    room.gameState = new GameState(room.players);
    return room;
  }
}
