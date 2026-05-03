const categoryModel = require('../model/categoryModel');
const customTabbedCategoryModel = require('../model/customTabbedCategoryModel');

// Admin: create or update a custom-tabbed-category tile
const upsertCustomTabbedCategory = async ({ categoryID, imageUrl, sortOrder, isActive }) => {
    if (!categoryID || !imageUrl) {
        return {
            success: false,
            message: 'categoryID and imageUrl are required',
        };
    }

    const existingCategory = await categoryModel.getCategoryByID(categoryID);
    if (!existingCategory) {
        return {
            success: false,
            message: 'Category not found',
        };
    }

    await customTabbedCategoryModel.upsertCustomTabbedCategory({
        categoryID,
        imageUrl,
        sortOrder: sortOrder || 0,
        isActive: isActive !== undefined ? isActive : 1,
    });

    return {
        success: true,
        message: 'Custom tabbed category saved successfully',
    };
};

// Public/Admin: list custom-tabbed-category tiles
const listCustomTabbedCategories = async (onlyActive = true) => {
    const rows = await customTabbedCategoryModel.getAllCustomTabbedCategories(onlyActive);
    return rows.map((row) => ({
        id: row.id,
        categoryID: row.categoryID,
        imageUrl: row.imageUrl,
        categoryName: row.categoryName,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
    }));
};

// Admin: delete
const deleteCustomTabbedCategory = async (id) => {
    await customTabbedCategoryModel.deleteCustomTabbedCategory(id);
    return {
        success: true,
        message: 'Custom tabbed category removed successfully',
    };
};

module.exports = {
    upsertCustomTabbedCategory,
    listCustomTabbedCategories,
    deleteCustomTabbedCategory,
};
