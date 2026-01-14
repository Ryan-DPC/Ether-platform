import geckos, { GeckosServer, iceServers } from '@geckos.io/server';
import axios from 'axios';
import dotenv from 'dotenv';
import { encode, decode } from '@msgpack/msgpack';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3002');
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000/api';

// Initialize Geckos (UDP-like transport via WebRTC)
const io = geckos({
  iceServers: process.env.NODE_ENV === 'production' ? iceServers : [],
  cors: { allowAuthorization: true, origin: '*' },
});

io.listen(PORT); // Listen on port

console.log(`🚀 Game Server (UDP/Geckos) running on port ${PORT}`);

// Game Types
interface GameState {
  turn: string; // playerId (not socket id, use channel.id)
  scores: Record<string, number>;
  round: number;
}

interface Lobby {
  id: string;
  players: string[]; // channel ids
  gameType: string;
  status: 'waiting' | 'playing';
  hostId: string;
  state?: GameState;
}

const lobbies: Map<string, Lobby> = new Map();

io.onConnection((channel) => {
  console.log(`Player connected via UDP: ${channel.id}`);

  // 1. Auth Handshake
  channel.on('auth', async (data: any) => {
    // data is likely { token: ... }
    channel.emit('auth:success', { id: channel.id });
  });

  // 2. Create Lobby (1v1)
  channel.on('lobby:create', (userId: any) => {
    const lobbyId = Math.random().toString(36).substring(7);
    lobbies.set(lobbyId, {
      id: lobbyId,
      players: [channel.id as string],
      gameType: 'Aether Strike',
      status: 'waiting',
      hostId: channel.id as string,
    });
    channel.join(lobbyId);
    channel.emit('lobby:joined', { lobbyId, isHost: true });
    console.log(`Lobby 1v1 created: ${lobbyId} by ${channel.id}`);
  });

  // 3. Join Lobby
  channel.on('lobby:join', (lobbyId: any) => {
    // Geckos data might need explicit casting if strictly typed but for now 'any'
    const id = typeof lobbyId === 'object' ? lobbyId.lobbyId : lobbyId; // Handle potential JSON wrapping

    const lobby = lobbies.get(id);
    if (lobby && lobby.status === 'waiting' && lobby.players.length < 2) {
      lobby.players.push(channel.id as string);
      channel.join(id);

      channel.emit('lobby:joined', { lobbyId: id, isHost: false });
      io.room(id).emit('player:joined', { playerId: channel.id, count: lobby.players.length });

      if (lobby.players.length === 2) {
        // Auto-start for test
        lobby.status = 'playing';
        lobby.state = {
          turn: lobby.hostId,
          scores: { [lobby.players[0]]: 0, [lobby.players[1]]: 0 },
          round: 1,
        };
        io.room(id).emit('game:started', {
          map: 'default_arena',
          players: lobby.players,
          state: lobby.state,
        });
        console.log(`1v1 Game started in lobby ${id}`);
      }
    } else {
      channel.emit('lobby:error', { message: 'Lobby full or not found' });
    }
  });

  // 4. Game Action (MsgPack Supported)
  channel.on('game:move', (data: any) => {
    let payload = data;
    // Decode if binary
    if (
      data instanceof ArrayBuffer ||
      data instanceof Uint8Array ||
      (typeof Buffer !== 'undefined' && Buffer.isBuffer(data))
    ) {
      try {
        payload = decode(data);
      } catch (e) {
        console.error('Failed to decode MsgPack:', e);
        return;
      }
    }

    const { lobbyId, action } = payload;
    const lobby = lobbies.get(lobbyId);

    if (lobby && lobby.status === 'playing' && lobby.state) {
      if (lobby.state.turn !== channel.id) {
        channel.emit('error', { message: 'Not your turn' });
        return;
      }

      console.log(`Move from ${channel.id}: ${action}`);

      // Switch turn
      const opponent = lobby.players.find((p) => p !== channel.id);
      if (opponent) {
        lobby.state.turn = opponent;
        lobby.state.round++;

        // Broadcast update (Encoded)
        const updateData = {
          lastAction: { player: channel.id, action: action },
          state: lobby.state,
        };

        // Binary Emit
        io.room(lobbyId).emit('game:update', encode(updateData));
      }
    }
  });

  // 6. Match End (Report Stats)
  channel.on('match:end', async (data: any) => {
    console.log('Match ended:', data);
    // Here we would call the Backend API to save stats
    // await axios.post(`${BACKEND_URL}/games/match/end`, data.results);

    // Cleanup
    lobbies.delete(data.lobbyId);
  });

  channel.onDisconnect(() => {
    console.log(`Player disconnected: ${channel.id}`);
    lobbies.forEach((lobby, id) => {
      const idx = lobby.players.indexOf(channel.id as string);
      if (idx !== -1) {
        lobby.players.splice(idx, 1);
        io.room(id).emit('player:left', { playerId: channel.id });
        if (lobby.players.length === 0) {
          lobbies.delete(id);
        }
      }
    });
  });
});
