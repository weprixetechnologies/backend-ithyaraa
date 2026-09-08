const db = require('../utils/dbconnect');

/**
 * Search brands by name
 * @param {string} searchText - Search text for brand name
 * @returns {Promise<Array>} Array of brands matching the search
 */
async function searchBrands(searchText) {
    try {
        const trimmedSearch = searchText ? searchText.trim() : '';

        // If search text is empty, return all brands
        if (!trimmedSearch) {
            const query = `
                SELECT uid, name, username, emailID
                FROM users
                WHERE role = 'brand'
                ORDER BY name ASC, username ASC
                LIMIT 100
            `;
            const [rows] = await db.query(query);
            return rows;
        }

        const searchTerm = `%${trimmedSearch}%`;
        const startMatch = `${trimmedSearch}%`;

        // Use LOWER() for case-insensitive search
        const query = `
            SELECT uid, name, username, emailID
            FROM users
            WHERE role = 'brand' 
            AND (
                LOWER(name) LIKE LOWER(?) 
                OR LOWER(username) LIKE LOWER(?) 
                OR LOWER(emailID) LIKE LOWER(?)
            )
            ORDER BY 
                CASE 
                    WHEN LOWER(name) LIKE LOWER(?) THEN 1
                    WHEN LOWER(username) LIKE LOWER(?) THEN 2
                    ELSE 3
                END,
                name ASC, username ASC
            LIMIT 50
        `;

        const params = [searchTerm, searchTerm, searchTerm, startMatch, startMatch];

        const [rows] = await db.query(query, params);

        return rows;
    } catch (error) {
        console.error('Error searching brands:', error);
        throw error;
    }
}

/**
 * Build SQL WHERE condition for brand filtering
 */
function buildBrandCondition(brandIDs = [], filterType = '') {
    if (filterType === 'only_inhouse') {
        return { condition: "(oi.brandID IS NULL OR oi.brandID = 'inhouse')", params: [] };
    }
    if (filterType === 'except_inhouse') {
        return { condition: "(oi.brandID IS NOT NULL AND oi.brandID != 'inhouse')", params: [] };
    }
    if (filterType === 'all') {
        return { condition: "1=1", params: [] };
    }

    // Custom selection or single brandID
    const ids = Array.isArray(brandIDs) ? brandIDs.filter(Boolean) : (brandIDs ? [String(brandIDs)] : []);
    if (ids.length === 0) {
        return { condition: "1=1", params: [] };
    }

    const hasInhouse = ids.includes('inhouse');
    const realUIDs = ids.filter(id => id !== 'inhouse');

    if (hasInhouse && realUIDs.length > 0) {
        const placeholders = realUIDs.map(() => '?').join(',');
        return {
            condition: `(oi.brandID IN (${placeholders}) OR oi.brandID IS NULL OR oi.brandID = 'inhouse')`,
            params: realUIDs
        };
    } else if (hasInhouse) {
        return { condition: "(oi.brandID IS NULL OR oi.brandID = 'inhouse')", params: [] };
    } else {
        const placeholders = realUIDs.map(() => '?').join(',');
        return {
            condition: `oi.brandID IN (${placeholders})`,
            params: realUIDs
        };
    }
}

/**
 * Get brand orders count
 */
async function getBrandOrdersCount(brandIDs, filterType, fromDate, toDate, whereConditions = [], queryParams = []) {
    try {
        const brandCond = buildBrandCondition(brandIDs, filterType);

        let conditions = [brandCond.condition];
        let params = [...brandCond.params];

        if (fromDate && toDate) {
            conditions.push(`DATE(oi.createdAt) BETWEEN ? AND ?`);
            params.push(fromDate, toDate);
        }

        conditions = conditions.concat(whereConditions);
        params = params.concat(queryParams);

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [countResult] = await db.query(
            `SELECT COUNT(DISTINCT oi.orderID) as total
             FROM order_items oi
             ${whereClause}`,
            params
        );

        return countResult[0]?.total || 0;
    } catch (error) {
        console.error('Error getting brand orders count:', error);
        throw error;
    }
}

/**
 * Get brand orders with pagination
 */
async function getBrandOrders(brandIDs, filterType, fromDate, toDate, page = 1, limit = 10, whereConditions = [], queryParams = []) {
    try {
        const offset = (page - 1) * limit;
        const brandCond = buildBrandCondition(brandIDs, filterType);

        let conditions = [brandCond.condition];
        let params = [...brandCond.params];

        if (fromDate && toDate) {
            conditions.push(`DATE(oi.createdAt) BETWEEN ? AND ?`);
            params.push(fromDate, toDate);
        }

        conditions = conditions.concat(whereConditions);
        params = params.concat(queryParams);

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const ordersQuery = `
            SELECT 
                oi.orderID,
                oi.uid,
                oi.createdAt,
                COUNT(oi.orderItemID) as itemCount,
                SUM(oi.lineTotalAfter) as brandOrderAmount,
                GROUP_CONCAT(DISTINCT oi.name SEPARATOR ', ') as itemNames,
                GROUP_CONCAT(DISTINCT CASE WHEN oi.brandID IS NULL OR oi.brandID = 'inhouse' THEN 'Ithyaraa' ELSE COALESCE(u_brand.name, u_brand.username, 'Ithyaraa') END SEPARATOR ', ') as brandNames,
                od.paymentMode,
                od.paymentStatus,
                od.orderStatus,
                od.createdAt as orderDate,
                u.name as customerName,
                u.username as customerUsername
            FROM order_items oi
            LEFT JOIN orderDetail od ON oi.orderID = od.orderID
            LEFT JOIN users u ON od.uid = u.uid
            LEFT JOIN users u_brand ON oi.brandID = u_brand.uid
            ${whereClause}
            GROUP BY oi.orderID, oi.uid, oi.createdAt, od.paymentMode, od.paymentStatus, od.orderStatus, od.createdAt, u.name, u.username
            ORDER BY oi.createdAt DESC
            LIMIT ? OFFSET ?
        `;

        const [orders] = await db.query(ordersQuery, [...params, parseInt(limit), offset]);

        return orders;
    } catch (error) {
        console.error('Error getting brand orders:', error);
        throw error;
    }
}

/**
 * Get order details for admin brand orders view
 */
async function getOrderDetailsForBrand(orderID, brandID) {
    try {
        const [orderDetailRows] = await db.query(
            `SELECT od.orderID, od.uid, od.paymentMode, od.paymentStatus, od.orderStatus, od.createdAt
             FROM orderDetail od
             WHERE od.orderID = ?
             LIMIT 1`,
            [orderID]
        );

        if (orderDetailRows.length === 0) {
            return null;
        }

        const orderDetail = orderDetailRows[0];
        const [userRows] = await db.query(
            `SELECT uid, name, username, emailID
             FROM users
             WHERE uid = ?
             LIMIT 1`,
            [orderDetail.uid]
        );

        const customer = userRows[0] || null;
        const customerName = customer?.name || customer?.username || 'N/A';

        return {
            orderID: orderDetail.orderID,
            orderDate: orderDetail.createdAt,
            customerName: customerName,
            paymentStatus: orderDetail.paymentStatus,
            orderStatus: orderDetail.orderStatus,
            paymentMode: orderDetail.paymentMode
        };
    } catch (error) {
        console.error('Error getting order details for brand:', error);
        throw error;
    }
}

/**
 * Get order items for a specific brand or set of brands in an order
 */
async function getOrderItemsForBrand(orderID, brandIDs, filterType) {
    try {
        const brandCond = buildBrandCondition(brandIDs, filterType);
        let conditions = ['oi.orderID = ?', brandCond.condition];
        let params = [orderID, ...brandCond.params];

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const [items] = await db.query(
            `SELECT 
                oi.name,
                oi.variationName,
                oi.quantity,
                oi.unitPriceAfter,
                oi.lineTotalAfter,
                oi.itemStatus,
                oi.featuredImage,
                oi.brandID,
                CASE WHEN oi.brandID IS NULL OR oi.brandID = 'inhouse' THEN 'Ithyaraa' ELSE COALESCE(u_brand.name, u_brand.username, 'Ithyaraa') END as brandName
            FROM order_items oi
            LEFT JOIN users u_brand ON oi.brandID = u_brand.uid
            ${whereClause}
            ORDER BY oi.createdAt ASC`,
            params
        );

        return items.map(item => ({
            ...item,
            featuredImage: item.featuredImage ? JSON.parse(item.featuredImage) : [{ imgUrl: '/placeholder-product.jpg' }]
        }));
    } catch (error) {
        console.error('Error getting order items for brand:', error);
        throw error;
    }
}

module.exports = {
    searchBrands,
    getBrandOrdersCount,
    getBrandOrders,
    getOrderDetailsForBrand,
    getOrderItemsForBrand
};

