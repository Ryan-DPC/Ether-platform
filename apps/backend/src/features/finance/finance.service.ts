
import { TransactionModel } from './transaction.model';
import { InvoiceModel } from './invoice.model';
import { Users } from '@vext/database';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

import { GameOwnershipModel as GameOwnership } from '../game-ownership/game-ownership.model';
import { BlockchainTxModel as BlockchainTx } from '../library/blockchainTx.model';
import etherBlockchain from '../../services/blockchain.instance';
import { Transaction } from '../../services/blockchain.service';

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

    static async purchaseUsedGame(buyerId: string, ownershipToken: string, sellerId: string) {
        if (!ownershipToken || !sellerId) {
            throw new Error('ownershipToken and sellerId are required');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Find the listing
            const listing = await GameOwnership.findOne({
                ownership_token: ownershipToken,
                user_id: sellerId,
                for_sale: true
            }).session(session);

            if (!listing) {
                throw new Error('Listing not found or no longer available');
            }

            // Check if buyer already owns this game
            const alreadyOwns = await GameOwnership.findOne({
                user_id: buyerId,
                game_key: listing.game_key
            }).session(session);

            if (alreadyOwns) {
                throw new Error('You already own this game');
            }

            const salePrice = listing.asking_price || 0;
            const platformFee = salePrice * 0.05; // 5%
            const developerFee = salePrice * 0.02; // 2%
            const sellerReceives = salePrice - platformFee - developerFee;

            // Check funds and deduct from buyer
            const hasFunds = await Users.decrementBalanceIfSufficient(buyerId, 'CHF', salePrice, session);
            if (!hasFunds) {
                throw new Error('Insufficient balance');
            }

            // Credit seller
            await Users.incrementBalance(sellerId, 'CHF', sellerReceives, session);

            // Transfer ownership
            listing.user_id = buyerId as any;
            listing.for_sale = false;
            listing.asking_price = undefined;
            listing.listed_at = undefined;
            listing.purchase_price = salePrice;
            listing.purchase_date = new Date();
            listing.installed = false;
            await listing.save({ session });

            await session.commitTransaction();
            session.endSession();

            // Record transaction in Blockchain (Outside Mongo Transaction for now as it's separate system simulation)
            try {
                // 1. Transaction: Buyer -> Seller (Net Amount)
                const txToSeller = new Transaction(buyerId, sellerId, sellerReceives, 'game_sale', listing.game_key);
                etherBlockchain.createTransaction(txToSeller);

                // Save to persistent DB
                await BlockchainTx.create({
                    transaction_id: txToSeller.transactionId,
                    from_address: buyerId,
                    to_address: sellerId,
                    amount: sellerReceives,
                    transaction_type: 'game_sale',
                    game_id: listing.game_id,
                    game_key: listing.game_key,
                    ownership_token: listing.ownership_token,
                    currency: 'CHF' // Game sales are in CHF
                });

                // 2. Transaction: Buyer -> Platform (Fee)
                const txToPlatform = new Transaction(buyerId, 'PLATFORM_WALLET', platformFee, 'commission', listing.game_key);
                etherBlockchain.createTransaction(txToPlatform);

                // 3. Transaction: Buyer -> Developer (Fee)
                const txToDev = new Transaction(buyerId, 'DEVELOPER_WALLET', developerFee, 'commission', listing.game_key);
                etherBlockchain.createTransaction(txToDev);

                // Mine the block immediately for this simulation
                etherBlockchain.minePendingTransactions('MINER_WALLET');

                console.log(`[Blockchain] Recorded sale of ${listing.game_name}`);
            } catch (bcError) {
                console.error('[Blockchain] Failed to record transaction:', bcError);
                // Non-blocking error for the purchase itself, but ideally should be robust
            }

            return {
                success: true,
                game: listing,
                salePrice,
                sellerReceives
            };

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
}

export const financeService = FinanceService;
