import { Room } from '../models/Room.js';
import { GameState } from '../models/GameState.js';
import { PowerUpManager } from '../models/PowerUpManager.js';

export class GameService {
  constructor() {
    this.rooms = new Map();
    this.playerSessions = new Map();
    this.quickMatchQueue = new Map();
    this.powerUpManager = new PowerUpManager();
  }

  createRoom(roomId, maxPlayers, password = null) {
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
    
    room.addPlayer(player);
    this.playerSessions.set(player.username, {
      socketId: player.id,
      roomId: roomId
    });
    
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
    
    // Check if it's player's first move and they didn't roll 1
    if (currentPlayer.firstMove && value !== 1) {
      room.gameState.gameLog.push({
        type: 'firstMove',
        player: currentPlayer.username,
        message: `${currentPlayer.username} needs to roll 1 to start`
      });
      room.gameState.nextTurn();
      return { room };
    }

    // If player rolled 1 on their first move, mark firstMove as false
    if (currentPlayer.firstMove && value === 1) {
      currentPlayer.firstMove = false;
      room.gameState.gameLog.push({
        type: 'firstMove',
        player: currentPlayer.username,
        message: `${currentPlayer.username} rolled 1 and can now start playing!`
      });
    }

    // Check for power-up trigger (6) in 5-player games
    if (room.players.length === 5 && value === 6 && !currentPlayer.firstMove) {
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

    // Handle normal roll for non-first moves
    if (!currentPlayer.firstMove) {
      const targetCell = currentPlayer.cells[value - 1];
      
      if (!targetCell.isActive) {
        targetCell.isActive = true;
        targetCell.stage = 1;
        room.gameState.gameLog.push({
          type: 'activate',
          player: currentPlayer.username,
          cell: value
        });
      } else if (targetCell.stage < 6) {
        targetCell.stage++;
        if (targetCell.stage === 6) {
          targetCell.bullets = 5;
          room.gameState.gameLog.push({
            type: 'maxLevel',
            player: currentPlayer.username,
            cell: value
          });
        }
      } else if (targetCell.stage === 6 && targetCell.bullets < 5) {
        targetCell.bullets = Math.min(5, targetCell.bullets + 1);
        room.gameState.gameLog.push({
          type: 'reload',
          player: currentPlayer.username,
          cell: value
        });
      }
    }

    room.gameState.lastRoll = value;
    if (!currentPlayer.firstMove) {
      room.gameState.nextTurn();
    }

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
    
    room.gameState.players.forEach(player => {
      const state = this.powerUpManager.getPlayerState(player.id);
      if (state?.activeEffects.length > 0) {
        state.activeEffects.forEach(effect => {
          // Effect-specific logic handled by PowerUpManager
        });
      }
    });
  }
}
