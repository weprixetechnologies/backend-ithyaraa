const model = require('../model/homepageTagSectionsModel');
const { getCache, setCache, deleteCache, clearByPattern } = require('../utils/cacheHelper');

const CACHE_TTL_SECTION_PRODUCTS = 3600; // 1 hour TTL
const getCacheKeyForTag = (tag) => `cache:section_products:${String(tag).trim().toLowerCase()}`;

/**
 * Re-prime (invalidate and immediately re-cache) section products
 */
const reprimeTagCache = async (tag) => {
    const cleanTag = String(tag).trim().toLowerCase();
    const cacheKey = getCacheKeyForTag(cleanTag);
    try {
        console.log(`[INSTANT CACHE INVALIDATION] Clearing key: ${cacheKey}`);
        await deleteCache(cacheKey);
        await clearByPattern(`products:page:*`); // Also clear product list caches

        // Fetch fresh products from DB
        const freshData = await model.getProductsByTag(cleanTag, { page: 1, limit: 50 });

        if (freshData && freshData.success) {
            console.log(`[INSTANT RE-CACHE] Setting fresh data into Redis for tag '${cleanTag}' (${freshData.data.length} products)`);
            await setCache(cacheKey, freshData, CACHE_TTL_SECTION_PRODUCTS);
        }
        return freshData;
    } catch (err) {
        console.error(`Error in reprimeTagCache for tag '${cleanTag}':`, err);
    }
};

/**
 * Get products for a section tag with Redis caching
 */
const getSectionProductsCached = async (tag, options = {}) => {
    const cleanTag = String(tag).trim().toLowerCase();
    const cacheKey = getCacheKeyForTag(cleanTag);

    // Only read from cache for default page 1 queries
    if ((!options.page || options.page === 1) && (!options.limit || options.limit === 50)) {
        const cached = await getCache(cacheKey);
        if (cached) {
            console.log(`[CACHE HIT] Section tag products for '${cleanTag}'`);
            return cached;
        }
    }

    console.log(`[CACHE MISS] Fetching section tag products for '${cleanTag}' from DB`);
    const freshData = await model.getProductsByTag(cleanTag, options);

    if (freshData && freshData.success && (!options.page || options.page === 1)) {
        await setCache(cacheKey, freshData, CACHE_TTL_SECTION_PRODUCTS);
    }

    return freshData;
};

/**
 * Create section tag and invalidate list cache
 */
const createSectionTag = async (data) => {
    const result = await model.createTagSection(data);
    if (result.success && result.tag) {
        await reprimeTagCache(result.tag);
    }
    return result;
};

/**
 * Update section tag and reprime cache
 */
const updateSectionTag = async (id, data) => {
    const section = await model.getTagSectionByTag(id);
    const result = await model.updateTagSection(id, data);

    if (result.success) {
        if (section && section.tag) await reprimeTagCache(section.tag);
        if (data.tag && data.tag !== section?.tag) await reprimeTagCache(data.tag);
    }
    return result;
};

/**
 * Delete section tag and invalidate cache
 */
const deleteSectionTag = async (id) => {
    const section = await model.getTagSectionByTag(id);
    const result = await model.deleteTagSection(id);

    if (result.success && section && section.tag) {
        await deleteCache(getCacheKeyForTag(section.tag));
    }
    return result;
};

/**
 * Bulk add tag to products and instantly re-cache
 */
const bulkAddTag = async (tag, productIDs) => {
    const result = await model.bulkAddTagToProducts(tag, productIDs);
    if (result.success && result.tag) {
        console.log(`[BULK TAG] Successfully tagged ${result.updatedCount} products with '${result.tag}'. Triggering reprime...`);
        await reprimeTagCache(result.tag);
    }
    return result;
};

/**
 * Bulk remove tag from products and instantly re-cache
 */
const bulkRemoveTag = async (tag, productIDs) => {
    const result = await model.bulkRemoveTagFromProducts(tag, productIDs);
    if (result.success && result.tag) {
        console.log(`[BULK UNTAG] Successfully removed tag '${result.tag}' from ${result.updatedCount} products. Triggering reprime...`);
        await reprimeTagCache(result.tag);
    }
    return result;
};

module.exports = {
    getSectionProductsCached,
    createSectionTag,
    updateSectionTag,
    deleteSectionTag,
    bulkAddTag,
    bulkRemoveTag,
    reprimeTagCache,
    getAllTagSections: model.getAllTagSections,
    getTagSectionByTag: model.getTagSectionByTag
};
