
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import Users from './user.model';

export const usersRoutes = new Elysia({ prefix: '/api/users' })
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
        if (!payload) {
            return { user: null };
        }
        return { user: payload };
    })
    .get('/me', async ({ user, set }) => {
        if (!user) {
            set.status = 401;
            return { success: false, message: 'Unauthorized' };
        }

        const userProfile = await Users.getUserById(user.id);
        if (!userProfile) {
            set.status = 404;
            return { success: false, message: 'User not found' };
        }

        return userProfile;
    });
