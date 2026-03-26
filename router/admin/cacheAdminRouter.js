const express = require('express');
const cacheAdminRouter = express.Router();
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');
const { SCOPE } = require('../../utils/cacheScopes');
const { clearByPattern, deleteCache, getCache } = require('../../utils/cacheHelper');
const { redis } = require('../../config/redis');
const productServices = require('../../services/productServices');

/**
 * GET /api/admin/cache/scopes
 * Returns all available cache scopes/patterns
 */
cacheAdminRouter.get('/cache/scopes', authAdminMiddleware.verifyAccessToken, (req, res) => {
    try {
        const scopes = Object.entries(SCOPE).map(([key, value]) => {
            let displayPattern = typeof value === 'function' ? `${key.toLowerCase().replace('_', ':')}:*` : value;
            
            // Strip the 'cache:' prefix for the UI display only
            if (typeof displayPattern === 'string' && displayPattern.startsWith('cache:')) {
                displayPattern = displayPattern.replace('cache:', '');
            }

            return {
                id: key,
                pattern: displayPattern,
                isDynamic: typeof value === 'function'
            };
        });

        res.json({
            success: true,
            data: scopes
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch cache scopes', error: error.message });
    }
});

/**
 * GET /api/admin/cache/view
 * Returns the raw JSON data for a specific key
 * query: ?key=cache:home:data
 */
cacheAdminRouter.get('/cache/view', authAdminMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const { key } = req.query;
        if (!key) {
            return res.status(400).json({ success: false, message: 'Key is required' });
        }

        // The key helper already handles the "cache:" prefix if configured that way,
        // but if the user provides the full key from SCAN, we should handle it.
        const cleanKey = key.startsWith('cache:') ? key.replace('cache:', '') : key;
        const data = await getCache(cleanKey);

        res.json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch cache data', error: error.message });
    }
});

/**
 * GET /api/admin/cache/keys
 * Lists actual keys matching a pattern
 * query: ?pattern=products:*
 */
cacheAdminRouter.get('/cache/keys', authAdminMiddleware.verifyAccessToken, async (req, res) => {
    try {
        let { pattern } = req.query;
        if (!pattern) {
            return res.status(400).json({ success: false, message: 'Pattern is required' });
        }

        // If it's a scope ID, resolve it to a proper search pattern
        if (SCOPE[pattern]) {
            const val = SCOPE[pattern];
            if (typeof val === 'function') {
                // For dynamic functions (PRODUCTS_PAGE etc), build a prefix-safe pattern
                // e.g. 'products:page' -> 'cache:products:page:*'
                if (pattern === 'PRODUCTS_PAGE') pattern = 'cache:products:page:*';
                else if (pattern === 'SHOP_PRODUCTS_PAGE') pattern = 'cache:shop:products:*';
                else if (pattern === 'PRODUCT_DETAIL') pattern = 'cache:products:detail:*';
                else if (pattern === 'CATEGORY_DETAIL') pattern = 'cache:categories:detail:*';
                else if (pattern === 'OFFER_ACTIVE') pattern = 'cache:offers:active:*';
                else pattern = `cache:${pattern.toLowerCase().replace('_', ':')}*`;
            } else {
                // Static string
                pattern = `${val}*`;
            }
        }

        // Ensure we search with the literal 'cache:' prefix
        if (!pattern.startsWith('cache:')) {
            pattern = `cache:${pattern}`;
        }

        console.log(`[Admin Cache] Scanning for pattern: ${pattern}`);

        const keys = await new Promise((resolve, reject) => {
            const stream = redis.scanStream({ match: pattern, count: 100 });
            let allKeys = [];
            stream.on('data', (resultKeys) => {
                allKeys = allKeys.concat(resultKeys);
            });
            stream.on('end', () => resolve(allKeys));
            stream.on('error', (err) => reject(err));
        });

        // Strip 'cache:' prefix from results for UI display
        const displayKeys = keys.map(k => k.replace('cache:', ''));

        res.json({
            success: true,
            data: displayKeys
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to list keys', error: error.message });
    }
});

/**
 * POST /api/admin/cache/clear
 * Clears cache for a specific scope or all
 * body: { scope: 'PRODUCTS_ALL' | '*' | pattern }
 */
cacheAdminRouter.post('/cache/clear', authAdminMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const { scope } = req.body;
        if (!scope) {
            return res.status(400).json({ success: false, message: 'Scope is required' });
        }

        let pattern;
        if (scope === '*') {
            pattern = '*';
        } else if (SCOPE[scope]) {
            const val = SCOPE[scope];
            pattern = typeof val === 'function' ? `${scope.toLowerCase().split('_')[0]}:*` : `${val}*`;
        } else {
            pattern = scope; // direct pattern
        }

        const deletedCount = await clearByPattern(pattern);

        res.json({
            success: true,
            message: `Cleared ${deletedCount} keys for scope: ${scope}`,
            deletedCount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to clear cache', error: error.message });
    }
});

/**
 * POST /api/admin/cache/recache
 * Triggers recaching for specific data
 * body: { scope: 'SHOP_PRODUCTS' }
 */
cacheAdminRouter.post('/cache/recache', authAdminMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const { scope } = req.body;
        
        if (scope === 'SHOP_PRODUCTS') {
            // Recache first page of public shop
            await productServices.getShopProductsPublic({ page: 1, limit: 12 });
            return res.json({ success: true, message: 'Shop products (Page 1) recached successfully' });
        }

        res.status(400).json({ success: false, message: 'Recache not supported for this scope' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Recaching failed', error: error.message });
    }
});

module.exports = cacheAdminRouter;
