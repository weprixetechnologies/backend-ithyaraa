const adminBrandOrdersService = require('../services/adminBrandOrdersService');

/**
 * Search brands by name
 * GET /api/admin/brands/search?name=
 */
const searchBrands = async (req, res) => {
    try {
        const { name } = req.query;
        const trimmedName = name ? name.trim() : '';

        const brands = await adminBrandOrdersService.searchBrands(trimmedName);

        return res.json({
            success: true,
            data: brands
        });
    } catch (error) {
        console.error('Error in searchBrands controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to search brands',
            error: error.message
        });
    }
};

/**
 * Get brand orders
 * GET /api/admin/orders/by-brand?brandIDs=&filterType=&fromDate=&toDate=&page=&limit=
 */
const getBrandOrders = async (req, res) => {
    try {
        const { brandID, brandIDs, filterType, fromDate, toDate, page = 1, limit = 10 } = req.query;

        // Parse brandIDs: handle comma-separated string, array, or fallback to brandID
        let parsedBrandIDs = [];
        if (brandIDs) {
            if (Array.isArray(brandIDs)) {
                parsedBrandIDs = brandIDs;
            } else if (typeof brandIDs === 'string') {
                parsedBrandIDs = brandIDs.split(',').map(s => s.trim()).filter(Boolean);
            }
        } else if (brandID) {
            parsedBrandIDs = [brandID];
        }

        // Validate date format if provided
        if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
            return res.status(400).json({
                success: false,
                message: 'fromDate must be in YYYY-MM-DD format'
            });
        }

        if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'toDate must be in YYYY-MM-DD format'
            });
        }

        const effectiveFilterType = filterType || (parsedBrandIDs.length === 0 ? 'all' : 'custom');

        const result = await adminBrandOrdersService.getBrandOrders(
            parsedBrandIDs,
            effectiveFilterType,
            fromDate,
            toDate,
            parseInt(page),
            parseInt(limit)
        );

        return res.json({
            success: true,
            data: result.orders,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Error in getBrandOrders controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch brand orders',
            error: error.message
        });
    }
};

module.exports = {
    searchBrands,
    getBrandOrders
};

