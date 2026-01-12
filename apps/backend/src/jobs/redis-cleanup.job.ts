import cron from 'node-cron';
import { redisService } from '../services/redis.service';

/**
 * Daily Redis Cache Cleanup Job
 * Runs every day at 3:00 AM to flush items and games cache
 * Keeps memory usage under 256MB
 */
cron.schedule('0 3 * * *', async () => {
    console.log('[Redis Cleanup Job] Starting daily cache cleanup...');

    try {
        const result = await redisService.flushDailyCache();
        console.log(`[Redis Cleanup Job] ✅ Success - Deleted ${result.deletedKeys} keys`);
        console.log(`[Redis Cleanup Job] 📊 Memory usage: ${result.memoryUsed}`);
    } catch (error) {
        console.error('[Redis Cleanup Job] ❌ Failed:', error);
    }
}, {
    timezone: 'Europe/Paris'
});

console.log('✅ Daily Redis cleanup job scheduled (3:00 AM every day)');
