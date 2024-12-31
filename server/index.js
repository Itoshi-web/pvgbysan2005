import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import 'dotenv/config';
import { EVENTS, ORIGINS, PORT } from './config/constants.js';
import { GameService } from './services/GameService.js';

const app = express();
const gameService = new GameService();

app.use(cors({
  origin: ORIGINS,
  methods: ['GET', 'POST'],
  credentials: true
}));

app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'online',
    message: 'Dice Battle Arena Server',
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ORIGINS, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket']
});

io.on(EVENTS.CONNECT, (socket) => {
  console.log('User connected:', socket.id);

  socket.on('rejoinRoom', ({ roomId, username }) => {
    try {
      const session = gameService.playerSessions.get(username);
      if (session && gameService.rooms.has(session.roomId)) {
        const room = gameService.rooms.get(session.roomId);
        const playerIndex = room.players.findIndex(p => p.username === username);
        
        if (playerIndex !== -1) {
          room.players[playerIndex].id = socket.id;
          socket.join(roomId);
          socket.emit(EVENTS.REJOIN_SUCCESS, { room });
          socket.to(roomId).emit('playerRejoined', { username });
        }
      }
    } catch (error) {
      socket.emit(EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on('createRoom', ({ maxPlayers, password, username }) => {
    try {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const room = gameService.createRoom(roomId, maxPlayers, password);
      const player = { id: socket.id, username, ready: false };
      
      gameService.joinRoom(roomId, player, password);
      socket.join(roomId);
      socket.emit(EVENTS.ROOM_CREATED, { room });
    } catch (error) {
      socket.emit(EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on('joinRoom', ({ roomId, password, username }) => {
    try {
      const player = { id: socket.id, username, ready: false };
      const room = gameService.joinRoom(roomId, player, password);
      
      socket.join(roomId);
      io.to(roomId).emit(EVENTS.PLAYER_JOINED, { room });
    } catch (error) {
      socket.emit(EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on('toggleReady', ({ roomId, username }) => {
    try {
      const room = gameService.togglePlayerReady(roomId, username);
      io.to(roomId).emit(EVENTS.ROOM_UPDATED, { room });
    } catch (error) {
      socket.emit(EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on('startGame', ({ roomId }) => {
    try {
      const room = gameService.startGame(roomId);
      io.to(roomId).emit(EVENTS.GAME_STARTED, { gameState: room.gameState });
    } catch (error) {
      socket.emit(EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on('gameAction', ({ roomId, action, data }) => {
    try {
      const room = gameService.rooms.get(roomId);
      if (!room) throw new Error('Room not found');

      let updatedRoom;
      switch (action) {
        case 'roll':
          updatedRoom = gameService.handleRoll(roomId, data.value);
          break;
        case 'shoot':
          updatedRoom = gameService.handleShoot(roomId, data.targetPlayer, data.targetCell);
          break;
        default:
          throw new Error('Invalid game action');
      }

      // Check for game end
      const remainingPlayers = updatedRoom.gameState.players.filter(p => !p.eliminated);
      if (remainingPlayers.length === 1) {
        const winner = remainingPlayers[0];
        const history = {
          winner: winner.username,
          eliminations: updatedRoom.gameState.gameLog
            .filter(log => log.type === 'eliminate')
            .map(log => ({
              eliminator: log.shooter,
              eliminated: log.player
            })),
          playerStats: Object.fromEntries(
            updatedRoom.gameState.players.map(player => [
              player.username,
              {
                shotsFired: player.cells.reduce((acc, cell) => acc + (5 - (cell.bullets || 0)), 0),
                eliminations: updatedRoom.gameState.gameLog.filter(log => 
                  log.type === 'eliminate' && log.shooter === player.username
                ).length,
                timesTargeted: updatedRoom.gameState.gameLog.filter(log =>
                  log.type === 'shoot' && log.target === player.username
                ).length
              }
            ])
          )
        };
        io.to(roomId).emit(EVENTS.GAME_ENDED, { history });
      }

      io.to(roomId).emit(EVENTS.GAME_STATE_UPDATED, { gameState: updatedRoom.gameState });
    } catch (error) {
      socket.emit(EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on('leaveRoom', () => {
    try {
      for (const [roomId, room] of gameService.rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          const username = room.players[playerIndex].username;
          room.removePlayer(socket.id);
          
          if (room.isEmpty()) {
            gameService.rooms.delete(roomId);
          } else {
            socket.to(roomId).emit(EVENTS.PLAYER_LEFT, { room, username });
          }
          
          socket.leave(roomId);
          break;
        }
      }
    } catch (error) {
      socket.emit(EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on('sendEmote', ({ roomId, emote }) => {
    try {
      const room = gameService.rooms.get(roomId);
      if (!room) throw new Error('Room not found');

      const player = room.players.find(p => p.id === socket.id);
      if (!player) throw new Error('Player not found');

      io.to(roomId).emit('emote', { username: player.username, emote });
    } catch (error) {
      socket.emit(EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const [roomId, room] of gameService.rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const username = room.players[playerIndex].username;
        socket.to(roomId).emit(EVENTS.PLAYER_LEFT, { room, username });
        break;
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
