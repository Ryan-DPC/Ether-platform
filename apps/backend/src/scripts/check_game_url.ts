import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { connectDB } from '../config/db';
import { GameModel } from '@vext/database';

const main = async () => {
  await connectDB();
  const game = await GameModel.findOne({ folder_name: 'aether_strike' });
  if (game) {
    console.log(`Game: ${game.game_name}`);
    console.log(`GitHub URL: ${game.github_url || 'MISSING ❌'}`);
    console.log(`Zip URL: ${game.zipUrl || 'MISSING ❌'}`);
    console.log(`Download URL: ${game.downloadUrl || 'MISSING ❌'}`); // legacy field check
  } else {
    console.log('Game not found.');
  }
  process.exit(0);
};
main();
