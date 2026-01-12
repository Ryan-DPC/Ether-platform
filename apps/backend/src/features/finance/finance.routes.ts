import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { financeService } from './finance.service';

export const financeRoutes = new Elysia({ prefix: '/api/finance' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'default_secret',
    })
  )
  .derive(async ({ headers, jwt, set }) => {
    const auth = headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      return { user: null };
    }
    const token = auth.slice(7);
    const payload = await jwt.verify(token);
    return { user: payload };
  })
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { message: 'Unauthorized' };
    }
  })
  .get('/history', async ({ user, query }) => {
    const { page = '1', limit = '20' } = query as any;
    return await financeService.getTransactionHistory(
      (user as any).id,
      parseInt(page),
      parseInt(limit)
    );
  })
  .post('/deposit', async ({ body, user, set }) => {
    const { amount, currency, method } = body as any;
    try {
      return await financeService.deposit((user as any).id, parseFloat(amount), currency, method);
    } catch (err: any) {
      set.status = 400;
      return { message: err.message };
    }
  })
  .post('/withdraw', async ({ body, user, set }) => {
    const { amount, currency, method } = body as any;
    try {
      return await financeService.withdraw((user as any).id, parseFloat(amount), currency, method);
    } catch (err: any) {
      set.status = 400;
      return { message: err.message };
    }
  });
