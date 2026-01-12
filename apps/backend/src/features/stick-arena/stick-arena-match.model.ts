import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IStickArenaMatch extends Document {
  winnerId: mongoose.Types.ObjectId;
  loserId: mongoose.Types.ObjectId;
  winnerScore: number;
  loserScore: number;
  duration: number; // in seconds
  playedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const stickArenaMatchSchema = new Schema<IStickArenaMatch>(
  {
    winnerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    loserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    winnerScore: { type: Number, default: 0 },
    loserScore: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    playedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

stickArenaMatchSchema.index({ winnerId: 1, playedAt: -1 });
stickArenaMatchSchema.index({ loserId: 1, playedAt: -1 });

export const StickArenaMatchModel: Model<IStickArenaMatch> =
  mongoose.models.StickArenaMatch ||
  mongoose.model<IStickArenaMatch>('StickArenaMatch', stickArenaMatchSchema);
export default StickArenaMatchModel;
