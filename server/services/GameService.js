import { Room } from '../models/Room.js';
import { GameState } from '../models/GameState.js';
import { PowerUpManager } from '../models/PowerUpManager.js';

export class GameService {
  constructor() {
    this.rooms = new Map();
    this.playerSessions = new Map();
    this.quickMatchQueue = new Map();
    this.powerUpManager = new PowerUpManager();
    this.turnTimers = new Map(); // Store turn timers for each room
  }

  createRoom(roomId, maxPlayers, password = null) {
    if (maxPlayers < 2 || maxPlayers > 5) {
      throw new Error('Invalid number of players. Must be between 2 and 5.');
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
    
    // Randomly determine first player
    const firstPlayer = Math.floor(Math.random() * room.players.length);
    
    room.started = true;
    room.gameState = new GameState(room.players, firstPlayer);

    // Start turn timer
    this.startTurnTimer(roomId);
    
    return room;
  }

  startTurnTimer(roomId) {
    // Clear existing timer if any
    if (this.turnTimers.has(roomId)) {
      clearTimeout(this.turnTimers.get(roomId));
    }

    const timer = setTimeout(() => {
      const room = this.rooms.get(roomId);
      if (room && room.gameState) {
        // Skip turn if timer expires
        room.gameState.nextTurn();
        this.startTurnTimer(roomId); // Start timer for next player
      }
    }, 30000); // 30 seconds

    this.turnTimers.set(roomId, timer);
  }

  handleRoll(roomId, value) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');

    const currentPlayer = room.gameState.players[room.gameState.currentPlayer];
    
    // Validate roll value based on number of players
    const maxRoll = room.players.length === 5 ? 6 : room.players.length;
    if (value > maxRoll) {
      throw new Error(`Invalid roll. Maximum value for ${room.players.length} players is ${maxRoll}`);
    }

    // Check for first move - must roll a 1
    if (currentPlayer.firstMove && value !== 1) {
      room.gameState.gameLog.push({
        type: 'firstMove',
        player: currentPlayer.username,
        message: 'Must roll a 1 to start'
      });
      room.gameState.nextTurn();
      this.startTurnTimer(roomId);
      return { room };
    }

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
      this.startTurnTimer(roomId);
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
        targetCell.bullets = 5; // Refill bullets
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

    // Get the cell that's doing the shooting based on last roll
    const lastRoll = room.gameState.lastRoll;
    if (!lastRoll) throw new Error('Must roll before shooting');

    const shooterCell = currentPlayer.cells[lastRoll - 1];
    if (!shooterCell) throw new Error('Invalid shooter cell');
    
    // Validate shooter cell conditions
    if (!shooterCell.isActive) throw new Error('Shooter cell is not active');
    if (shooterCell.stage !== 6) throw new Error('Cell must be at stage 6 to shoot');
    if (!shooterCell.bullets || shooterCell.bullets <= 0) throw new Error('No bullets available');

    // Get and validate target cell
    const targetCellObj = target.cells[targetCell];
    if (!targetCellObj) throw new Error('Target cell not found');
    if (!targetCellObj.isActive) throw new Error('Cannot shoot an inactive cell');

    // Check for shield power-up
    const targetPowerUpState = this.powerUpManager.getPlayerState(target.id);
    const isShielded = targetPowerUpState?.activeEffects.some(
      effect => effect.type === 'shield' && effect.targetCell === targetCell
    );
    if (isShielded) throw new Error('Target cell is shielded');

    // Perform the shot
    shooterCell.bullets--;

    // Reset target cell to stage 0
    targetCellObj.isActive = false;
    targetCellObj.stage = 0;
    targetCellObj.bullets = 0;

    // Log the shot
    room.gameState.gameLog.push({
      type: 'shoot',
      shooter: currentPlayer.username,
      target: target.username,
      cell: targetCell + 1
    });

    // Check if target player is eliminated
    const isEliminated = target.cells.every(cell => !cell.isActive);
    if (isEliminated) {
      target.eliminated = true;
      room.gameState.gameLog.push({
        type: 'eliminate',
        player: target.username,
        shooter: currentPlayer.username
      });

      // Check for game end
      const remainingPlayers = room.gameState.players.filter(p => !p.eliminated);
      if (remainingPlayers.length === 1) {
        const winner = remainingPlayers[0];
        const history = {
          winner: winner.username,
          eliminations: room.gameState.gameLog
            .filter(log => log.type === 'eliminate')
            .map(log => ({
              eliminator: log.shooter,
              eliminated: log.player
            })),
          playerStats: Object.fromEntries(
            room.gameState.players.map(player => [
              player.username,
              {
                shotsFired: player.cells.reduce((acc, cell) => acc + (5 - (cell.bullets || 0)), 0),
                eliminations: room.gameState.gameLog.filter(log => 
                  log.type === 'eliminate' && log.shooter === player.username
                ).length,
                timesTargeted: room.gameState.gameLog.filter(log =>
                  log.type === 'shoot' && log.target === player.username
                ).length
              }
            ])
          )
        };
        return { room, gameEnded: true, history };
      }
    }

    // Move to next turn
    room.gameState.nextTurn();
    this.startTurnTimer(roomId);
    return { room };
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
          // Apply active effects (freeze, shield, etc.)
          switch (effect.type) {
            case 'freeze':
              // Cell remains frozen for the duration
              break;
            case 'shield':
              // Cell remains shielded for the duration
              break;
            case 'noRoll':
              // Player skips their next roll
              break;
            case 'doubleShot':
              // Player can shoot twice on their next turn
              break;
          }
        });
      }
    });
  }

  cleanup() {
    // Clear all turn timers when shutting down
    for (const timer of this.turnTimers.values()) {
      clearTimeout(timer);
    }
    this.turnTimers.clear();
  }
}
