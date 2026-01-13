import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3002;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000/api'; // Default to localhost backend

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all for now (Game Clients)
    methods: ['GET', 'POST'],
  },
});

// Store active lobbies
interface Lobby {
  id: string;
  players: string[]; // socket ids
  gameType: string;
  status: 'waiting' | 'playing';
  hostId: string;
}

const lobbies: Map<string, Lobby> = new Map();

io.on('connection', (socket: Socket) => {
  console.log(`Player connected: ${socket.id}`);

  // 1. Auth Handshake (Optional but recommended)
  // Client sends { token: "..." }
  socket.on('auth', async (data: { token: string }) => {
    try {
      // Validate with Backend
      // const res = await axios.get(`${BACKEND_URL}/users/me`, { headers: { Authorization: `Bearer ${data.token}` } });
      // socket.data.user = res.data;
      // console.log(`User authenticated: ${res.data.username}`);
      socket.emit('auth:success', { id: socket.id });
    } catch (e) {
      console.error('Auth failed', e);
      socket.emit('auth:fail', { message: 'Invalid token' });
    }
  });

  // 2. Create Lobby
  socket.on('lobby:create', (userId: string) => {
    // User ID or username
    const lobbyId = Math.random().toString(36).substring(7);
    lobbies.set(lobbyId, {
      id: lobbyId,
      players: [socket.id],
      gameType: 'Aether Strike',
      status: 'waiting',
      hostId: socket.id,
    });
    socket.join(lobbyId);
    socket.emit('lobby:joined', { lobbyId, isHost: true });
    console.log(`Lobby created: ${lobbyId} by ${socket.id}`);
  });

  // 3. Join Lobby
  socket.on('lobby:join', (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby && lobby.status === 'waiting') {
      lobby.players.push(socket.id);
      socket.join(lobbyId);
      socket.emit('lobby:joined', { lobbyId, isHost: false });
      io.to(lobbyId).emit('player:joined', { playerId: socket.id, count: lobby.players.length });
      console.log(`Player ${socket.id} joined lobby ${lobbyId}`);
    } else {
      socket.emit('lobby:error', { message: 'Lobby not found or full' });
    }
  });

  // 4. Start Game
  socket.on('game:start', (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby && lobby.hostId === socket.id) {
      lobby.status = 'playing';
      io.to(lobbyId).emit('game:started', { map: 'default_arena' });
      console.log(`Game started in lobby ${lobbyId}`);
    }
  });

  // 5. Game Events (Relay)
  socket.on('game:action', (data: any) => {
    // Broadcast to others in the room
    // Assume data has { lobbyId, action, ... }
    if (data.lobbyId) {
      socket.to(data.lobbyId).emit('game:action', { sender: socket.id, ...data });
    }
  });

  // 6. Match End (Report Stats)
  socket.on('match:end', async (data: { lobbyId: string; results: any }) => {
    console.log('Match ended:', data);
    // Here we would call the Backend API to save stats
    // await axios.post(`${BACKEND_URL}/games/match/end`, data.results);

    // Cleanup
    lobbies.delete(data.lobbyId);
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    // Cleanup player from lobbies
    lobbies.forEach((lobby, id) => {
      const idx = lobby.players.indexOf(socket.id);
      if (idx !== -1) {
        lobby.players.splice(idx, 1);
        io.to(id).emit('player:left', { playerId: socket.id });
        if (lobby.players.length === 0) {
          lobbies.delete(id);
        }
      }
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Game Server running on port ${PORT}`);
});
