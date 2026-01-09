
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IInvoice extends Document {
    userId: mongoose.Types.ObjectId;
    transactionId: mongoose.Types.ObjectId;
    invoiceNumber: string;
    amount: number;
    currency: string;
    billingDetails?: any;
    pdfUrl?: string;
    issuedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
        invoiceNumber: { type: String, required: true, unique: true },
        amount: { type: Number, required: true },
        currency: { type: String, default: 'CHF' },
        billingDetails: { type: Schema.Types.Mixed },
        pdfUrl: { type: String },
        issuedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

export const InvoiceModel: Model<IInvoice> = mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', invoiceSchema);
export default InvoiceModel;
