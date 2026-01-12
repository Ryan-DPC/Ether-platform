import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { itemsService } from './items.service';

export const itemsRoutes = new Elysia({ prefix: '/api/items' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'default_secret',
    })
  )
  .derive(async ({ headers, jwt }) => {
    const auth = headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.slice(7);
      const payload = await jwt.verify(token);
      return { user: payload };
    }
    return { user: null };
  })
  .get('/all', async ({ user, query }) => {
    // Build filters? The route just calls getAll.
    return await itemsService.getAll(user ? (user as any).id : null, query);
  })
  .get('/store', async ({ user, query }) => {
    // Alias
    return await itemsService.getAll(user ? (user as any).id : null, query);
  })
  .get('/search', async ({ query }) => {
    const { q } = query as any;
    return await itemsService.searchItems(q || '');
  })
  // Protected Routes
  .group('', (app) =>
    app
      .onBeforeHandle(({ user, set }) => {
        if (!user) {
          set.status = 401;
          return { message: 'Unauthorized' };
        }
      })
      .post('/purchase', async ({ body, user, set }) => {
        const { itemId } = body as any;
        try {
          return await itemsService.purchaseItem((user as any).id, itemId);
        } catch (err: any) {
          set.status = 400;
          return { message: err.message };
        }
      })
      .post('/equip', async ({ body, user, set }) => {
        const { itemId } = body as any;
        try {
          return await itemsService.equip((user as any).id, itemId);
        } catch (err: any) {
          set.status = 400;
          return { message: err.message };
        }
      })
      .post('/unequip', async ({ body, user, set }) => {
        const { itemId } = body as any;
        try {
          return await itemsService.unequip((user as any).id, itemId);
        } catch (err: any) {
          set.status = 400;
          return { message: err.message };
        }
      })
      .get('/my-items', async ({ user }) => {
        return await itemsService.getUserItems((user as any).id);
      })
      .delete('/:itemId', async ({ params: { itemId }, user, set }) => {
        // Admin check missing here, assuming protected is enough or future admin check
        try {
          return await itemsService.archiveItem(itemId);
        } catch (err: any) {
          set.status = 400;
          return { message: err.message };
        }
      })
  );
