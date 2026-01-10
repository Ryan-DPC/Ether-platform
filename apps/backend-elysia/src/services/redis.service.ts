import { createClient } from 'redis';

class RedisService {
    private client;
    private isConnected = false;

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
}

export const redisService = new RedisService();
