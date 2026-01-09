
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { GameCategoriesService } from './game-categories.service';

export const gameCategoriesRoutes = new Elysia({ prefix: '/api/game-categories' })
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
    .guard({
        beforeHandle: ({ user, set }) => {
            if (!user) {
                set.status = 401;
                return { message: 'Unauthorized' };
            }
        }
    }, (app) => app
        .get('/', async ({ user }) => {
            return await GameCategoriesService.getUserCategories((user as any).id);
        })
        .post('/', async ({ body, user, set }) => {
            const { name, icon } = body as any;
            if (!name) {
                set.status = 400;
                return { message: 'Category name is required' };
            }
            try {
                return await GameCategoriesService.createCategory((user as any).id, name, icon);
            } catch (err: any) {
                set.status = 500;
                return { message: err.message };
            }
        })
        .put('/:id', async ({ params: { id }, body, user, set }) => {
            const { name, icon } = body as any;
            try {
                return await GameCategoriesService.updateCategory((user as any).id, id, { name, icon });
            } catch (err: any) {
                set.status = 404;
                return { message: err.message };
            }
        })
        .delete('/:id', async ({ params: { id }, user, set }) => {
            try {
                const deleted = await GameCategoriesService.deleteCategory((user as any).id, id);
                if (!deleted) {
                    set.status = 404;
                    return { message: 'Category not found' };
                }
                return { success: true, message: 'Category deleted' };
            } catch (err: any) {
                set.status = 500;
                return { message: err.message };
            }
        })
        .post('/:id/assign', async ({ params: { id }, body, user, set }) => {
            const { gameKey } = body as any;
            if (!gameKey) {
                set.status = 400;
                return { message: 'gameKey is required' };
            }
            try {
                return await GameCategoriesService.assignGame((user as any).id, id, gameKey);
            } catch (err: any) {
                set.status = 404;
                return { message: err.message };
            }
        })
    );
