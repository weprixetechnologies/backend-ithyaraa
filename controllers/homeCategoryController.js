const homeCategoryService = require('../services/homeCategoryService');

// Public: GET /api/home-categories
const getHomeCategories = async (req, res) => {
    try {
        const tiles = await homeCategoryService.listHomeCategoryTiles();
        return res.status(200).json(tiles);
    } catch (error) {
        console.error('getHomeCategories error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch home categories',
        });
    }
};

// Admin: POST /api/admin/home-categories
const createHomeCategory = async (req, res) => {
    try {
        const { categoryID, imageUrl, sortOrder } = req.body || {};
        const result = await homeCategoryService.createHomeCategoryTile({
            categoryID,
            imageUrl,
            sortOrder,
        });

        return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('createHomeCategory error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create home category tile',
        });
    }
};

module.exports = {
    getHomeCategories,
    createHomeCategory,
};

