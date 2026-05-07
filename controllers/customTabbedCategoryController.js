const customTabbedCategoryService = require('../services/customTabbedCategoryService');
const { getCache, setCache, deleteCache } = require('../utils/cacheHelper');
const { SCOPE } = require('../utils/cacheScopes');

// Public: GET /api/products/shop/customtabbed
const getCustomTabbedCategories = async (req, res) => {
    try {
        const cacheKey = SCOPE.CUSTOM_TABBED_CATEGORIES;
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.status(200).json(cached);
        }

        const tiles = await customTabbedCategoryService.listCustomTabbedCategories(true);
        
        try { await setCache(cacheKey, tiles); } catch (e) { console.error(e); }

        return res.status(200).json(tiles);
    } catch (error) {
        console.error('getCustomTabbedCategories error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch custom tabbed categories',
        });
    }
};

// Admin: GET /api/admin/custom-tabbed-categories
const adminListCustomTabbedCategories = async (req, res) => {
    try {
        const tiles = await customTabbedCategoryService.listCustomTabbedCategories(false);
        return res.status(200).json(tiles);
    } catch (error) {
        console.error('adminListCustomTabbedCategories error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch custom tabbed categories',
        });
    }
};

// Admin: POST /api/admin/custom-tabbed-categories
const upsertCustomTabbedCategory = async (req, res) => {
    try {
        const { categoryID, imageUrl, sortOrder, isActive } = req.body || {};
        const result = await customTabbedCategoryService.upsertCustomTabbedCategory({
            categoryID,
            imageUrl,
            sortOrder,
            isActive,
        });

        if (result.success) {
            try { await deleteCache(SCOPE.CUSTOM_TABBED_CATEGORIES); } catch (e) { console.error(e); }
        }

        return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('upsertCustomTabbedCategory error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save custom tabbed category',
        });
    }
};

// Admin: DELETE /api/admin/custom-tabbed-categories/:id
const deleteCustomTabbedCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await customTabbedCategoryService.deleteCustomTabbedCategory(id);
        
        if (result.success) {
            try { await deleteCache(SCOPE.CUSTOM_TABBED_CATEGORIES); } catch (e) { console.error(e); }
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('deleteCustomTabbedCategory error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete custom tabbed category',
        });
    }
};

module.exports = {
    getCustomTabbedCategories,
    adminListCustomTabbedCategories,
    upsertCustomTabbedCategory,
    deleteCustomTabbedCategory,
};
