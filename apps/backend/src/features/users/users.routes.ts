
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { UsersService } from './users.service';

export const usersRoutes = new Elysia({ prefix: '/api/users' })
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

    // Profile Management
    .get('/me', async ({ user, set }) => {
        try {
            return await UsersService.getUserProfile(user!.id as string);
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    })
    .put('/me', async ({ user, body, set }) => {
        try {
            return await UsersService.updateProfile(user!.id as string, body);
        } catch (error: any) {
            set.status = 400; // Likely validation or duplicate error
            return { message: error.message };
        }
    }, {
        body: t.Object({
            username: t.Optional(t.String()),
            email: t.Optional(t.String()),
            language: t.Optional(t.String()),
            bio: t.Optional(t.String()),
            social_links: t.Optional(t.Any()), // Using Any for flexibility, could be Record
            notification_preferences: t.Optional(t.Any())
        })
    })

    // Upload Avatar (simplified via JSON for now, assuming external upload service or separate multipart handler)
    // Note: The original used multipart/form-data. For now, we assume frontend sends URL after upload.
    // If multipart upload is needed within Elysia, it requires specific plugin.
    .post('/avatar', async ({ user, body, set }) => {
        try {
            const { avatarUrl } = body;
            return await UsersService.updateAvatar(user!.id as string, avatarUrl);
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    }, {
        body: t.Object({
            avatarUrl: t.String()
        })
    })

    // Search
    .get('/search', async ({ query, user, set }) => {
        try {
            const { q } = query;
            if (!q) {
                set.status = 400;
                return { message: 'Query parameter "q" is required' };
            }
            return await UsersService.searchUsers(q, user!.id as string);
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    }, {
        query: t.Object({
            q: t.String() // search term
        })
    })

    // Recent Games
    .get('/recent-games', async ({ user, set }) => {
        try {
            return await UsersService.getRecentGames(user!.id as string);
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    })

    // Wishlist
    .get('/wishlist', async ({ user, set }) => {
        try {
            return await UsersService.getWishlist(user!.id as string);
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    })
    .post('/wishlist', async ({ user, body, set }) => {
        try {
            const { gameId } = body;
            return await UsersService.addToWishlist(user!.id as string, gameId);
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    }, {
        body: t.Object({
            gameId: t.String()
        })
    })
    .delete('/wishlist/:gameId', async ({ user, params: { gameId }, set }) => {
        try {
            return await UsersService.removeFromWishlist(user!.id as string, gameId);
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    })

    // ELO
    .get('/:userId/elo', async ({ params: { userId }, set }) => {
        try {
            return await UsersService.getUserElo(userId);
        } catch (error: any) {
            set.status = 404;
            return { message: error.message };
        }
    })
    .put('/elo', async ({ user, body, set }) => {
        try {
            const { newElo } = body;
            return await UsersService.updateUserElo(user!.id as string, newElo);
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    }, {
        body: t.Object({
            newElo: t.Number()
        })
    })

    // Public Profile
    .get('/:userId', async ({ params: { userId }, set }) => {
        try {
            const profile = await UsersService.getPublicProfile(userId);
            if (!profile) {
                set.status = 404;
                return { message: 'User not found' };
            }
            return profile;
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    });

