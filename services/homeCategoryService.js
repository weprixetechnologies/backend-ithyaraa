const categoryModel = require('../model/categoryModel');
const homeCategoryModel = require('../model/homeCategoryModel');

// Admin: create or update a home-category tile for an existing category
const createHomeCategoryTile = async ({ categoryID, imageUrl, sortOrder }) => {
    if (!categoryID || !imageUrl) {
        return {
            success: false,
            message: 'categoryID and imageUrl are required',
        };
    }

    // Ensure category exists (do not create new categories here)
    const existingCategory = await categoryModel.getCategoryByID(categoryID);
    if (!existingCategory) {
        return {
            success: false,
            message: 'Category not found',
        };
    }

    await homeCategoryModel.upsertHomeCategory({
        categoryID,
        imageUrl,
        sortOrder: sortOrder != null ? sortOrder : null,
    });

    return {
        success: true,
        message: 'Home category tile saved successfully',
    };
};

// Public: list home-category tiles in the shape expected by frontend
const listHomeCategoryTiles = async () => {
    const rows = await homeCategoryModel.getAllHomeCategories();
    return rows.map((row) => ({
        categoryID: row.categoryID,
        imageUrl: row.imageUrl,
        categoryName: row.categoryName,
    }));
};

module.exports = {
    createHomeCategoryTile,
    listHomeCategoryTiles,
};

