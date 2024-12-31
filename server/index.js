import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors({
  origin: [
    'https://lambent-nasturtium-dbb11c.netlify.app',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST'],
  credentials: true
}));

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'https://lambent-nasturtium-dbb11c.netlify.app',
      'http://localhost:5173'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket']
});

const rooms = new Map();
const playerSessions = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('rejoinRoom', ({ roomId, username }) => {
    const session = playerSessions.get(username);
    if (session && rooms.has(session.roomId)) {
      const room = rooms.get(session.roomId);
      const playerIndex = room.players.findIndex(p => p.username === username);
      
      if (playerIndex !== -1) {
        // Update socket ID for the rejoining player
        room.players[playerIndex].id = socket.id;
        socket.join(roomId);
        socket.emit('rejoinSuccess', { room });
        socket.to(roomId).emit('playerRejoined', { username });
      }
    }
  });

  socket.on('quickMatch', ({ username }) => {
    // ... existing quickMatch logic ...
    // Add session tracking
    playerSessions.set(username, {
      socketId: socket.id,
      roomId: room.id
    });
  });

  socket.on('createRoom', ({ maxPlayers, password, username }) => {
    // ... existing createRoom logic ...
    // Add session tracking
    playerSessions.set(username, {
      socketId: socket.id,
      roomId: roomId
    });
  });

  socket.on('joinRoom', ({ roomId, password, username }) => {
    // ... existing joinRoom logic ...
    // Add session tracking
    playerSessions.set(username, {
      socketId: socket.id,
      roomId: roomId
    });
  });

  socket.on('leaveRoom', () => {
    // ... existing leaveRoom logic ...
    // Clean up session
    for (const [username, session] of playerSessions.entries()) {
      if (session.socketId === socket.id) {
        playerSessions.delete(username);
        break;
      }
    }
  });

  socket.on('disconnect', () => {
    // Keep session data for potential rejoin
    console.log('User disconnected:', socket.id);
  });

  // ... rest of the socket event handlers ...
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});