import { createClient } from 'redis';

const url = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = createClient({
    url,
    socket: {
        // Enable TLS if the URL scheme is rediss:// (common for cloud Redis like Render)
        tls: url.startsWith('rediss://') ? true : undefined,
        // Accept self-signed certificates which are common in managed services
        rejectUnauthorized: false
    }
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));

const connectRedis = async (): Promise<void> => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
};

export { redisClient, connectRedis };
