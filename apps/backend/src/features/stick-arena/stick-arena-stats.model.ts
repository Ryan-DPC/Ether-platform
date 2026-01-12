import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IStickArenaStats extends Document {
  userId: mongoose.Types.ObjectId;
  gamesPlayed: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  powerupsCollected: number;
  favoriteWeapon: 'SWORD' | 'BOW' | 'GUN';
  winStreak: number;
  bestWinStreak: number;
  ranking: number;
  lastPlayed: Date;
  createdAt: Date;
  updatedAt: Date;
  // Virtuals
  winRate?: string;
  kdRatio?: number;
}

const stickArenaStatsSchema = new Schema<IStickArenaStats>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    totalDamageDealt: { type: Number, default: 0 },
    totalDamageTaken: { type: Number, default: 0 },
    powerupsCollected: { type: Number, default: 0 },
    favoriteWeapon: { type: String, enum: ['SWORD', 'BOW', 'GUN'], default: 'SWORD' },
    winStreak: { type: Number, default: 0 },
    bestWinStreak: { type: Number, default: 0 },
    ranking: { type: Number, default: 1000 },
    lastPlayed: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

stickArenaStatsSchema.virtual('winRate').get(function (this: IStickArenaStats) {
  if (this.gamesPlayed === 0) return 0;
  return ((this.wins / this.gamesPlayed) * 100).toFixed(2);
});

stickArenaStatsSchema.virtual('kdRatio').get(function (this: IStickArenaStats) {
  if (this.deaths === 0) return this.kills;
  return (this.kills / this.deaths).toFixed(2);
});

stickArenaStatsSchema.set('toJSON', { virtuals: true });
stickArenaStatsSchema.set('toObject', { virtuals: true });

stickArenaStatsSchema.index({ ranking: -1 });
stickArenaStatsSchema.index({ wins: -1 });
stickArenaStatsSchema.index({ winStreak: -1 });

export const StickArenaStatsModel: Model<IStickArenaStats> =
  mongoose.models.StickArenaStats ||
  mongoose.model<IStickArenaStats>('StickArenaStats', stickArenaStatsSchema);
export default StickArenaStatsModel;
