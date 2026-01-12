
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IMessage extends Document {
    from_user: mongoose.Types.ObjectId;
    to_user: mongoose.Types.ObjectId;
    content: string;
    read_at?: Date | null;
    created_at: Date;
    updated_at: Date;
}

const messageSchema = new Schema<IMessage>(
    {
        from_user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        to_user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        content: { type: String, required: true },
        read_at: { type: Date, default: null },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const MessageModel: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>('Message', messageSchema);
export default MessageModel;
