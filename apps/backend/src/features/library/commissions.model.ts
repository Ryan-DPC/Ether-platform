import mongoose, { Document, Schema, Model } from 'mongoose';

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

export const CommissionModel: Model<ICommission> =
  mongoose.models.Commission || mongoose.model<ICommission>('Commission', commissionSchema);
export default CommissionModel;
