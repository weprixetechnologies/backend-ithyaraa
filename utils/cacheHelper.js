const { redis } = require('../config/redis');

// Default TTL in seconds (configurable via env var)
const DEFAULT_TTL = parseInt(process.env.CACHE_TTL, 10) || 60;

/**
 * NOTE:
 * - Keys passed to these helpers SHOULD NOT include the "cache:" prefix.
 *   The Redis client is configured with `keyPrefix = "cache:"`.
 * - These helpers are CommonJS to match the project's style.
 */

async function getCache(key) {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function setCache(key, value, ttl = DEFAULT_TTL) {
  const str = JSON.stringify(value);
  if (ttl && Number.isInteger(ttl) && ttl > 0) {
    await redis.set(key, str, 'EX', ttl);
  } else {
    await redis.set(key, str);
  }
}

async function deleteCache(key) {
  await redis.del(key);
}

/**
 * Remove keys matching a pattern.
 * - pattern should be provided WITHOUT the top-level "cache:" prefix and
 *   can include glob-style wildcards, e.g. 'products:*' or 'products:page:*'
 * - This uses SCAN (stream) under the hood to avoid blocking Redis.
 * - Returns number of keys deleted.
 */
async function clearByPattern(pattern) {
  const stream = redis.scanStream({ match: pattern, count: 100 });
  const pipeline = redis.pipeline();
  let keysSeen = 0;

  return new Promise((resolve, reject) => {
    stream.on('data', (keys = []) => {
      if (keys.length) {
        keysSeen += keys.length;
        keys.forEach((k) => pipeline.del(k));
      }
    });
    stream.on('end', async () => {
      if (keysSeen === 0) return resolve(0);
      try {
        await pipeline.exec();
        resolve(keysSeen);
      } catch (err) {
        reject(err);
      }
    });
    stream.on('error', reject);
  });
}

module.exports = {
  getCache,
  setCache,
  deleteCache,
  clearByPattern,
  DEFAULT_TTL,
};
