const categoryService = require('../services/categoryService');
const { getCache, setCache, deleteCache } = require('../utils/cacheHelper');
const { SCOPE } = require('../utils/cacheScopes');

const postCategory = async (req, res) => {
    const data = req.body;

    const result = await categoryService.uploadCategory(data);

    if (result.success) {
        try { await deleteCache(SCOPE.CATEGORIES_ALL); } catch (e) { console.error(e); }
        res.status(201).json(result);
    } else {
        res.status(400).json(result);
    }
};
const getCategories = async (req, res) => {
    try {
        // Only cache the default "all" call (no filters)
        const isDefaultAll = !req.query || Object.keys(req.query).length === 0;
        if (isDefaultAll) {
            const cached = await getCache(SCOPE.CATEGORIES_ALL);
            if (cached) {
                return res.status(200).json({ success: true, data: cached, cached: true });
            }
        }

        const result = await categoryService.getAllCategories({ query: req.query });

        if (result.success) {
            if (isDefaultAll) {
                try { await setCache(SCOPE.CATEGORIES_ALL, result.data); } catch (e) { console.error(e); }
            }
            res.status(200).json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('getCategories error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getCategoryByID = async (req, res) => {
    const { categoryID } = req.params;

    if (!categoryID) {
        return res.status(400).json({ success: false, message: 'Category ID is required' });
    }

    try {
        const cacheKey = SCOPE.CATEGORY_DETAIL(categoryID);
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.status(200).json({ success: true, data: cached, cached: true });
        }

        const result = await categoryService.fetchCategoryByID(categoryID);

        if (!result.success) {
            return res.status(404).json(result);
        }

        try { await setCache(cacheKey, result.data); } catch (e) { console.error(e); }

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

        try {
            await deleteCache(SCOPE.CATEGORIES_ALL);
            await deleteCache(SCOPE.CATEGORY_DETAIL(categoryID));
        } catch (e) { console.error(e); }

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

        try {
            await deleteCache(SCOPE.CATEGORIES_ALL);
            await deleteCache(SCOPE.CATEGORY_DETAIL(categoryID));
        } catch (e) { console.error(e); }

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
