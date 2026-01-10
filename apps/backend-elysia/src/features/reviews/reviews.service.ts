
import { Review } from './review.model';
import { GamesService } from '../games/games.service';

export class ReviewsService {
    static async addReview(userId: string, gameId: string, rating: number, content: string) {
        // Resolve Game ID (could be 'EtherChess' slug or ObjectId)
        const game = await GamesService.getGameByName(gameId);
        if (!game) throw new Error('Game not found');

        // Allow passing either _id or id from the game object
        const resolvedGameId = game._id || game.id;

        // Check if already reviewed
        const existing = await Review.findOne({ user_id: userId, game_id: resolvedGameId });
        if (existing) throw new Error('You have already reviewed this game');

        return await Review.create({ user_id: userId, game_id: resolvedGameId, rating, content });
    }

    static async getGameReviews(gameId: string) {
        // Resolve Game ID
        const game = await GamesService.getGameByName(gameId);
        if (!game) {
            return [];
        }

        const resolvedGameId = game._id || game.id;

        const reviews = await Review.find({ game_id: resolvedGameId })
            .populate('user_id', 'username profile_pic')
            .sort({ created_at: -1 })
            .lean();

        // Transform populate result
        return reviews.map((r: any) => ({
            id: r._id,
            user_id: {
                id: r.user_id._id,
                username: r.user_id.username,
                profile_pic: r.user_id.profile_pic
            },
            rating: r.rating,
            content: r.content,
            created_at: r.created_at
        }));
    }
}
