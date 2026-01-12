
import { PlaySession } from './playSession.model';
import { UserGameStats } from './userGameStats.model';
import mongoose from 'mongoose';

export class StatsService {
    // --- Session Management ---

    static async startSession(userId: string, gameId: string) {
        if (!gameId) throw new Error('Missing gameId');

        const session = await PlaySession.create({
            userId,
            gameId,
            startTime: new Date()
        });

        // Ensure UserGameStats entry exists
        await UserGameStats.updateOne(
            { userId, gameId },
            { $setOnInsert: { installDate: new Date() } },
            { upsert: true }
        );

        return { sessionId: session._id, startTime: session.startTime };
    }

    static async endSession(sessionId: string) {
        if (!sessionId) throw new Error('Missing sessionId');

        const session = await PlaySession.findById(sessionId);
        if (!session) throw new Error('Session not found');

        // If already ended, return existing duration
        if (session.endTime) {
            return { message: 'Session already ended', duration: session.duration };
        }

        const endTime = new Date();
        const duration = Math.round((endTime.getTime() - session.startTime.getTime()) / 1000); // Seconds

        session.endTime = endTime;
        session.duration = duration;
        await session.save();

        // Update user total playtime for this game
        await UserGameStats.updateOne(
            { userId: session.userId, gameId: session.gameId },
            {
                $inc: { totalPlaytime: duration },
                $set: { lastPlayed: endTime }
            }
        );

        return { success: true, duration };
    }

    // --- Statistics Aggregation ---

    static async getGlobalStats(userId: string) {
        // 1. Total Playtime across all games
        const totalStats = await UserGameStats.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $group: { _id: null, totalSeconds: { $sum: '$totalPlaytime' } } }
        ]);
        const totalHours = totalStats.length ? (totalStats[0].totalSeconds / 3600).toFixed(1) : "0.0";

        // 2. Top 3 Most Played Games
        const topGamesDocs = await UserGameStats.find({ userId })
            .sort({ totalPlaytime: -1 })
            .limit(3)
            .populate('gameId', 'game_name image_url')
            .lean();

        const topGames = topGamesDocs.map((doc: any) => ({
            id: doc.gameId._id,
            name: doc.gameId.game_name,
            image: doc.gameId.image_url,
            hours: (doc.totalPlaytime / 3600).toFixed(1)
        }));

        // 3. Activity Heatmap (Sessions per Day of Week / Hour)
        // Aggregating last 30 days of sessions
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const sessions = await PlaySession.find({
            userId,
            startTime: { $gte: thirtyDaysAgo }
        }).select('startTime duration').lean();

        // Transform for heatmap (last 7 days)
        const last7Days: Record<string, number> = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            last7Days[dateKey] = 0;
        }

        sessions.forEach((s: any) => {
            const dateKey = s.startTime.toISOString().split('T')[0];
            if (last7Days[dateKey] !== undefined) {
                last7Days[dateKey] += (s.duration / 3600); // Add hours
            }
        });

        const activityData = Object.entries(last7Days)
            .map(([date, hours]) => ({ date, hours: (hours as number).toFixed(2) }))
            .reverse();

        return {
            totalHours,
            topGames,
            activityData
        };
    }

    static async getGameStats(userId: string, gameId: string) {
        const stats = await UserGameStats.findOne({ userId, gameId }).lean();
        if (!stats) return { totalPlaytime: 0, lastPlayed: null, achievements: [] };

        return {
            totalPlaytime: stats.totalPlaytime,
            lastPlayed: stats.lastPlayed,
            achievements: stats.achievements || []
        };
    }
}
