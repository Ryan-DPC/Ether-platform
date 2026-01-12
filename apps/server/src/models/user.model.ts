import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    profile_pic: {
      type: String,
      default: '',
    },
    socket_id: {
      type: String,
      default: null,
    },
    friends: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    balances: {
      chf: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    statics: {
      async saveSocketId(userId: string, socketId: string) {
        return this.findByIdAndUpdate(userId, { socket_id: socketId });
      },
      async removeSocketId(socketId: string) {
        return this.findOneAndUpdate({ socket_id: socketId }, { socket_id: null });
      },
      async getUserBySocketId(socketId: string) {
        return this.findOne({ socket_id: socketId });
      },
      async getFriends(userId: string) {
        const user = await this.findById(userId).populate(
          'friends',
          'username socket_id is_online'
        ); // Select fields
        return user ? user.friends : [];
      },
    },
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    // Use Bun.password instead of bcrypt
    this.password = await Bun.password.hash(this.password, {
      algorithm: 'bcrypt', // Use bcrypt for compatibility with existing hashes if needed, or 'argon2d' (default)
      cost: 10, // Cost factor for bcrypt
    });
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string) {
  // Bun.password.verify auto-detects algorithm (bcrypt or argon2)
  return Bun.password.verify(candidatePassword, this.password);
};
/**
 * Helper to decrement balance atomically
 */
userSchema.statics.decrementBalanceIfSufficient = async function (
  userId: string,
  currency: string,
  amount: number,
  session: any
) {
  const field = `balances.${currency.toLowerCase()}`;
  const result = await this.updateOne(
    { _id: userId, [field]: { $gte: amount } },
    { $inc: { [field]: -amount } },
    { session }
  );
  return result.modifiedCount > 0;
};

userSchema.statics.incrementBalance = async function (
  userId: string,
  currency: string,
  amount: number,
  session: any
) {
  const field = `balances.${currency.toLowerCase()}`;
  await this.updateOne({ _id: userId }, { $inc: { [field]: amount } }, { session });
};
// Prevent OverwriteModelError
const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
