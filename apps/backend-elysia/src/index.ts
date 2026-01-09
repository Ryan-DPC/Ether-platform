import { Elysia } from 'elysia';
import dotenv from 'dotenv';
dotenv.config(); // Load environment variables first

import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { connectDB } from './config/db';
import { authRoutes } from './features/auth/auth.routes';
import { usersRoutes } from './features/users/users.routes';
import { gamesRoutes } from './features/games/games.routes';
import { friendsRoutes } from './features/friends/friends.routes';
import { libraryRoutes } from './features/library/library.routes';
import { stickArenaRoutes } from './features/stick-arena/stick-arena.routes';
import { chatRoutes } from './features/chat/chat.routes';
import { itemsRoutes } from './features/items/items.routes';
import { financeRoutes } from './features/finance/finance.routes';
import { lobbyRoutes } from './features/lobby/lobby.routes';
import { gameCategoriesRoutes } from './features/game-categories/game-categories.routes';
import { gameOwnershipRoutes } from './features/game-ownership/game-ownership.routes';

import { Server } from 'socket.io';
import { attachWebSocketBridge } from './features/ws-bridge/ws-bridge.socket';

// Connect Database
await connectDB();

const app = new Elysia()
    .use(cors())
    .use(swagger())
    .get('/', () => ({
        success: true,
        message: 'VEXT Backend (Elysia) is running',
        version: '1.0.0'
    }))
    .get('/health', () => ({
        status: 'ok',
        uptime: process.uptime()
    }))
    .use(authRoutes)
    .use(usersRoutes)
    .use(gamesRoutes)
    .use(friendsRoutes)
    .use(libraryRoutes)
    .use(stickArenaRoutes)
    .use(chatRoutes)
    .use(itemsRoutes)
    .use(financeRoutes)
    .use(lobbyRoutes)
    .use(gameCategoriesRoutes)
    .use(gameOwnershipRoutes)
    .listen(3000);

import { setIO } from './socket';

// Initialize Socket.IO on a separate port (3001) to avoid conflict with Elysia/Bun server
const io = new Server({
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.listen(3001);

setIO(io);

attachWebSocketBridge(io);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(`🔌 Socket.IO is running on port 3001`);
