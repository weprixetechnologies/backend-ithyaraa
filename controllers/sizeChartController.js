const sizeChartService = require('../services/sizeChartService');

const createSizeChart = async (req, res) => {
    try {
        const { chartName, imgUrl } = req.body;
        const chart = await sizeChartService.createSizeChart({ chartName, imgUrl });
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
        const charts = await sizeChartService.listSizeCharts();
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

