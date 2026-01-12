import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { ChatService } from './chat.service';

export const chatRoutes = new Elysia({ prefix: '/api/chat' })
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
  .post('/send', async ({ body, user, set }) => {
    const { toUserId, content } = body as any;
    try {
      return await ChatService.sendMessage((user as any).id, toUserId, content);
    } catch (err: any) {
      set.status = 400;
      return { message: err.message };
    }
  })
  .get('/inbox', async ({ user }) => {
    return await ChatService.getInbox((user as any).id);
  })
  .get('/conversation/:otherUserId', async ({ params: { otherUserId }, user }) => {
    return await ChatService.getConversation((user as any).id, otherUserId);
  })
  .post('/mark-read/:messageId', async ({ params: { messageId }, user, set }) => {
    try {
      await ChatService.markAsRead(messageId, (user as any).id);
      return { success: true };
    } catch (err: any) {
      set.status = 400;
      return { message: err.message };
    }
  })
  .get('/unread-count', async ({ user }) => {
    return { count: await ChatService.getUnreadCount((user as any).id) };
  })
  .get('/conversations', async ({ user }) => {
    return await ChatService.getConversationsList((user as any).id);
  });
