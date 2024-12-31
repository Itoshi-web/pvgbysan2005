import { Room } from '../models/Room.js';
import { GameState } from '../models/GameState.js';
import { PowerUpManager } from '../models/PowerUpManager.js';
import { TurnManager } from './TurnManager.js';
import { RoomManager } from './RoomManager.js';
import { CombatManager } from './CombatManager.js';

export class GameService {
  constructor() {
    this.roomManager = new RoomManager();
    this.turnManager = new TurnManager();
    this.powerUpManager = new PowerUpManager();
    this.combatManager = new CombatManager(this.powerUpManager);
  }

  createRoom(roomId, maxPlayers, password = null) {
    return this.roomManager.createRoom(roomId, maxPlayers, password);
  }

  findQuickMatch(username) {
    return this.roomManager.findQuickMatch(username);
  }

  joinRoom(roomId, player, password = null) {
    const room = this.roomManager.joinRoom(roomId, player, password);
    this.powerUpManager.initializePlayer(player.id);
    return room;
  }

  togglePlayerReady(roomId, username) {
    return this.roomManager.togglePlayerReady(roomId, username);
  }

  startGame(roomId) {
    const room = this.roomManager.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    
    const allPlayersReady = room.players.slice(1).every(player => player.ready);
    if (!allPlayersReady) throw new Error('Not all players are ready');
    
    const firstPlayer = Math.floor(Math.random() * room.players.length);
    room.started = true;
    room.gameState = new GameState(room.players, firstPlayer);
    
    this.turnManager.startTurnTimer(roomId, () => {
      if (room.gameState) {
        room.gameState.nextTurn();
        this.turnManager.startTurnTimer(roomId);
      }
    });
    
    return room;
  }

  handleRoll(roomId, value) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');

    return this.turnManager.handleRoll(room, value, this.powerUpManager);
  }

  handleShoot(roomId, targetPlayer, targetCell) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');

    return this.combatManager.handleShoot(room, targetPlayer, targetCell);
  }

  handlePowerUp(roomId, playerId, targetPlayerId, targetCell) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');

    return this.powerUpManager.handlePowerUp(room, playerId, targetPlayerId, targetCell);
  }

  cleanup() {
    this.turnManager.cleanup();
  }
}
