
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken'; // Assuming jsonwebtoken is installed via generic jwt libraries or handled by elusia/jwt utils but we need standard verify here or re-use elysia one if exported
// bun add jsonwebtoken @types/jsonwebtoken if not present. Elysia uses joseph/busboy or other for jwt usually?
// Elysia @elysiajs/jwt uses `jose` under the hood. 
// Ideally I should reuse the JWT secret from env.

import { ChatService } from '../chat/chat.service';
import { FriendsService } from '../friends/friends.service';
import Users from '../users/user.model';

interface AuthSocket extends Socket {
    userId?: string;
    username?: string;
}

export const attachWebSocketBridge = (io: Server) => {
    // Middleware for authentication
    io.use(async (socket: AuthSocket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers.token;

        if (!token) {
            return next(new Error('Authentication error: Token required'));
        }

        try {
            // Using standard JWT verify for socket.io as it's separate from Elysia context
            // Ensure jsonwebtoken is installed or use jose.
            // For now assuming jsonwebtoken usage pattern from original code which used `require('jsonwebtoken')`
            // and we have `jwt` imported.
            const decoded = jwt.verify(token as string, process.env.JWT_SECRET || 'default_secret') as any;
            socket.userId = decoded.id; // Correct
            socket.username = decoded.username;
            next();
        } catch (err) {
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', async (socket: AuthSocket) => {
        if (!socket.userId) return;

        console.log(`🔌 User connected: ${socket.username} (${socket.id})`);

        // 1. Update Socket ID in DB
        try {
            await Users.saveSocketId(socket.userId, socket.id);
        } catch (error) {
            console.error('Error saving socket ID:', error);
        }

        // 2. Join personal room
        socket.join(socket.userId);

        // 3. Notify friends that user is online
        try {
            const friends = await FriendsService.getFriends(socket.userId);
            friends.forEach((friend: any) => {
                io.to(friend.id).emit('friend:status-changed', {
                    userId: socket.userId,
                    status: 'online'
                });
            });
        } catch (error) {
            console.error('Error notifying friends:', error);
        }

        // --- Event Handlers ---

        // Chat Events
        socket.on('chat:send-message', async (data: { toUserId: string, content: string }) => {
            try {
                const { toUserId, content } = data;
                if (!toUserId || !content) return;
                if (!socket.userId || !socket.username) return;

                const message = await ChatService.sendMessage(socket.userId, toUserId, content);

                const messagePayload = {
                    id: message.id,
                    from_user_id: socket.userId,
                    from_username: socket.username,
                    content: message.content,
                    created_at: new Date(),
                    is_from_me: false
                };

                io.to(toUserId).emit('chat:message-received', messagePayload);

            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        socket.on('chat:typing', (data: { toUserId: string }) => {
            if (data.toUserId && socket.userId) {
                io.to(data.toUserId).emit('chat:typing', { from_user_id: socket.userId });
            }
        });

        socket.on('chat:stop-typing', (data: { toUserId: string }) => {
            if (data.toUserId && socket.userId) {
                io.to(data.toUserId).emit('chat:stop-typing', { from_user_id: socket.userId });
            }
        });

        // Lobby Events
        socket.on('lobby:invite', async (data: { friendId: string, lobbyId: string }) => {
            try {
                if (data.friendId && socket.userId) {
                    io.to(data.friendId).emit('lobby:invite-received', {
                        lobbyId: data.lobbyId,
                        fromUserId: socket.userId,
                        fromUsername: socket.username
                    });
                }
            } catch (error) {
                console.error('Error sending invite:', error);
            }
        });

        // User Status
        socket.on('user:status-update', async (data: { status: 'online' | 'offline' | 'in-game', lobbyId?: string }) => {
            try {
                if (!socket.userId) return;
                const friends = await FriendsService.getFriends(socket.userId);
                friends.forEach((friend: any) => {
                    io.to(friend.id).emit('friend:status-changed', {
                        userId: socket.userId,
                        status: data.status,
                        lobbyId: data.lobbyId
                    });
                });
            } catch (error) {
                console.error('Error broadcasting status:', error);
            }
        });

        // Disconnect
        socket.on('disconnect', async () => {
            console.log(`❌ User disconnected: ${socket.username}`);

            if (socket.userId) {
                await Users.removeSocketId(socket.id);

                try {
                    const friends = await FriendsService.getFriends(socket.userId);
                    friends.forEach((friend: any) => {
                        io.to(friend.id).emit('friend:status-changed', {
                            userId: socket.userId,
                            status: 'offline'
                        });
                    });
                } catch (error) {
                    console.error('Error notifying friends offline:', error);
                }
            }
        });
    });
};
