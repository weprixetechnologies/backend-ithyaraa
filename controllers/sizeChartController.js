const sizeChartService = require('../services/sizeChartService');

const createSizeChart = async (req, res) => {
    try {
        const { chartName, imgUrl } = req.body;
        const brandID = req.user?.role === 'brand' ? req.user.uid : null;
        const chart = await sizeChartService.createSizeChart({ chartName, imgUrl, brandID });
        res.status(201).json({
            success: true,
            data: chart,
        });
    } catch (error) {
        console.error('Error in createSizeChart:', error);
        const status = error.statusCode || 500;
        res.status(status).json({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};

const listSizeCharts = async (req, res) => {
    try {
        const brandID = req.user?.role === 'brand' ? req.user.uid : null;
        let charts = await sizeChartService.listSizeCharts();
        
        // If it's a brand user, filter the charts to only show their own
        if (brandID) {
            charts = charts.filter(chart => chart.brandID === brandID);
        }

        res.status(200).json({
            success: true,
            data: charts,
        });
    } catch (error) {
        console.error('Error in listSizeCharts:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};

const deleteSizeChart = async (req, res) => {
    try {
        const { id } = req.params;
        const nullify = req.query.nullify === 'true' || req.query.nullify === '1';
        const brandID = req.user?.role === 'brand' ? req.user.uid : null;

        // Fetch size chart by ID
        const chart = await sizeChartService.getSizeChartByID(id);
        if (!chart) {
            return res.status(404).json({
                success: false,
                message: 'Size chart not found',
            });
        }

        // If it's a brand user, verify ownership
        if (brandID && chart.brandID !== brandID) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to delete this size chart',
            });
        }

        // Check for products using this size chart (by imgUrl)
        const products = await sizeChartService.getProductsUsingSizeChart(chart.imgUrl);

        if (products.length > 0 && !nullify) {
            return res.status(200).json({
                success: false,
                inUse: true,
                products,
                message: 'Size chart is in use by products',
            });
        }

        // Proceed to delete (with nullification if confirmed)
        if (products.length > 0 && nullify) {
            await sizeChartService.nullifyProductsSizeChart(chart.imgUrl);
        }

        const deleted = await sizeChartService.deleteSizeChart(id);
        if (!deleted) {
            return res.status(500).json({
                success: false,
                message: 'Failed to delete size chart from database',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Size chart deleted successfully',
        });
    } catch (error) {
        console.error('Error in deleteSizeChart:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};

module.exports = {
    createSizeChart,
    listSizeCharts,
    deleteSizeChart,
};

