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
      const result = gameService.handlePlayerReconnect(socket.id, username);
      if (result.success) {
        socket.join(roomId);
        socket.emit(EVENTS.REJOIN_SUCCESS, { room: result.room });
        socket.to(roomId).emit('playerRejoined', { username });
      } else {
        socket.emit(EVENTS.ERROR, { message: 'Failed to rejoin room' });
      }
    } catch (error) {
      socket.emit(EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on('quickMatch', ({ username }) => {
    try {
      const matchedRoomId = gameService.findQuickMatch(username);
      
      if (matchedRoomId) {
        const player = { id: socket.id, username, ready: false };
        const room = gameService.joinRoom(matchedRoomId, player);
        socket.join(matchedRoomId);
        io.to(matchedRoomId).emit(EVENTS.PLAYER_JOINED, { room });
      } else {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const room = gameService.createRoom(roomId, 4);
        const player = { id: socket.id, username, ready: false };
        gameService.joinRoom(roomId, player);
        socket.join(roomId);
        socket.emit(EVENTS.ROOM_CREATED, { room });

        setTimeout(() => {
          const currentRoom = gameService.rooms.get(roomId);
          if (currentRoom && currentRoom.players.length === 1) {
            socket.emit('quickMatchTimeout');
          }
        }, 20000);
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

  socket.on('leaveRoom', () => {
    try {
      for (const [roomId, room] of gameService.rooms.entries()) {
        const result = gameService.removePlayerFromRoom(socket.id, roomId);
        if (result) {
          if (result.roomDeleted) {
            io.to(roomId).emit('roomDeleted', {
              message: 'Room has been closed by the host'
            });
          } else {
            socket.to(roomId).emit(EVENTS.PLAYER_LEFT, {
              room,
              username: result.player.username
            });
          }
          socket.leave(roomId);
          break;
        }
      }
    } catch (error) {
      socket.emit(EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const result = gameService.handlePlayerDisconnect(socket.id);
    if (result.room && result.player) {
      socket.to(result.room.id).emit('playerDisconnected', {
        username: result.player.username
      });
    }
  });

  // Other event handlers remain the same...
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
