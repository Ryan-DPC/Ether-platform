
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { GameSyncService } from '../../services/game-sync.service';

export const adminRoutes = new Elysia({ prefix: '/api/admin' })
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
    .onBeforeHandle(({ user, set }) => {
        if (!user || !(user as any).isAdmin) {
            set.status = 403;
            return { error: 'Admin access required' };
        }
    })
    .post('/sync-games', async ({ body, set }) => {
        try {
            const { force } = body as any;
            const result = await GameSyncService.syncAllGames(force);
            return result;
        } catch (error: any) {
            console.error('Admin sync error:', error);
            set.status = 500;
            return { error: error.message };
        }
    })
    .get('/sync-status', async ({ set }) => {
        try {
            const devGames = await GameSyncService.getDevGames();
            const status: any = {};

            for (const slug of Object.keys(devGames)) {
                const cached = GameSyncService.syncCache.get(slug);
                status[slug] = {
                    lastSync: cached?.lastSync || null,
                    checksum: cached?.checksum || null
                };
            }

            return {
                success: true,
                games: devGames,
                syncStatus: status
            };
        } catch (error: any) {
            console.error('Status error:', error);
            set.status = 500;
            return { error: error.message };
        }
    })
    .post('/sync-db', async ({ set }) => {
        // Placeholder
        return { success: true, message: 'DB sync not implemented yet' };
    });
