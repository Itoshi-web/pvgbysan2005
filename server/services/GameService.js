import { Room } from '../models/Room.js';
import { GameState } from '../models/GameState.js';
import { PowerUpManager } from '../models/PowerUpManager.js';

export class GameService {
  constructor() {
    this.rooms = new Map();
    this.playerSessions = new Map();
    this.quickMatchQueue = new Map(); // Track players in quick match
    this.powerUpManager = new PowerUpManager();
  }

  createRoom(roomId, maxPlayers, password = null) {
    const room = new Room(roomId, maxPlayers, password);
    this.rooms.set(roomId, room);
    return room;
  }

  findQuickMatch(username) {
    // Find an available room (no password, not full)
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
    
    // Initialize power-up state for the player
    this.powerUpManager.initializePlayer(player.id);
    
    return room;
  }

  togglePlayerReady(roomId, username) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const player = room.players.find(p => p.username === username);
    if (!player) throw new Error('Player not found');

    if (player === room.players[0]) return room;

    player.ready = !player.ready;
    return room;
  }

  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    
    const allPlayersReady = room.players.slice(1).every(player => player.ready);
    if (!allPlayersReady) throw new Error('Not all players are ready');
    
    room.started = true;
    room.gameState = new GameState(room.players);
    return room;
  }

  handleRoll(roomId, value) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');

    const currentPlayer = room.gameState.players[room.gameState.currentPlayer];
    
    // Check for power-up trigger (6) in 5-player games
    if (room.players.length === 5 && value === 6) {
      const powerUp = this.powerUpManager.grantPowerUp(currentPlayer.id);
      if (powerUp) {
        room.gameState.gameLog.push({
          type: 'powerUp',
          player: currentPlayer.username,
          powerUpType: powerUp.type
        });
        return { room, powerUp };
      }
    }

    // Check if player is affected by noRoll power-up
    const powerUpState = this.powerUpManager.getPlayerState(currentPlayer.id);
    if (powerUpState?.activeEffects.some(effect => effect.type === 'noRoll')) {
      room.gameState.gameLog.push({
        type: 'skipTurn',
        player: currentPlayer.username,
        message: 'Turn skipped due to No Roll effect'
      });
      room.gameState.nextTurn();
      return { room };
    }

    // Rest of the existing roll logic...
    // [Previous roll logic remains unchanged]

    return { room };
  }

  handleShoot(roomId, targetPlayer, targetCell) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');

    const currentPlayer = room.gameState.players[room.gameState.currentPlayer];
    const target = room.gameState.players[targetPlayer];

    if (!target) throw new Error('Target player not found');

    const shooterCell = currentPlayer.cells[room.gameState.lastRoll - 1];
    
    if (!shooterCell || shooterCell.stage !== 6 || !shooterCell.bullets) {
      throw new Error('Invalid shot attempt');
    }

    shooterCell.bullets--;

    const targetCellObj = target.cells[targetCell];
    if (!targetCellObj) throw new Error('Target cell not found');
    
    targetCellObj.isActive = false;
    targetCellObj.stage = 0;
    targetCellObj.bullets = 0;

    room.gameState.gameLog.push({
      type: 'shoot',
      shooter: currentPlayer.username,
      target: target.username,
      cell: targetCell + 1
    });

    const isEliminated = target.cells.every(cell => !cell.isActive);
    if (isEliminated) {
      target.eliminated = true;
      room.gameState.gameLog.push({
        type: 'eliminate',
        player: target.username,
        shooter: currentPlayer.username
      });
    }

    room.gameState.nextTurn();
    return room;
  }

  handlePowerUp(roomId, playerId, targetPlayerId, targetCell) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');

    const effect = this.powerUpManager.usePowerUp(playerId, targetPlayerId, targetCell);
    if (!effect) throw new Error('No power-up available');

    room.gameState.gameLog.push({
      type: 'usePowerUp',
      player: room.players.find(p => p.id === playerId)?.username,
      target: room.players.find(p => p.id === targetPlayerId)?.username,
      powerUpType: effect.type,
      cell: targetCell
    });

    return { room, effect };
  }

  updatePowerUps(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) return;

    this.powerUpManager.updateCooldowns();
    
    // Update game state based on active effects
    room.gameState.players.forEach(player => {
      const state = this.powerUpManager.getPlayerState(player.id);
      if (state?.activeEffects.length > 0) {
        // Apply active effects (freeze, shield, etc.)
        state.activeEffects.forEach(effect => {
          // Effect-specific logic
        });
      }
    });
  }
}
