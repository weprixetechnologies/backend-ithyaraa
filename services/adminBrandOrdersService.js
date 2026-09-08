const adminBrandOrdersModel = require('../model/adminBrandOrdersModel');

/**
 * Search brands by name
 * @param {string} searchText - Search text
 * @returns {Promise<Array>} Array of brands
 */
async function searchBrands(searchText) {
    try {
        const brands = await adminBrandOrdersModel.searchBrands(searchText ? searchText.trim() : '');

        // Format response (uid for consistency with getAllBrands)
        return brands.map(brand => ({
            uid: brand.uid,
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
 * Get brand orders
 * @param {Array|string} brandIDs - Array of Brand UIDs or single brandID
 * @param {string} filterType - Preset filter type ('all', 'except_inhouse', 'only_inhouse', 'custom')
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Orders with pagination
 */
async function getBrandOrders(brandIDs, filterType = '', fromDate = '', toDate = '', page = 1, limit = 10) {
    try {
        let parsedBrandIDs = [];
        if (Array.isArray(brandIDs)) {
            parsedBrandIDs = brandIDs.filter(Boolean);
        } else if (typeof brandIDs === 'string' && brandIDs.trim()) {
            parsedBrandIDs = brandIDs.split(',').map(s => s.trim()).filter(Boolean);
        }

        // Get total count
        const total = await adminBrandOrdersModel.getBrandOrdersCount(parsedBrandIDs, filterType, fromDate, toDate);

        // Get orders
        const orders = await adminBrandOrdersModel.getBrandOrders(parsedBrandIDs, filterType, fromDate, toDate, page, limit);

        // Enrich orders with items
        const enrichedOrders = await Promise.all(
            orders.map(async (order) => {
                const items = await adminBrandOrdersModel.getOrderItemsForBrand(order.orderID, parsedBrandIDs, filterType);
                const customerName = order.customerName || order.customerUsername || 'N/A';

                return {
                    orderID: order.orderID,
                    orderDate: order.orderDate || order.createdAt,
                    customerName: customerName,
                    brandNames: order.brandNames || 'Ithyaraa',
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
                totalPages: Math.ceil(total / limit) || 1,
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

