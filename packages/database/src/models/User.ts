import mongoose, { Document, Schema, Model, ClientSession } from 'mongoose';

export interface IUserBalances {
  chf: number;
  eur: number;
  usd: number;
  gbp: number;
}

export interface ISocialLinks {
  twitter: string;
  discord: string;
  website: string;
}

export interface INotificationPreferences {
  email_updates: boolean;
  push_notifications: boolean;
  marketing_emails: boolean;
}

export interface IUser extends Document {
  username: string;
  password?: string;
  email: string;
  github_id?: string | null;
  github_username?: string | null;
  isAdmin: boolean;
  tokens: number;
  currency: 'CHF' | 'EUR' | 'USD' | 'GBP';
  language: string;
  balances: IUserBalances;
  profile_pic?: string | null;
  elo: number;
  socket_id?: string | null;
  xp: number;
  level: number;
  status_message: string;
  favorite_games: mongoose.Types.ObjectId[];
  wishlist: mongoose.Types.ObjectId[];
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  bio: string;
  social_links: ISocialLinks;
  notification_preferences: INotificationPreferences;
  created_at: Date;
  updated_at: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: false },
    email: { type: String, required: true, unique: true, index: true },
    github_id: { type: String, default: null, index: true },
    github_username: { type: String, default: null },
    isAdmin: { type: Boolean, default: false },
    tokens: { type: Number, default: 1000 },
    currency: { type: String, enum: ['CHF', 'EUR', 'USD', 'GBP'], default: 'CHF' },
    language: { type: String, default: 'English' },
    balances: {
      chf: { type: Number, default: 0 },
      eur: { type: Number, default: 0 },
      usd: { type: Number, default: 0 },
      gbp: { type: Number, default: 0 },
    },
    profile_pic: { type: String, default: null },
    elo: { type: Number, default: 1600 },
    socket_id: { type: String, default: null, index: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    status_message: { type: String, default: 'Online' },
    favorite_games: [{ type: Schema.Types.ObjectId }],
    wishlist: [{ type: Schema.Types.ObjectId }],
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    bio: { type: String, default: '' },
    social_links: {
      twitter: { type: String, default: '' },
      discord: { type: String, default: '' },
      website: { type: String, default: '' },
    },
    notification_preferences: {
      email_updates: { type: Boolean, default: true },
      push_notifications: { type: Boolean, default: true },
      marketing_emails: { type: Boolean, default: false },
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Note: Bun.password usage is removed from the Model definition to keep the package environment-agnostic or strictly database focused.
// Hashing logic should ideally live in a service or controller, OR we can keep it if we ensure Bun types are available.
// Since the environment is Bun, we can keep it, but we need to ensure 'bun-types' is in devDependencies of this package.
// For now, I'll comment out the pre-save hook that uses Bun.password to avoid runtime errors if imported in a Node context (apps/server is Node?).
// Wait, apps/server uses 'node:20' in Dockerfile. Bun.password WON'T work there.
// IMPORTANT: We must refactor password hashing out of the model if sharing between Bun (Backend) and Node (Server).
// OR, use a universal hashing library like 'bcryptjs'.
// For this step, I will include the schema but comment out Bun-specific logic with a todo.

// userSchema.pre('save', async function (next) { ... });

export const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', userSchema);

export class Users {
  // Static implementations will be moved here if they are pure Mongoose.
  // Methods using Bun.password must be moved to the Application layer or adapted.

  static async createUser(userData: any): Promise<any> {
    // Hashing should be done before calling this
    const doc = await UserModel.create(userData);
    return { id: doc._id.toString(), username: doc.username, email: doc.email, tokens: doc.tokens };
  }

  static async getUserByUsername(username: string): Promise<any | null> {
    const doc = await UserModel.findOne({ username }).lean();
    if (!doc) return null;
    return { ...doc, id: (doc as any)._id.toString() };
  }

  // ... Implement other basic finders
  static async getUserByBaseUsername(baseUsername: string): Promise<any | null> {
    const escapedUsername = baseUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escapedUsername}#[a-zA-Z0-9]{3,4}$`, 'i');
    const doc = await UserModel.findOne({ username: regex }).lean();
    if (!doc) return null;
    return { ...doc, id: (doc as any)._id.toString() };
  }

  static async getUserByEmail(email: string): Promise<any | null> {
    const doc = await UserModel.findOne({ email }).lean();
    if (!doc) return null;
    return { ...doc, id: (doc as any)._id.toString() };
  }

  static async getUserByGithubId(githubId: string): Promise<any | null> {
    const doc = await UserModel.findOne({ github_id: githubId }).lean();
    if (!doc) return null;
    return { ...doc, id: (doc as any)._id.toString() };
  }

  static async updateUser(userId: string, updateData: any): Promise<boolean> {
    const res = await UserModel.updateOne({ _id: userId }, { $set: updateData });
    return res.modifiedCount > 0;
  }

  static async findUsersByUsername(
    username: string,
    excludeUserId: string | null = null
  ): Promise<any[]> {
    const filter: any = { username: { $regex: username, $options: 'i' } };
    if (excludeUserId) filter._id = { $ne: new mongoose.Types.ObjectId(excludeUserId) };
    const docs = await UserModel.find(filter, {
      username: 1,
      profile_pic: 1,
      profile_picture: 1,
      elo: 1,
    }).lean();
    return docs.map((d: any) => {
      let finalPic = d.profile_pic;
      if (finalPic && (finalPic.includes('/assets/') || finalPic.includes('placeholder'))) {
        finalPic = null;
      }
      return {
        id: d._id.toString(),
        username: d.username,
        profile_pic: finalPic,
        profile_picture: finalPic,
        elo: d.elo,
      };
    });
  }

  static async getUserById(userId: string): Promise<any | null> {
    const doc = await UserModel.findById(userId, {
      username: 1,
      tokens: 1,
      elo: 1,
      profile_pic: 1,
      profile_picture: 1,
      currency: 1,
      balances: 1,
      isAdmin: 1,
      created_at: 1,
      xp: 1,
      level: 1,
      status_message: 1,
      favorite_games: 1,
      bio: 1,
      social_links: 1,
      notification_preferences: 1,
    })
      .populate('favorite_games', 'name image_url')
      .lean();
    if (!doc) return null;
    const user: any = { id: (doc as any)._id.toString(), ...doc };
    if (!user.profile_picture && user.profile_pic) {
      user.profile_picture = user.profile_pic;
    }
    return user;
  }

  static async updateUserTokens(
    id: string,
    tokens: number,
    session: ClientSession | null = null
  ): Promise<number> {
    const options = session ? { session } : {};
    const res = await UserModel.updateOne({ _id: id }, { $set: { tokens } }, options);
    return res.modifiedCount;
  }

  static async updateUserBalance(
    userId: string,
    currency: string,
    amount: number,
    session: ClientSession | null = null
  ): Promise<number> {
    const updateField = `balances.${currency.toLowerCase()}`;
    const options = session ? { session } : {};
    const res = await UserModel.updateOne(
      { _id: userId },
      { $set: { [updateField]: amount } },
      options
    );
    return res.modifiedCount;
  }

  static async decrementBalance(
    userId: string,
    currency: string,
    amount: number,
    session: ClientSession | null = null
  ): Promise<number> {
    const updateField = `balances.${currency.toLowerCase()}`;
    const options = session ? { session } : {};
    const res = await UserModel.updateOne(
      { _id: userId },
      { $inc: { [updateField]: -amount } },
      options
    );
    return res.modifiedCount;
  }

  static async decrementBalanceIfSufficient(
    userId: string,
    currency: string,
    amount: number,
    session: ClientSession | null = null
  ): Promise<boolean> {
    const balanceField = `balances.${currency.toLowerCase()}`;
    const filter = {
      _id: userId,
      [balanceField]: { $gte: amount },
    };
    const update = { $inc: { [balanceField]: -amount } };
    const options = session ? { session } : {};

    const res = await UserModel.updateOne(filter, update, options);
    return res.modifiedCount > 0;
  }

  static async incrementBalance(
    userId: string,
    currency: string,
    amount: number,
    session: ClientSession | null = null
  ): Promise<number> {
    const updateField = `balances.${currency.toLowerCase()}`;
    const options = session ? { session } : {};
    const res = await UserModel.updateOne(
      { _id: userId },
      { $inc: { [updateField]: amount } },
      options
    );
    return res.modifiedCount;
  }

  static async updateUserProfilePic(id: string, profile_pic: string): Promise<number> {
    const res = await UserModel.updateOne({ _id: id }, { $set: { profile_pic } });
    return res.modifiedCount;
  }

  static async getUserElo(id: string): Promise<number | null> {
    const doc = await UserModel.findById(id, { elo: 1 }).lean();
    return doc ? doc.elo : null;
  }

  static async updateUserElo(userId: string, newElo: number): Promise<number> {
    const res = await UserModel.updateOne({ _id: userId }, { $set: { elo: newElo } });
    return res.modifiedCount;
  }

  static async incrementUserElo(id: string, increment: number): Promise<number> {
    const res = await UserModel.updateOne({ _id: id }, { $inc: { elo: increment } });
    return res.modifiedCount;
  }

  static async decrementUserElo(id: string, decrement: number): Promise<number> {
    const res = await UserModel.updateOne({ _id: id }, { $inc: { elo: -Number(decrement) } });
    return res.modifiedCount;
  }

  static async saveSocketId(userId: string, socketId: string): Promise<number> {
    const res = await UserModel.updateOne({ _id: userId }, { $set: { socket_id: socketId } });
    return res.modifiedCount;
  }

  static async getUserBySocketId(socketId: string): Promise<{ username: string } | null> {
    const doc = await UserModel.findOne({ socket_id: socketId }, { username: 1 }).lean();
    return doc ? { username: doc.username } : null;
  }

  static async removeSocketId(socketId: string): Promise<void> {
    await UserModel.updateOne({ socket_id: socketId }, { $unset: { socket_id: 1 } });
  }

  static async getUserByResetToken(token: string): Promise<any | null> {
    const doc = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    }).lean();
    if (!doc) return null;
    return { ...doc, id: (doc as any)._id.toString() };
  }

  static async addToWishlist(userId: string, gameId: string): Promise<any> {
    // Mock implementation for dependency loop break in simple migration phase
    // const { default: Games } = await import('../games/games.model');
    // const game = await Games.findGameByIdOrSlug(gameId);
    // if (!game) throw new Error('Game not found');

    return await UserModel.updateOne({ _id: userId }, { $addToSet: { wishlist: gameId } });
  }

  static async removeFromWishlist(userId: string, gameId: string): Promise<any> {
    return await UserModel.updateOne({ _id: userId }, { $pull: { wishlist: gameId } });
  }

  static async getWishlist(userId: string): Promise<any[]> {
    const doc = await UserModel.findById(userId).populate('wishlist').lean();
    return doc ? (doc.wishlist as any[]) : [];
  }
}
