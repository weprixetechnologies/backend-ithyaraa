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

module.exports = {
    uploadCategory,
    getAllCategories,
    fetchCategoryByID,
    updateCategory
};
