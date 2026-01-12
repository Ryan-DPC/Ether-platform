import mongoose, { Schema, Document } from 'mongoose';

export interface IUserGameStats extends Document {
    userId: mongoose.Types.ObjectId;
    gameId: mongoose.Types.ObjectId;
    totalPlaytime: number;
    lastPlayed?: Date;
    installDate: Date;
    achievements: {
        id: string;
        unlockedAt: Date;
        name: string;
        description: string;
    }[];
    stats: Map<string, any>;
}

const userGameStatsSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    gameId: {
        type: Schema.Types.ObjectId,
        ref: 'Game',
        required: true,
        index: true
    },
    totalPlaytime: {
        type: Number,
        default: 0 // In seconds
    },
    lastPlayed: {
        type: Date,
        default: null
    },
    installDate: {
        type: Date,
        default: Date.now
    },
    achievements: [{
        id: String,
        unlockedAt: Date,
        name: String,
        description: String
    }],
    // Generic stats object for game-specific metrics (kills, wins, etc.)
    stats: {
        type: Map,
        of: Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Compound index for unique user-game pair
userGameStatsSchema.index({ userId: 1, gameId: 1 }, { unique: true });

export const UserGameStats = mongoose.model<IUserGameStats>('UserGameStats', userGameStatsSchema);
