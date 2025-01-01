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
    this.disconnectionTimers = new Map();
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
      roomId: roomId,
      lastActive: Date.now()
    });
    
    this.powerUpManager.initializePlayer(player.id);
    
    return room;
  }

  handlePlayerDisconnect(socketId) {
    let affectedRoom = null;
    let disconnectedPlayer = null;

    for (const [roomId, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socketId);
      if (playerIndex !== -1) {
        disconnectedPlayer = room.players[playerIndex];
        affectedRoom = room;

        // Start a 30-second timer for this player
        const timer = setTimeout(() => {
          this.removePlayerFromRoom(socketId, roomId);
        }, 30000);

        this.disconnectionTimers.set(socketId, {
          timer,
          roomId,
          username: disconnectedPlayer.username
        });

        break;
      }
    }

    return { room: affectedRoom, player: disconnectedPlayer };
  }

  handlePlayerReconnect(socketId, username) {
    const timerInfo = this.disconnectionTimers.get(socketId);
    if (timerInfo) {
      clearTimeout(timerInfo.timer);
      this.disconnectionTimers.delete(socketId);
      
      const room = this.rooms.get(timerInfo.roomId);
      if (room) {
        const playerIndex = room.players.findIndex(p => p.username === username);
        if (playerIndex !== -1) {
          room.players[playerIndex].id = socketId;
          return { success: true, room };
        }
      }
    }
    return { success: false };
  }

  removePlayerFromRoom(socketId, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.id === socketId);
    if (playerIndex !== -1) {
      const player = room.players[playerIndex];
      room.removePlayer(socketId);
      this.playerSessions.delete(player.username);
      this.powerUpManager.removePlayer(socketId);

      // If room is empty or host left, clean up the room
      if (room.isEmpty() || playerIndex === 0) {
        this.rooms.delete(roomId);
        return { roomDeleted: true, player };
      }

      return { roomDeleted: false, player };
    }
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

  togglePlayerReady(roomId, username) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const player = room.players.find(p => p.username === username);
    if (!player) throw new Error('Player not found');

    // Host (first player) can't toggle ready state
    if (player === room.players[0]) return room;

    player.ready = !player.ready;
    return room;
  }

  // Other methods remain the same...
}
