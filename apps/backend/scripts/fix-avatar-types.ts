import mongoose from 'mongoose';

async function fixAvatarTypes() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vext';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Get Items collection
        const Item = mongoose.model('Item', new mongoose.Schema({}, { strict: false }));

        // Find all items with 'avatars' in the image URL but wrong type
        const itemsToFix = await Item.find({
            image_url: { $regex: '/items/avatars/' },
            item_type: { $ne: 'profile_picture' }
        });

        console.log(`📊 Found ${itemsToFix.length} items to fix`);

        // Update them
        const result = await Item.updateMany(
            { image_url: { $regex: '/items/avatars/' } },
            { $set: { item_type: 'profile_picture' } }
        );

        console.log(`✅ Updated ${result.modifiedCount} items`);
        console.log('\n🎉 Migration completed successfully!');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

fixAvatarTypes();
