
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { GameOwnershipService } from './game-ownership.service';

export const gameOwnershipRoutes = new Elysia({ prefix: '/api/game-ownership' })
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
    .get('/marketplace', async ({ query, user }) => {
        const userId = user ? (user as any).id : null;
        const filters = {
            minPrice: query.minPrice,
            maxPrice: query.maxPrice,
            genre: query.genre,
            sort: query.sort
        };
        return await GameOwnershipService.getMarketplace(filters, userId);
    })
    .get('/stats/:gameKey', async ({ params: { gameKey } }) => {
        return await GameOwnershipService.getGameStats(gameKey);
    })
    .guard({
        beforeHandle: ({ user, set }) => {
            if (!user) {
                set.status = 401;
                return { message: 'Unauthorized' };
            }
        }
    }, (app) => app
        .get('/my-games', async ({ user }) => {
            return await GameOwnershipService.getUserGames((user as any).id);
        })
        .post('/redeem-key', async ({ body, user, set }) => {
            const { key, gameName } = body as any;
            if (!key) {
                set.status = 400;
                return { message: 'Game key is required' };
            }
            try {
                return await GameOwnershipService.redeemKey((user as any).id, key, gameName);
            } catch (err: any) {
                set.status = 400;
                return { message: err.message };
            }
        })
        .post('/install', async ({ body, user, set }) => {
            const { gameKey } = body as any;
            if (!gameKey) {
                set.status = 400;
                return { message: 'gameKey is required' };
            }
            try {
                return await GameOwnershipService.installGame((user as any).id, gameKey);
            } catch (err: any) {
                set.status = 404;
                return { message: err.message };
            }
        })
        .post('/sell', async ({ body, user, set }) => {
            const { gameKey, askingPrice } = body as any;
            if (!gameKey || !askingPrice) {
                set.status = 400;
                return { message: 'gameKey and askingPrice are required' };
            }
            try {
                return await GameOwnershipService.listForSale((user as any).id, gameKey, askingPrice);
            } catch (err: any) {
                set.status = 400;
                return { message: err.message };
            }
        })
        .post('/cancel-sale', async ({ body, user, set }) => {
            const { ownershipToken } = body as any;
            if (!ownershipToken) {
                set.status = 400;
                return { message: 'ownershipToken is required' };
            }
            try {
                return await GameOwnershipService.cancelSale((user as any).id, ownershipToken);
            } catch (err: any) {
                set.status = 404;
                return { message: err.message };
            }
        })
        .get('/my-sales', async ({ user }) => {
            return await GameOwnershipService.getActiveSales((user as any).id);
        })
        .get('/transactions', async ({ user }) => {
            return await GameOwnershipService.getTransactions((user as any).id);
        })
        .delete('/marketplace/:id', async ({ params: { id }, user, set }) => {
            try {
                return await GameOwnershipService.deleteListing((user as any).id, id);
            } catch (err: any) {
                set.status = 403;
                return { message: err.message };
            }
        })
    );
