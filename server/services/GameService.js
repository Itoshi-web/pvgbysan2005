import { Room } from '../models/Room.js';
import { GameState } from '../models/GameState.js';
import { PowerUpManager } from '../models/PowerUpManager.js';
import { RollHandler } from '../handlers/RollHandler.js';
import { ShootHandler } from '../handlers/ShootHandler.js';

export class GameService {
  constructor() {
    this.rooms = new Map(); // Stores all active rooms
    this.playerSessions = new Map(); // Maps players to their session details
    this.quickMatchQueue = new Map(); // Manages the queue for quick matches
    this.powerUpManager = new PowerUpManager(); // Handles power-ups
    this.rollHandler = new RollHandler(this.powerUpManager); // Handles dice rolls and power-up logic
    this.shootHandler = new ShootHandler(); // Handles shooting logic
  }

  // Creates a new room with a given ID, max player count, and optional password
  createRoom(roomId, maxPlayers, password = null) {
    if (maxPlayers < 2 || maxPlayers > 5) {
      throw new Error('Invalid number of players');
    }
    const room = new Room(roomId, maxPlayers, password);
    this.rooms.set(roomId, room);
    return room;
  }

  // Allows a player to join a specific room
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

    // Ensure bullets are initialized for the player
    player.bullets = player.bullets || 0;

    room.addPlayer(player);
    this.playerSessions.set(player.username, {
      socketId: player.id,
      roomId: roomId
    });

    this.powerUpManager.initializePlayer(player.id);

    return room;
  }

  // Handles shooting action in the game
  handleShoot(roomId, targetPlayer, targetCell) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameState) throw new Error('Game not found');
    return this.shootHandler.handle(room, targetPlayer, targetCell);
  }

  handleTurn(playerId) {
    const player = this.gameState.getPlayer(playerId);
    if (!player || player.isEliminated) return;

    const diceRoll = this.rollHandler.handleRoll();
    player.lastRoll = diceRoll;

    if (player.turnSkips >= 2) {
      this.freezeRandomCell(player);
      player.turnSkips = 0; // Reset skips after freezing a cell
      this.eventEmitter.emit("cellFrozen", { playerId });
      return;
    }

    if (player.hasSkippedTurn) {
      player.turnSkips += 1;
    } else {
      player.turnSkips = 0; // Reset turn skips if turn is taken
      this.movePlayer(player, diceRoll);
    }

    this.checkDynamicEvents(player);
    this.checkPowerUp(player);
  }

  movePlayer(player, steps) {
    player.position += steps;
    if (player.position >= this.gameState.goal) {
      this.gameState.declareWinner(player.id);
    }
  }

  freezeRandomCell(player) {
    const unfrozenCells = player.cells.filter(cell => !cell.isFrozen);
    if (unfrozenCells.length > 0) {
      const randomCell = unfrozenCells[Math.floor(Math.random() * unfrozenCells.length)];
      randomCell.isFrozen = true;
    }
  }

  checkPowerUp(player) {
    const powerUp = this.powerUpManager.getRandomPowerUp();
    if (powerUp) {
      if (player.powerUps.length >= 3) {
        player.powerUps.shift(); // Remove oldest powerup if inventory is full
      }
      player.powerUps.push(powerUp);
      this.eventEmitter.emit("powerUpGained", { playerId: player.id, powerUp });
    }
  }

  checkDynamicEvents(player) {
    const randomEventTrigger = Math.random();

    if (randomEventTrigger < 0.05) { // 5% chance for Cell Swap
      const opponent = this.gameState.getRandomOpponent(player.id);
      if (opponent) {
        [player.position, opponent.position] = [opponent.position, player.position];
        this.eventEmitter.emit("cellSwap", { playerId: player.id, opponentId: opponent.id });
      }
    } else if (randomEventTrigger < 0.10) { // Additional 5% for Arena Blackout
      this.gameState.blackoutTurns = 1;
      this.eventEmitter.emit("arenaBlackout", {});
    }
  }

  eliminatePlayer(playerId) {
    const player = this.gameState.getPlayer(playerId);
    if (player) {
      player.isEliminated = true;
      this.eventEmitter.emit("playerEliminated", { playerId });
    }
  }

  leaderboardUpdate() {
    const players = this.gameState.getAllPlayers();
    players.forEach(player => {
      player.tags = [];
      if (player.shotsFired > 10) player.tags.push("Top Shooter");
      if (player.survivalTurns > 20) player.tags.push("Survivor");
      if (player.comebackScore > 50) player.tags.push("Comeback King");
    });
    this.eventEmitter.emit("leaderboardUpdated", { players });
  }

  endGame() {
    const tiedPlayers = this.gameState.getTiedPlayers();
    if (tiedPlayers.length > 1) {
      this.suddenDeath(tiedPlayers);
    } else {
      const winner = this.gameState.getWinner();
      this.eventEmitter.emit("gameEnded", { winner });
    }
  }

  suddenDeath(players) {
    players.forEach(player => {
      const diceRoll = this.dice.roll();
      player.lastRoll = diceRoll;
    });

    const highestRoll = Math.max(...players.map(player => player.lastRoll));
    const winners = players.filter(player => player.lastRoll === highestRoll);

    if (winners.length === 1) {
      this.gameState.declareWinner(winners[0].id);
      this.eventEmitter.emit("suddenDeathWinner", { playerId: winners[0].id });
    } else {
      this.suddenDeath(winners); // Recursively resolve ties in sudden death
    }
  }
}

export default GameService;
