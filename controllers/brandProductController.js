const model = require('./../model/productModel');
const imageModel = require('./../model/imagesModel')
const imageService = require('./../services/imageService')
const service = require('./../services/productServices');
const db = require('../utils/dbconnect');

// Add brand product
const addBrandProduct = async (req, res) => {
    try {
        const payload = req.body;
        const brandID = req.user.uid; // Get brandID from JWT token
        const brandName = req.user.username || 'BRANDNAME'; // Get brand name from JWT token


        console.log('Brand Product Payload:', payload);
        console.log('Brand ID:', brandID);
        console.log('Brand Name:', brandName);

        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({ message: 'Invalid payload' });
        }

        // Force type to 'variable' for brand products
        payload.type = 'variable';
        payload.brand = brandName;
        payload.brandID = brandID;

        // 1. Generate Unique Product ID
        const productID = await service.generateUniqueProductID();
        if (!productID) {
            return res.status(500).json({ message: 'Failed to generate product ID' });
        }

        // 2. Upload Product Core Data
        const uploadProduct = await model.uploadProduct({ ...payload, productID, brandID, brandName });
        if (!uploadProduct.success) {
            return res.status(500).json({
                message: 'Product upload failed',
                error: uploadProduct.error
            });
        }

        // 3. Upload Attributes (optional)
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
                console.error("Error during attribute upload:", err);
                return res.status(500).json({
                    message: 'Attribute upload failed due to an exception',
                    error: err.message
                });
            }
        }

        // 4. Upload Variations (required for variable products)
        const variations = payload.productVariations;
        if (variations && Array.isArray(variations) && variations.length > 0) {
            try {
                const variationsResult = await service.uploadVariationMap({ variations, productID });
                if (!variationsResult.success) {
                    return res.status(500).json({
                        message: 'Variation upload failed',
                        error: variationsResult.error
                    });
                }
            } catch (err) {
                console.error('Variation upload error:', err);
                return res.status(500).json({
                    message: 'Variation upload service error',
                    error: err.message
                });
            }
        } else {
            return res.status(400).json({
                message: 'Variations are required for brand products',
                error: 'Variable products must have at least one variation'
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Brand product uploaded successfully',
            productID,
            brandID,
            brandName
        });

    } catch (err) {
        console.error('Error in addBrandProduct:', err);
        return res.status(500).json({
            message: 'Internal server error',
            error: err.message || 'Unknown server error'
        });
    }
};

// Edit brand product
const editBrandProduct = async (req, res) => {
    try {
        const payload = req.body;
        const productID = payload.productID;
        const brandID = req.user.uid;

        if (!payload || typeof payload !== 'object' || !productID) {
            return res.status(400).json({ message: 'Invalid payload or missing productID' });
        }

        // Verify product belongs to this brand
        const product = await model.getProductByID(productID);
        if (!product || product.brandID !== brandID) {
            return res.status(403).json({ message: 'Product not found or does not belong to this brand' });
        }

        // Force type to 'variable' for brand products
        payload.type = 'variable';

        // Update Product Core Info
        const updateProduct = await model.editProductModel({ ...payload, productID });
        if (!updateProduct.success) {
            return res.status(500).json({
                message: 'Product update failed',
                error: updateProduct.error
            });
        }

        // Replace Attributes (if any)
        const attributes = payload.attributes;
        if (Array.isArray(attributes) && attributes.length > 0) {
            const attrResult = await service.editAttributeService(attributes, productID);
            if (!attrResult.success) {
                return res.status(500).json({
                    message: 'Attribute update failed',
                    error: attrResult.error
                });
            }
        }

        // Replace Variations (if any)
        const variations = payload.productVariations;
        if (Array.isArray(variations) && variations.length > 0) {
            const varResult = await service.editVariationMap({ variations, productID });
            if (!varResult.success) {
                return res.status(500).json({
                    message: 'Variation update failed',
                    error: varResult.error
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Brand product updated successfully',
            productID
        });

    } catch (err) {
        console.error('Error in editBrandProduct:', err);
        return res.status(500).json({
            message: 'Internal server error',
            error: err.message || 'Unknown server error'
        });
    }
};

// Delete brand product
const deleteBrandProduct = async (req, res) => {
    try {
        const { productID } = req.params;
        const brandID = req.user.uid;

        if (!productID) {
            return res.status(400).json({ message: 'Product ID is required' });
        }

        // Verify product belongs to this brand
        const product = await model.getProductByID(productID);
        if (!product || product.brandID !== brandID) {
            return res.status(403).json({ message: 'Product not found or does not belong to this brand' });
        }

        // Delete product
        const deleteResult = await model.deleteProduct(productID);
        if (!deleteResult.success) {
            return res.status(500).json({
                message: 'Product deletion failed',
                error: deleteResult.error
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Brand product deleted successfully'
        });

    } catch (err) {
        console.error('Error in deleteBrandProduct:', err);
        return res.status(500).json({
            message: 'Internal server error',
            error: err.message || 'Unknown server error'
        });
    }
};

// Get brand products with pagination
const getBrandProducts = async (req, res) => {
    try {
        const brandID = req.user.uid;
        const { page = 1, limit = 10, search, status, category } = req.query;

        const filters = [`brandID = '${brandID}'`];
        const values = [];

        if (search) {
            filters.push('(name LIKE ? OR description LIKE ?)');
            const searchTerm = `%${search}%`;
            values.push(searchTerm, searchTerm);
        }

        if (status) {
            filters.push('status = ?');
            values.push(status);
        }

        if (category) {
            filters.push('JSON_CONTAINS(categories, ?)');
            values.push(`"${category}"`);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const baseQuery = `SELECT * FROM products ${whereClause} ORDER BY createdAt DESC`;
        const countQuery = `SELECT COUNT(*) AS total FROM products ${whereClause}`;

        // Get total count
        const [countResult] = await db.query(countQuery, values);
        const total = countResult[0].total;

        // Get paginated results
        const offset = (page - 1) * limit;
        const paginatedQuery = `${baseQuery} LIMIT ${limit} OFFSET ${offset}`;
        const [products] = await db.query(paginatedQuery, values);

        // Parse JSON fields
        const processedProducts = products.map(product => ({
            ...product,
            featuredImage: product.featuredImage ? JSON.parse(product.featuredImage) : [],
            galleryImage: product.galleryImage ? JSON.parse(product.galleryImage) : [],
            productAttributes: product.productAttributes ? JSON.parse(product.productAttributes) : [],
            categories: product.categories ? JSON.parse(product.categories) : []
        }));

        res.json({
            success: true,
            data: processedProducts,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalProducts: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching brand products:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch products', error: error.message });
    }
};

// Get brand product count
const getBrandProductCount = async (req, res) => {
    try {
        const brandID = req.user.uid;
        const { search, status, category } = req.query;

        const filters = [`brandID = '${brandID}'`];
        const values = [];

        if (search) {
            filters.push('(name LIKE ? OR description LIKE ?)');
            const searchTerm = `%${search}%`;
            values.push(searchTerm, searchTerm);
        }

        if (status) {
            filters.push('status = ?');
            values.push(status);
        }

        if (category) {
            filters.push('JSON_CONTAINS(categories, ?)');
            values.push(`"${category}"`);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const countQuery = `SELECT COUNT(*) AS total FROM products ${whereClause}`;
        const [result] = await db.query(countQuery, values);
        const total = result[0].total;

        res.json({
            success: true,
            totalProducts: total
        });

    } catch (error) {
        console.error('Error getting brand product count:', error);
        res.status(500).json({ success: false, message: 'Failed to get product count', error: error.message });
    }
};

// Get brand product details
const getBrandProductDetails = async (req, res) => {


    try {
        const { productID } = req.params;
        const brandID = req.user.uid;

        if (!productID) {
            return res.status(400).json({ message: 'Product ID is required' });
        }

        // Get product details
        const product = await model.getProductByID(productID);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Verify product belongs to this brand
        if (product.brandID !== brandID) {
            return res.status(403).json({ message: 'Product does not belong to this brand' });
        }

        // helper
        const safeParse = (value, fallback = null) => {
            try {
                let parsed = value;
                while (typeof parsed === 'string') parsed = JSON.parse(parsed);
                return parsed;
            } catch {
                return fallback;
            }
        };

        // Load variations
        const [variationRows] = await db.query(`SELECT * FROM variations WHERE productID = ?`, [productID]);
        const variations = (variationRows || []).map(v => ({
            ...v,
            variationValues: safeParse(v.variationValues, [])
        }));
        console.log(variations);



        // Parse JSON fields
        const processedProduct = {
            ...product,
            featuredImage: safeParse(product.featuredImage, []),
            galleryImage: safeParse(product.galleryImage, []),
            productAttributes: safeParse(product.productAttributes, []),
            categories: safeParse(product.categories, []),
            variations
        };

        res.json({
            success: true,
            data: processedProduct
        });

    } catch (error) {
        console.error('Error fetching brand product details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch product details', error: error.message });
    }
};

module.exports = {
    addBrandProduct,
    editBrandProduct,
    deleteBrandProduct,
    getBrandProducts,
    getBrandProductCount,
    getBrandProductDetails
};
