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
    
    if (room.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }
    
    room.started = true;
    room.gameState = new GameState(room.players);
    const numPlayers = room.players.length;
    room.gameState.maxDiceValue = numPlayers === 5 ? 6 : numPlayers;
    
    return room;
  }

  handleRoll(roomId, value) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');

    const currentPlayer = room.gameState.players[room.gameState.currentPlayer];
    
    if (value > room.gameState.maxDiceValue) {
      throw new Error('Invalid dice value');
    }
    
    if (currentPlayer.firstMove && value !== 1) {
      room.gameState.gameLog.push({
        type: 'firstMove',
        player: currentPlayer.username,
        message: 'Must roll a 1 to start'
      });
      room.gameState.nextTurn();
      return { room };
    }

    if (room.players.length === 5 && value === 6) {
      const powerUp = this.powerUpManager.grantPowerUp(currentPlayer.id);
      if (powerUp) {
        room.gameState.gameLog.push({
          type: 'powerUp',
          player: currentPlayer.username,
          powerUpType: powerUp.type
        });
      }
    }

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

    const targetCell = currentPlayer.cells[value - 1];
    if (!targetCell.isActive) {
      targetCell.isActive = true;
      targetCell.stage = 1;
      room.gameState.gameLog.push({
        type: 'activate',
        player: currentPlayer.username,
        cell: value
      });
    } else {
      if (targetCell.stage < 6) {
        targetCell.stage++;
        if (targetCell.stage === 6) {
          targetCell.bullets = 5;
          room.gameState.gameLog.push({
            type: 'maxLevel',
            player: currentPlayer.username,
            cell: value
          });
        }
      } else if (targetCell.bullets < 5) {
        targetCell.bullets++;
        room.gameState.gameLog.push({
          type: 'reload',
          player: currentPlayer.username,
          cell: value
        });
      }
    }

    if (currentPlayer.firstMove) {
      currentPlayer.firstMove = false;
    }

    room.gameState.lastRoll = value;

    if (targetCell.stage !== 6 || targetCell.bullets === 0) {
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
    if (target.eliminated) throw new Error('Cannot shoot an eliminated player');
    if (currentPlayer.eliminated) throw new Error('Eliminated players cannot shoot');
    if (currentPlayer.firstMove) throw new Error('Cannot shoot on first move');

    const lastRoll = room.gameState.lastRoll;
    if (!lastRoll) throw new Error('Must roll before shooting');

    const shooterCell = currentPlayer.cells[lastRoll - 1];
    if (!shooterCell) throw new Error('Invalid shooter cell');
    
    if (!shooterCell.isActive) throw new Error('Shooter cell is not active');
    if (shooterCell.stage !== 6) throw new Error('Cell must be at stage 6 to shoot');
    if (!shooterCell.bullets || shooterCell.bullets <= 0) throw new Error('No bullets available');

    const targetCellObj = target.cells[targetCell];
    if (!targetCellObj) throw new Error('Target cell not found');
    if (!targetCellObj.isActive) throw new Error('Cannot shoot an inactive cell');

    const targetPowerUpState = this.powerUpManager.getPlayerState(target.id);
    const isShielded = targetPowerUpState?.activeEffects.some(
      effect => effect.type === 'shield' && effect.targetCell === targetCell
    );
    if (isShielded) throw new Error('Target cell is shielded');

    shooterCell.bullets--;

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
          switch (effect.type) {
            case 'freeze':
              break;
            case 'shield':
              break;
            case 'noRoll':
              break;
            case 'doubleShot':
              break;
          }
        });
      }
    });
  }
}
