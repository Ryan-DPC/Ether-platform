
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IGameSession extends Document {
    user_id: mongoose.Types.ObjectId;
    game_id?: mongoose.Types.ObjectId;
    game_folder_name: string;
    ownership_token: string;
    session_token: string;
    started_at: Date;
    last_heartbeat: Date;
    status: 'active' | 'ended' | 'timeout';
    process_id?: number | null;
    created_at: Date;
    updated_at: Date;
}

const gameSessionSchema = new Schema<IGameSession>(
    {
        user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        game_id: { type: Schema.Types.ObjectId, ref: 'Game', default: null, index: true },
        game_folder_name: { type: String, required: true },
        ownership_token: { type: String, required: true },
        session_token: { type: String, required: true, unique: true, index: true },
        started_at: { type: Date, default: Date.now, index: true },
        last_heartbeat: { type: Date, default: Date.now },
        status: { type: String, enum: ['active', 'ended', 'timeout'], default: 'active', index: true },
        process_id: { type: Number, default: null, index: true },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

gameSessionSchema.index({ user_id: 1, status: 1 });

export const GameSessionModel: Model<IGameSession> = mongoose.models.GameSession || mongoose.model<IGameSession>('GameSession', gameSessionSchema);
export default GameSessionModel;
