import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { connectDB } from '../config/db';
import mongoose from 'mongoose';

const main = async () => {
  console.log('🔍 Checking Database Connection Host...');

  await connectDB();

  console.log(`\n🏠 Connected Host: ${mongoose.connection.host}`);
  console.log(`🗄️  Connected DB:   ${mongoose.connection.name}`);
  console.log(`👤 Connected User:  ${mongoose.connection.user || '(hidden)'}`);

  const uri = process.env.MONGODB_URI || '';
  const isSrv = uri.includes('+srv');
  console.log(`🔗 Connection Type: ${isSrv ? 'SRV Cluster' : 'Direct Connection'}`);

  console.log('\nPlease compare this Host with your Render URI!');
  process.exit(0);
};
main();
