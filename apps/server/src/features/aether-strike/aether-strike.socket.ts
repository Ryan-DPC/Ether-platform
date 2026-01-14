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

  // Combat State
  currentTurnActorId: string | null = null;
  turnOrder: string[] = []; // string of userId or 'enemy'
  enemyHp: number = 500;
  enemyMaxHp: number = 500;

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

      // Notify others (Manual loop for reliability)
      const joinMsg = JSON.stringify({
        type: 'aether-strike:player-joined',
        data: { playerId: userId, username, class: playerClass },
      });

      for (const p of lobby.players.values()) {
        p.socket.send(joinMsg);
      }

      this.broadcastGameState(lobby);
      return;
    }

    // 3. START GAME
    if (type === 'aether-strike:start-game') {
      const lobby = this.findLobbyBySocket(ws);
      if (lobby && lobby.hostId === ws.data.userId) {
        lobby.isStarted = true;

        // Initialize Turned-based combat order based on speed
        const getSpeed = (cls: string) => {
          switch (cls.toLowerCase()) {
            case 'archer':
              return 120;
            case 'mage':
              return 100;
            case 'warrior':
              return 80;
            default:
              return 80;
          }
        };

        const participants = Array.from(lobby.players.values()).map((p) => ({
          id: p.userId,
          speed: getSpeed(p.class),
        }));
        participants.push({ id: 'enemy', speed: 90 }); // Enemy speed 90

        // Sort by speed descending
        participants.sort((a, b) => b.speed - a.speed);
        lobby.turnOrder = participants.map((p) => p.id);
        lobby.currentTurnActorId = lobby.turnOrder[0];

        logger.info(
          `[Aether Strike] Game started: ${lobby.id}. Turn order: ${lobby.turnOrder.join(', ')}`
        );

        // Broadcast start
        const startMsg = JSON.stringify({ type: 'aether-strike:game-started', data: {} });
        const turnMsg = JSON.stringify({
          type: 'aether-strike:turn-changed',
          data: { currentTurnId: lobby.currentTurnActorId },
        });

        for (const p of lobby.players.values()) {
          p.socket.send(startMsg);
          p.socket.send(turnMsg);
        }
      }
      return;
    }

    // 4. CHANGE CLASS (Lobby)
    if (type === 'aether-strike:change-class') {
      const lobby = this.findLobbyBySocket(ws);
      if (lobby) {
        const player = lobby.players.get(ws.id);
        if (player) {
          player.class = payload.newClass;

          // Broadcast update
          const updateMsg = JSON.stringify({
            type: 'aether-strike:player-updated',
            data: {
              playerId: player.userId,
              username: player.username,
              class: player.class,
              position: player.position,
            },
          });

          // Send to everyone in the lobby to ensure sync
          for (const p of lobby.players.values()) {
            p.socket.send(updateMsg);
          }

          // Full state sync for safety
          this.broadcastGameState(lobby);
        }
      }
      return;
    }

    // 6. USE ATTACK
    if (type === 'aether-strike:use-attack') {
      const lobby = this.findLobbyBySocket(ws);
      if (lobby && lobby.currentTurnActorId === ws.data.userId) {
        const player = lobby.players.get(ws.id);
        const { attackName, targetId } = payload;

        // Mock Damage/Mana calculation based on attack name
        // (In a real game, this would be validated against class system)
        let damage = 20;
        let manaCost = 10;
        const isArea = false;

        if (attackName.toLowerCase() === 'shoot') {
          damage = 15;
          manaCost = 0;
        }
        if (attackName.toLowerCase() === 'fireball') {
          damage = 40;
          manaCost = 30;
        }

        if (targetId === 'enemy') {
          lobby.enemyHp = Math.max(0, lobby.enemyHp - damage);
        }

        const actionMsg = JSON.stringify({
          type: 'aether-strike:combat-action',
          data: {
            actorId: player.userId,
            targetId,
            actionName: attackName,
            damage,
            manaCost,
            isArea,
          },
        });

        for (const p of lobby.players.values()) {
          p.socket.send(actionMsg);
        }

        // Auto end turn after attack? User choice usually, but let's allow manual end-turn too.
        // For simplicity, let's auto-end turn after an attack for now.
        this.nextTurn(lobby);
      }
      return;
    }

    // 7. END TURN
    if (type === 'aether-strike:end-turn') {
      const lobby = this.findLobbyBySocket(ws);
      if (lobby && lobby.currentTurnActorId === ws.data.userId) {
        this.nextTurn(lobby);
      }
      return;
    }

    // 8. FLEE
    if (type === 'aether-strike:flee') {
      const lobby = this.findLobbyBySocket(ws);
      if (lobby && lobby.currentTurnActorId === ws.data.userId) {
        const actionMsg = JSON.stringify({
          type: 'aether-strike:combat-action',
          data: {
            actorId: ws.data.userId,
            actionName: 'Flee',
            damage: 0,
            manaCost: 0,
            isArea: false,
          },
        });
        for (const p of lobby.players.values()) {
          p.socket.send(actionMsg);
        }
        // Logic for flee could be disconnection or lobby exit
        this.nextTurn(lobby);
      }
      return;
    }

    // 5. PLAYER INPUT (Movement/Action)
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
        const leftMsg = JSON.stringify({
          type: 'aether-strike:player-left',
          data: { playerId: player.userId },
        });

        for (const p of lobby.players.values()) {
          p.socket.send(leftMsg);
        }

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

  private nextTurn(lobby: GameLobby) {
    if (!lobby.turnOrder.length) return;

    const currentIndex = lobby.turnOrder.indexOf(lobby.currentTurnActorId!);
    const nextIndex = (currentIndex + 1) % lobby.turnOrder.length;
    lobby.currentTurnActorId = lobby.turnOrder[nextIndex];

    logger.info(`[Aether Strike] Turn changed to: ${lobby.currentTurnActorId}`);

    const turnMsg = JSON.stringify({
      type: 'aether-strike:turn-changed',
      data: { currentTurnId: lobby.currentTurnActorId },
    });

    for (const p of lobby.players.values()) {
      p.socket.send(turnMsg);
    }

    if (lobby.currentTurnActorId === 'enemy') {
      setTimeout(() => this.executeEnemyTurn(lobby), 2000);
    }
  }

  private executeEnemyTurn(lobby: GameLobby) {
    if (!lobby.isStarted || lobby.currentTurnActorId !== 'enemy') return;

    const players = Array.from(lobby.players.values());
    if (!players.length) return;

    // AI Logic: Alternate between area attack and single target
    const isArea = Math.random() > 0.5;
    const damage = isArea ? 15 : 30;
    const actionName = isArea ? 'Earthquake (AOE)' : 'Crush';
    const target = players[Math.floor(Math.random() * players.length)];

    const actionMsg = JSON.stringify({
      type: 'aether-strike:combat-action',
      data: {
        actorId: 'enemy',
        targetId: isArea ? null : target.userId,
        actionName,
        damage,
        manaCost: 0,
        isArea,
      },
    });

    for (const p of lobby.players.values()) {
      p.socket.send(actionMsg);
    }

    // End enemy turn
    setTimeout(() => this.nextTurn(lobby), 1500);
  }
}

export const aetherStrikeManager = new AetherStrikeManager();

export const handleAetherStrikeMessage = (ws: any, type: string, payload: any) => {
  aetherStrikeManager.handleMessage(ws, type, payload);
};

export const handleAetherStrikeDisconnect = (ws: any) => {
  aetherStrikeManager.handleDisconnect(ws);
};
