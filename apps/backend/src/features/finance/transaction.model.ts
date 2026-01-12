import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  currency: 'CHF' | 'EUR' | 'USD' | 'GBP';
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'PURCHASE' | 'REFUND' | 'TRANSFER';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  description?: string;
  referenceId?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ['CHF', 'EUR', 'USD', 'GBP'], default: 'CHF' },
    type: {
      type: String,
      enum: ['DEPOSIT', 'WITHDRAWAL', 'PURCHASE', 'REFUND', 'TRANSFER'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    description: { type: String },
    referenceId: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const TransactionModel: Model<ITransaction> =
  mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', transactionSchema);
export default TransactionModel;
