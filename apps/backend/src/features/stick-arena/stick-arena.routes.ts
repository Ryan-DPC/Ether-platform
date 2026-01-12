
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { stickArenaStatsService } from './stick-arena-stats.service';

export const stickArenaRoutes = new Elysia({ prefix: '/api/stick-arena' })
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
    // Public routes (Leaderboard)
    .get('/leaderboard', async ({ query }) => {
        const { sortBy, limit } = query as any;
        return await stickArenaStatsService.getLeaderboard(sortBy, limit ? parseInt(limit) : 100);
    })
    .get('/leaderboard/top', async ({ query }) => {
        const { limit } = query as any;
        return await stickArenaStatsService.getTopPlayers(limit ? parseInt(limit) : 10);
    })
    // Match recording (might be called by game server or client - protecting with auth for now but might need API key)
    .post('/match/record', async ({ body, user, set }) => {
        if (!user) {
            // In future, might use API Key for game server
            set.status = 401;
            return { message: 'Unauthorized' };
        }
        try {
            return await stickArenaStatsService.recordMatch(body);
        } catch (err: any) {
            set.status = 500;
            return { message: err.message };
        }
    })
    // Protected User Stats
    .group('/stats', (app) => app
        .derive(async ({ headers, jwt, set }) => {
            const auth = headers['authorization'];
            if (!auth || !auth.startsWith('Bearer ')) {
                set.status = 401;
                throw new Error('Unauthorized');
            }
            const token = auth.slice(7);
            const payload = await jwt.verify(token);
            if (!payload) {
                set.status = 401;
                throw new Error('Unauthorized');
            }
            return { user: payload };
        })
        .get('/me', async ({ user }) => {
            return await stickArenaStatsService.getOrCreateStats((user as any).id);
        })
        .get('/rank', async ({ user }) => {
            return await stickArenaStatsService.getUserRank((user as any).id);
        })
        .get('/history', async ({ user, query }) => {
            const { limit } = query as any;
            return await stickArenaStatsService.getMatchHistory((user as any).id, limit ? parseInt(limit) : 10);
        })
        .get('/user/:userId', async ({ params: { userId } }) => {
            return await stickArenaStatsService.getOrCreateStats(userId);
        })
    );

// Note: The original route '/' serving the game HTML is omitted here as backend should be API only.
// Static files usually served by frontend or Nginx. If needed, we can use `elysia-static`.
