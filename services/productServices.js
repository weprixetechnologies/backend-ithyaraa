const model = require('./../model/productModel');
const attributeModel = require('./../model/attributesModel');
const crossSellModel = require('./../model/crossSellModel');
const db = require('./../utils/dbconnect');
const { getCache, setCache } = require('../utils/cacheHelper');
const { SCOPE } = require('../utils/cacheScopes');

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
        if (rows.length === 0) unique = true;
    }
    return productID;
};

const generateVariationSlug = (variation) => {
    // If slug already provided by payload, use it
    if (variation.variationSlug) return variation.variationSlug;

    // Otherwise derive from variationValues
    if (variation.variationValues && Array.isArray(variation.variationValues)) {
        return variation.variationValues
            .map(v => {
                if (typeof v === 'object' && v !== null) {
                    const entries = Object.entries(v);
                    return entries.length > 0 ? entries[0][1] : '';
                }
                return String(v);
            })
            .join('_')
            .toLowerCase();
    }

    // Last resort fallback
    return variation.variationName
        ? variation.variationName.toLowerCase().replace(/\s+/g, '_')
        : null;
};

const uploadVariationMap = async ({ variations, productID }) => {
    if (!variations) {
        return { success: false, message: 'No variation data provided' };
    }

    try {
        const variationsArray = Array.isArray(variations) ? variations : [variations];
        if (variationsArray.length === 0) {
            return { success: false, message: 'Variations array is empty' };
        }

        const variationIDs = await generateMultipleUniqueVariationIDs(variationsArray.length);

        const preparedVariations = variationsArray.map((variation, i) => ({
            ...variation,
            productID,
            variationID: variationIDs[i],
            variationSlug: generateVariationSlug(variation), // explicitly guaranteed
        }));

        const result = await model.bulkUploadVariations(preparedVariations);
        if (!result.success) {
            return { success: false, message: 'Variation upload failed', error: result.error };
        }

        return {
            success: true,
            message: result.message,
            data: preparedVariations.map(v => ({
                variationID: v.variationID,
                variationSlug: v.variationSlug
            }))
        };
    } catch (error) {
        console.error('Exception during uploadVariationMap:', error);
        return { success: false, message: 'Unexpected error during variation upload', error: error.message };
    }
};
const normalizeVariationValues = (variationValues) => {
    if (!variationValues || !Array.isArray(variationValues)) return '';
    const sorted = variationValues
        .map(v => {
            if (typeof v === 'object' && v !== null) {
                const entries = Object.entries(v);
                if (entries.length > 0) return `${entries[0][0]}:${entries[0][1]}`;
            }
            return String(v);
        })
        .sort()
        .join('|');
    return sorted;
};

const editVariationMap = async ({ variations, productID }) => {
    if (!variations) {
        return { success: false, message: 'No variation data provided' };
    }

    try {
        const existingVariations = await model.getVariationsByProductID(productID);

        const existingVariationsBySlug = new Map();
        const existingVariationsByID = new Map();
        const existingVariationsByValues = new Map();

        existingVariations.forEach(v => {
            if (v.variationSlug) existingVariationsBySlug.set(v.variationSlug.toLowerCase().trim(), v);
            if (v.variationID) existingVariationsByID.set(v.variationID, v);
            const normalizedValues = normalizeVariationValues(v.variationValues);
            if (normalizedValues) existingVariationsByValues.set(normalizedValues, v);
        });

        const variationsArray = Array.isArray(variations) ? variations : [variations];
        const processedSlugs = new Set();
        const processedIDs = new Set();
        const results = [];

        for (const variation of variationsArray) {
            let existingVariation = null;
            let matchMethod = null;

            if (variation.variationID) {
                existingVariation = existingVariationsByID.get(variation.variationID);
                if (existingVariation) {
                    matchMethod = 'variationID';
                    processedIDs.add(variation.variationID);
                }
            }

            if (!existingVariation && variation.variationSlug) {
                const normalizedSlug = variation.variationSlug.toLowerCase().trim();
                existingVariation = existingVariationsBySlug.get(normalizedSlug);
                if (existingVariation) {
                    matchMethod = 'variationSlug';
                    processedSlugs.add(normalizedSlug);
                    if (existingVariation.variationID) processedIDs.add(existingVariation.variationID);
                }
            }

            if (!existingVariation && variation.variationValues) {
                const normalizedValues = normalizeVariationValues(variation.variationValues);
                if (normalizedValues) {
                    existingVariation = existingVariationsByValues.get(normalizedValues);
                    if (existingVariation) {
                        matchMethod = 'variationValues';
                        if (existingVariation.variationSlug) processedSlugs.add(existingVariation.variationSlug.toLowerCase().trim());
                        if (existingVariation.variationID) processedIDs.add(existingVariation.variationID);
                    }
                }
            }

            if (existingVariation) {
                const updatePayload = {
                    variationName: variation.variationName !== undefined ? variation.variationName : existingVariation.variationName,
                    variationSlug: existingVariation.variationSlug || variation.variationSlug,
                    variationID: existingVariation.variationID,
                    variationPrice: variation.variationPrice !== undefined && variation.variationPrice !== '' ? variation.variationPrice : existingVariation.variationPrice,
                    variationStock: variation.variationStock !== undefined && variation.variationStock !== '' ? variation.variationStock : existingVariation.variationStock,
                    variationValues: variation.variationValues || existingVariation.variationValues,
                    productID,
                    variationSalePrice: variation.variationSalePrice !== undefined && variation.variationSalePrice !== '' ? variation.variationSalePrice : existingVariation.variationSalePrice
                };

                const result = await model.updateVariation(updatePayload);
                if (!result.success) {
                    console.error('Failed to update variation:', updatePayload.variationSlug || updatePayload.variationID, result.error);
                    return {
                        success: false,
                        message: `Failed to update variation: ${updatePayload.variationSlug || updatePayload.variationID}`,
                        error: result.error
                    };
                }
                results.push({ action: 'updated', matchMethod, variationSlug: updatePayload.variationSlug, variationID: updatePayload.variationID, ...result });
            } else {
                const variationID = await generateUniqueVariationID();

                let variationSlug = variation.variationSlug;
                if (!variationSlug && variation.variationValues) {
                    const values = Array.isArray(variation.variationValues)
                        ? variation.variationValues.map(v => {
                            if (typeof v === 'object' && v !== null) {
                                const entries = Object.entries(v);
                                return entries.length > 0 ? entries[0][1] : '';
                            }
                            return String(v);
                        })
                        : [];
                    variationSlug = values.join('_').toLowerCase();
                }

                if (variationSlug && existingVariationsBySlug.has(variationSlug.toLowerCase().trim())) {
                    console.warn(`Variation slug ${variationSlug} already exists but wasn't matched.`);
                }

                const createPayload = {
                    variationName: variation.variationName || variationSlug,
                    variationSlug,
                    variationID,
                    variationPrice: variation.variationPrice || 0,
                    variationStock: variation.variationStock || 0,
                    variationValues: variation.variationValues || [],
                    productID,
                    variationSalePrice: variation.variationSalePrice || null
                };

                const result = await model.uploadVariations(createPayload);
                if (!result.success) {
                    console.error('Failed to create variation:', createPayload.variationSlug, result.error);
                    return {
                        success: false,
                        message: `Failed to create variation: ${createPayload.variationSlug}`,
                        error: result.error
                    };
                }

                if (createPayload.variationSlug) processedSlugs.add(createPayload.variationSlug.toLowerCase().trim());
                processedIDs.add(createPayload.variationID);

                results.push({ action: 'created', variationSlug: createPayload.variationSlug, variationID: createPayload.variationID, ...result });
            }
        }

        const variationsToDelete = existingVariations.filter(v => {
            const hasSlug = v.variationSlug && processedSlugs.has(v.variationSlug.toLowerCase().trim());
            const hasID = v.variationID && processedIDs.has(v.variationID);
            return !hasSlug && !hasID;
        });

        for (const variationToDelete of variationsToDelete) {
            const deleteResult = await model.deleteVariationByID(variationToDelete.variationID);
            if (deleteResult.success) {
                results.push({ action: 'deleted', variationSlug: variationToDelete.variationSlug, variationID: variationToDelete.variationID });
            }
        }

        return { success: true, message: 'Variation(s) updated successfully', data: results };
    } catch (error) {
        console.error('editVariationMap error:', error);
        return { success: false, message: 'Unexpected error during variation update', error: error.message };
    }
};

const uploadAttributeService = async (attributesArray) => {
    if (!Array.isArray(attributesArray) || attributesArray.length === 0) {
        return { success: false, message: 'An array of attributes is required' };
    }

    const results = [];
    for (const attr of attributesArray) {
        const { name, values } = attr;
        if (!name || !Array.isArray(values) || values.length === 0) {
            console.warn(`Skipping attribute "${name}" due to invalid format`);
            results.push({ success: false, name, message: 'Invalid attribute format (missing name or non-array/empty values)' });
            continue;
        }
        try {
            const result = await attributeModel.uploadAttribute({ name, values });
            if (result.success) {
                results.push({ success: true, name, id: result.insertId || result.insertedId });
            } else {
                console.error(`Failed to upload attribute "${name}":`, result.error);
                results.push({ success: false, name, message: result.error });
            }
        } catch (error) {
            console.error(`Error uploading attribute "${name}":`, error.message);
            results.push({ success: false, name, message: error.message });
        }
    }

    const allSuccessful = results.every(r => r.success);
    return { success: allSuccessful, message: 'Attribute upload process completed', data: results };
};

const editAttributeService = async (attributesArray, productID) => {
    if (!Array.isArray(attributesArray) || attributesArray.length === 0) {
        return { success: false, message: 'An array of attributes is required' };
    }

    try {
        const results = [];

        for (const attr of attributesArray) {
            const { name, values } = attr;
            if (!name || !Array.isArray(values) || values.length === 0) {
                results.push({ success: false, name, message: 'Invalid attribute format' });
                continue;
            }
            const result = await attributeModel.uploadAttribute({ name, values, productID });
            if (result.success) {
                results.push({ success: true, name, id: result.insertId || result.insertedId });
            } else {
                results.push({ success: false, name, message: result.error });
            }
        }

        const allSuccessful = results.every(r => r.success);
        return { success: allSuccessful, message: 'Attribute update process completed', data: results };
    } catch (error) {
        console.error('editAttributeService error:', error);
        return { success: false, message: 'Unexpected error during attribute update', error: error.message };
    }
};

const getProductCount = async (query) => {
    const filters = [];
    const values = [];

    const allowedFilters = [
        'name', 'regularPrice', 'salePrice', 'discountType',
        'discountValue', 'type', 'status', 'offerID',
        'overridePrice', 'tab1', 'tab2', 'productID',
        'sectionid', 'featuredImage', 'categoryID', 'categoryName', 'brandID'
    ];
    const likeFields = ['name', 'type', 'productID', 'sectionid'];

    for (const key in query) {
        if (!allowedFilters.includes(key)) continue;
        const value = query[key];
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
    if (filters.length > 0) countQuery += ` WHERE ${filters.join(' AND ')}`;

    const [rows] = await db.execute(countQuery, values);
    return { totalItems: rows[0]?.total || 0 };
};

const paginate = async ({ baseQuery, values, page, limit, db }) => {
    const offset = (page - 1) * limit;
    const [data] = await db.query(`${baseQuery} LIMIT ? OFFSET ?`, [...values, limit, offset]);
    return { currentPage: page, data };
};

const fetchPaginatedProducts = async (query) => {
    let page = parseInt(query.page) || 1;
    let limit = parseInt(query.limit) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;

    const filters = [];
    const values = [];

    const allowedFilters = [
        'name', 'regularPrice', 'salePrice', 'discountType',
        'discountValue', 'type', 'status', 'offerID',
        'overridePrice', 'tab1', 'tab2', 'productID',
        'sectionid', 'featuredImage', 'categoryID', 'categoryName', 'brandID'
    ];
    const likeFields = ['name', 'productID', 'sectionid'];

    for (const key in query) {
        if (!allowedFilters.includes(key)) continue;
        const value = query[key];
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

    let baseQuery = `
        SELECT
            productID, name, sectionid, regularPrice, salePrice,
            discountType, discountValue, offerID, featuredImage,
            brand, categories, type, status, createdAt
        FROM products
    `;
    if (filters.length > 0) baseQuery += ` WHERE ${filters.join(' AND ')}`;
    baseQuery += ` ORDER BY createdAt DESC`;

    return paginate({ baseQuery, values, page, limit, db });
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
            return { ...v, variationSalePrice: String(salePrice.toFixed ? salePrice.toFixed(2) : salePrice) };
        });
    }

    try {
        const crossSellProducts = await crossSellModel.getCrossSellProducts(productID);
        product.crossSellProducts = crossSellProducts.map(p => {
            const parsed = { ...p };
            let imageUrl = null;
            try {
                let featuredImage = parsed.featuredImage;
                if (typeof featuredImage === 'string') featuredImage = JSON.parse(featuredImage);
                if (Array.isArray(featuredImage) && featuredImage.length > 0) {
                    const firstImage = featuredImage[0];
                    if (firstImage && firstImage.imgUrl) imageUrl = firstImage.imgUrl;
                }
            } catch (error) {
                console.error('Error parsing featuredImage for cross-sell product:', error);
            }
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

    try {
        if (product.offerID) {
            const [offerRows] = await db.query(
                `SELECT offerID, offerName, offerType, buyCount, getCount, offerBanner, offerMobileBanner
                 FROM offers WHERE offerID = ? LIMIT 1`,
                [product.offerID]
            );
            if (offerRows && offerRows.length > 0) {
                const offer = offerRows[0];
                product.offer = {
                    offerID: offer.offerID,
                    offerName: offer.offerName,
                    offerType: offer.offerType,
                    buyCount: parseInt(offer.buyCount, 10) || 1,
                    getCount: parseInt(offer.getCount, 10) || 1
                };
            } else {
                product.offer = null;
            }
        } else {
            product.offer = null;
        }
    } catch (offerErr) {
        console.error('Error fetching offer for product:', offerErr);
        product.offer = null;
    }

    return product;
};

async function getShopProductsPublic(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 12));
    const type = query.type || 'variable';

    const cacheFilters = {
        categoryID: query.categoryID ?? '__none__',
        sectionid: query.sectionid ?? '__none__',
        type: type !== 'all' ? type : '__all__',
        priceBands: query.priceBands ?? '__none__',
        minPrice: query.minPrice ?? '__none__',
        maxPrice: query.maxPrice ?? '__none__',
        stock: query.stock ?? '__none__',
        search: query.search ?? '__none__',
        offerID: query.offerID ?? '__none__',
        sortBy: query.sortBy ?? 'createdAt',
        sortOrder: query.sortOrder ?? 'DESC',
    };

    const cacheKey = SCOPE.PRODUCTS_PAGE(page, limit, cacheFilters);
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const filters = [];
    const values = [];

    if (query.categoryID) {
        const ids = String(query.categoryID).split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(n => !Number.isNaN(n));
        if (ids.length > 0) {
            filters.push(`(${ids.map(() => `JSON_CONTAINS(categories, JSON_OBJECT('categoryID', ?))`).join(' OR ')})`);
            values.push(...ids);
        }
    }

    if (query.sectionid) {
        const sectionIds = String(query.sectionid).split(',').map(s => s.trim()).filter(Boolean);
        if (sectionIds.length > 0) {
            filters.push(`(${sectionIds.map(() => `sectionid = ?`).join(' OR ')})`);
            values.push(...sectionIds);
        }
    }

    if (type && String(type).toLowerCase() !== 'all') {
        filters.push(`type = ?`);
        values.push(type);
    }

    const priceBands = typeof query.priceBands === 'string'
        ? query.priceBands.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    if (priceBands.length > 0) {
        const bandConds = [];
        for (const band of priceBands) {
            if (band === 'u500') bandConds.push(`(salePrice BETWEEN 0 AND 499)`);
            else if (band === '500-999') bandConds.push(`(salePrice BETWEEN 500 AND 999)`);
            else if (band === '1000-1999') bandConds.push(`(salePrice BETWEEN 1000 AND 1999)`);
            else if (band === '2000+') bandConds.push(`(salePrice >= 2000)`);
        }
        if (bandConds.length > 0) filters.push(`(${bandConds.join(' OR ')})`);
    } else {
        const minPrice = query.minPrice !== undefined && query.minPrice !== '' ? Number(query.minPrice) : null;
        const maxPrice = query.maxPrice !== undefined && query.maxPrice !== '' ? Number(query.maxPrice) : null;
        if (minPrice !== null && !Number.isNaN(minPrice)) { filters.push(`salePrice >= ?`); values.push(minPrice); }
        if (maxPrice !== null && !Number.isNaN(maxPrice)) { filters.push(`salePrice <= ?`); values.push(maxPrice); }
    }

    if (query.stock) {
        const stock = String(query.stock).toLowerCase();
        if (stock === 'in') { filters.push(`(status = ? OR status IS NULL)`); values.push('In Stock'); }
        else if (stock === 'out') { filters.push(`status = ?`); values.push('Out of Stock'); }
    }

    if (query.search) { filters.push(`name LIKE ?`); values.push(`%${query.search}%`); }
    if (query.offerID) { filters.push(`offerID = ?`); values.push(query.offerID); }

    const allowedSort = new Set(['createdAt', 'name', 'salePrice', 'regularPrice']);
    const sortBy = allowedSort.has(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = String(query.sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let baseQuery = `
        SELECT productID, name, regularPrice, salePrice,
               discountType, discountValue, type, status,
               brand, brandID, featuredImage, categories, sectionid, createdAt
        FROM products
    `;
    if (filters.length > 0) baseQuery += ` WHERE ${filters.join(' AND ')}`;
    baseQuery += ` ORDER BY ${sortBy} ${sortOrder}`;

    let countQuery = `SELECT COUNT(*) AS total FROM products`;
    if (filters.length > 0) countQuery += ` WHERE ${filters.join(' AND ')}`;

    const offset = (page - 1) * limit;
    const [rows] = await db.query(`${baseQuery} LIMIT ? OFFSET ?`, [...values, limit, offset]);

    rows.forEach(row => {
        try {
            if (typeof row.featuredImage === 'string') row.featuredImage = JSON.parse(row.featuredImage);
            if (typeof row.categories === 'string') row.categories = JSON.parse(row.categories);
        } catch (e) {
            console.error('JSON parse error for product:', row.productID, e);
        }
    });

    const [countRows] = await db.query(countQuery, values);
    const total = countRows?.[0]?.total || 0;

    const data = {
        success: true,
        data: rows,
        pagination: {
            currentPage: page,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            itemsPerPage: limit,
            hasPrevPage: page > 1,
            hasNextPage: page < Math.ceil(total / limit),
        },
    };

    await setCache(cacheKey, data, 300);
    return data;
}

const deleteProduct = async (productID) => {
    try {
        if (!productID) return { success: false, message: 'Product ID is required' };
        const result = await model.deleteProduct(productID);
        if (result.success) {
            return { success: true, message: 'Product deleted successfully', affectedRows: result.affectedRows };
        }
        return { success: false, message: 'Failed to delete product', error: result.error };
    } catch (error) {
        return { success: false, message: 'Error deleting product', error: error.message };
    }
};

const bulkDeleteProducts = async (productIDs = []) => {
    if (!Array.isArray(productIDs) || productIDs.length === 0) {
        return { success: false, message: 'productIDs must be a non-empty array' };
    }
    const results = [];
    for (const id of productIDs) {
        const result = await deleteProduct(id);
        results.push({ productID: id, ...result });
    }
    const allOk = results.every(r => r.success);
    return {
        success: allOk,
        message: allOk ? 'All products deleted successfully' : 'Some products could not be deleted',
        results
    };
};

const bulkUpdateSale = async ({ productIDs = [], discountType, discountValue, updateSalePrice = false }) => {
    if (!Array.isArray(productIDs) || productIDs.length === 0) return { success: false, message: 'productIDs must be a non-empty array' };
    if (!discountType || typeof discountValue === 'undefined' || discountValue === null) return { success: false, message: 'discountType and discountValue are required' };

    const validTypes = new Set(['percentage', 'fixed', 'flat']);
    const normType = String(discountType).toLowerCase();
    if (!validTypes.has(normType)) return { success: false, message: 'Invalid discountType. Use percentage, fixed or flat.' };

    const numericDiscount = Number(discountValue);
    if (Number.isNaN(numericDiscount)) return { success: false, message: 'discountValue must be a number' };

    const placeholders = productIDs.map(() => '?').join(',');
    let sql = `UPDATE products SET discountType = ?, discountValue = ?`;
    const values = [normType, numericDiscount];

    if (updateSalePrice) {
        sql += `,
            salePrice = CASE
                WHEN ? = 'percentage' THEN GREATEST(0, ROUND(regularPrice * (1 - (? / 100)), 2))
                WHEN ? IN ('fixed', 'flat') THEN GREATEST(0, regularPrice - ?)
                ELSE salePrice
            END`;
        values.push(normType, numericDiscount, normType, numericDiscount);
    }

    sql += ` WHERE productID IN (${placeholders})`;
    values.push(...productIDs);

    const [result] = await db.query(sql, values);
    return { success: true, message: 'Bulk sale updated successfully', affectedRows: result.affectedRows };
};

const bulkAssignSection = async ({ productIDs = [], sectionid }) => {
    if (!Array.isArray(productIDs) || productIDs.length === 0) return { success: false, message: 'productIDs must be a non-empty array' };
    if (!sectionid) return { success: false, message: 'sectionid is required' };

    const placeholders = productIDs.map(() => '?').join(',');
    const [result] = await db.query(
        `UPDATE products SET sectionid = ? WHERE productID IN (${placeholders})`,
        [sectionid, ...productIDs]
    );
    return { success: true, message: 'Section assigned successfully to selected products', affectedRows: result.affectedRows };
};

const bulkRemoveSection = async ({ productIDs = [] }) => {
    if (!Array.isArray(productIDs) || productIDs.length === 0) return { success: false, message: 'productIDs must be a non-empty array' };

    const placeholders = productIDs.map(() => '?').join(',');
    const [result] = await db.query(
        `UPDATE products SET sectionid = NULL WHERE productID IN (${placeholders})`,
        productIDs
    );
    return { success: true, message: 'Section removed successfully from selected products', affectedRows: result.affectedRows };
};

const handleCrossSells = async (productID, crossSellProductIDs) => {
    if (!productID) return { success: false, message: 'Product ID is required' };
    try {
        await crossSellModel.deleteCrossSells(productID);
        if (Array.isArray(crossSellProductIDs) && crossSellProductIDs.length > 0) {
            return await crossSellModel.insertCrossSells(productID, crossSellProductIDs);
        }
        return { success: true, message: 'Cross-sells updated successfully' };
    } catch (error) {
        console.error('Error handling cross-sells:', error);
        return { success: false, message: 'Failed to handle cross-sells', error: error.message };
    }
};

async function searchProducts(query) {
    try {
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return { success: true, data: [], total: 0 };
        }
        const trimmedQuery = query.trim();
        const searchTerm = `%${trimmedQuery}%`;
        const startMatch = `${trimmedQuery}%`;

        const searchQuery = `
            SELECT
                productID, name, description, regularPrice, salePrice,
                discountType, discountValue, type, status, brand,
                featuredImage, categories, createdAt
            FROM products
            WHERE (name LIKE ? OR productID LIKE ?)
              AND status != 'deleted'
            ORDER BY
                CASE
                    WHEN name LIKE ? THEN 1
                    WHEN name LIKE ? THEN 2
                    ELSE 3
                END,
                createdAt DESC
            LIMIT 20
        `;

        const [rows] = await db.query(searchQuery, [searchTerm, searchTerm, startMatch, searchTerm]);
        return { success: true, data: rows, total: rows.length };
    } catch (error) {
        console.error('Error searching products:', error);
        return { success: false, message: 'Error searching products', error: error.message, data: [], total: 0 };
    }
}

// ─────────────────────────────────────────────
// Single export block
// FIX: removed orphan mid-file
// `module.exports = { getShopProductsPublic }`
// that was dead code (overwritten by this block)
// ─────────────────────────────────────────────
module.exports = {
    generateUniqueProductID,
    uploadVariationMap,
    uploadAttributeService,
    fetchPaginatedProducts,
    getProductCount,
    getProductDetails,
    editAttributeService,
    editVariationMap,
    getShopProductsPublic,
    deleteProduct,
    bulkDeleteProducts,
    bulkUpdateSale,
    bulkAssignSection,
    bulkRemoveSection,
    handleCrossSells,
    searchProducts,
};