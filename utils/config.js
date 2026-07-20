// config.js
require('dotenv').config();

// BullMQ Redis connection config
// NOTE: Do NOT add lazyConnect:true here — BullMQ manages its own ioredis
// instances and lazyConnect causes "Connection is closed" errors.
function getRedisConnection() {
    return {
        host: '127.0.0.1',
        port: 6379,
        maxRetriesPerRequest: null,
        connectTimeout: 5000,
        commandTimeout: 3000,
        enableReadyCheck: false,
    };
}

// Standalone cache client config (used by config/redis.js)
// Same as above — lazyConnect removed for consistency.
function getCacheRedisConnection() {
    return {
        host: '127.0.0.1',
        port: 6379,
        connectTimeout: 5000,
        commandTimeout: 3000,
        enableReadyCheck: false,
    };
}

module.exports = {
    ACCESS_TOKEN_SECRET: process.env.JWT_SECRET,
    REFRESH_TOKEN_SECRET: process.env.JWT_SECRET,
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    REFRESH_TOKEN_EXPIRY_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 7,
    REDIS_CONNECTION: getRedisConnection(),
    CACHE_REDIS_CONNECTION: getCacheRedisConnection()
};
