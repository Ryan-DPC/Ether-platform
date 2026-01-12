import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { connectDB } from './config/db';
import { UsersService } from './services/users.service';
import { setWebSocketServer } from './services/websocket.service';
import { handleWsMessage, handleWsDisconnect } from './socket.handlers';
import { VersionCheckerJob } from './jobs/version-checker.job';

// Initialize and start VersionChecker
const versionChecker = new VersionCheckerJob();
versionChecker.start();

const PORT = process.env.PORT || 3002;

// Connect Database
await connectDB();

const app = new Elysia()
    .use(cors({
        origin: [
            "http://localhost:5173",
            "https://vext-frontend.onrender.com",
            "https://vext-backend.onrender.com",
            /\.onrender\.com$/
        ],
        credentials: true
    }))
    .use(jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET || 'default_secret'
    }))
    .ws('/', {
        async open(ws) {
            try {
                // console.log('WS Open - Data keys:', Object.keys((ws as any).data || {}));
                const query = (ws as any).data?.query;
                const headers = (ws as any).data?.headers;

                // console.log('WS Query:', query);

                const token = query?.token || headers?.['authorization'];

                if (!token) {
                    console.log('WS Auth Failed: No token found');
                    ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
                    ws.close();
                    return;
                }

                // Verify Token
                const jwtTool = (ws as any).data.jwt;
                if (!jwtTool) {
                    console.error('WS Error: JWT plugin not found on ws.data');
                    console.log('Available keys:', Object.keys((ws as any).data || {}));
                    ws.close();
                    return;
                }

                const payload = await jwtTool.verify(token.startsWith?.('Bearer ') ? token.slice(7) : token);

                if (!payload) {
                    console.log('WS Auth Failed: Invalid token');
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
                    ws.close();
                    return;
                }

                const userId = payload.userId || payload.id;
                const username = payload.username;

                // Store in ws.data
                (ws as any).data.userId = userId;
                (ws as any).data.username = username;

                console.log(`🔌 Client connected: ${userId} (${username})`);

                // Save Socket ID
                await UsersService.saveSocketId(userId, ws.id);

                // Notify Friends (Online)
                try {
                    const friends = await UsersService.getFriends(userId);
                    // We need a way to publish to friends. 
                    // In Elysia/Bun, we can publish to a topic.
                    // Let's assume friends are subscribed to their own userId topic "user:{friendId}"

                    // But wait, in handleWsOpen (backend-elysia), we subscribe users to their own ID.
                    // We need to do the same here.
                    // Subscribe to user's personal topic for private messages
                    ws.subscribe(`user:${userId}`);

                    // Subscribe to global topic for broadcast messages
                    ws.subscribe('global');

                    friends.forEach((friend: any) => {
                        app.server?.publish(`user:${friend.id}`, JSON.stringify({
                            type: 'friend:status-changed',
                            data: {
                                userId: userId,
                                status: 'online'
                            }
                        }));
                    });
                } catch (err) {
                    console.error('Error notifying friends:', err);
                }

            } catch (err) {
                console.error('WS Open Error:', err);
                ws.close();
            }
        },

        async message(ws, message) {
            await handleWsMessage(ws, message);
        },

        async close(ws) {
            await handleWsDisconnect(ws);

            const userId = (ws as any).data.userId;
            const username = (ws as any).data.username;

            if (userId) {
                console.log(`❌ Client disconnected: ${userId} (${username})`);
                await UsersService.removeSocketId(ws.id);

                // Notify Friends (Offline)
                try {
                    const friends = await UsersService.getFriends(userId);
                    friends.forEach((friend: any) => {
                        app.server?.publish(`user:${friend.id}`, JSON.stringify({
                            type: 'friend:status-changed',
                            data: {
                                userId: userId,
                                status: 'offline'
                            }
                        }));
                    });
                } catch (err) {
                    console.error('Error notifying friends offline:', err);
                }
            }
        }
    })
    // .get('/', () => 'Vext WebSocket Server (Elysia) Running')
    .listen(PORT);

if (app.server) {
    setWebSocketServer(app.server);
    console.log(`🦊 WebSocket Server running at ${app.server.hostname}:${app.server.port}`);
}

// Global Types
declare global {
    interface WebSocketData {
        userId?: string;
        username?: string;
    }
}

