import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFriend extends Document {
  user_id: mongoose.Types.ObjectId;
  friend_id: mongoose.Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const friendSchema = new Schema<IFriend>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    friend_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

friendSchema.index({ user_id: 1, friend_id: 1 }, { unique: true });

export const FriendModel: Model<IFriend> =
  mongoose.models.Friend || mongoose.model<IFriend>('Friend', friendSchema);
