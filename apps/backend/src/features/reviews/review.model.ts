import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
    user_id: mongoose.Types.ObjectId;
    game_id: mongoose.Types.ObjectId;
    rating: number;
    content: string;
    created_at: Date;
    updated_at: Date;
}

const reviewSchema = new Schema({
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    game_id: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    content: { type: String, required: true, maxlength: 1000 },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Ensure unique review per user per game
reviewSchema.index({ user_id: 1, game_id: 1 }, { unique: true });

export const Review = mongoose.model<IReview>('Review', reviewSchema);
