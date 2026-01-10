
import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { ReviewsService } from './reviews.service';

export const reviewsRoutes = new Elysia({ prefix: '/api/games' })
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
    .get('/:id/reviews', async ({ params: { id }, set }) => {
        try {
            const reviews = await ReviewsService.getGameReviews(id);
            return reviews;
        } catch (error: any) {
            set.status = 500;
            return { message: error.message };
        }
    })
    .post('/:id/reviews', async ({ params: { id }, body, user, set }) => {
        if (!user || typeof user.id !== 'string') {
            set.status = 401;
            return { message: 'Unauthorized' };
        }

        const { rating, content } = body;

        try {
            const review = await ReviewsService.addReview(user.id, id, rating, content);
            set.status = 201;
            return review;
        } catch (error: any) {
            set.status = 400;
            return { message: error.message };
        }
    }, {
        body: t.Object({
            rating: t.Numeric({ min: 1, max: 5 }),
            content: t.String({ maxLength: 1000 })
        })
    });
