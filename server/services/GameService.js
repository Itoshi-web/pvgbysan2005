import { GameState } from '../models/GameState.js';
import { Room } from '../models/Room.js';

export class GameService {
  constructor() {
    this.rooms = new Map();
    this.playerSessions = new Map();
  }

  createRoom(roomId, maxPlayers, password = null) {
    const room = new Room(roomId, maxPlayers, password);
    this.rooms.set(roomId, room);
    return room;
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
    
    return room;
  }

  togglePlayerReady(roomId, username) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const player = room.players.find(p => p.username === username);
    if (!player) throw new Error('Player not found');

    // Don't toggle ready state for the host (first player)
    if (player === room.players[0]) return room;

    player.ready = !player.ready;
    return room;
  }

  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    
    // Check if all non-host players are ready
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
    
    // Check if it's player's first move
    if (currentPlayer.firstMove && value !== 1) {
      room.gameState.gameLog.push({
        type: 'firstMove',
        player: currentPlayer.username,
        message: `${currentPlayer.username} must roll a 1 to start!`
      });
      return room;
    }

    // Update the cell based on the roll
    const cell = currentPlayer.cells[value - 1];
    if (!cell.isActive) {
      cell.isActive = true;
      cell.stage = 1;
      currentPlayer.firstMove = false;
      room.gameState.gameLog.push({
        type: 'activate',
        player: currentPlayer.username,
        cell: value
      });
    } else {
      // Upgrade cell if not at max level
      if (cell.stage < 6) {
        cell.stage++;
        if (cell.stage === 6) {
          cell.bullets = 5;
          room.gameState.gameLog.push({
            type: 'maxLevel',
            player: currentPlayer.username,
            cell: value
          });
        }
      } else {
        // Reload bullets if at max level
        cell.bullets = Math.min((cell.bullets || 0) + 3, 5);
        room.gameState.gameLog.push({
          type: 'reload',
          player: currentPlayer.username,
          cell: value
        });
      }
    }

    room.gameState.lastRoll = value;
    room.gameState.nextTurn();
    return room;
  }

  handleShoot(roomId, targetPlayer, targetCell) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');

    const currentPlayer = room.gameState.players[room.gameState.currentPlayer];
    const target = room.gameState.players[targetPlayer];

    // Get the cell that's shooting (based on last roll)
    const shooterCell = currentPlayer.cells[room.gameState.lastRoll - 1];
    
    if (!shooterCell || shooterCell.stage !== 6 || !shooterCell.bullets) {
      throw new Error('Invalid shot attempt');
    }

    // Reduce bullets
    shooterCell.bullets--;

    // Destroy target cell
    const targetCellObj = target.cells[targetCell];
    targetCellObj.isActive = false;
    targetCellObj.stage = 0;
    targetCellObj.bullets = 0;

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
        player: target.username
      });
    }

    room.gameState.nextTurn();
    return room;
  }
}
