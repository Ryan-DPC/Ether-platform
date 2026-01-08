
import mongoose, { Document, Schema } from 'mongoose';

export interface ICommission extends Document {
    transaction_id: string;
    recipient_type: 'platform' | 'developer';
    recipient_id?: string | null;
    amount: number;
    percentage: number;
}

const commissionSchema = new Schema<ICommission>(
    {
        transaction_id: { type: String, required: true },
        recipient_type: { type: String, enum: ['platform', 'developer'], required: true },
        recipient_id: { type: String, default: null },
        amount: { type: Number, required: true },
        percentage: { type: Number, required: true },
    },
    { timestamps: true }
);

export default mongoose.models.Commission as mongoose.Model<ICommission> || mongoose.model<ICommission>('Commission', commissionSchema);
