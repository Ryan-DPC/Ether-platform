import mongoose, { Schema, Document } from 'mongoose';

export interface IPlaySession extends Document {
    userId: mongoose.Types.ObjectId;
    gameId: mongoose.Types.ObjectId;
    startTime: Date;
    endTime?: Date;
    duration: number; // In seconds
    platform: string;
}

const playSessionSchema = new Schema({
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
    startTime: {
        type: Date,
        required: true,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    duration: {
        type: Number, // In seconds
        default: 0
    },
    platform: {
        type: String,
        default: 'desktop'
    }
}, {
    timestamps: true
});

// Index for efficiently querying sessions by date range (activity graph)
playSessionSchema.index({ userId: 1, startTime: -1 });

export const PlaySession = mongoose.model<IPlaySession>('PlaySession', playSessionSchema);
