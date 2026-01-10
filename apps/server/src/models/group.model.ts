import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IGroup extends Document {
    name: string;
    description?: string;
    owner_id: mongoose.Types.ObjectId;
    members: mongoose.Types.ObjectId[];
    icon_url?: string;
    created_at: Date;
    updated_at: Date;
}

const groupSchema = new Schema<IGroup>(
    {
        name: { type: String, required: true, trim: true, maxlength: 100 },
        description: { type: String, trim: true, maxlength: 500 },
        owner_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        members: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
        icon_url: { type: String }
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Compound index for efficient queries
groupSchema.index({ owner_id: 1, created_at: -1 });

export const GroupModel: Model<IGroup> = mongoose.models.Group || mongoose.model<IGroup>('Group', groupSchema);
export default GroupModel;
