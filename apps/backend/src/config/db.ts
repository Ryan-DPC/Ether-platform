import mongoose from 'mongoose';

import dotenv from 'dotenv';
dotenv.config();

export async function connectDB() {
  // Fallback to local if env var not set, for easier dev
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in environment variables.');
    // For local dev, we might want to hardcode a fallback if env is missing
    // uri = 'mongodb+srv://...';
    return;
  }

  console.log(`🔌 Attempting to connect to MongoDB...`);

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    console.log('✅ MongoDB Connected (Elysia)');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
  }
}
