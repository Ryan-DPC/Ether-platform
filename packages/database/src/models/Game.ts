
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IGame extends Document {
    game_name: string;
    folder_name: string;
    description: string;
    image_url: string;
    status: string;
    genre: string;
    max_players: number;
    is_multiplayer: boolean;
    developer: string;
    price: number;
    manifestUrl?: string;
    zipUrl?: string;
    github_url?: string;
    version: string;
    manifestVersion?: string;
    manifestUpdatedAt?: Date;
    created_at: Date;
    updated_at: Date;
}

const gameSchema = new Schema<IGame>(
    {
        game_name: { type: String, required: true },
        folder_name: { type: String, required: true, unique: true, index: true },
        description: { type: String, default: '' },
        image_url: { type: String, default: '' },
        status: { type: String, default: 'bientôt', index: true },
        genre: { type: String, default: 'Undefined' },
        max_players: { type: Number, default: 1 },
        is_multiplayer: { type: Boolean, default: false },
        developer: { type: String, default: 'Inconnu' },
        price: { type: Number, default: 0 },
        manifestUrl: { type: String, default: null },
        zipUrl: { type: String, default: null },
        github_url: { type: String, default: null },
        version: { type: String, default: '0.0.0' },
        manifestVersion: { type: String, default: null },
        manifestUpdatedAt: { type: Date, default: null },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const GameModel: Model<IGame> = mongoose.models.Game || mongoose.model<IGame>('Game', gameSchema);
