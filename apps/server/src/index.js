require('dotenv').config();
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const connectDB = require('./config/db');
const { redisClient, connectRedis } = require('./config/redis');
const socketHandlers = require('./socket.handlers');
const authMiddleware = require('./middleware/auth.middleware');
const rateLimitMiddleware = require('./middleware/rateLimit.middleware');
const UsersService = require('./services/users.service');

// Security Check
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET is not defined in production environment.');
    process.exit(1);
}

const PORT = process.env.WS_PORT || 3002;

// Connect to Database
connectDB();

const io = new Server(PORT, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://ether-platform.onrender.com",
            "https://vext-frontend.onrender.com",
            "https://backend-ether.onrender.com",
            /\.onrender\.com$/
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

console.log(`WebSocket server running on port ${PORT}`);

// Authentication middleware
io.use(authMiddleware);

// Redis Client Initialization
(async () => {
    try {
        await connectRedis();
        console.log('✅ Redis client connected');

        // Redis Adapter Initialization
        if (!process.env.DISABLE_REDIS_ADAPTER) {
            // Create subClient for adapter
            const subClient = redisClient.duplicate();
            await subClient.connect();
            io.adapter(createAdapter(redisClient, subClient));
            console.log('✅ Redis adapter initialized');
        } else {
            console.log('⚠️ Redis adapter disabled via env var');
        }
    } catch (err) {
        console.warn('⚠️ Redis connection failed:', err.message);
    }
})();

// Initialize Version Checker Job
const VersionCheckerJob = require('./jobs/version-checker.job');
const versionChecker = new VersionCheckerJob(io);
versionChecker.start();
console.log('🔄 Version checker job initialized');

io.on('connection', async (socket) => {
    console.log(`\n🔌 [${new Date().toISOString()}] Client connected: ${socket.id} (${socket.username})`);
    console.log(`📊 Total clients: ${io.engine.clientsCount}`);

    // Initialize handlers immediately to avoid race conditions
    socketHandlers(io, socket);

    // Distributed Rate Limiting
    socket.use((packet, next) => rateLimitMiddleware(socket, next));

    if (socket.userId) {
        socket.join(`user:${socket.userId}`);

        // Save socket ID to DB
        UsersService.saveSocketId(socket.userId, socket.id)
            .then(() => console.log(`✅ Socket ID saved for user ${socket.username}`))
            .catch(err => console.error(`❌ Failed to save socket ID for user ${socket.username}:`, err));

        // Real Friends Logic for Status Updates (Connection)
        try {
            const friends = await UsersService.getFriends(socket.userId);
            friends.forEach(friend => {
                io.to(`user:${friend.id}`).emit("friend:status-changed", {
                    userId: socket.userId,
                    status: "online"
                });
            });
        } catch (err) {
            console.error('❌ Failed to notify friends of connection:', err);
        }

        socket.on('disconnect', async () => {
            // Remove socket ID from DB
            UsersService.removeSocketId(socket.id)
                .then(() => console.log(`✅ Socket ID removed for user ${socket.username}`))
                .catch(err => console.error(`❌ Failed to remove socket ID for user ${socket.username}:`, err));

            try {
                const friends = await UsersService.getFriends(socket.userId);
                friends.forEach(friend => {
                    io.to(`user:${friend.id}`).emit("friend:status-changed", {
                        userId: socket.userId,
                        status: "offline"
                    });
                });
            } catch (err) {
                console.error('❌ Failed to notify friends of disconnection:', err);
            }

            console.log(`\n❌ [${new Date().toISOString()}] Client disconnected: ${socket.id}`);
            console.log(`📊 Total clients: ${io.engine.clientsCount}`);
        });
    }

    socket.onAny((eventName, ...args) => {
        console.log(`📡 Event received: ${eventName}`, args.length > 0 ? args[0] : '');
    });
});
