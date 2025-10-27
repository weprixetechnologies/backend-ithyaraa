// config.js
require('dotenv').config();

// Local Redis configuration
function getRedisConnection() {
    // Always use local Redis connection
    return {
        host: '127.0.0.1',
        port: 6379,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: null,
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 3000,
    };
}

module.exports = {
    ACCESS_TOKEN_SECRET: process.env.JWT_SECRET,
    REFRESH_TOKEN_SECRET: process.env.JWT_SECRET,
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    REFRESH_TOKEN_EXPIRY_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 7,
    REDIS_CONNECTION: getRedisConnection()
};
