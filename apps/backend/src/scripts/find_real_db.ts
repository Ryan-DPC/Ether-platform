
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { connectDB } from '../config/db';
import mongoose from 'mongoose';

const main = async () => {
    await connectDB();

    // Use the admin interface to list databases
    try {
        const admin = mongoose.connection.db.admin();
        const result = await admin.listDatabases();

        console.log('--- CLUSTER DATABASES ---');
        console.log(result.databases.map((d: any) => `- ${d.name} (Size: ${d.sizeOnDisk})`).join('\n'));

        console.log('\n--- SEARCHING FOR ETHERCHESS ---');
        // Loop through accessible DBs and check for the game
        for (const dbInfo of result.databases) {
            const dbName = dbInfo.name;
            if (['admin', 'local', 'config'].includes(dbName)) continue;

            console.log(`Checking DB: ${dbName}...`);
            const db = mongoose.connection.useDb(dbName);
            const count = await db.collection('games').countDocuments({ folder_name: 'EtherChess' });

            if (count > 0) {
                console.log(`🎉 FOUND ETHERCHESS IN DB: "${dbName}"`);
            } else {
                console.log(`  - Not in ${dbName}`);
            }
        }

    } catch (e: any) {
        console.error('Error listing databases (might be permissions):', e.message);
    }

    process.exit(0);
};
main();
