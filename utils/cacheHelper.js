const { redis } = require('../config/redis');

// Default TTL in seconds (configurable via env var)
const DEFAULT_TTL = parseInt(process.env.CACHE_TTL, 10) || 180;

/**
 * NOTE:
 * - Keys passed to these helpers SHOULD NOT include the "cache:" prefix.
 *   The Redis client is configured with `keyPrefix = "cache:"`.
 * - These helpers are CommonJS to match the project's style.
 */

async function getCache(key) {
  const data = await redis.get(key);
  if (data) {
    console.log(`[Cache HIT] key: ${key}`);
    return JSON.parse(data);
  }
  console.log(`[Cache MISS] key: ${key}`);
  return null;
}

async function setCache(key, value, ttl = DEFAULT_TTL) {
  const str = JSON.stringify(value);
  console.log(`[Cache SET] key: ${key}, ttl: ${ttl}s`);
  if (ttl && Number.isInteger(ttl) && ttl > 0) {
    await redis.set(key, str, 'EX', ttl);
  } else {
    await redis.set(key, str);
  }
}

async function deleteCache(key) {
  console.log(`[Cache DEL] key: ${key}`);
  await redis.del(key);
}

/**
 * Remove keys matching a pattern.
 * - pattern should be provided WITH the 'cache:' prefix if that's how it's stored,
 *   OR the helper can ensure it. Given our new SCOPE, literal 'cache:' is assumed.
 */
async function clearByPattern(pattern) {
  const fullPattern = pattern.startsWith('cache:') ? pattern : `cache:${pattern}`;
  console.log(`[Cache CLEAR] pattern: ${fullPattern}`);

  const stream = redis.scanStream({ match: fullPattern, count: 100 });
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
      if (keysSeen === 0) {
        console.log(`[Cache CLEAR] No keys found for pattern: ${fullPattern}`);
        return resolve(0);
      }
      try {
        await pipeline.exec();
        console.log(`[Cache CLEAR] Deleted ${keysSeen} keys for pattern: ${fullPattern}`);
        resolve(keysSeen);
      } catch (err) {
        console.error(`[Cache CLEAR] Error:`, err);
        reject(err);
      }
    });
    stream.on('error', (err) => {
      console.error(`[Cache CLEAR] Stream Error:`, err);
      reject(err);
    });
  });
}

module.exports = {
  getCache,
  setCache,
  deleteCache,
  clearByPattern,
  DEFAULT_TTL,
};
