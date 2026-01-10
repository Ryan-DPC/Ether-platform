import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IGroupMessage extends Document {
    group_id: mongoose.Types.ObjectId;
    user_id: mongoose.Types.ObjectId;
    content: string;
    created_at: Date;
}

const groupMessageSchema = new Schema<IGroupMessage>(
    {
        group_id: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
        user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        content: { type: String, required: true, maxlength: 2000 }
    },
    { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

// Compound index for efficient message history queries
groupMessageSchema.index({ group_id: 1, created_at: -1 });

export const GroupMessageModel: Model<IGroupMessage> = mongoose.models.GroupMessage || mongoose.model<IGroupMessage>('GroupMessage', groupMessageSchema);
export default GroupMessageModel;
