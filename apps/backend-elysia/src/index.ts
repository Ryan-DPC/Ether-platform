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
import { reviewsRoutes } from './features/reviews/reviews.routes';
import { statsRoutes } from './features/stats/stats.routes';
import { devGamesRoutes } from './features/dev-games/dev-games.routes';
import { adminRoutes } from './features/admin/admin.routes';
import { wsRoutes } from './features/ws/ws.routes';
import { setWebSocketServer } from './services/websocket.service';

// Connect Database
await connectDB();

const app = new Elysia()
    .use(cors())
    .use(swagger())
    .get('/', () => ({
        success: true,
        message: 'VEXT Backend (Elysia + Native WS) is running',
        version: '1.0.0'
    }))
    .get('/health', () => ({
        status: 'ok',
        uptime: process.uptime()
    }))
    // HTTP Routes
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
    .use(reviewsRoutes)
    .use(statsRoutes)
    .use(devGamesRoutes)
    .use(adminRoutes)
    // WebSocket Routes
    .use(wsRoutes)
    .listen(3000);

// Initialize Global WebSocket Server Reference
if (app.server) {
    setWebSocketServer(app.server);
    console.log(`🦊 Elysia is running at ${app.server.hostname}:${app.server.port} (with Native WebSockets)`);
} else {
    console.error('Failed to start Elysia server');
}
