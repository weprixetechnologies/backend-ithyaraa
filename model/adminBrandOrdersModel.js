const db = require('../utils/dbconnect');

/**
 * Search brands by name
 * @param {string} searchText - Search text for brand name
 * @returns {Promise<Array>} Array of brands matching the search
 */
async function searchBrands(searchText) {
    try {
        // Debug logging
        console.log('=== Model searchBrands ===');
        console.log('Received searchText:', searchText);
        console.log('SearchText type:', typeof searchText);
        console.log('SearchText length:', searchText?.length);

        const trimmedSearch = searchText.trim();
        const searchTerm = `%${trimmedSearch}%`;
        const startMatch = `${trimmedSearch}%`;

        console.log('Search term (LIKE):', searchTerm);
        console.log('Start match (LIKE):', startMatch);

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
        console.log('Query params:', params);

        const [rows] = await db.query(query, params);

        console.log('Query returned rows:', rows.length);
        console.log('First result:', rows[0] || 'No results');

        return rows;
    } catch (error) {
        console.error('Error searching brands:', error);
        throw error;
    }
}

/**
 * Get brand orders count (reusing Brand Panel logic)
 * @param {string} brandID - Brand UID
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @param {Array} whereConditions - Additional WHERE conditions
 * @param {Array} queryParams - Query parameters
 * @returns {Promise<number>} Total count of unique orders
 */
async function getBrandOrdersCount(brandID, fromDate, toDate, whereConditions = [], queryParams = []) {
    try {
        // Build date filter
        const dateFilter = fromDate && toDate
            ? `DATE(oi.createdAt) BETWEEN ? AND ?`
            : null;

        // Base conditions
        let conditions = ['oi.brandID = ?'];
        let params = [brandID];

        // Add date filter if provided
        if (dateFilter) {
            conditions.push(dateFilter);
            params.push(fromDate, toDate);
        }

        // Add additional conditions
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
 * Get brand orders with pagination (reusing Brand Panel logic)
 * @param {string} brandID - Brand UID
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {Array} whereConditions - Additional WHERE conditions
 * @param {Array} queryParams - Query parameters
 * @returns {Promise<Array>} Array of orders
 */
async function getBrandOrders(brandID, fromDate, toDate, page = 1, limit = 10, whereConditions = [], queryParams = []) {
    try {
        const offset = (page - 1) * limit;

        // Build date filter
        const dateFilter = fromDate && toDate
            ? `DATE(oi.createdAt) BETWEEN ? AND ?`
            : null;

        // Base conditions
        let conditions = ['oi.brandID = ?'];
        let params = [brandID];

        // Add date filter if provided
        if (dateFilter) {
            conditions.push(dateFilter);
            params.push(fromDate, toDate);
        }

        // Add additional conditions
        conditions = conditions.concat(whereConditions);
        params = params.concat(queryParams);

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Get orders grouped by orderID with orderDetail and customer info (optimized with JOINs)
        const ordersQuery = `
            SELECT 
                oi.orderID,
                oi.uid,
                oi.createdAt,
                COUNT(oi.orderID) as itemCount,
                SUM(oi.lineTotalAfter) as brandOrderAmount,
                GROUP_CONCAT(oi.name SEPARATOR ', ') as itemNames,
                od.paymentMode,
                od.paymentStatus,
                od.orderStatus,
                od.createdAt as orderDate,
                u.name as customerName,
                u.username as customerUsername
            FROM order_items oi
            LEFT JOIN orderDetail od ON oi.orderID = od.orderID
            LEFT JOIN users u ON od.uid = u.uid
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
 * @param {string} orderID - Order ID
 * @param {string} brandID - Brand UID
 * @returns {Promise<Object>} Order details with orderDetail info
 */
async function getOrderDetailsForBrand(orderID, brandID) {
    try {
        // Get orderDetail info
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

        // Get customer info
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
 * Get order items for a specific brand in an order
 * @param {string} orderID - Order ID
 * @param {string} brandID - Brand UID
 * @returns {Promise<Array>} Array of order items
 */
async function getOrderItemsForBrand(orderID, brandID) {
    try {
        const [items] = await db.query(
            `SELECT 
                oi.name,
                oi.variationName,
                oi.quantity,
                oi.unitPriceAfter,
                oi.lineTotalAfter,
                oi.itemStatus,
                oi.featuredImage
            FROM order_items oi
            WHERE oi.orderID = ? AND oi.brandID = ?
            ORDER BY oi.createdAt ASC`,
            [orderID, brandID]
        );

        // Parse featuredImage for each item
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

