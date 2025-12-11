const categoryModel = require('../model/categoryModel');

const uploadCategory = async (categoryData) => {
    if (!categoryData.categoryName) {
        return { success: false, message: 'Category name is required' };
    }

    try {
        const insertedId = await categoryModel.insertCategory(categoryData);
        return {
            success: true,
            message: 'Category uploaded successfully',
            categoryID: insertedId
        };
    } catch (error) {
        console.error('Error in uploadCategory service:', error);
        return {
            success: false,
            message: 'Database error',
            error: error.message
        };
    }
};
const fetchCategoryByID = async (categoryID) => {
    const category = await categoryModel.getCategoryByID(categoryID);

    if (!category) {
        return { success: false, message: 'Category not found' };
    }

    return { success: true, data: category };
};


const getAllCategories = async ({ query }) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;

    const filters = {
        categoryName: query.categoryName || null
    };

    try {
        const { data, total } = await categoryModel.getFilteredCategories({ filters, page, limit });

        return {
            success: true,
            currentPage: page,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            data
        };
    } catch (error) {
        console.error('Error in getAllCategories service:', error);
        return {
            success: false,
            message: 'Failed to fetch categories',
            error: error.message
        };
    }
};

const updateCategory = async (payload) => {
    const {
        categoryID,
        categoryName,
        slug,
        featuredImage,
        categoryBanner
    } = payload;

    if (!categoryID || !categoryName || !slug || !featuredImage) {
        return { success: false, message: 'Required fields missing' };
    }

    const updated = await categoryModel.updateCategoryByID({
        categoryID,
        categoryName,
        slug,
        featuredImage,
        categoryBanner
    });

    if (!updated) {
        return { success: false, message: 'Category not found or update failed' };
    }

    return { success: true, message: 'Category updated successfully' };
};

const deleteCategory = async (categoryID) => {
    if (!categoryID) {
        return { success: false, message: 'Category ID is required' };
    }

    try {
        // Check if category exists
        const category = await categoryModel.getCategoryByID(categoryID);
        if (!category) {
            return { success: false, message: 'Category not found' };
        }

        // Remove category from all products first
        const updatedProductsCount = await categoryModel.removeCategoryFromProducts(categoryID);

        // Delete the category
        const deleted = await categoryModel.deleteCategoryByID(categoryID);

        if (!deleted) {
            return { success: false, message: 'Failed to delete category' };
        }

        return {
            success: true,
            message: 'Category deleted successfully',
            updatedProductsCount
        };
    } catch (error) {
        console.error('Error in deleteCategory service:', error);
        return {
            success: false,
            message: 'Failed to delete category',
            error: error.message
        };
    }
};

module.exports = {
    uploadCategory,
    getAllCategories,
    fetchCategoryByID,
    updateCategory,
    deleteCategory
};
