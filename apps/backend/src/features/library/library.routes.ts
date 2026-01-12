import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { libraryService } from './library.service';
import { WebSocketService } from '../../services/websocket.service';

export const libraryRoutes = new Elysia({ prefix: '/api/library' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'default_secret',
    })
  )
  .derive(async ({ headers, jwt }) => {
    const auth = headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      return { user: null };
    }
    const token = auth.slice(7);
    const payload = await jwt.verify(token);
    return { user: payload };
  })
  .get('/blockchain-stats', () => {
    return libraryService.getBlockchainStats();
  })

  // Auth required group
  .guard({}, (app) =>
    app
      .onBeforeHandle(({ user, set }) => {
        if (!user) {
          set.status = 401;
          return { message: 'Unauthorized' };
        }
      })
      .get('/debug-fix', async ({ user }) => {
        return await libraryService.debugFix((user as any).id);
      })
      .post('/purchase', async ({ body, user, set }) => {
        const { gameId } = body as any;
        try {
          const result = await libraryService.purchaseGame((user as any).id, gameId);

          if (result.success) {
            const userId = (user as any).id;
            WebSocketService.publish(userId, 'transaction:success', {
              game: {
                game_name: result.game_name,
                purchase_price: 0,
              },
              newBalance: result.remainingBalance,
            });
          }

          return result;
        } catch (err: any) {
          set.status = 400;
          return { message: err.message };
        }
      })
      .post('/purchase-game', async ({ body, user, set }) => {
        // Alias
        const { gameId } = body as any;
        try {
          // Same logic as purchase
          const result = await libraryService.purchaseGame((user as any).id, gameId);
          if (result.success) {
            const userId = (user as any).id;
            WebSocketService.publish(userId, 'transaction:success', {
              game: {
                game_name: result.game_name,
                purchase_price: 0,
              },
              newBalance: result.remainingBalance,
            });
          }
          return result;
        } catch (err: any) {
          set.status = 400;
          return { message: err.message };
        }
      })
      .post('/list-for-sale', async ({ body, user, set }) => {
        const { gameKey, askingPrice } = body as any;
        try {
          return await libraryService.listGameForSale(gameKey, askingPrice, (user as any).id);
        } catch (err: any) {
          set.status = 400;
          return { message: err.message };
        }
      })
      .post('/purchase-used', async ({ body, user, set }) => {
        const { gameKey, sellerId } = body as any;
        try {
          const result = await libraryService.purchaseUsedGame((user as any).id, gameKey, sellerId);

          if (result.success) {
            // Notification to buyer
            WebSocketService.publish((user as any).id, 'transaction:success', {
              game: { game_name: 'Used Game', purchase_price: result.sellerAmount },
              newBalance: (user as any).tokens,
            });

            // Notification to seller
            WebSocketService.publish(sellerId, 'transaction:seller_notification', {
              message: `You sold a game for ${result.sellerAmount} CHF`,
            });
          }

          return result;
        } catch (err: any) {
          set.status = 400;
          return { message: err.message };
        }
      })
      .get('/my-games', async ({ user }) => {
        return await libraryService.getUserOwnedGames((user as any).id);
      })
      .get('/my-sales', async ({ user }) => {
        return await libraryService.getUserActiveSales((user as any).id);
      })
      .get('/transaction-history', async ({ user }) => {
        return await libraryService.getUserTransactionHistory((user as any).id);
      })
      .post('/cancel-sale', async ({ body, user, set }) => {
        const { gameKey } = body as any;
        try {
          return await libraryService.cancelSale(gameKey, (user as any).id);
        } catch (err: any) {
          set.status = 400;
          return { message: err.message };
        }
      })
      .post('/redeem', async ({ body, user, set }) => {
        const { key } = body as any;
        try {
          return await libraryService.redeemKey((user as any).id, key);
        } catch (err: any) {
          set.status = 400;
          return { message: err.message };
        }
      })
      .post('/keys/generate', async ({ body, user, set }) => {
        // Need admin check ideally
        const { gameId, quantity, purpose } = body as any;
        try {
          return await libraryService.generateKeys(gameId, quantity, (user as any).id, purpose);
        } catch (err: any) {
          set.status = 400;
          return { message: err.message };
        }
      })
      .get('/keys', async ({ query, user }) => {
        // Need admin check ideally
        const { gameId, used } = query as any;
        return await libraryService.getGeneratedKeys(
          gameId,
          (user as any).id,
          used === 'true' ? true : used === 'false' ? false : null
        );
      })
      .post('/install', async ({ body, user, set }) => {
        const { gameKey } = body as any;
        try {
          return await libraryService.installGame((user as any).id, gameKey);
        } catch (err: any) {
          set.status = 500;
          return { message: err.message };
        }
      })
      .post('/add-manual', async ({ body, user, set }) => {
        const { gameKey, gameData } = body as any;
        try {
          return await libraryService.addManualGame((user as any).id, gameKey, gameData);
        } catch (err: any) {
          set.status = 400;
          return { message: err.message };
        }
      })
  )
  // Public loose guard for Marketplace (optional auth)
  .get('/marketplace', async ({ headers, jwt, query }) => {
    let authUser: any = null;
    const auth = headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.slice(7);
      authUser = await jwt.verify(token);
    }

    const filters = {
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      genre: query.genre,
      sort: query.sort,
    };

    return await libraryService.getMarketplaceGames(
      filters,
      authUser ? (authUser as any).id : null
    );
  });
