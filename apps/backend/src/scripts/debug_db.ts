
import path from 'path';
import dotenv from 'dotenv';
import { connectDB } from '../config/db';
import { GameModel } from '@vext/database';
import mongoose from 'mongoose';

const main = async () => {
    const envPath = path.resolve(__dirname, '../../.env');
    console.log(`📂 Loading .env from: ${envPath}`);

    // Check if file exists
    const fs = await import('fs');
    if (fs.existsSync(envPath)) {
        console.log('✅ .env file exists.');
        const content = fs.readFileSync(envPath, 'utf-8');
        console.log('📄 .env content preview:', content.substring(0, 100).replace(/\n/g, ' '));
    } else {
        console.error('❌ .env file NOT FOUND at expected path.');
    }

    dotenv.config({ path: envPath });

    console.log('--- DB CONNECTION DEBUG ---');
    console.log('1. Loading Environment variables...');
    const uri = process.env.MONGODB_URI || 'fallback-localhost';
    console.log(`🔌 Local Script is connecting to: ${uri.substring(0, 15)}...`);

    await connectDB();

    // 2. Count games
    const count = await GameModel.countDocuments();
    console.log(`📊 Total Games in THIS database: ${count}`);

    // 3. List their names
    const games = await GameModel.find({}, 'game_name folder_name');
    console.log('📝 Games List:', games.map(g => `${g.game_name} (${g.folder_name})`));

    // 4. Check for Aether Strike specifically
    const found = await GameModel.findOne({ folder_name: 'aether_strike' });
    console.log(`🔍 Aether Strike in THIS DB? ${found ? 'YES ✅' : 'NO ❌'}`);

    process.exit(0);
};
main();
