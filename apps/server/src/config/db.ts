import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI is not defined');
    return;
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    console.log('✅ MongoDB Connected (Elysia Server)');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
    console.warn('⚠️ Proceeding without MongoDB connection');
  }
}
