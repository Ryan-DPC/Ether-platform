import mongoose, { Schema } from 'mongoose';

const blockchainTxSchema = new Schema(
  {
    transaction_id: { type: String, required: true, unique: true },
    from_address: { type: String, required: true },
    to_address: { type: String, required: true },
    amount: { type: Number, required: true },
    transaction_type: {
      type: String,
      enum: ['game_purchase', 'game_sale', 'item_purchase', 'game_redemption'],
      required: true,
    },
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

const BlockchainTx =
  mongoose.models.BlockchainTx || mongoose.model('BlockchainTx', blockchainTxSchema);
export default BlockchainTx;
