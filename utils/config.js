// config.js
require('dotenv').config();

// Parse Redis URL and create connection config with TLS support
function getRedisConfig() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

    try {
        const url = new URL(redisUrl);

        // Check if it's a secure connection (rediss://)
        const isSecure = url.protocol === 'rediss:';

        const config = {
            host: url.hostname,
            port: parseInt(url.port) || (isSecure ? 6380 : 6379),
            password: url.password || undefined,
            username: url.username || undefined,
        };

        // Add TLS configuration for secure connections
        if (isSecure) {
            config.tls = {
                rejectUnauthorized: false, // Set to true in production with proper certificates
            };
        }

        return config;
    } catch (error) {
        console.error('Invalid REDIS_URL format, falling back to default:', error.message);
        return {
            host: '127.0.0.1',
            port: 6379,
        };
    }
}

module.exports = {
    ACCESS_TOKEN_SECRET: process.env.JWT_SECRET,
    REFRESH_TOKEN_SECRET: process.env.JWT_SECRET,
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    REFRESH_TOKEN_EXPIRY_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 7,
    REDIS_CONFIG: getRedisConfig()
};
