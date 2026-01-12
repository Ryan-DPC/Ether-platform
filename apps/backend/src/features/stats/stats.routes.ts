
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { StatsService } from './stats.service';

export const statsRoutes = new Elysia({ prefix: '/api/stats' })
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
        if (!payload) {
            return { user: null };
        }
        return { user: payload };
    })
    .onBeforeHandle(({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { message: 'Unauthorized' };
        }
    })

    // Session Management
    .post('/session/start', async ({ body, user, set }) => {
        try {
            const { gameId } = body;
            const result = await StatsService.startSession(user!.id as string, gameId);
            return result;
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    }, {
        body: t.Object({
            gameId: t.String()
        })
    })

    .post('/session/end', async ({ body, set }) => {
        try {
            const { sessionId } = body;
            const result = await StatsService.endSession(sessionId);
            return result;
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    }, {
        body: t.Object({
            sessionId: t.String()
        })
    })

    // Data Retrieval
    .get('/global', async ({ user, set }) => {
        try {
            const result = await StatsService.getGlobalStats(user!.id as string);
            return result;
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    })

    .get('/:gameId', async ({ user, params: { gameId }, set }) => {
        try {
            const result = await StatsService.getGameStats(user!.id as string, gameId);
            return result;
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    });
