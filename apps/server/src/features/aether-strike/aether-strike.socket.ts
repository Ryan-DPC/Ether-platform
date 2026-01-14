import { WebSocketService } from '../../services/websocket.service';

// Basic logger shim
const logger = {
  info: (msg: string) => console.log(msg),
  debug: (msg: string) => console.log(msg),
  error: (msg: string) => console.error(msg),
};

class GameLobby {
  id: string;
  hostId: string;
  players: Map<string, any> = new Map(); // socketId -> playerData
  isStarted: boolean = false;

  constructor(id: string, hostId: string) {
    this.id = id;
    this.hostId = hostId;
  }
}

class AetherStrikeManager {
  private lobbies: Map<string, GameLobby> = new Map();

  handleMessage(ws: any, type: string, payload: any) {
    // 1. CREATE GAME
    if (type === 'aether-strike:create-game') {
      const gameId = payload.gameId; // Sent by client "test" etc.
      const userId = ws.data.userId || ws.id;
      const username = ws.data.username || 'Unknown';
      const playerClass = payload.playerClass || 'warrior';

      let lobby = this.lobbies.get(gameId);
      if (lobby) {
        // Lobby exists? reset or error?
        // simple logic: reject or join as host?
        // taking over for dev simplicity if not started
      } else {
        lobby = new GameLobby(gameId, userId);
        this.lobbies.set(gameId, lobby);
      }

      // Add host to players
      lobby.players.set(ws.id, {
        userId,
        username,
        class: playerClass,
        position: { x: 200, y: 450 }, // default spawn
        socket: ws,
      });

      ws.subscribe(`aether-strike:${gameId}`);

      logger.info(`[Aether Strike] Game created: ${gameId} by ${username}`);

      // Notify client he is host
      ws.send(
        JSON.stringify({
          type: 'aether-strike:new-host',
          data: { hostId: userId },
        })
      );

      this.broadcastGameState(lobby);
      return;
    }

    // 2. JOIN GAME
    if (type === 'aether-strike:join-game') {
      const gameId = payload.gameId;
      const userId = ws.data.userId || ws.id;
      const username = ws.data.username || 'Unknown';
      const playerClass = payload.playerClass || 'warrior';

      const lobby = this.lobbies.get(gameId);
      if (!lobby) {
        ws.send(JSON.stringify({ type: 'error', data: { message: 'Lobby not found' } }));
        return;
      }

      lobby.players.set(ws.id, {
        userId,
        username,
        class: playerClass,
        position: { x: 400, y: 450 },
        socket: ws,
      });

      ws.subscribe(`aether-strike:${gameId}`);
      logger.info(`[Aether Strike] ${username} joined ${gameId}`);

      // Notify others
      ws.publish(
        `aether-strike:${gameId}`,
        JSON.stringify({
          type: 'aether-strike:player-joined',
          data: { playerId: userId, username },
        })
      );

      this.broadcastGameState(lobby);
      return;
    }

    // 3. START GAME
    if (type === 'aether-strike:start-game') {
      // Find lobby for this socket
      const lobby = this.findLobbyBySocket(ws);
      if (lobby && lobby.hostId === ws.data.userId) {
        lobby.isStarted = true;
        logger.info(`[Aether Strike] Game started: ${lobby.id}`);

        // Broadcast start
        const msg = JSON.stringify({ type: 'aether-strike:game-started', data: {} });
        ws.publish(`aether-strike:${lobby.id}`, msg);
        ws.send(msg);
      }
      return;
    }

    // 4. PLAYER INPUT (Movement/Action)
    if (type === 'aether-strike:player-input') {
      const lobby = this.findLobbyBySocket(ws);
      if (lobby) {
        const player = lobby.players.get(ws.id);
        if (player) {
          // Update internal state
          player.position = { x: payload.position[0], y: payload.position[1] };
          player.velocity = { x: payload.velocity[0], y: payload.velocity[1] };
          player.action = payload.action;

          // Broadcast update
          ws.publish(
            `aether-strike:${lobby.id}`,
            JSON.stringify({
              type: 'aether-strike:player-update',
              data: {
                playerId: player.userId,
                position: payload.position,
                velocity: payload.velocity,
                action: payload.action,
              },
            })
          );
        }
      }
      return;
    }

    // 5. LEAVE GAME
    if (type === 'aether-strike:leave-game') {
      this.handleDisconnect(ws);
    }
  }

  handleDisconnect(ws: any) {
    const lobby = this.findLobbyBySocket(ws);
    if (lobby) {
      const player = lobby.players.get(ws.id);
      if (player) {
        lobby.players.delete(ws.id);
        ws.unsubscribe(`aether-strike:${lobby.id}`);

        // Notify others
        const msg = JSON.stringify({
          type: 'aether-strike:player-left',
          data: { playerId: player.userId },
        });
        ws.publish(`aether-strike:${lobby.id}`, msg);

        // Clean up if empty
        if (lobby.players.size === 0) {
          this.lobbies.delete(lobby.id);
        }
      }
    }
  }

  findLobbyBySocket(socket: any): GameLobby | undefined {
    for (const lobby of this.lobbies.values()) {
      if (lobby.players.has(socket.id)) return lobby;
    }
    return undefined;
  }

  broadcastGameState(lobby: GameLobby) {
    const playersList = Array.from(lobby.players.values()).map((p) => ({
      userId: p.userId,
      username: p.username,
      class: p.class,
      position: p.position,
    }));

    const msg = JSON.stringify({
      type: 'aether-strike:game-state',
      data: {
        players: playersList,
        hostId: lobby.hostId,
        isStarted: lobby.isStarted,
      },
    });

    // Send to all in lobby
    for (const p of lobby.players.values()) {
      p.socket.send(msg);
    }
  }
}

export const aetherStrikeManager = new AetherStrikeManager();

export const handleAetherStrikeMessage = (ws: any, type: string, payload: any) => {
  aetherStrikeManager.handleMessage(ws, type, payload);
};

export const handleAetherStrikeDisconnect = (ws: any) => {
  aetherStrikeManager.handleDisconnect(ws);
};
