const customTabbedCategoryService = require('../services/customTabbedCategoryService');

// Public: GET /api/products/shop/customtabbed
const getCustomTabbedCategories = async (req, res) => {
    try {
        const tiles = await customTabbedCategoryService.listCustomTabbedCategories(true);
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
