
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBlockchainTx extends Document {
    transaction_id: string;
    from_address: string;
    to_address: string;
    amount: number;
    transaction_type: 'game_purchase' | 'game_sale' | 'item_purchase' | 'game_redemption';
    currency: string;
    game_id?: mongoose.Types.ObjectId;
    game_key?: string;
    item_id?: mongoose.Types.ObjectId;
    ownership_token?: string;
    timestamp: Date;
}

const blockchainTxSchema = new Schema<IBlockchainTx>(
    {
        transaction_id: { type: String, required: true, unique: true },
        from_address: { type: String, required: true },
        to_address: { type: String, required: true },
        amount: { type: Number, required: true },
        transaction_type: { type: String, enum: ['game_purchase', 'game_sale', 'item_purchase', 'game_redemption'], required: true },
        currency: { type: String, default: 'VTX' },
        game_id: { type: Schema.Types.ObjectId, ref: 'Game', required: false },
        game_key: { type: String, required: false },
        item_id: { type: Schema.Types.ObjectId, ref: 'Item', required: false },
        ownership_token: { type: String, default: null },
        timestamp: { type: Date, default: Date.now },
    },
    { timestamps: false }
);

blockchainTxSchema.index({ from_address: 1, timestamp: -1 });
blockchainTxSchema.index({ to_address: 1, timestamp: -1 });

export const BlockchainTxModel: Model<IBlockchainTx> = mongoose.models.BlockchainTx || mongoose.model<IBlockchainTx>('BlockchainTx', blockchainTxSchema);
export default BlockchainTxModel;
