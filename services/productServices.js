const model = require('./../model/productModel');
const attributeModel = require('./../model/attributesModel');
const crossSellModel = require('./../model/crossSellModel');
const db = require('./../utils/dbconnect');
const { get } = require('../router/admin/productRouter');

const generateRandomID = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 5; i++) {
        id += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `ITHYP${id}`;
};

const generateRandomString = (length = 7) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const generateUniqueVariationID = async () => {
    const prefix = 'VAR-';
    let variationID = '';

    while (true) {
        const randomPart = generateRandomString(7);
        variationID = `${prefix}${randomPart}`;

        const exists = await model.checkIfVariationIDExists(variationID);
        if (!exists) break;
    }

    return variationID;
};


const generateUniqueProductID = async () => {
    let unique = false;
    let productID = '';

    while (!unique) {
        productID = generateRandomID();

        const [rows] = await db.query(
            'SELECT 1 FROM products WHERE productID = ? LIMIT 1',
            [productID]
        );

        if (rows.length === 0) {
            unique = true;
        }
    }

    return productID;
};

const uploadVariationMap = async ({ variations, productID }) => {
    // console.log('🔄 Starting uploadVariationMap...');

    if (!variations) {
        console.warn('⚠️ No variation data provided');
        return {
            success: false,
            message: 'No variation data provided'
        };
    }

    try {
        const results = [];

        if (Array.isArray(variations)) {
            // console.log(`🧩 Variations is an array with ${variations.length} item(s)`);

            for (const [index, variation] of variations.entries()) {
                // console.log(`➡️ Processing variation[${index}]:`, variation);

                const variationID = await generateUniqueVariationID();
                // console.log(`🆔 Generated variationID: ${variationID}`);

                const payload = {
                    ...variation,
                    productID,
                    variationID
                };

                // console.log('📤 Uploading variation to model.uploadVariations with payload:', payload);

                const result = await model.uploadVariations(payload);

                if (!result.success) {
                    console.error(`❌ Upload failed for variation[${index}]:`, result.error);
                    return {
                        success: false,
                        message: 'One or more variations failed to upload',
                        error: result.error
                    };
                }

                // console.log(`✅ Upload succeeded for variation[${index}] with ID ${variationID}`);
                results.push(result);
            }

        } else if (typeof variations === 'object') {
            // console.log('🧩 Single variation object detected:', variations);

            const variationID = await generateUniqueVariationID();
            // console.log(`🆔 Generated variationID: ${variationID}`);

            const payload = {
                ...variations,
                productID,
                variationID
            };

            // console.log('📤 Uploading single variation to model.uploadVariations with payload:', payload);

            const result = await model.uploadVariations(payload);

            if (!result.success) {
                console.error('❌ Upload failed for single variation:', result.error);
                return {
                    success: false,
                    message: 'Variation upload failed',
                    error: result.error
                };
            }

            // console.log(`✅ Upload succeeded for single variation with ID ${variationID}`);
            results.push(result);
        } else {
            console.warn('⚠️ Invalid variations format. Must be array or object:', variations);
            return {
                success: false,
                message: 'Invalid variation format'
            };
        }

        // console.log('🎉 All variation(s) uploaded successfully');
        return {
            success: true,
            message: 'Variation(s) uploaded successfully',
            data: results
        };

    } catch (error) {
        console.error('🔥 Exception during uploadVariationMap:', error);
        return {
            success: false,
            message: 'Unexpected error during variation upload',
            error: error.message
        };
    }
};

const editVariationMap = async ({ variations, productID }) => {
    if (!variations) {
        return {
            success: false,
            message: 'No variation data provided'
        };
    }

    try {
        await model.deleteVariationsByProductID(productID); // Overwrite logic

        const results = [];

        const variationsArray = Array.isArray(variations) ? variations : [variations];

        for (const variation of variationsArray) {
            const variationID = await generateUniqueVariationID();

            const payload = {
                ...variation,
                productID,
                variationID
            };

            const result = await model.uploadVariations(payload);

            if (!result.success) {
                return {
                    success: false,
                    message: 'One or more variations failed to upload',
                    error: result.error
                };
            }

            results.push(result);
        }

        return {
            success: true,
            message: 'Variation(s) updated successfully',
            data: results
        };
    } catch (error) {
        console.error('editVariationMap error:', error);
        return {
            success: false,
            message: 'Unexpected error during variation update',
            error: error.message
        };
    }
};

const uploadAttributeService = async (attributesArray) => {

    if (!Array.isArray(attributesArray) || attributesArray.length === 0) {
        console.error("Invalid attributesArray: Must be a non-empty array");
        return {
            success: false,
            message: 'An array of attributes is required'
        };
    }

    const results = [];

    for (const attr of attributesArray) {
        const { name, values } = attr;

        // Validation
        if (!name || !Array.isArray(values) || values.length === 0) {
            console.warn(`Skipping attribute "${name}" due to invalid format`);
            results.push({
                success: false,
                name,
                message: 'Invalid attribute format (missing name or non-array/empty values)'
            });
            continue;
        }

        try {
            const result = await attributeModel.uploadAttribute({ name, values });

            if (result.success) {
                results.push({
                    success: true,
                    name,
                    id: result.insertId || result.insertedId
                });
            } else {
                console.error(`Failed to upload attribute "${name}":`, result.error);
                results.push({
                    success: false,
                    name,
                    message: result.error
                });
            }
        } catch (error) {
            console.error(`Error uploading attribute "${name}":`, error.message);
            results.push({
                success: false,
                name,
                message: error.message
            });
        }
    }

    const allSuccessful = results.every(r => r.success);
    return {
        success: allSuccessful,
        message: 'Attribute upload process completed',
        data: results
    };
};

const editAttributeService = async (attributesArray, productID) => {
    if (!Array.isArray(attributesArray) || attributesArray.length === 0) {
        return {
            success: false,
            message: 'An array of attributes is required'
        };
    }

    try {
        await model.deleteVariationsByProductID(productID); // overwrite behavior

        const results = [];

        for (const attr of attributesArray) {
            const { name, values } = attr;

            if (!name || !Array.isArray(values) || values.length === 0) {
                results.push({
                    success: false,
                    name,
                    message: 'Invalid attribute format'
                });
                continue;
            }

            const result = await attributeModel.uploadAttribute({ name, values, productID });

            if (result.success) {
                results.push({
                    success: true,
                    name,
                    id: result.insertId || result.insertedId
                });
            } else {
                results.push({
                    success: false,
                    name,
                    message: result.error
                });
            }
        }

        const allSuccessful = results.every(r => r.success);

        return {
            success: allSuccessful,
            message: 'Attribute update process completed',
            data: results
        };
    } catch (error) {
        console.error('editAttributeService error:', error);
        return {
            success: false,
            message: 'Unexpected error during attribute update',
            error: error.message
        };
    }
};

const getProductCount = async (query) => {
    const filters = [];
    const values = [];

    const allowedFilters = [
        'name', 'regularPrice', 'salePrice', 'discountType',
        'discountValue', 'type', 'status', 'offerID',
        'overridePrice', 'tab1', 'tab2', 'productID',
        'featuredImage', 'categoryID', 'categoryName'
    ];

    const likeFields = ['name', 'type', 'productID'];

    for (const key in query) {
        if (!allowedFilters.includes(key)) continue;

        let value = query[key];
        const cleanedValue = typeof value === 'string' ? value.replace(/^'+|'+$/g, '') : value;

        if (key === 'categoryID') {
            filters.push(`JSON_CONTAINS(categories, JSON_OBJECT('categoryID', ?))`);
            values.push(Number(cleanedValue));
        } else if (key === 'categoryName') {
            filters.push(`JSON_EXTRACT(categories, '$[*].categoryName') LIKE ?`);
            values.push(`%${cleanedValue}%`);
        } else if (likeFields.includes(key)) {
            filters.push(`${key} LIKE ?`);
            values.push(`%${cleanedValue}%`);
        } else {
            filters.push(`${key} = ?`);
            values.push(cleanedValue);
        }
    }

    let countQuery = `SELECT COUNT(*) as total FROM products`;

    if (filters.length > 0) {
        countQuery += ` WHERE ${filters.join(' AND ')}`;
    }

    const [rows] = await db.execute(countQuery, values);

    return {
        totalItems: rows[0]?.total || 0
    };
};


const paginate = async ({ baseQuery, values, page, limit, db }) => {
    const offset = (page - 1) * limit;

    const [data] = await db.query(`${baseQuery} LIMIT ? OFFSET ?`, [...values, limit, offset]);

    return {
        currentPage: page,
        data
    };
};
const fetchPaginatedProducts = async (query) => {
    console.log(query);

    let page = parseInt(query.page) || 1;
    let limit = parseInt(query.limit) || 2;

    if (page < 1) page = 1;
    if (limit < 1) limit = 10;

    const filters = [];
    const values = [];

    const allowedFilters = [
        'name', 'regularPrice', 'salePrice', 'discountType',
        'discountValue', 'type', 'status', 'offerID',
        'overridePrice', 'tab1', 'tab2', 'productID',
        'featuredImage', 'categoryID', 'categoryName'
    ];

    const likeFields = ['name', 'productID'];

    for (const key in query) {
        if (allowedFilters.includes(key)) {
            let value = query[key];
            const cleanedValue = typeof value === 'string' ? value.replace(/^'+|'+$/g, '') : value;

            if (key === 'categoryID') {
                filters.push(`JSON_CONTAINS(categories, JSON_OBJECT('categoryID', ?))`);
                values.push(Number(cleanedValue));
            } else if (key === 'categoryName') {
                // Use LIKE on JSON_EXTRACT to allow partial match
                filters.push(`JSON_EXTRACT(categories, '$[*].categoryName') LIKE ?`);
                values.push(`%${cleanedValue}%`);
            } else if (likeFields.includes(key)) {
                filters.push(`${key} LIKE ?`);
                values.push(`%${cleanedValue}%`);
            } else {
                filters.push(`${key} = ?`);
                values.push(cleanedValue);
            }
        }
    }

    let baseQuery = `SELECT * FROM products`;

    if (filters.length > 0) {
        baseQuery += ` WHERE ${filters.join(' AND ')}`;
    }

    baseQuery += ` ORDER BY createdAt DESC`;

    console.log('🧪 baseQuery:', baseQuery);
    console.log('🧪 values:', values);

    const result = await paginate({
        baseQuery,
        values,
        page,
        limit,
        db
    });
    // console.log(result);


    return result;
};


const { detectFlashSaleSchema } = require('../utils/flashSaleSchema');

const getProductDetails = async (productID) => {
    const product = await model.getProductWithVariations(productID);
    if (!product) return null;

    let flash = null;
    try {
        const schema = await detectFlashSaleSchema();
        const d = schema.details;
        const i = schema.items;
        const timeFilter = (d.startTime && d.endTime) ? `AND NOW() BETWEEN d.${d.startTime} AND d.${d.endTime}` : '';
        const statusFilter = d.status ? `AND d.${d.status} = 'active'` : '';
        const selectEnd = d.endTime ? `, d.${d.endTime} AS flashSaleEndTime` : '';
        const [rows] = await db.query(
            `SELECT d.${d.saleID} AS saleID, i.${i.discountType} AS discountType, i.${i.discountValue} AS discountValue${selectEnd}
             FROM ${schema.tables.items} i
             INNER JOIN ${schema.tables.details} d ON d.${d.saleID} = i.${i.saleID}
             WHERE i.${i.productID} = ? ${statusFilter} ${timeFilter}
             ORDER BY ${d.startTime ? `d.${d.startTime} DESC` : 'd.createdAt DESC'}
             LIMIT 1`,
            [productID]
        );
        if (rows && rows.length > 0) flash = rows[0];
    } catch (_) {
        flash = null;
    }

    product.isFlashSale = Boolean(flash);
    if (flash && Object.prototype.hasOwnProperty.call(flash, 'flashSaleEndTime')) {
        product.flashSaleEndTime = flash.flashSaleEndTime;
    }

    if (flash && Array.isArray(product.variations)) {
        const discountType = String(flash.discountType || '').toLowerCase();
        const discountValue = Number(flash.discountValue || 0);

        product.variations = product.variations.map(v => {
            const basePrice = Number(v.variationPrice);
            let salePrice = Number(v.variationSalePrice ?? v.variationPrice);

            if (!Number.isNaN(basePrice)) {
                if (discountType === 'percentage') {
                    salePrice = Math.max(0, +(basePrice * (1 - discountValue / 100)).toFixed(2));
                } else if (discountType === 'fixed' || discountType === 'flat') {
                    salePrice = Math.max(0, +(basePrice - discountValue).toFixed(2));
                }
            }

            return {
                ...v,
                variationSalePrice: String(salePrice.toFixed ? salePrice.toFixed(2) : salePrice)
            };
        });
    }

    // Fetch cross-sell products
    try {
        const crossSellProducts = await crossSellModel.getCrossSellProducts(productID);
        // Extract only the first image URL for cross-sell products
        product.crossSellProducts = crossSellProducts.map(p => {
            const parsed = { ...p };
            
            // Extract first image URL from featuredImage
            let imageUrl = null;
            try {
                let featuredImage = parsed.featuredImage;
                // Parse if it's a string
                if (typeof featuredImage === 'string') {
                    featuredImage = JSON.parse(featuredImage);
                }
                // Extract first image URL
                if (Array.isArray(featuredImage) && featuredImage.length > 0) {
                    const firstImage = featuredImage[0];
                    if (firstImage && firstImage.imgUrl) {
                        imageUrl = firstImage.imgUrl;
                    }
                }
            } catch (error) {
                // If parsing fails, imageUrl remains null
                console.error('Error parsing featuredImage for cross-sell product:', error);
            }
            
            // Return only essential fields with imageUrl and type
            return {
                productID: parsed.productID,
                name: parsed.name,
                regularPrice: parsed.regularPrice,
                salePrice: parsed.salePrice,
                type: parsed.type || 'variable',
                imageUrl: imageUrl || null
            };
        });
    } catch (error) {
        console.error('Error fetching cross-sell products:', error);
        product.crossSellProducts = [];
    }

    return product;
};



// Public shop products with filters: multiple categories, price range, stock, pagination
async function getShopProductsPublic(query) {
    let page = Math.max(1, parseInt(query.page) || 1);
    let limit = Math.min(50, Math.max(1, parseInt(query.limit) || 12));
    let type = query.type || 'variable';

    const filters = [];
    const values = [];

    // Category filter: categoryID can be comma-separated IDs
    if (query.categoryID) {
        const ids = String(query.categoryID)
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .map(Number)
            .filter(n => !Number.isNaN(n));
        if (ids.length > 0) {
            const orConds = ids.map(() => `JSON_CONTAINS(categories, JSON_OBJECT('categoryID', ?))`);
            filters.push(`(${orConds.join(' OR ')})`);
            values.push(...ids);
        }
    }

    // Type filter: default to 'variable' unless explicitly provided otherwise
    if (type && String(type).toLowerCase() !== 'all') {
        filters.push(`type = ?`);
        values.push(type);
    }

    // Price range (single min/max) or multiple bands via priceBands param
    const priceBands = typeof query.priceBands === 'string'
        ? query.priceBands.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    if (priceBands.length > 0) {
        const bandConds = [];
        for (const band of priceBands) {
            if (band === 'u500') bandConds.push(`(salePrice >= 0 AND salePrice <= 499)`);
            else if (band === '500-999') bandConds.push(`(salePrice >= 500 AND salePrice <= 999)`);
            else if (band === '1000-1999') bandConds.push(`(salePrice >= 1000 AND salePrice <= 1999)`);
            else if (band === '2000+') bandConds.push(`(salePrice >= 2000)`);
        }
        if (bandConds.length > 0) filters.push(`(${bandConds.join(' OR ')})`);
    } else {
        const minPrice = query.minPrice !== undefined && query.minPrice !== '' ? Number(query.minPrice) : null;
        const maxPrice = query.maxPrice !== undefined && query.maxPrice !== '' ? Number(query.maxPrice) : null;
        if (minPrice !== null && !Number.isNaN(minPrice)) { filters.push(`salePrice >= ?`); values.push(minPrice); }
        if (maxPrice !== null && !Number.isNaN(maxPrice)) { filters.push(`salePrice <= ?`); values.push(maxPrice); }
    }

    // Stock filter (optional): stock=in|out maps to status field values
    if (query.stock) {
        const stock = String(query.stock).toLowerCase();
        if (stock === 'in') {
            // Treat NULL as In Stock as well
            filters.push(`(status = ? OR status IS NULL)`);
            values.push('In Stock');
        } else if (stock === 'out') {
            filters.push(`status = ?`);
            values.push('Out of Stock');
        }
    }

    // Optional search by name
    if (query.search) { filters.push(`name LIKE ?`); values.push(`%${query.search}%`); }

    // Offer filter
    if (query.offerID) {
        filters.push(`offerID = ?`);
        values.push(query.offerID);
    }

    // Sorting
    const allowedSort = new Set(['createdAt', 'name', 'salePrice', 'regularPrice']);
    const sortBy = allowedSort.has(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = String(query.sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Base query
    let baseQuery = `SELECT productID, name, description, regularPrice, salePrice, discountType, discountValue, type, status, brand, featuredImage, categories, createdAt FROM products`;
    if (filters.length > 0) baseQuery += ` WHERE ${filters.join(' AND ')}`;
    baseQuery += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Count query
    let countQuery = `SELECT COUNT(*) AS total FROM products`;
    if (filters.length > 0) countQuery += ` WHERE ${filters.join(' AND ')}`;

    const offset = (page - 1) * limit;
    const [rows] = await db.query(`${baseQuery} LIMIT ? OFFSET ?`, [...values, limit, offset]);
    const [countRows] = await db.query(countQuery, values);
    const total = countRows?.[0]?.total || 0;

    return {
        success: true,
        data: rows,
        pagination: {
            currentPage: page,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            itemsPerPage: limit,
            hasPrevPage: page > 1,
            hasNextPage: page < Math.ceil(total / limit)
        }
    };
}

const deleteProduct = async (productID) => {
    try {
        if (!productID) {
            return {
                success: false,
                message: 'Product ID is required'
            };
        }

        const result = await model.deleteProduct(productID);

        if (result.success) {
            return {
                success: true,
                message: 'Product deleted successfully',
                affectedRows: result.affectedRows
            };
        } else {
            return {
                success: false,
                message: 'Failed to delete product',
                error: result.error
            };
        }
    } catch (error) {
        return {
            success: false,
            message: 'Error deleting product',
            error: error.message
        };
    }
};

/**
 * Handle cross-sell mappings for a product
 * @param {string} productID - The product ID
 * @param {number[]} crossSellProductIDs - Array of cross-sell product IDs
 * @returns {Promise<{success: boolean, message: string}>}
 */
const handleCrossSells = async (productID, crossSellProductIDs) => {
    if (!productID) {
        return { success: false, message: 'Product ID is required' };
    }

    try {
        // Delete existing cross-sells
        await crossSellModel.deleteCrossSells(productID);

        // Insert new cross-sells if provided
        if (Array.isArray(crossSellProductIDs) && crossSellProductIDs.length > 0) {
            const result = await crossSellModel.insertCrossSells(productID, crossSellProductIDs);
            return result;
        }

        return { success: true, message: 'Cross-sells updated successfully' };
    } catch (error) {
        console.error('Error handling cross-sells:', error);
        return { success: false, message: 'Failed to handle cross-sells', error: error.message };
    }
};

// Search products by query string
async function searchProducts(query) {
    try {
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return {
                success: true,
                data: [],
                total: 0
            };
        }

        const trimmedQuery = query.trim();
        const searchTerm = `%${trimmedQuery}%`;
        const startMatch = `${trimmedQuery}%`;
        
        // Search in both name and description
        const searchQuery = `
            SELECT 
                productID, 
                name, 
                description, 
                regularPrice, 
                salePrice, 
                discountType, 
                discountValue, 
                type, 
                status, 
                brand, 
                featuredImage, 
                categories, 
                createdAt 
            FROM products 
            WHERE (name LIKE ? OR description LIKE ?)
            AND status = 'In Stock'
            ORDER BY 
                CASE 
                    WHEN name LIKE ? THEN 1
                    WHEN name LIKE ? THEN 2
                    ELSE 3
                END,
                createdAt DESC
            LIMIT 20
        `;
        
        const [rows] = await db.query(searchQuery, [
            searchTerm,
            searchTerm,
            startMatch, // Exact start match gets highest priority
            searchTerm
        ]);

        return {
            success: true,
            data: rows,
            total: rows.length
        };
    } catch (error) {
        console.error('Error searching products:', error);
        return {
            success: false,
            message: 'Error searching products',
            error: error.message,
            data: [],
            total: 0
        };
    }
}

module.exports = { generateUniqueProductID, uploadVariationMap, uploadAttributeService, fetchPaginatedProducts, getProductCount, getProductDetails, editAttributeService, editVariationMap, getShopProductsPublic, deleteProduct, handleCrossSells, searchProducts };