
import { FriendsService } from '../friends/friends.service';
import { ChatService } from '../chat/chat.service';
import Users from '../users/user.model';
import { WebSocketService } from '../../services/websocket.service';
import { handleStickArenaMessage, handleStickArenaDisconnect } from '../stick-arena/stick-arena.socket';

// Define a minimal interface for the WS object we use
// This avoids dragging in the entire intense Elysia type inference chain
export interface AppWebSocket {
    data: {
        userId?: string;
        username?: string;
        query: Record<string, string | undefined>;
        headers: Record<string, string | undefined>;
        jwt: {
            verify: (token: string) => Promise<any>;
        };
    };
    send: (message: string) => void;
    close: () => void;
    subscribe: (topic: string) => void;
    publish: (topic: string, message: string) => void;
    id: string;
}

export const handleWsOpen = async (ws: AppWebSocket) => {
    const token = ws.data.query.token || ws.data.headers['authorization'];

    if (!token) {
        ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
        ws.close();
        return;
    }

    try {
        // @ts-ignore - jwt plugin usage
        const payload = await ws.data.jwt.verify(token.startsWith?.('Bearer ') ? token.slice(7) : token);

        if (!payload) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
            ws.close();
            return;
        }

        const userId = (payload as any).id;
        const username = (payload as any).username;

        // Store user info in ws.data for later use
        ws.data.userId = userId;
        ws.data.username = username;

        console.log(`🔌 User connected (WS): ${username} (${userId})`);

        // 2. Subscribe to personal topic (Room)
        ws.subscribe(userId);
        ws.subscribe('global'); // Optional global broadcast

        // 3. Update Status in DB (Presence)
        try {
            await Users.saveSocketId(userId, ws.id);
        } catch (e) {
            console.error('Error saving socket ID:', e);
        }

        // 4. Notify friends
        try {
            const friends = await FriendsService.getFriends(userId);
            friends.forEach((friend: any) => {
                // Publish to friend's topic
                WebSocketService.publish(friend.id, 'friend:status-changed', {
                    userId: userId,
                    status: 'online'
                });
            });
        } catch (error) {
            console.error('Error notifying friends:', error);
        }

    } catch (err) {
        ws.close();
    }
};

export const handleWsMessage = async (ws: AppWebSocket, message: any) => {
    // Check auth
    const userId = ws.data.userId;
    const username = ws.data.username;
    if (!userId) return;

    // Handle raw message or JSON
    let event = '';
    let payload: any = {};

    if (typeof message === 'object') {
        event = message.type;
        payload = message.data || {};
    } else {
        try {
            const parsed = JSON.parse(message as string);
            event = parsed.type;
            payload = parsed.data || {};
        } catch (e) { return; } // Ignore garbage
    }

    switch (event) {
        case 'chat:send-message':
            try {
                const { toUserId, content } = payload;
                if (!toUserId || !content) return;

                // Save to DB
                const msgObj = await ChatService.sendMessage(userId, toUserId, content);

                const messagePayload = {
                    id: msgObj.id,
                    from_user_id: userId,
                    from_username: username,
                    content: msgObj.content,
                    created_at: new Date(),
                    is_from_me: false
                };

                // Send to recipient
                WebSocketService.publish(toUserId, 'chat:message-received', messagePayload);

                // Send confirmation to sender (optional, front might handle optimistic)
                // ws.send(JSON.stringify({ type: 'chat:message-sent', data: messagePayload }));

            } catch (error) {
                ws.send(JSON.stringify({ type: 'error', message: 'Failed to send message' }));
            }
            break;

        case 'chat:typing':
            if (payload.toUserId) {
                WebSocketService.publish(payload.toUserId, 'chat:typing', { from_user_id: userId });
            }
            break;

        case 'chat:stop-typing':
            if (payload.toUserId) {
                WebSocketService.publish(payload.toUserId, 'chat:stop-typing', { from_user_id: userId });
            }
            break;

        case 'lobby:invite':
            if (payload.friendId) {
                WebSocketService.publish(payload.friendId, 'lobby:invite-received', {
                    lobbyId: payload.lobbyId,
                    fromUserId: userId,
                    fromUsername: username
                });
            }
            break;

        case 'user:status-update':
            try {
                const status = payload.status;
                const friends = await FriendsService.getFriends(userId);
                friends.forEach((friend: any) => {
                    WebSocketService.publish(friend.id, 'friend:status-changed', {
                        userId: userId,
                        status: status,
                        lobbyId: payload.lobbyId
                    });
                });
            } catch (e) { }
            break;

        case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

        default:
            if (event.startsWith('stick-arena:')) {
                handleStickArenaMessage(ws, event, payload);
            }
            break;
    }
};

export const handleWsClose = async (ws: AppWebSocket) => {
    const userId = ws.data.userId;
    const username = ws.data.username;

    // Handle Stick Arena Disconnect
    handleStickArenaDisconnect(ws);

    if (!userId) return;

    console.log(`❌ User disconnected (WS): ${username}`);

    // Remove Socket ID from DB
    try {
        await Users.removeSocketId(ws.id);
    } catch (e) { }

    // Notify friends offline
    try {
        const friends = await FriendsService.getFriends(userId);
        friends.forEach((friend: any) => {
            WebSocketService.publish(friend.id, 'friend:status-changed', {
                userId: userId,
                status: 'offline'
            });
        });
    } catch (e) { }
};
