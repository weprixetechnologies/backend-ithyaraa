const model = require('./../model/productModel');
const imageModel = require('./../model/imagesModel')
const imageService = require('./../services/imageService')
const service = require('./../services/productServices');
const { getCache, setCache, deleteCache, clearByPattern } = require('../utils/cacheHelper'); // FIX: clearByPattern was missing
const { SCOPE } = require('../utils/cacheScopes');

// ─────────────────────────────────────────────
// Cache helper — runs all invalidations in parallel
// so one slow/failing delete doesn't block others
// ─────────────────────────────────────────────
const invalidateProductCaches = async (productID = null) => {
    const tasks = [
        deleteCache(SCOPE.OFFERS_LIST),
        deleteCache(SCOPE.PRODUCTS_ALL),
        clearByPattern('products:page:*'),
        clearByPattern('shop:products:*'),
    ];
    if (productID) tasks.push(deleteCache(SCOPE.PRODUCT_DETAIL(productID)));
    await Promise.allSettled(tasks); // allSettled: one failure won't throw
};

// ─────────────────────────────────────────────
// Add Product
// ─────────────────────────────────────────────
const addProduct = async (req, res) => {
    try {
        const payload = req.body;

        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({ message: 'Invalid payload' });
        }

        const productID = await service.generateUniqueProductID();
        if (!productID) {
            return res.status(500).json({ message: 'Failed to generate product ID' });
        }

        const uploadProduct = await model.uploadProduct({ ...payload, productID });
        if (!uploadProduct.success) {
            return res.status(500).json({ message: 'Product upload failed', error: uploadProduct.error });
        }

        const attributes = payload.attributes;
        if (attributes && Array.isArray(attributes) && attributes.length > 0) {
            try {
                const attributesResult = await service.uploadAttributeService(attributes);
                if (!attributesResult.success) {
                    return res.status(500).json({
                        message: 'Attribute upload failed',
                        error: attributesResult.data || attributesResult.message
                    });
                }
            } catch (err) {
                return res.status(500).json({ message: 'Attribute upload failed due to an exception', error: err.message });
            }
        }

        const variations = payload.productVariations;
        if (variations) {
            try {
                const variationsResult = await service.uploadVariationMap({ variations, productID });
                if (!variationsResult.success) {
                    return res.status(500).json({ message: 'Variation upload failed', error: variationsResult.error });
                }
            } catch (err) {
                return res.status(500).json({ message: 'Variation upload service error', error: err.message });
            }
        }

        const crossSells = payload.crossSells;
        if (Array.isArray(crossSells) && crossSells.length > 0) {
            try {
                const crossSellResult = await service.handleCrossSells(productID, crossSells);
                if (!crossSellResult.success) {
                    console.error('Cross-sell upload failed:', crossSellResult.error);
                }
            } catch (err) {
                console.error('Error handling cross-sells:', err);
            }
        }

        try { await invalidateProductCaches(); } catch (e) { console.error(e); }

        return res.status(201).json({ success: true, message: 'Product uploaded successfully', productID });

    } catch (err) {
        console.error('Error in addProduct:', err);
        return res.status(500).json({ message: 'Internal server error', error: err.message || 'Unknown server error' });
    }
};

// ─────────────────────────────────────────────
// Add Custom Product
// ─────────────────────────────────────────────
const addCustomProduct = async (req, res) => {
    try {
        const payload = req.body;

        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({ message: 'Invalid payload' });
        }

        if (!payload.custom_inputs || !Array.isArray(payload.custom_inputs) || payload.custom_inputs.length === 0) {
            return res.status(400).json({
                message: 'Custom inputs are required for custom products',
                error: 'custom_inputs must be a non-empty array'
            });
        }

        for (let i = 0; i < payload.custom_inputs.length; i++) {
            const input = payload.custom_inputs[i];
            if (!input.label || !input.type || input.required === undefined) {
                return res.status(400).json({
                    message: `Invalid custom input at index ${i}`,
                    error: 'Each custom input must have label, type, and required properties',
                    details: {
                        input,
                        missing: { label: !input.label, type: !input.type, required: input.required === undefined }
                    }
                });
            }
        }

        payload.type = 'customproduct';

        const productID = await service.generateUniqueProductID();
        if (!productID) {
            return res.status(500).json({ message: 'Failed to generate product ID' });
        }

        const uploadProduct = await model.uploadProduct({ ...payload, productID });
        if (!uploadProduct.success) {
            return res.status(500).json({ message: 'Custom product upload failed', error: uploadProduct.error });
        }

        const attributes = payload.attributes;
        if (attributes && Array.isArray(attributes) && attributes.length > 0) {
            try {
                const attributesResult = await service.uploadAttributeService(attributes);
                if (!attributesResult.success) {
                    return res.status(500).json({
                        message: 'Attribute upload failed',
                        error: attributesResult.data || attributesResult.message
                    });
                }
            } catch (err) {
                return res.status(500).json({ message: 'Attribute upload failed due to an exception', error: err.message });
            }
        }

        const crossSells = payload.crossSells;
        if (Array.isArray(crossSells) && crossSells.length > 0) {
            try {
                const crossSellResult = await service.handleCrossSells(productID, crossSells);
                if (!crossSellResult.success) {
                    console.error('Cross-sell upload failed:', crossSellResult.error);
                }
            } catch (err) {
                console.error('Error handling cross-sells:', err);
            }
        }

        try { await invalidateProductCaches(); } catch (e) { console.error(e); }

        return res.status(201).json({
            success: true,
            message: 'Custom product uploaded successfully',
            productID,
            custom_inputs: payload.custom_inputs
        });

    } catch (err) {
        console.error('Error in addCustomProduct:', err);
        return res.status(500).json({ message: 'Internal server error', error: err.message || 'Unknown server error' });
    }
};

// ─────────────────────────────────────────────
// Edit Product
// ─────────────────────────────────────────────
const editProduct = async (req, res) => {
    try {
        const payload = req.body;
        const productID = payload.productID;

        if (!payload || typeof payload !== 'object' || !productID) {
            return res.status(400).json({ message: 'Invalid payload or missing productID' });
        }

        const updateProduct = await model.editProductModel({ ...payload, productID });
        if (!updateProduct.success) {
            return res.status(500).json({ message: 'Product update failed', error: updateProduct.error });
        }

        const attributes = payload.attributes;
        if (Array.isArray(attributes) && attributes.length > 0) {
            const attrResult = await service.editAttributeService(attributes, productID);
            if (!attrResult.success) {
                return res.status(500).json({ message: 'Attribute update failed', error: attrResult.error });
            }
        }

        const variations = payload.productVariations;
        if (Array.isArray(variations) && variations.length > 0) {
            const varResult = await service.editVariationMap({ variations, productID });
            if (!varResult.success) {
                return res.status(500).json({ message: 'Variation update failed', error: varResult.error });
            }
        }

        if (payload.hasOwnProperty('crossSells')) {
            try {
                const crossSellResult = await service.handleCrossSells(
                    productID,
                    Array.isArray(payload.crossSells) ? payload.crossSells : []
                );
                if (!crossSellResult.success) {
                    console.error('Cross-sell update failed:', crossSellResult.error);
                }
            } catch (err) {
                console.error('Error handling cross-sells:', err);
            }
        }

        try { await invalidateProductCaches(productID); } catch (e) { console.error('editProduct cache error', e); }

        return res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            productID,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Error in editProduct:', err);
        return res.status(500).json({ message: 'Internal server error', error: err.message || 'Unknown error' });
    }
};

// ─────────────────────────────────────────────
// Get Paginated Products
// ─────────────────────────────────────────────
const getPaginatedProducts = async (req, res) => {
    try {
        const { page, limit, ...filters } = req.query;
        const cacheKey = SCOPE.PRODUCTS_PAGE(page || 1, limit || 10, filters);

        const cached = await getCache(cacheKey);
        if (cached) {
            return res.status(200).json({ success: true, ...cached, cached: true });
        }

        const result = await service.fetchPaginatedProducts(req.query);

        try { await setCache(cacheKey, result); } catch (e) { console.error(e); }

        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error('Error getting products:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─────────────────────────────────────────────
// Get Product Page Count
// ─────────────────────────────────────────────
const getProductPageCount = async (req, res) => {
    try {
        const result = await service.getProductCount(req.query);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error('Error getting Page Count:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─────────────────────────────────────────────
// Get Product Details
// ─────────────────────────────────────────────
const getProductDetails = async (req, res) => {
    const { productID } = req.params;

    if (!productID) {
        return res.status(400).json({ message: 'Missing productID' });
    }

    try {
        const cacheKey = SCOPE.PRODUCT_DETAIL(productID);
        try {
            const cached = await getCache(cacheKey);
            if (cached) {
                return res.status(200).json({ success: true, product: cached, cached: true });
            }
        } catch (e) {
            console.error('getProductDetails cache get error', e);
        }

        const product = await service.getProductDetails(productID);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        try { await setCache(cacheKey, product); } catch (e) { console.error('getProductDetails cache set error', e); }

        return res.status(200).json({ success: true, product });
    } catch (error) {
        console.error('Error fetching product details:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// ─────────────────────────────────────────────
// Delete Product
// ─────────────────────────────────────────────
const deleteProduct = async (req, res) => {
    try {
        const { productID } = req.params;

        if (!productID) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        const result = await service.deleteProduct(productID);

        if (result.success) {
            try { await invalidateProductCaches(productID); } catch (e) { console.error('deleteProduct cache error', e); }
            return res.status(200).json({ success: true, message: result.message, affectedRows: result.affectedRows });
        } else {
            return res.status(500).json({ success: false, message: result.message, error: result.error });
        }
    } catch (error) {
        console.error('Error in deleteProduct:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// ─────────────────────────────────────────────
// Bulk Delete Products
// ─────────────────────────────────────────────
const bulkDeleteProducts = async (req, res) => {
    try {
        const { productIDs } = req.body || {};
        const result = await service.bulkDeleteProducts(productIDs);
        try { await invalidateProductCaches(); } catch (e) { console.error(e); }
        return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in bulkDeleteProducts:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// ─────────────────────────────────────────────
// Bulk Sale Update
// ─────────────────────────────────────────────
const bulkUpdateSale = async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await service.bulkUpdateSale(payload);
        try { await invalidateProductCaches(); } catch (e) { console.error(e); }
        return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in bulkUpdateSale:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// ─────────────────────────────────────────────
// Bulk Assign Section
// ─────────────────────────────────────────────
const bulkAssignSection = async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await service.bulkAssignSection(payload);
        try { await invalidateProductCaches(); } catch (e) { console.error(e); }
        return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in bulkAssignSection:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// ─────────────────────────────────────────────
// Bulk Remove Section
// ─────────────────────────────────────────────
const bulkRemoveSection = async (req, res) => {
    try {
        const payload = req.body || {};
        const result = await service.bulkRemoveSection(payload);
        try { await invalidateProductCaches(); } catch (e) { console.error(e); }
        return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in bulkRemoveSection:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

// ─────────────────────────────────────────────
// Public: Shop List
// ─────────────────────────────────────────────
const shopList = async (req, res) => {
    try {
        const { page, limit, ...filters } = req.query;
        const cacheKey = SCOPE.SHOP_PRODUCTS_PAGE(page || 1, limit || 10, filters);

        const cached = await getCache(cacheKey);
        if (cached) {
            return res.status(200).json({ ...cached, cached: true });
        }

        const result = await service.getShopProductsPublic(req.query);
        try { await setCache(cacheKey, result); } catch (e) { console.error(e); }

        return res.status(200).json(result);
    } catch (e) {
        console.error('shopList error:', e);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─────────────────────────────────────────────
// Public: Search Products
// ─────────────────────────────────────────────
const searchProducts = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string' || q.trim().length === 0) {
            return res.status(200).json({ success: true, data: [], total: 0, message: 'Please provide a search query' });
        }

        const result = await service.searchProducts(q);
        return res.status(200).json(result);
    } catch (e) {
        console.error('searchProducts error:', e);
        return res.status(500).json({ success: false, message: 'Server error', data: [], total: 0 });
    }
};

// ─────────────────────────────────────────────
// Single export block — FIX: previously split
// across two module.exports assignments
// ─────────────────────────────────────────────
module.exports = {
    addProduct,
    addCustomProduct,
    getPaginatedProducts,
    getProductPageCount,
    getProductDetails,
    editProduct,
    deleteProduct,
    bulkDeleteProducts,
    bulkUpdateSale,
    bulkAssignSection,
    bulkRemoveSection,
    shopList,
    searchProducts,
};