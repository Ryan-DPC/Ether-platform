
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IItem extends Document {
    name: string;
    description: string;
    price: number;
    image_url: string;
    game_id?: mongoose.Types.ObjectId;
    item_type: 'badge' | 'banner' | 'profile_picture' | 'avatar_frame' | 'background' | 'other';
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    cloudinary_id?: string;
    is_archived: boolean;
    created_at: Date;
    updated_at: Date;
}

const itemSchema = new Schema<IItem>(
    {
        name: { type: String, required: true },
        description: { type: String, default: '' },
        price: { type: Number, default: 0 },
        image_url: { type: String, default: '' },
        game_id: { type: Schema.Types.ObjectId, ref: 'Game', default: null, index: true },
        item_type: { type: String, enum: ['badge', 'banner', 'profile_picture', 'avatar_frame', 'background', 'other'], default: 'other' },
        rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
        cloudinary_id: { type: String, default: null, index: true },
        is_archived: { type: Boolean, default: false, index: true },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

itemSchema.index({ is_archived: 1, rarity: 1 });
itemSchema.index({ name: 'text', description: 'text' });
export const ItemModel: Model<IItem> = mongoose.models.Item || mongoose.model<IItem>('Item', itemSchema);
export default ItemModel;
