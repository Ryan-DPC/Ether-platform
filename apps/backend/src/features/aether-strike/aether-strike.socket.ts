import { WebSocketService } from '../../services/websocket.service';

interface AetherPlayer {
    userId: string;
    username: string;
    ws: any;
    position: { x: number; y: number };
    health: number;
    class: string;
}

interface AetherGameRoom {
    id: string;
    hostId: string;
    players: Map<string, AetherPlayer>;
    maxPlayers: number;
    createdAt: number;
    state: 'waiting' | 'playing' | 'ended';
}

// Global state
const gameRooms = new Map<string, AetherGameRoom>();

export const handleAetherStrikeMessage = async (ws: any, event: string, payload: any) => {
    const userId = ws.data.userId;
    const username = ws.data.username;

    switch (event) {
        case 'aether-strike:create-game':
            const { gameId, maxPlayers } = payload;

            // Create new game room
            const room: AetherGameRoom = {
                id: gameId,
                hostId: userId,
                players: new Map(),
                maxPlayers: maxPlayers || 4,
                createdAt: Date.now(),
                state: 'waiting',
            };

            // Add host as first player
            room.players.set(userId, {
                userId,
                username,
                ws,
                position: { x: 400, y: 300 },
                health: 100,
                class: payload.class || 'warrior',
            });

            gameRooms.set(gameId, room);
            ws.data.aetherGameId = gameId;
            ws.subscribe(`aether-game:${gameId}`);

            console.log(`[Aether Strike] Game created: ${gameId} by ${username}`);

            ws.send(JSON.stringify({
                type: 'aether-strike:game-created',
                data: { gameId, hostId: userId },
            }));
            break;

        case 'aether-strike:join-game':
            const { gameId: joinGameId, playerClass } = payload;
            const targetRoom = gameRooms.get(joinGameId);

            if (!targetRoom) {
                ws.send(JSON.stringify({
                    type: 'aether-strike:error',
                    data: { message: 'Game not found' },
                }));
                return;
            }

            if (targetRoom.players.size >= targetRoom.maxPlayers) {
                ws.send(JSON.stringify({
                    type: 'aether-strike:error',
                    data: { message: 'Game is full' },
                }));
                return;
            }

            // Add player to room
            targetRoom.players.set(userId, {
                userId,
                username,
                ws,
                position: { x: 400 + targetRoom.players.size * 50, y: 300 },
                health: 100,
                class: playerClass || 'warrior',
            });

            ws.data.aetherGameId = joinGameId;
            ws.subscribe(`aether-game:${joinGameId}`);

            console.log(`[Aether Strike] ${username} joined game ${joinGameId}`);

            // Notify all players in room
            ws.publish(`aether-game:${joinGameId}`, JSON.stringify({
                type: 'aether-strike:player-joined',
                data: {
                    playerId: userId,
                    username,
                    playerClass,
                    playerCount: targetRoom.players.size,
                },
            }));

            // Send current game state to new player
            const currentPlayers = Array.from(targetRoom.players.values()).map(p => ({
                userId: p.userId,
                username: p.username,
                position: p.position,
                health: p.health,
                class: p.class,
            }));

            ws.send(JSON.stringify({
                type: 'aether-strike:game-state',
                data: {
                    gameId: joinGameId,
                    players: currentPlayers,
                    state: targetRoom.state,
                },
            }));
            break;

        case 'aether-strike:start-game':
            const startGameId = ws.data.aetherGameId;
            const startRoom = gameRooms.get(startGameId);

            if (!startRoom || startRoom.hostId !== userId) {
                return; // Only host can start
            }

            startRoom.state = 'playing';

            ws.publish(`aether-game:${startGameId}`, JSON.stringify({
                type: 'aether-strike:game-started',
                data: { timestamp: Date.now() },
            }));

            ws.send(JSON.stringify({
                type: 'aether-strike:game-started',
                data: { timestamp: Date.now() },
            }));
            break;

        case 'aether-strike:change-class':
            const classGameId = ws.data.aetherGameId;
            const classRoom = gameRooms.get(classGameId);
            if (!classRoom) {
                console.log(`[Aether Strike] Change class failed: Room ${classGameId} not found`);
                return;
            }

            const player = classRoom.players.get(userId);
            if (player) {
                player.class = payload.newClass || payload.class || 'warrior';

                // Broadcast update to all players
                ws.publish(`aether-game:${classGameId}`, JSON.stringify({
                    type: 'aether-strike:player-updated',
                    data: {
                        playerId: userId,
                        class: player.class,
                        username: player.username
                    }
                }));

                console.log(`[Aether Strike] Player ${username} changed class to ${player.class}`);
            } else {
                console.log(`[Aether Strike] Change class failed: Player ${userId} not found in room ${classGameId}`);
            }
            break;

        case 'aether-strike:player-input':
            const inputGameId = ws.data.aetherGameId;
            if (!inputGameId) return;

            // Relay input to all other players
            ws.publish(`aether-game:${inputGameId}`, JSON.stringify({
                type: 'aether-strike:player-update',
                data: {
                    playerId: userId,
                    ...payload,
                    timestamp: Date.now(),
                },
            }));
            break;

        case 'aether-strike:player-attack':
            const attackGameId = ws.data.aetherGameId;
            if (!attackGameId) return;

            ws.publish(`aether-game:${attackGameId}`, JSON.stringify({
                type: 'aether-strike:player-attacked',
                data: {
                    attackerId: userId,
                    ...payload,
                    timestamp: Date.now(),
                },
            }));
            break;

        case 'aether-strike:player-damage':
            const damageGameId = ws.data.aetherGameId;
            const damageRoom = gameRooms.get(damageGameId);

            if (!damageRoom) return;

            const { targetId, damage } = payload;
            const targetPlayer = damageRoom.players.get(targetId);

            if (targetPlayer) {
                targetPlayer.health -= damage;

                ws.publish(`aether-game:${damageGameId}`, JSON.stringify({
                    type: 'aether-strike:player-damaged',
                    data: {
                        targetId,
                        damage,
                        newHealth: targetPlayer.health,
                        attackerId: userId,
                    },
                }));

                // Check for death
                if (targetPlayer.health <= 0) {
                    ws.publish(`aether-game:${damageGameId}`, JSON.stringify({
                        type: 'aether-strike:player-died',
                        data: {
                            playerId: targetId,
                            killerId: userId,
                        },
                    }));
                }
            }
            break;

        case 'aether-strike:leave-game':
            handleAetherStrikeDisconnect(ws);
            break;
    }
};

export const handleAetherStrikeDisconnect = (ws: any) => {
    const userId = ws.data.userId;
    const disconnectGameId = ws.data.aetherGameId;

    if (!disconnectGameId) return;

    const room = gameRooms.get(disconnectGameId);
    if (!room) return;

    // Remove player from room
    room.players.delete(userId);

    // Notify others
    ws.publish(`aether-game:${disconnectGameId}`, JSON.stringify({
        type: 'aether-strike:player-left',
        data: {
            playerId: userId,
            playerCount: room.players.size,
        },
    }));

    ws.unsubscribe(`aether-game:${disconnectGameId}`);
    delete ws.data.aetherGameId;

    // Clean up empty rooms
    if (room.players.size === 0) {
        gameRooms.delete(disconnectGameId);
        console.log(`[Aether Strike] Room ${disconnectGameId} closed (empty)`);
    } else if (room.hostId === userId) {
        // Host left, assign new host
        const newHost = Array.from(room.players.keys())[0];
        room.hostId = newHost;

        ws.publish(`aether-game:${disconnectGameId}`, JSON.stringify({
            type: 'aether-strike:new-host',
            data: { hostId: newHost },
        }));
    }

    console.log(`[Aether Strike] ${userId} left game ${disconnectGameId}`);
};
