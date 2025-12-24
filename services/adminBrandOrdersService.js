const adminBrandOrdersModel = require('../model/adminBrandOrdersModel');

/**
 * Search brands by name
 * @param {string} searchText - Search text
 * @returns {Promise<Array>} Array of brands
 */
async function searchBrands(searchText) {
    try {
        if (!searchText || searchText.trim().length === 0) {
            return [];
        }

        const brands = await adminBrandOrdersModel.searchBrands(searchText.trim());

        // Format response
        return brands.map(brand => ({
            brandID: brand.uid,
            name: brand.name || brand.username || 'N/A',
            username: brand.username,
            emailID: brand.emailID
        }));
    } catch (error) {
        console.error('Error in searchBrands service:', error);
        throw error;
    }
}

/**
 * Get brand orders (reusing Brand Panel logic)
 * @param {string} brandID - Brand UID
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Orders with pagination
 */
async function getBrandOrders(brandID, fromDate, toDate, page = 1, limit = 10) {
    try {
        if (!brandID) {
            throw new Error('brandID is required');
        }

        // Get total count
        const total = await adminBrandOrdersModel.getBrandOrdersCount(brandID, fromDate, toDate);

        // Get orders (same query logic as Brand Panel)
        const orders = await adminBrandOrdersModel.getBrandOrders(brandID, fromDate, toDate, page, limit);

        // Enrich orders with items (orderDetail and customer info already in query)
        const enrichedOrders = await Promise.all(
            orders.map(async (order) => {
                // Get items for this brand
                const items = await adminBrandOrdersModel.getOrderItemsForBrand(order.orderID, brandID);

                // Customer name from joined query or fallback
                const customerName = order.customerName || order.customerUsername || 'N/A';

                return {
                    orderID: order.orderID,
                    orderDate: order.orderDate || order.createdAt,
                    customerName: customerName,
                    paymentStatus: order.paymentStatus || 'N/A',
                    orderStatus: order.orderStatus || 'N/A',
                    paymentMode: order.paymentMode || 'N/A',
                    brandOrderAmount: parseFloat(order.brandOrderAmount) || 0,
                    itemCount: order.itemCount || 0,
                    items: items
                };
            })
        );

        return {
            orders: enrichedOrders,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalOrders: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        };
    } catch (error) {
        console.error('Error in getBrandOrders service:', error);
        throw error;
    }
}

module.exports = {
    searchBrands,
    getBrandOrders
};

