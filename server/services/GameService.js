import { Room } from '../models/Room.js';
import { GameState } from '../models/GameState.js';

export class GameService {
  constructor() {
    this.rooms = new Map();
    this.playerSessions = new Map();
  }

  /**
   * Create a new room.
   * @param {string} roomId - Unique identifier for the room.
   * @param {number} maxPlayers - Maximum number of players in the room.
   * @param {string|null} password - Optional password for the room.
   * @returns {Room} - The created room instance.
   */
  createRoom(roomId, maxPlayers, password = null) {
    if (this.rooms.has(roomId)) {
      throw new Error('Room ID already exists');
    }

    const room = new Room(roomId, maxPlayers, password);
    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Find an available room for quick match.
   * @returns {string|null} - Room ID if found, else null.
   */
  findQuickMatch() {
    for (const [roomId, room] of this.rooms.entries()) {
      if (!room.password && !room.isFull() && !room.started) {
        return roomId;
      }
    }
    return null;
  }

  /**
   * Add a player to a room.
   * @param {string} roomId - The room ID.
   * @param {object} player - The player object.
   * @param {string|null} password - Password for the room (if any).
   * @returns {Room} - The room instance.
   */
  joinRoom(roomId, player, password = null) {
    const room = this.rooms.get(roomId);

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.password && room.password !== password) {
      throw new Error('Invalid password');
    }

    if (room.isFull()) {
      throw new Error('Room is full');
    }

    room.addPlayer(player);
    this.playerSessions.set(player.username, { socketId: player.id, roomId });

    return room;
  }

  /**
   * Toggle a player's ready state.
   * @param {string} roomId - The room ID.
   * @param {string} username - The player's username.
   * @returns {Room} - The updated room instance.
   */
  togglePlayerReady(roomId, username) {
    const room = this.rooms.get(roomId);

    if (!room) {
      throw new Error('Room not found');
    }

    const player = room.players.find(p => p.username === username);

    if (!player) {
      throw new Error('Player not found');
    }

    if (player === room.players[0]) {
      return room; // Host cannot toggle ready
    }

    player.ready = !player.ready;
    return room;
  }

  /**
   * Start the game in a room.
   * @param {string} roomId - The room ID.
   * @returns {Room} - The room with the game started.
   */
  startGame(roomId) {
    const room = this.rooms.get(roomId);

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.started) {
      throw new Error('Game already started');
    }

    const allPlayersReady = room.players.slice(1).every(player => player.ready);

    if (!allPlayersReady) {
      throw new Error('Not all players are ready');
    }

    room.started = true;
    room.gameState = new GameState(room.players);
    return room;
  }

  /**
   * Handle a player's roll action.
   * @param {string} roomId - The room ID.
   * @param {number} value - The rolled value.
   * @returns {Room} - The updated room instance.
   */
  handleRoll(roomId, value) {
    const room = this.rooms.get(roomId);

    if (!room || !room.gameState) {
      throw new Error('Game not found');
    }

    const currentPlayer = room.gameState.players[room.gameState.currentPlayer];

    if (currentPlayer.firstMove && value !== 1) {
      room.gameState.logAction('firstMove', currentPlayer.username, `Must roll a 1 to start`);
      return room;
    }

    const cell = currentPlayer.cells[value - 1];

    if (!cell.isActive) {
      cell.isActive = true;
      cell.stage = 1;
      currentPlayer.firstMove = false;
      room.gameState.logAction('activate', currentPlayer.username, `Activated cell ${value}`);
    } else if (cell.stage < 6) {
      cell.stage++;
      if (cell.stage === 6) {
        cell.bullets = 5;
        room.gameState.logAction('maxLevel', currentPlayer.username, `Maxed out cell ${value}`);
      } else {
        room.gameState.logAction('upgrade', currentPlayer.username, `Upgraded cell ${value} to stage ${cell.stage}`);
      }
    } else {
      cell.bullets = Math.min((cell.bullets || 0) + 3, 5);
      room.gameState.logAction('reload', currentPlayer.username, `Reloaded cell ${value}`);
    }

    room.gameState.lastRoll = value;
    room.gameState.nextTurn();
    return room;
  }

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
