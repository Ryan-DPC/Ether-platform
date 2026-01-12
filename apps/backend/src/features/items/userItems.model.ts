
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IUserItem extends Document {
    user_id: mongoose.Types.ObjectId;
    item_id: mongoose.Types.ObjectId;
    purchased_at: Date;
    is_equipped: boolean;
    user_image_url?: string;
}

const userItemSchema = new Schema<IUserItem>(
    {
        user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        item_id: { type: Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
        purchased_at: { type: Date, default: Date.now },
        is_equipped: { type: Boolean, default: false },
        user_image_url: { type: String, default: null },
    },
    { timestamps: false }
);

// Optimization for fetching user items and equipping check
userItemSchema.index({ user_id: 1, is_equipped: 1 });
userItemSchema.index({ user_id: 1, item_id: 1 }, { unique: true });
export const UserItemModel: Model<IUserItem> = mongoose.models.UserItem || mongoose.model<IUserItem>('UserItem', userItemSchema);
export default UserItemModel;
