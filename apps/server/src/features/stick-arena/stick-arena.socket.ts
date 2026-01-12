import { WebSocketService } from '../../services/websocket.service';

// Basic logger shim
const logger = {
  info: (msg: string) => console.log(msg),
  debug: (msg: string) => console.log(msg),
  error: (msg: string) => console.error(msg),
};

class GameRoom {
  id: string;
  player1: { socket: any; id: string; score: number };
  player2: { socket: any; id: string; score: number };
  createdAt: number;

  constructor(player1Socket: any, player2Socket: any, player1Id: string, player2Id: string) {
    this.id = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.player1 = {
      socket: player1Socket,
      id: player1Id,
      score: 0,
    };
    this.player2 = {
      socket: player2Socket,
      id: player2Id,
      score: 0,
    };
    this.createdAt = Date.now();
    logger.info(`[Stick Arena] Room created: ${this.id} (${player1Id} vs ${player2Id})`);
  }

  getOpponent(socket: any) {
    return this.player1.socket === socket ? this.player2 : this.player1;
  }
}

class StickArenaManager {
  private rooms: Map<string, GameRoom> = new Map();
  private waitingPlayers: Map<string, any> = new Map();

  handleMessage(ws: any, type: string, payload: any) {
    // Relay mapping for simple events
    const relayEvents = [
      'stick-arena:playerUpdate',
      'stick-arena:shoot',
      'stick-arena:melee',
      'stick-arena:playerDamaged',
      'stick-arena:powerupSpawned',
      'stick-arena:powerupCollected',
      'stick-arena:chat',
    ];

    // Specific handlers
    if (type === 'stick-arena:join') {
      const userId = payload.userId || ws.id;
      ws.data.userId = userId;
      logger.info(`[Stick Arena] Player joined: ${userId}`);
      ws.send(JSON.stringify({ type: 'stick-arena:joined', data: { userId } }));
      return;
    }

    if (type === 'stick-arena:findMatch') {
      this.handleFindMatch(ws, payload);
      return;
    }

    if (type === 'stick-arena:leaveMatch') {
      this.handlePlayerLeave(ws);
      return;
    }

    if (type === 'stick-arena:roundEnd') {
      this.handleRoundEnd(ws, payload);
      return;
    }

    // Relays
    if (type === 'stick-arena:playerUpdate') {
      const room = this.findRoomBySocket(ws);
      if (room) {
        ws.publish(
          room.id,
          JSON.stringify({
            type: 'stick-arena:opponentMoved',
            data: { ...payload.state, playerId: payload.playerId },
          })
        );
      }
      return;
    }

    if (type === 'stick-arena:shoot') {
      const room = this.findRoomBySocket(ws);
      if (room) {
        ws.publish(
          room.id,
          JSON.stringify({ type: 'stick-arena:projectileCreated', data: payload.projectile })
        );
      }
      return;
    }

    if (type === 'stick-arena:melee') {
      const room = this.findRoomBySocket(ws);
      if (room) {
        ws.publish(room.id, JSON.stringify({ type: 'stick-arena:playerMelee', data: payload }));
      }
      return;
    }

    if (type === 'stick-arena:playerDamaged') {
      const room = this.findRoomBySocket(ws);
      if (room) {
        ws.publish(room.id, JSON.stringify({ type: 'stick-arena:playerDamaged', data: payload }));
      }
      return;
    }

    if (type === 'stick-arena:powerupSpawned') {
      const room = this.findRoomBySocket(ws);
      if (room) {
        ws.publish(
          room.id,
          JSON.stringify({ type: 'stick-arena:powerupSpawned', data: payload.powerup })
        );
      }
      return;
    }

    if (type === 'stick-arena:powerupCollected') {
      const room = this.findRoomBySocket(ws);
      if (room) {
        ws.publish(
          room.id,
          JSON.stringify({ type: 'stick-arena:powerupCollected', data: payload })
        );
      }
      return;
    }

    if (type === 'stick-arena:chat') {
      const room = this.findRoomBySocket(ws);
      if (room) {
        ws.publish(
          room.id,
          JSON.stringify({
            type: 'stick-arena:chat',
            data: {
              senderId: ws.data.userId || 'Anonymous',
              message: payload.message,
            },
          })
        );
      }
      return;
    }
  }

  handleFindMatch(ws: any, payload: any) {
    const userId = payload.userId || ws.id;

    if (this.waitingPlayers.has(userId)) return;

    const waitingEntries = Array.from(this.waitingPlayers.entries());

    // Ensure we don't match with self if same user connects twice (though socket diff)
    const validOpponentEntry = waitingEntries.find(([oppId, _]) => oppId !== userId);

    if (!validOpponentEntry) {
      this.waitingPlayers.set(userId, ws);
      ws.send(
        JSON.stringify({
          type: 'stick-arena:waiting',
          data: { message: 'Waiting for opponent...' },
        })
      );
    } else {
      const [opponentId, opponentSocket] = validOpponentEntry;
      this.waitingPlayers.delete(opponentId);

      const room = new GameRoom(opponentSocket, ws, opponentId, userId);
      this.rooms.set(room.id, room);

      // Join Room (Subscribe)
      opponentSocket.subscribe(room.id);
      ws.subscribe(room.id);

      // Notify P1 (Opponent)
      opponentSocket.send(
        JSON.stringify({
          type: 'stick-arena:matchFound',
          data: {
            roomId: room.id,
            playerId: 1, // Host/P1
            opponentId: userId,
            opponentSocket: ws.id,
          },
        })
      );

      // Notify P2 (Current User)
      ws.send(
        JSON.stringify({
          type: 'stick-arena:matchFound',
          data: {
            roomId: room.id,
            playerId: 2, // Client/P2
            opponentId: opponentId,
            opponentSocket: opponentSocket.id,
          },
        })
      );
    }
  }

  handleRoundEnd(ws: any, data: any) {
    const room = this.findRoomBySocket(ws);
    if (room) {
      if (data.winnerId === 1) room.player1.score++;
      else if (data.winnerId === 2) room.player2.score++;

      // Broadcast result using server publish to ensure both get it (including sender)
      // ws.publish sends to others. ws.send sends to self.
      // Or use WebSocketService.publish(room.id, ...) if wired up to global server.

      const payload = JSON.stringify({
        type: 'stick-arena:roundEnd',
        data: {
          winnerId: data.winnerId,
          scores: {
            player1: room.player1.score,
            player2: room.player2.score,
          },
        },
      });

      ws.publish(room.id, payload); // To opponent
      ws.send(payload); // To self
    }
  }

  handlePlayerLeave(ws: any) {
    const userId = ws.data.userId || ws.id;
    this.waitingPlayers.delete(userId);

    const room = this.findRoomBySocket(ws);
    if (room) {
      const opponent = room.getOpponent(ws);
      opponent.socket.send(
        JSON.stringify({
          type: 'stick-arena:opponentDisconnected',
          data: { message: 'Opponent disconnected' },
        })
      );

      ws.unsubscribe(room.id);
      opponent.socket.unsubscribe(room.id);
      this.rooms.delete(room.id);
      logger.info(`[Stick Arena] Room closed: ${room.id}`);
    }
  }

  findRoomBySocket(socket: any) {
    for (const room of this.rooms.values()) {
      if (room.player1.socket === socket || room.player2.socket === socket) return room;
    }
    return null;
  }

  handleDisconnect(ws: any) {
    this.handlePlayerLeave(ws);
  }
}

export const stickArenaManager = new StickArenaManager();

export const handleStickArenaMessage = (ws: any, type: string, payload: any) => {
  stickArenaManager.handleMessage(ws, type, payload);
};

export const handleStickArenaDisconnect = (ws: any) => {
  stickArenaManager.handleDisconnect(ws);
};
