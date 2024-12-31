import { Room } from '../models/Room.js';

export class GameService {
  constructor() {
    this.rooms = new Map();
    this.playerSessions = new Map();
    this.quickMatchQueue = new Map(); // Track players in quick match
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
    
    if (currentPlayer.firstMove && value !== 1) {
      room.gameState.gameLog.push({
        type: 'firstMove',
        player: currentPlayer.username,
        message: `${currentPlayer.username} must roll a 1 to start!`
      });
      return room;
    }

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
      room.gameState.lastRoll = value;
      room.gameState.nextTurn();
    } else {
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
        room.gameState.lastRoll = value;
        room.gameState.nextTurn();
      } else {
        cell.bullets = Math.min((cell.bullets || 0) + 3, 5);
        room.gameState.lastRoll = value;
        room.gameState.gameLog.push({
          type: 'reload',
          player: currentPlayer.username,
          cell: value
        });
      }
    }

    return room;
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
}
