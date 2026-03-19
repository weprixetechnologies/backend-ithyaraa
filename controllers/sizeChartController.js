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
        const status = error.statusCode || 400;
        res.status(status).json({
            success: false,
            message: error.message,
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
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    createSizeChart,
    listSizeCharts,
};

