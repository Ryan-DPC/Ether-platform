
import { WebSocketService } from '../../services/websocket.service';
import { stickArenaStatsService } from './stick-arena-stats.service';

interface Player {
    userId: string;
    ws: any; // WebSocket instance
    score: number;
    playerNumber: 1 | 2;
}

class GameRoom {
    id: string;
    player1: Player;
    player2: Player;
    createdAt: number;

    constructor(p1UserId: string, p1Ws: any, p2UserId: string, p2Ws: any) {
        this.id = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.player1 = { userId: p1UserId, ws: p1Ws, score: 0, playerNumber: 1 };
        this.player2 = { userId: p2UserId, ws: p2Ws, score: 0, playerNumber: 2 };
        this.createdAt = Date.now();
    }

    getOpponent(ws: any) {
        return this.player1.ws === ws ? this.player2 : this.player1;
    }

    getPlayer(ws: any) {
        return this.player1.ws === ws ? this.player1 : this.player2;
    }
}

// Global State
const rooms = new Map<string, GameRoom>();
const waitingPlayers = new Map<string, any>(); // userId -> ws

// Helper to find room by socket
const findRoomBySocket = (ws: any): GameRoom | undefined => {
    // This is O(N), inefficient but fine for now. Better to store roomId in ws.data
    // But ws.data access here depends on how we pass it.
    // If we can rely on ws.data.roomId, simpler.
    // Let's implement storing roomId in ws.data in the main handler.
    if (ws.data.stickArenaRoomId) {
        return rooms.get(ws.data.stickArenaRoomId);
    }
    return undefined;
};

export const handleStickArenaMessage = async (ws: any, event: string, payload: any) => {
    const userId = ws.data.userId;
    const username = ws.data.username;

    switch (event) {
        case 'stick-arena:join':
            // Logic handled on connection/open generally, but explicit join allows retrying
            ws.send(JSON.stringify({ type: 'stick-arena:joined', data: { userId } }));
            break;

        case 'stick-arena:findMatch':
            if (waitingPlayers.has(userId)) return;

            const waitingEntries = Array.from(waitingPlayers.entries());
            if (waitingEntries.length === 0) {
                // No one waiting, add self
                waitingPlayers.set(userId, ws);
                ws.send(JSON.stringify({ type: 'stick-arena:waiting', data: { message: 'Waiting for opponent...' } }));
            } else {
                // Found opponent
                const [opponentId, opponentWs] = waitingEntries[0];

                // Verify opponent is still connected (check readyState)
                if (opponentWs.readyState !== 1) { // 1 = OPEN
                    waitingPlayers.delete(opponentId);
                    // Retry with next or add self
                    waitingPlayers.set(userId, ws);
                    ws.send(JSON.stringify({ type: 'stick-arena:waiting', data: { message: 'Waiting for opponent...' } }));
                    return;
                }

                waitingPlayers.delete(opponentId);

                // Create Room
                const room = new GameRoom(opponentId, opponentWs, userId, ws);
                rooms.set(room.id, room);

                // Store roomId on sockets
                opponentWs.data.stickArenaRoomId = room.id;
                ws.data.stickArenaRoomId = room.id;

                // Subscribe to room topic
                opponentWs.subscribe(room.id);
                ws.subscribe(room.id);

                console.log(`[Stick Arena] Match found: ${room.id} (${opponentId} vs ${userId})`);

                // Notify P1 (Host/Opponent)
                opponentWs.send(JSON.stringify({
                    type: 'stick-arena:matchFound',
                    data: {
                        roomId: room.id,
                        playerId: 1,
                        opponentId: userId
                    }
                }));

                // Notify P2 (Client/Self)
                ws.send(JSON.stringify({
                    type: 'stick-arena:matchFound',
                    data: {
                        roomId: room.id,
                        playerId: 2,
                        opponentId: opponentId
                    }
                }));
            }
            break;

        // Relay Events (Forward to opponent via topic)
        case 'stick-arena:playerUpdate':
        case 'stick-arena:shoot':
        case 'stick-arena:melee':
        case 'stick-arena:playerDamaged':
        case 'stick-arena:powerupSpawned':
        case 'stick-arena:powerupCollected':
        case 'stick-arena:chat':
            if (ws.data.stickArenaRoomId) {
                // ws.publish sends to everyone in topic EXCEPT sender. Perfect for relay.
                ws.publish(ws.data.stickArenaRoomId, JSON.stringify({
                    type: event === 'stick-arena:playerUpdate' ? 'stick-arena:opponentMoved' : event,
                    data: payload
                }));
            }
            break;

        case 'stick-arena:roundEnd':
            const room = rooms.get(ws.data.stickArenaRoomId);
            if (room) {
                if (payload.winnerId === 1) room.player1.score++;
                else if (payload.winnerId === 2) room.player2.score++;

                // Broadcast result using Server publish (to all, including sender)
                // Wait, we need access to Server publish.
                // OR we can use ws.publish (to opponent) AND ws.send (to self).
                // Or we use WebSocketService.publish(room.id) if it covers room topics? 
                // ws.subscribe matches what WebSocketService publishes to? Yes.
                // But wait, WebSocketService.publish uses server.publish.
                // Let's use ws.publish to opponent and ws.send to self for simplicity.

                const resultData = {
                    winnerId: payload.winnerId,
                    scores: {
                        player1: room.player1.score,
                        player2: room.player2.score
                    }
                };

                ws.publish(room.id, JSON.stringify({ type: 'stick-arena:roundEnd', data: resultData }));
                ws.send(JSON.stringify({ type: 'stick-arena:roundEnd', data: resultData }));

                // Update Stats?
                // stickArenaStatsService.recordMatch(...)
            }
            break;

        case 'stick-arena:leaveMatch':
            handleStickArenaDisconnect(ws);
            break;
    }
};

export const handleStickArenaDisconnect = (ws: any) => {
    const userId = ws.data.userId;

    // Remove from waiting
    if (userId && waitingPlayers.has(userId)) {
        waitingPlayers.delete(userId);
    }

    // Handle Active Room
    if (ws.data.stickArenaRoomId) {
        const room = rooms.get(ws.data.stickArenaRoomId);
        if (room) {
            const opponent = room.getOpponent(ws);

            // Notify Opponent
            if (opponent.ws.readyState === 1) {
                opponent.ws.send(JSON.stringify({
                    type: 'stick-arena:opponentDisconnected',
                    data: { message: 'Opponent disconnected' }
                }));
                // Unsubscribe/Cleanup
                opponent.ws.unsubscribe(room.id);
                delete opponent.ws.data.stickArenaRoomId;
            }

            rooms.delete(room.id);
            console.log(`[Stick Arena] Room closed: ${room.id}`);
        }
    }
};
