
import { StickArenaStatsModel } from './stick-arena-stats.model';
import { StickArenaMatchModel } from './stick-arena-match.model';

export class StickArenaStatsService {
    async getOrCreateStats(userId: string) {
        try {
            let stats = await StickArenaStatsModel.findOne({ userId }).populate('userId', 'username email');

            if (!stats) {
                stats = await StickArenaStatsModel.create({ userId });
                stats = await StickArenaStatsModel.findById(stats._id).populate('userId', 'username email');
            }

            return stats;
        } catch (error: any) {
            throw new Error(`Error getting stats: ${error.message}`);
        }
    }

    async updateMatchStats(userId: string, matchData: any) {
        try {
            const stats = await this.getOrCreateStats(userId);
            if (!stats) throw new Error("Stats fetch failed");

            stats.gamesPlayed += 1;
            stats.lastPlayed = new Date();

            if (matchData.won) {
                stats.wins += 1;
                stats.winStreak += 1;
                if (stats.winStreak > stats.bestWinStreak) {
                    stats.bestWinStreak = stats.winStreak;
                }
                stats.ranking += 25;
            } else {
                stats.losses += 1;
                stats.winStreak = 0;
                stats.ranking = Math.max(0, stats.ranking - 15);
            }

            if (matchData.kills) stats.kills += matchData.kills;
            if (matchData.deaths) stats.deaths += matchData.deaths;
            if (matchData.damageDealt) stats.totalDamageDealt += matchData.damageDealt;
            if (matchData.damageTaken) stats.totalDamageTaken += matchData.damageTaken;
            if (matchData.powerupsCollected) stats.powerupsCollected += matchData.powerupsCollected;
            if (matchData.weaponUsed) stats.favoriteWeapon = matchData.weaponUsed;

            await stats.save();
            return stats;
        } catch (error: any) {
            throw new Error(`Error updating stats: ${error.message}`);
        }
    }

    async getLeaderboard(sortBy: string = 'ranking', limit: number = 100) {
        try {
            const sortOptions: any = {
                ranking: { ranking: -1 },
                wins: { wins: -1 },
                winRate: { wins: -1, gamesPlayed: -1 }, // Mongoose sort doesn't support virtuals directly naturally in simple query, but MongoDB aggregation could. However simplified:
                winStreak: { bestWinStreak: -1 },
                kills: { kills: -1 }
            };

            const sort = sortOptions[sortBy] || sortOptions.ranking;

            const leaderboard = await StickArenaStatsModel.find()
                .populate('userId', 'username email')
                .sort(sort)
                .limit(limit)
                .lean();

            return leaderboard.map((entry, index) => ({
                ...entry,
                position: index + 1
            }));
        } catch (error: any) {
            throw new Error(`Error fetching leaderboard: ${error.message}`);
        }
    }

    async getUserRank(userId: string) {
        try {
            const userStats = await this.getOrCreateStats(userId);
            if (!userStats) throw new Error("User stats not found");

            const higherRanked = await StickArenaStatsModel.countDocuments({
                ranking: { $gt: userStats.ranking }
            });

            return {
                rank: higherRanked + 1,
                stats: userStats
            };
        } catch (error: any) {
            throw new Error(`Error getting user rank: ${error.message}`);
        }
    }

    async getTopPlayers(limit: number = 10) {
        try {
            return await StickArenaStatsModel.find()
                .populate('userId', 'username email')
                .sort({ ranking: -1 })
                .limit(limit)
                .select('userId wins losses ranking winRate kdRatio bestWinStreak')
                .lean();
        } catch (error: any) {
            throw new Error(`Error getting top players: ${error.message}`);
        }
    }

    async resetStreak(userId: string) {
        try {
            await StickArenaStatsModel.updateOne(
                { userId },
                { $set: { winStreak: 0 } }
            );
        } catch (error: any) {
            throw new Error(`Error resetting streak: ${error.message}`);
        }
    }

    async recordMatch(matchData: any) {
        try {
            const match = await StickArenaMatchModel.create({
                winnerId: matchData.winnerId,
                loserId: matchData.loserId,
                winnerScore: matchData.winnerScore,
                loserScore: matchData.loserScore,
                duration: matchData.duration
            });

            await this.updateMatchStats(matchData.winnerId, {
                won: true,
                ...matchData.winnerStats
            });

            await this.updateMatchStats(matchData.loserId, {
                won: false,
                ...matchData.loserStats
            });

            return match;
        } catch (error: any) {
            console.error('Error recording match:', error);
        }
    }

    async getMatchHistory(userId: string, limit: number = 10) {
        try {
            return await StickArenaMatchModel.find({
                $or: [{ winnerId: userId }, { loserId: userId }]
            })
                .populate('winnerId', 'username')
                .populate('loserId', 'username')
                .sort({ playedAt: -1 })
                .limit(limit)
                .lean();
        } catch (error: any) {
            throw new Error(`Error getting match history: ${error.message}`);
        }
    }
}

export const stickArenaStatsService = new StickArenaStatsService();
