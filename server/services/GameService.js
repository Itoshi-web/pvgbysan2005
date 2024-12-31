import { Room } from '../models/Room.js';
import { GameState } from '../models/GameState.js';
import { PowerUpManager } from '../models/PowerUpManager.js';
import { RollHandler } from '../handlers/RollHandler.js';
import { ShootHandler } from '../handlers/ShootHandler.js';

export class GameService {
  constructor() {
    this.rooms = new Map();
    this.playerSessions = new Map();
    this.quickMatchQueue = new Map();
    this.powerUpManager = new PowerUpManager();
    this.rollHandler = new RollHandler(this.powerUpManager);
    this.shootHandler = new ShootHandler();
  }

  createRoom(roomId, maxPlayers, password = null) {
    if (maxPlayers < 2 || maxPlayers > 5) {
      throw new Error('Invalid number of players');
    }
    const room = new Room(roomId, maxPlayers, password);
    this.rooms.set(roomId, room);
    return room;
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
    if (room.started) throw new Error('Game already started');
    
    if (room.players.some(p => p.username === player.username)) {
      throw new Error('Username already taken in this room');
    }
    
    room.addPlayer(player);
    this.playerSessions.set(player.username, {
      socketId: player.id,
      roomId: roomId
    });
    
    this.powerUpManager.initializePlayer(player.id);
    
    return room;
  }

  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    
    const allPlayersReady = room.players.slice(1).every(player => player.ready);
    if (!allPlayersReady) throw new Error('Not all players are ready');
    
    if (room.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }
    
    room.started = true;
    room.gameState = new GameState(room.players);
    room.gameState.maxDiceValue = room.players.length === 5 ? 6 : room.players.length;
    
    return room;
  }

  handleRoll(roomId, value) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');
    return this.rollHandler.handle(room, value);
  }

  handleShoot(roomId, targetPlayer, targetCell) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');
    return this.shootHandler.handle(room, targetPlayer, targetCell);
  }

  // Other methods remain the same...
}