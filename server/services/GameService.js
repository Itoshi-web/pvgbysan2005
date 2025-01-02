import { Room } from '../models/Room.js';
import { GameState } from '../models/GameState.js';

export class GameService {
  constructor() {
    this.rooms = new Map();
    this.playerSessions = new Map();
  }

  // ... (keep all other methods unchanged)

  /**
   * Handle a player's shoot action.
   * @param {string} roomId - The room ID.
   * @param {string} targetPlayer - The target player's username.
   * @param {number} targetCell - The target cell index.
   * @returns {Room} - The updated room instance.
   */
  handleShoot(roomId, targetPlayer, targetCell) {
    const room = this.rooms.get(roomId);

    if (!room || !room.gameState) {
      throw new Error('Game not found');
    }

    const currentPlayer = room.gameState.players[room.gameState.currentPlayer];
    const target = room.gameState.players.find(p => p.username === targetPlayer);

    if (!target) {
      throw new Error('Target player not found');
    }

    // Get the shooter's cell based on the last roll
    const shooterCell = currentPlayer.cells[room.gameState.lastRoll - 1];

    // Check if the shooter's cell has bullets
    if (!shooterCell || shooterCell.stage !== 6 || !shooterCell.bullets) {
      throw new Error('No bullets available');
    }

    // Get the target cell
    const targetCellObj = target.cells[targetCell];
    if (!targetCellObj || !targetCellObj.isActive) {
      throw new Error('Invalid target cell - cell must be active');
    }

    // Deduct a bullet from the shooter's cell
    shooterCell.bullets--;

    // Reset the target cell to stage 0
    targetCellObj.isActive = false;
    targetCellObj.stage = 0;
    targetCellObj.bullets = 0;

    // Log the shooting action
    room.gameState.logAction('shoot', currentPlayer.username, `Shot cell ${targetCell + 1} of ${targetPlayer}`);

    // Check if the target player is eliminated
    if (target.cells.every(cell => !cell.isActive)) {
      target.eliminated = true;
      room.gameState.logAction('eliminate', currentPlayer.username, `Eliminated ${targetPlayer}`);
    }

    // Move to next turn
    room.gameState.nextTurn();
    return room;
  }
}
