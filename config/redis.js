const Redis = require('ioredis');
const { CACHE_REDIS_CONNECTION } = require('../utils/config');

// Keep a single Redis client for caching. This client uses a key prefix
// so all cache keys will be stored as `cache:<your-key>` in Redis.
const options = Object.assign({}, CACHE_REDIS_CONNECTION || {});

const redis = new Redis(options);

// Minimal, non-noisy logging
redis.on('connect', () => {
  console.log('Redis client connected');
});
redis.on('ready', () => {
  // ready is emitted after a successful connection/handshake
});
redis.on('reconnecting', () => {
  console.warn('Redis reconnecting...');
});
redis.on('close', () => {
  console.warn('Redis connection closed');
});
redis.on('end', () => {
  console.warn('Redis connection ended');
});

redis.on('error', (err) => {
  console.error('Redis client error', err);
});

// Disconnect helper to explicitly shut down the cache client on app exit
async function disconnectRedis() {
  try {
    if (typeof redis.quit === 'function') {
      await redis.quit();
    } else {
      redis.disconnect();
    }
  } catch (err) {
    // fallback to disconnect if quit fails
    try { redis.disconnect(); } catch (e) { /* ignore */ }
  }
}

module.exports = {
  redis,
  disconnectRedis,
};

