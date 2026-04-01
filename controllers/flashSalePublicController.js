const db = require('../utils/dbconnect');
const { detectFlashSaleSchema } = require('../utils/flashSaleSchema');

/**
 * Public endpoint to fetch all products currently in an active flash sale.
 * Optimized for performance, no caching as per requirements.
 */
const getFlashSaleProducts = async (req, res) => {
    try {
        const schema = await detectFlashSaleSchema();
        const d = schema.details;
        const i = schema.items;

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
        const offset = (page - 1) * limit;

        const filters = [];
        const values = [];

        // Base condition: Active and within time range
        filters.push(`d.${d.status} = 'active'`);
        if (d.startTime && d.endTime) {
            filters.push(`NOW() BETWEEN d.${d.startTime} AND d.${d.endTime}`);
        }

        // Category filter
        if (req.query.categoryID) {
            const ids = String(req.query.categoryID)
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .map(Number)
                .filter(n => !Number.isNaN(n));

            if (ids.length > 0) {
                const orConds = ids.map(
                    () => `JSON_CONTAINS(p.categories, JSON_OBJECT('categoryID', ?))`
                );
                filters.push(`(${orConds.join(' OR ')})`);
                values.push(...ids);
            }
        }

        // Price bands
        const priceBands = typeof req.query.priceBands === 'string'
            ? req.query.priceBands.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        if (priceBands.length > 0) {
            const bandConds = [];
            for (const band of priceBands) {
                if (band === 'u500') bandConds.push(`(p.salePrice BETWEEN 0 AND 499)`);
                else if (band === '500-999') bandConds.push(`(p.salePrice BETWEEN 500 AND 999)`);
                else if (band === '1000-1999') bandConds.push(`(p.salePrice BETWEEN 1000 AND 1999)`);
                else if (band === '2000+') bandConds.push(`(p.salePrice >= 2000)`);
            }
            if (bandConds.length > 0) filters.push(`(${bandConds.join(' OR ')})`);
        } else {
            const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
            const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
            if (minPrice !== null && !Number.isNaN(minPrice)) {
                filters.push(`p.salePrice >= ?`);
                values.push(minPrice);
            }
            if (maxPrice !== null && !Number.isNaN(maxPrice)) {
                filters.push(`p.salePrice <= ?`);
                values.push(maxPrice);
            }
        }

        // Sorting
        const allowedSort = new Set(['createdAt', 'name', 'salePrice']);
        const sortBy = allowedSort.has(req.query.sortBy) ? `p.${req.query.sortBy}` : `d.${d.createdAt || 'createdAt'}`;
        const sortOrder = String(req.query.sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

        // Optimized Query: Only select necessary fields
        // We join products (p) with flash_sale_items (i) and flash_sale_details (d)
        const sql = `
            SELECT 
                p.productID, p.name, p.regularPrice, p.salePrice,
                p.featuredImage, p.categories, p.brand, p.type, p.status,
                i.${i.discountType} AS flashDiscountType,
                i.${i.discountValue} AS flashDiscountValue,
                d.${d.endTime} AS flashSaleEndTime
            FROM ${schema.tables.items} i
            INNER JOIN ${schema.tables.details} d ON d.${d.saleID} = i.${i.saleID}
            INNER JOIN products p ON p.productID = i.${i.productID}
            ${whereClause}
            ORDER BY ${sortBy} ${sortOrder}
            LIMIT ? OFFSET ?
        `;

        const [rows] = await db.query(sql, [...values, limit, offset]);

        // Process rows: Calculate flash sale price and parse JSON
        const processedRows = rows.map(row => {
            let featuredImage = [];
            let categories = [];
            try {
                featuredImage = typeof row.featuredImage === 'string' ? JSON.parse(row.featuredImage) : row.featuredImage;
                categories = typeof row.categories === 'string' ? JSON.parse(row.categories) : row.categories;
            } catch (e) {
                console.error('JSON parse error for product:', row.productID, e);
            }

            const basePrice = Number(row.regularPrice);
            let flashSalePrice = Number(row.salePrice);

            const discountType = String(row.flashDiscountType || '').toLowerCase();
            const discountValue = Number(row.flashDiscountValue || 0);

            if (!Number.isNaN(basePrice)) {
                if (discountType === 'percentage') {
                    flashSalePrice = Math.max(0, +(basePrice * (1 - discountValue / 100)).toFixed(2));
                } else if (discountType === 'fixed' || discountType === 'flat') {
                    flashSalePrice = Math.max(0, +(basePrice - discountValue).toFixed(2));
                }
            }

            return {
                ...row,
                featuredImage,
                categories,
                flashSalePrice, // The actual price during flash sale
                isFlashSale: true
            };
        });

        // Get total count for pagination
        const countSql = `
            SELECT COUNT(*) AS total
            FROM ${schema.tables.items} i
            INNER JOIN ${schema.tables.details} d ON d.${d.saleID} = i.${i.saleID}
            INNER JOIN products p ON p.productID = i.${i.productID}
            ${whereClause}
        `;
        const [countRows] = await db.query(countSql, values);
        const total = countRows?.[0]?.total || 0;

        return res.status(200).json({
            success: true,
            data: processedRows,
            pagination: {
                currentPage: page,
                totalItems: total,
                totalPages: Math.ceil(total / limit),
                itemsPerPage: limit,
                hasPrevPage: page > 1,
                hasNextPage: page < Math.ceil(total / limit),
            }
        });

    } catch (error) {
        console.error('Error in getFlashSaleProducts:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    getFlashSaleProducts
};
