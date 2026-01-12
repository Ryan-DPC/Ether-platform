
import mongoose, { Document, Schema } from 'mongoose';

export interface IGameCategory extends Document {
    user_id: mongoose.Types.ObjectId;
    name: string;
    icon: string;
    games: string[]; // Game keys/slugs
    created_at: Date;
    updated_at: Date;
}

const gameCategorySchema = new Schema<IGameCategory>(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        icon: {
            type: String,
            default: '📁'
        },
        games: [{
            type: String // Game keys/slugs
        }],
        created_at: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Index for faster queries
gameCategorySchema.index({ user_id: 1, name: 1 });

export const GameCategory = mongoose.model<IGameCategory>('GameCategory', gameCategorySchema);
