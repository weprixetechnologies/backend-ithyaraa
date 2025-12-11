const categoryService = require('../services/categoryService');

const postCategory = async (req, res) => {
    const data = req.body;

    const result = await categoryService.uploadCategory(data);

    if (result.success) {
        res.status(201).json(result);
    } else {
        res.status(400).json(result);
    }
};
const getCategories = async (req, res) => {
    const result = await categoryService.getAllCategories({ query: req.query });

    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(500).json(result);
    }
};

const getCategoryByID = async (req, res) => {
    const { categoryID } = req.params;
    console.log(categoryID);

    if (!categoryID) {
        return res.status(400).json({ success: false, message: 'Category ID is required' });
    }

    try {
        const result = await categoryService.fetchCategoryByID(categoryID);

        if (!result.success) {
            return res.status(404).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('getCategoryByID error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const editCategory = async (req, res) => {
    const { categoryID } = req.params;
    const { categoryName, slug, featuredImage, categoryBanner } = req.body;

    if (!categoryID || !categoryName || !slug || !featuredImage) {
        return res.status(400).json({ success: false, message: 'Required fields missing' });
    }

    try {
        const result = await categoryService.updateCategory({
            categoryID,
            categoryName,
            slug,
            featuredImage,
            categoryBanner
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('editCategory error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteCategory = async (req, res) => {
    const { categoryID } = req.params;

    if (!categoryID) {
        return res.status(400).json({ success: false, message: 'Category ID is required' });
    }

    try {
        const result = await categoryService.deleteCategory(categoryID);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('deleteCategory error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    postCategory,
    getCategories,
    getCategoryByID,
    editCategory,
    deleteCategory
};
