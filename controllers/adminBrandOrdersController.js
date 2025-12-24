const adminBrandOrdersService = require('../services/adminBrandOrdersService');

/**
 * Search brands by name
 * GET /api/admin/brands/search?name=
 */
const searchBrands = async (req, res) => {
    try {
        const { name } = req.query;

        // Debug logging
        console.log('=== Brand Search Debug ===');
        console.log('Raw query param:', req.query);
        console.log('Name param:', name);
        console.log('Name type:', typeof name);
        console.log('Name length:', name?.length);

        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Search name is required'
            });
        }

        const trimmedName = name.trim();
        console.log('Trimmed name:', trimmedName);
        console.log('Calling service with:', trimmedName);

        const brands = await adminBrandOrdersService.searchBrands(trimmedName);

        console.log('Service returned brands count:', brands?.length || 0);

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
 * GET /api/admin/orders/by-brand?brandID=&fromDate=&toDate=&page=&limit=
 */
const getBrandOrders = async (req, res) => {
    try {
        const { brandID, fromDate, toDate, page = 1, limit = 10 } = req.query;

        if (!brandID) {
            return res.status(400).json({
                success: false,
                message: 'brandID is required'
            });
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

        const result = await adminBrandOrdersService.getBrandOrders(
            brandID,
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

