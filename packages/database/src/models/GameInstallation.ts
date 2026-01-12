
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IGameInstallation extends Document {
    user_id: mongoose.Types.ObjectId;
    game_id: mongoose.Types.ObjectId;
    version: string;
    path: string;
    status: 'installed' | 'pending_update' | 'updating' | 'failed';
    last_checked: Date;
    created_at: Date;
    updated_at: Date;
}

const gameInstallationSchema = new Schema<IGameInstallation>(
    {
        user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        game_id: { type: Schema.Types.ObjectId, ref: 'Game', required: true, index: true },
        version: { type: String, required: true },
        path: { type: String, required: true },
        status: { type: String, enum: ['installed', 'pending_update', 'updating', 'failed'], default: 'installed' },
        last_checked: { type: Date, default: null }
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const GameInstallationModel: Model<IGameInstallation> = mongoose.models.GameInstallation || mongoose.model<IGameInstallation>('GameInstallation', gameInstallationSchema);
