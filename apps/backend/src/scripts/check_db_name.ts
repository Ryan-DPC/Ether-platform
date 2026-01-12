
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { connectDB } from '../config/db';
import mongoose from 'mongoose';
import { GameModel } from '@vext/database';

const main = async () => {
    console.log('--- DB CONNECTION DEBUG ---');
    console.log('1. Loading Environment variables...');
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error('❌ MONGODB_URI is MISSING from local .env');
        process.exit(1);
    }

    // Parse URI to hide password but show DB name
    // Format: mongodb+srv://user:pass@host/DBNAME?opts
    const match = uri.match(/mongodb(?:\+srv)?:\/\/[^@]+@[^\/]+\/([^?]+)/);
    const dbNameInURI = match ? match[1] : 'Unknown';

    console.log(`2. URI Configured in .env targets DB Name: "${dbNameInURI}"`);

    await connectDB();

    console.log(`3. Mongoose Connected to DB Name: "${mongoose.connection.name}"`);

    console.log('--- DATA CHECK ---');
    const etherChess = await GameModel.findOne({ folder_name: 'EtherChess' });
    console.log(`Does "EtherChess" exist here? ${etherChess ? 'YES ✅' : 'NO ❌'}`);

    const aether = await GameModel.findOne({ folder_name: 'aether_strike' });
    console.log(`Does "Aether Strike" exist here? ${aether ? 'YES ✅' : 'NO ❌'}`);

    console.log('-----------------------');
    process.exit(0);
};
main();
