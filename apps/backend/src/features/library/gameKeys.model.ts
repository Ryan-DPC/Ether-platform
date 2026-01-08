
import mongoose, { Document, Schema } from 'mongoose';

export interface IGameKey extends Document {
    game_id: mongoose.Types.ObjectId;
    key: string;
    created_by?: mongoose.Types.ObjectId;
    used_by?: mongoose.Types.ObjectId;
    used_at?: Date;
    purpose: 'purchase' | 'dev' | 'streamer' | 'external' | 'promo';
    is_used: boolean;
    created_at: Date;
    updated_at: Date;
}

const gameKeySchema = new Schema<IGameKey>(
    {
        game_id: { type: Schema.Types.ObjectId, ref: 'Game', required: true, index: true },
        key: { type: String, required: true, unique: true, index: true },
        created_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        used_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        used_at: { type: Date, default: null },
        purpose: { type: String, enum: ['purchase', 'dev', 'streamer', 'external', 'promo'], default: 'purchase' },
        is_used: { type: Boolean, default: false },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.models.GameKey as mongoose.Model<IGameKey> || mongoose.model<IGameKey>('GameKey', gameKeySchema);
