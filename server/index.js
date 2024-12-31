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
    'https://inspiring-macaron-2070dc.netlify.app',
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
    if (!roomId || !username) {
      socket.emit('error', { message: 'Room ID and username are required' });
      return;
    }

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
    if (!username) {
      socket.emit('error', { message: 'Username is required' });
      return;
    }

    // ... rest of quickMatch logic ...
    // Make sure to define roomId before using it
    const roomId = generateRoomId();
    playerSessions.set(username, {
      socketId: socket.id,
      roomId: roomId
    });
  });

  socket.on('createRoom', ({ maxPlayers, password, username }) => {
    if (!username) {
      socket.emit('error', { message: 'Username is required' });
      return;
    }

    const roomId = generateRoomId();
    playerSessions.set(username, {
      socketId: socket.id,
      roomId: roomId
    });
    // ... rest of createRoom logic ...
  });

  socket.on('joinRoom', ({ roomId, password, username }) => {
    if (!roomId || !username) {
      socket.emit('error', { message: 'Room ID and username are required' });
      return;
    }

    playerSessions.set(username, {
      socketId: socket.id,
      roomId: roomId
    });
    // ... rest of joinRoom logic ...
  });

  socket.on('leaveRoom', () => {
    // Find the session for this socket
    let userSession;
    for (const [username, session] of playerSessions.entries()) {
      if (session.socketId === socket.id) {
        userSession = { username, ...session };
        playerSessions.delete(username);
        break;
      }
    }

    if (userSession && rooms.has(userSession.roomId)) {
      const room = rooms.get(userSession.roomId);
      // ... handle room cleanup ...
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
