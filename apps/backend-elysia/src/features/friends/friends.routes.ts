
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { FriendsService } from './friends.service';

export const friendsRoutes = new Elysia({ prefix: '/api/friends' })
    .use(jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET || 'default_secret'
    }))
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
    .get('/list', async ({ user }) => {
        return await FriendsService.getFriends((user as any).id);
    })
    .get('/requests', async ({ user }) => {
        return await FriendsService.getFriendRequests((user as any).id);
    })
    .post('/add', async ({ body, user, set }) => {
        const { friendId } = body as any;
        try {
            const result = await FriendsService.sendFriendRequest((user as any).id, friendId);
            return { success: true, id: result };
        } catch (err: any) {
            set.status = 400;
            return { message: err.message };
        }
    })
    .post('/accept', async ({ body, set }) => {
        const { requestId } = body as any;
        try {
            await FriendsService.acceptFriendRequest(requestId);
            return { success: true };
        } catch (err: any) {
            set.status = 400;
            return { message: err.message };
        }
    })
    .post('/reject/:id', async ({ params: { id }, user, set }) => {
        try {
            await FriendsService.rejectFriendRequest(id, (user as any).id);
            return { success: true };
        } catch (err: any) {
            set.status = 400;
            return { message: err.message };
        }
    })
    .delete('/:friendId', async ({ params: { friendId }, user, set }) => {
        try {
            await FriendsService.removeFriend((user as any).id, friendId);
            return { success: true };
        } catch (err: any) {
            set.status = 500;
            return { message: err.message };
        }
    });
