
import { TransactionModel } from './transaction.model';
import { InvoiceModel } from './invoice.model';
import Users from '../users/user.model';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid'; // Need to add uuid package if not present, or use crypto

// bun add uuid @types/uuid
// If not installed, I will use custom random gen for now or stick with crypto.
import crypto from 'crypto';

export class FinanceService {
    static async getTransactionHistory(userId: string, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;
        const [transactions, total] = await Promise.all([
            TransactionModel.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            TransactionModel.countDocuments({ userId })
        ]);

        return {
            rows: transactions.map((t: any) => ({ ...t, id: t._id.toString() })),
            count: total
        };
    }

    static async deposit(userId: string, amount: number, currency: any, method: string = 'CREDIT_CARD') {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Create Transaction (Mongoose)
            const transaction = await TransactionModel.create([{
                userId,
                amount,
                currency,
                type: 'DEPOSIT',
                status: 'COMPLETED',
                description: `Deposit via ${method}`,
                referenceId: crypto.randomUUID(), // Native UUID in Bun/Node
                metadata: { method }
            }], { session });

            const txDoc = transaction[0];

            // 2. Create Invoice
            await InvoiceModel.create([{
                userId,
                transactionId: txDoc._id,
                invoiceNumber: `INV-${Date.now()}`,
                amount,
                currency,
                billingDetails: { method }
            }], { session });

            // 3. Update User Balance (Mongo)
            await Users.incrementBalance(userId, currency, amount, session);

            await session.commitTransaction();
            session.endSession();
            return { ...txDoc.toObject(), id: txDoc._id.toString() };

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }

    static async withdraw(userId: string, amount: number, currency: any, method: string = 'BANK_TRANSFER') {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Check and atomic deduct
            const hasFunds = await Users.decrementBalanceIfSufficient(userId, currency, amount, session);

            if (!hasFunds) {
                await session.abortTransaction();
                session.endSession();
                throw new Error('Insufficient funds');
            }

            // 2. Create Transaction
            const transaction = await TransactionModel.create([{
                userId,
                amount: -amount, // Negative for withdrawal
                currency,
                type: 'WITHDRAWAL',
                status: 'COMPLETED',
                description: `Withdrawal to ${method}`,
                metadata: { method }
            }], { session });

            const txDoc = transaction[0];

            // 3. Create Invoice
            await InvoiceModel.create([{
                userId,
                transactionId: txDoc._id,
                invoiceNumber: `INV-${Date.now()}`,
                amount: amount,
                currency
            }], { session });

            await session.commitTransaction();
            session.endSession();
            return { ...txDoc.toObject(), id: txDoc._id.toString() };

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
}

export const financeService = FinanceService;
