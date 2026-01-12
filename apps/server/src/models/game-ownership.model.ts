import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto';

const gameOwnershipSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    game_key: { type: String, required: true, index: true },
    game_name: { type: String, required: true },
    purchase_price: { type: Number, default: 0 },
    purchase_date: { type: Date, default: Date.now },
    is_manual_add: { type: Boolean, default: false },
    for_sale: { type: Boolean, default: false, index: true },
    asking_price: { type: Number },
    listed_at: { type: Date },
    ownership_token: { type: String, unique: true, sparse: true },
    game_id: { type: Schema.Types.ObjectId, ref: 'Game', default: null, index: true },
    current_price: { type: Number, default: null },
    status: { type: String, enum: ['owned', 'listed_for_sale'], default: 'owned' },
    is_resellable: { type: Boolean, default: true },
    game_type: { type: String, enum: ['web', 'exe'], default: 'web' },
    exe_path: { type: String, default: null },
    game_description: { type: String, default: null },
    installed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

gameOwnershipSchema.index({ user_id: 1, game_key: 1 }, { unique: true });
gameOwnershipSchema.index({ for_sale: 1, asking_price: 1 });
gameOwnershipSchema.index({ for_sale: 1, listed_at: -1 });

gameOwnershipSchema.pre('save', function (next) {
  if (!this.ownership_token) {
    this.ownership_token = crypto.randomBytes(16).toString('hex');
  }
  next();
});

const GameOwnership =
  mongoose.models.GameOwnership || mongoose.model('GameOwnership', gameOwnershipSchema);
export default GameOwnership;
