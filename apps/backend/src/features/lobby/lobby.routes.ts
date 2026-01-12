
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { lobbyService } from './lobby.service';

export const lobbyRoutes = new Elysia({ prefix: '/api/lobby' })
    .use(jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET || 'default_secret'
    }))
    .derive(async ({ headers, jwt }) => {
        const auth = headers['authorization'];
        if (!auth || !auth.startsWith('Bearer ')) {
            return { user: null };
        }
        const token = auth.slice(7);
        const payload = await jwt.verify(token);
        return { user: payload };
    })
    // Lobby Management (Socket ID based usually, but here exposing via REST for initial actions or fallbacks)
    .post('/create', ({ body }) => {
        const { socketId } = body as any;
        return { lobbyId: lobbyService.createLobby(socketId) };
    })
    .post('/join', ({ body }) => {
        const { lobbyId, socketId } = body as any;
        const joined = lobbyService.joinLobby(lobbyId, socketId);
        return { success: joined };
    })
    .post('/leave', ({ body }) => {
        const { socketId } = body as any;
        const lobbyId = lobbyService.leaveLobby(socketId);
        return { success: !!lobbyId, lobbyId };
    })
    .get('/:lobbyId/players', ({ params: { lobbyId } }) => {
        return lobbyService.getPlayers(lobbyId);
    })
    .post('/remove-player', ({ body }) => {
        const { socketId } = body as any;
        const lobbyId = lobbyService.removePlayer(socketId);
        return { success: !!lobbyId, lobbyId };
    })

    // Game Session Management (Protected)
    .group('/session', (app) => app
        .onBeforeHandle(({ user, set }) => {
            if (!user) {
                set.status = 401;
                return { message: 'Unauthorized' };
            }
        })
        .post('/create', async ({ body, user, set }) => {
            const { gameId, gameFolderName, ownershipToken } = body as any;
            try {
                return await lobbyService.createSession((user as any).id, gameId, gameFolderName, ownershipToken);
            } catch (err: any) {
                set.status = 400;
                return { message: err.message };
            }
        })
        .post('/heartbeat', async ({ body }) => {
            const { sessionToken } = body as any;
            const success = await lobbyService.updateHeartbeat(sessionToken);
            return { success };
        })
        .post('/end', async ({ body }) => {
            const { sessionToken } = body as any;
            const success = await lobbyService.endSession(sessionToken);
            return { success };
        })
        .get('/active', async ({ user }) => {
            return await lobbyService.getActiveSession((user as any).id);
        })
    );
