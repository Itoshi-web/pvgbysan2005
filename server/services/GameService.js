import { Room } from '../models/Room.js';
import { GameState } from '../models/GameState.js';
import { PowerUpService } from './PowerUpService.js';

export class GameService {
  constructor() {
    this.rooms = new Map();
    this.playerSessions = new Map();
    this.quickMatchQueue = new Map();
    this.powerUpService = new PowerUpService();
  }

  handleRoll(roomId, value) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');

    const currentPlayer = room.gameState.players[room.gameState.currentPlayer];
    
    // Handle power-up roll for 5-player games
    if (room.players.length === 5 && value === 6) {
      const powerUp = this.powerUpService.handlePowerUpRoll(room.gameState);
      if (powerUp) {
        room.gameState.lastRoll = value;
        room.gameState.nextTurn();
        return room;
      }
    }

    // Rest of the existing roll logic...
    // [Previous roll logic remains unchanged]

    return room;
  }

  handlePowerUp(roomId, targetPlayerId, targetCell) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');

    const success = this.powerUpService.applyPowerUp(
      room.gameState,
      targetPlayerId,
      targetCell
    );

    if (!success) throw new Error('Failed to apply power-up');

    return room;
  }

  // Rest of the existing GameService methods...
}