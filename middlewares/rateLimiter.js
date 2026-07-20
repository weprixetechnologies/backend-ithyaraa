const { redis } = require('../config/redis');

/**
 * Custom Redis-based rate limiting middleware.
 * @param {number} limit - Maximum requests allowed in the time window.
 * @param {number} windowSeconds - The time window in seconds.
 */
const rateLimiter = (limit, windowSeconds) => {
    return async (req, res, next) => {
        try {
            const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const key = `ratelimit:${req.originalUrl}:${ip}`;
            
            const current = await redis.get(key);
            if (current && parseInt(current, 10) >= limit) {
                return res.status(429).json({
                    success: false,
                    message: `Too many requests. Please try again after ${windowSeconds} seconds.`
                });
            }

            const newValue = await redis.incr(key);
            if (newValue === 1) {
                await redis.expire(key, windowSeconds);
            }
            next();
        } catch (err) {
            console.error('Rate limiter error:', err);
            // Fail open so Redis issues do not block the application
            next();
        }
    };
};

module.exports = rateLimiter;
