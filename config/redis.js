const Redis = require('ioredis');
const { REDIS_CONNECTION } = require('../utils/config');

// Keep a single Redis client for caching. This client uses a key prefix
// so all cache keys will be stored as `cache:<your-key>` in Redis.
const options = Object.assign({}, REDIS_CONNECTION || {});

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

// Optional helpers to explicitly manage lifecycle from the application
async function connectRedis() {
  // ioredis v4 exposes connect(); older versions may connect automatically.
  if (redis.status === 'ready') return;
  if (typeof redis.connect === 'function') {
    try {
      await redis.connect();
      console.log('Redis client connected (explicit)');
    } catch (err) {
      console.error('Redis explicit connect failed', err);
      throw err;
    }
  }
}

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
  connectRedis,
  disconnectRedis,
};

