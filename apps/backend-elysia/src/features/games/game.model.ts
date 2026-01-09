
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

export default class Games {
    static async getAllGames(): Promise<any[]> {
        const docs = await GameModel.find({}).lean();
        return docs.map((d: any) => ({ id: d._id.toString(), ...d }));
    }

    static async addGame(game: Partial<IGame>): Promise<string> {
        const doc = await GameModel.create(game);
        return doc._id.toString();
    }

    static async getGameByName(folder_name: string): Promise<any | null> {
        const doc = await GameModel.findOne({ folder_name }).lean();
        return doc ? { id: (doc as any)._id.toString(), ...doc } : null;
    }

    static async getGameById(gameId: string): Promise<any | null> {
        if (!gameId || !mongoose.Types.ObjectId.isValid(gameId)) return null;
        const doc = await GameModel.findById(gameId).lean();
        return doc ? { id: (doc as any)._id.toString(), ...doc } : null;
    }

    static async getAvailableGamesFromDB(): Promise<any[]> {
        const docs = await GameModel.find({ status: 'disponible' }).lean();
        return docs.map((d: any) => ({ id: d._id.toString(), ...d }));
    }

    static async updateManifest(folderName: string, manifestUrl: string, manifestVersion: string): Promise<boolean> {
        const result = await GameModel.updateOne(
            { folder_name: folderName },
            {
                $set: {
                    manifestUrl: manifestUrl,
                    manifestVersion: manifestVersion,
                    manifestUpdatedAt: new Date(),
                }
            }
        );
        return result.modifiedCount > 0;
    }

    static async updateGameVersion(gameId: string, version: string, manifestUrl: string, zipUrl: string): Promise<boolean> {
        let query = {};
        if (mongoose.Types.ObjectId.isValid(gameId)) {
            query = { _id: gameId };
        } else {
            query = { folder_name: gameId };
        }

        const result = await GameModel.updateOne(
            query,
            {
                $set: {
                    version: version,
                    manifestVersion: version,
                    manifestUrl: manifestUrl,
                    zipUrl: zipUrl,
                    manifestUpdatedAt: new Date()
                }
            }
        );
        return result.modifiedCount > 0;
    }

    static async getGamesByKeysOrIds(keys: string[], ids: string[]): Promise<any[]> {
        return await GameModel.find({
            $or: [
                { folder_name: { $in: keys } },
                { _id: { $in: ids } }
            ]
        }).lean();
    }

    static async updateGameMetadata(folderName: string, updates: any): Promise<boolean> {
        const result = await GameModel.updateOne(
            { folder_name: folderName },
            { $set: updates }
        );
        return result.modifiedCount > 0;
    }

    static async findGameByIdOrSlug(identifier: string): Promise<any | null> {
        if (!identifier) return null;
        let query;

        if (mongoose.Types.ObjectId.isValid(identifier)) {
            query = { $or: [{ _id: identifier }, { folder_name: identifier }] };
        } else {
            query = { folder_name: identifier };
        }

        const doc = await GameModel.findOne(query).lean();
        return doc ? { id: (doc as any)._id.toString(), ...doc } : null;
    }
}
