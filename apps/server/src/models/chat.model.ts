import mongoose, { Schema } from 'mongoose';

const messageSchema = new Schema(
  {
    from_user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    to_user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    read_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const ChatModel = mongoose.models.Message || mongoose.model('Message', messageSchema);
export default ChatModel;
