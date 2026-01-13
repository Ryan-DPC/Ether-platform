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

interface GameState {
  turn: string; // socketId
  scores: Record<string, number>;
  round: number;
}

interface Lobby {
  id: string;
  players: string[]; // socket ids
  gameType: string;
  status: 'waiting' | 'playing';
  hostId: string;
  state?: GameState;
}

const lobbies: Map<string, Lobby> = new Map();

io.on('connection', (socket: Socket) => {
  console.log(`Player connected: ${socket.id}`);

  // 1. Auth Handshake
  socket.on('auth', async (data: { token: string }) => {
    // Mock Auth for test
    socket.emit('auth:success', { id: socket.id });
  });

  // 2. Create Lobby (1v1)
  socket.on('lobby:create', (userId: string) => {
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
    console.log(`Lobby 1v1 created: ${lobbyId} by ${socket.id}`);
  });

  // 3. Join Lobby
  socket.on('lobby:join', (lobbyId: string) => {
    const lobby = lobbies.get(lobbyId);
    if (lobby && lobby.status === 'waiting' && lobby.players.length < 2) {
      lobby.players.push(socket.id);
      socket.join(lobbyId);

      socket.emit('lobby:joined', { lobbyId, isHost: false });
      io.to(lobbyId).emit('player:joined', { playerId: socket.id, count: lobby.players.length });

      if (lobby.players.length === 2) {
        // Auto-start for test
        lobby.status = 'playing';
        lobby.state = {
          turn: lobby.hostId, // Host starts
          scores: { [lobby.players[0]]: 0, [lobby.players[1]]: 0 },
          round: 1,
        };
        io.to(lobbyId).emit('game:started', {
          map: 'default_arena',
          players: lobby.players,
          state: lobby.state,
        });
        console.log(`1v1 Game started in lobby ${lobbyId}`);
      }
    } else {
      socket.emit('lobby:error', { message: 'Lobby full or not found' });
    }
  });

  // 4. Game Action (Turn Based Test)
  socket.on('game:move', (data: { lobbyId: string; action: string }) => {
    const lobby = lobbies.get(data.lobbyId);
    if (lobby && lobby.status === 'playing' && lobby.state) {
      if (lobby.state.turn !== socket.id) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      // Process Move (Simplified)
      console.log(`Move from ${socket.id}: ${data.action}`);

      // Update State
      // Switch turn
      const opponent = lobby.players.find((p) => p !== socket.id);
      if (opponent) {
        lobby.state.turn = opponent;
        lobby.state.round++;

        // Broadcast update
        io.to(data.lobbyId).emit('game:update', {
          lastAction: { player: socket.id, action: data.action },
          state: lobby.state,
        });
      }
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
