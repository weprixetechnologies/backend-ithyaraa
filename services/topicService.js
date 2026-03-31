const supportModel = require('../model/supportModel');
const { redis } = require('../config/redis');

const CACHE_TTL = 600; // 10 minutes

const getTopicTree = async (panel) => {
    const cacheKey = `support_topics:${panel}`;
    
    // Try cache first
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (err) {
        console.error('Redis cache error:', err);
    }

    const topics = await supportModel.getAllTopics(panel);
    const tree = buildTree(topics);

    // Set cache
    try {
        await redis.set(cacheKey, JSON.stringify(tree), 'EX', CACHE_TTL);
    } catch (err) {
        console.error('Redis set error:', err);
    }

    return tree;
};

const bustCache = async () => {
    try {
        await redis.del('support_topics:user');
        await redis.del('support_topics:brand');
        await redis.del('support_topics:both'); // If ever used
    } catch (err) {
        console.error('Redis bust cache error:', err);
    }
};

const buildTree = (items, parentId = null) => {
    return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
            ...item,
            children: buildTree(items, item.id)
        }));
};

module.exports = {
    getTopicTree,
    bustCache
};
