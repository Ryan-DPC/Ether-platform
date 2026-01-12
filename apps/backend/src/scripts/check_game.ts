import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { connectDB } from '../config/db';
import { GameModel } from '@vext/database';

const check = async () => {
  await connectDB();
  const game = await GameModel.findOne({ folder_name: 'aether_strike' });
  console.log(JSON.stringify(game, null, 2));
  process.exit(0);
};
check();
