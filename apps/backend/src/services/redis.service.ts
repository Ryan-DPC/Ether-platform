import { createClient } from 'redis';

class RedisService {
    private client;
    private isConnected = false;
    private readonly DEFAULT_TTL = 86400; // 24 hours in seconds

    constructor() {
        this.client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });

        this.client.on('error', (err) => console.error('Redis Client Error', err));
        this.client.on('connect', () => {
            this.isConnected = true;
            console.log('Redis Client Connected');
        });
    }

    async connect() {
        if (!this.isConnected) {
            await this.client.connect();
        }
    }

    async get(key: string) {
        if (!this.isConnected) await this.connect();
        return await this.client.get(key);
    }

    async set(key: string, value: string, options?: any) {
        if (!this.isConnected) await this.connect();
        return await this.client.set(key, value, options);
    }

    /**
     * Set a key with TTL (Time To Live)
     * @param key Redis key
     * @param value Value to store
     * @param ttlSeconds TTL in seconds (default: 24h)
     */
    async setWithTTL(key: string, value: string, ttlSeconds: number = this.DEFAULT_TTL) {
        if (!this.isConnected) await this.connect();
        return await this.client.set(key, value, { EX: ttlSeconds });
    }

    async del(key: string) {
        if (!this.isConnected) await this.connect();
        return await this.client.del(key);
    }

    async deletePattern(pattern: string) {
        if (!this.isConnected) await this.connect();
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
            await this.client.del(keys);
        }
    }

    /**
     * Flush daily cache (items and games)
     * Called by daily cleanup job
     */
    async flushDailyCache() {
        if (!this.isConnected) await this.connect();

        try {
            // Delete all items and games cache keys
            const patterns = ['items:*', 'games:*'];
            let totalDeleted = 0;

            for (const pattern of patterns) {
                const keys = await this.client.keys(pattern);
                if (keys.length > 0) {
                    await this.client.del(keys);
                    totalDeleted += keys.length;
                    console.log(`[Redis] Deleted ${keys.length} keys matching '${pattern}'`);
                }
            }

            // Log memory info
            const info = await this.client.info('memory');
            const usedMemory = info.match(/used_memory_human:(.+)/)?.[1]?.trim();

            console.log(`[Redis Cleanup] Total keys deleted: ${totalDeleted}`);
            console.log(`[Redis Cleanup] Memory used: ${usedMemory}`);

            return { deletedKeys: totalDeleted, memoryUsed: usedMemory };
        } catch (error) {
            console.error('[Redis Cleanup] Error during cache flush:', error);
            throw error;
        }
    }
}

export const redisService = new RedisService();
