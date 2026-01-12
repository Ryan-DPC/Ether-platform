
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { connectDB } from '../config/db';
import mongoose from 'mongoose';
import { GameModel } from '@vext/database';

const main = async () => {
    await connectDB();

    console.log('--- COLLECTION AUDIT ---');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📂 Collections found:', collections.map(c => c.name));

    // Check count in 'games' specifically
    const gamesCount = await mongoose.connection.db.collection('games').countDocuments();
    console.log(`🔢 Count in 'games': ${gamesCount}`);

    // Fetch IDs for comparison
    const games = await GameModel.find({}, '_id game_name folders_name');
    console.log('🆔 IDs in this DB:');
    games.forEach(g => console.log(` - ${g.game_name}: ${g._id}`));

    process.exit(0);
};
main();
