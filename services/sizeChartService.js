const sizeChartModel = require('../model/sizeChartModel');

async function createSizeChart(payload) {
    const { chartName, imgUrl } = payload || {};

    if (!chartName || !chartName.trim()) {
        const err = new Error('chartName is required');
        err.statusCode = 400;
        throw err;
    }
    if (!imgUrl || !imgUrl.trim()) {
        const err = new Error('imgUrl is required');
        err.statusCode = 400;
        throw err;
    }

    const chart = await sizeChartModel.createSizeChart({
        chartName: chartName.trim(),
        imgUrl: imgUrl.trim(),
    });

    return chart;
}

async function listSizeCharts() {
    const charts = await sizeChartModel.listSizeCharts();
    return charts;
}

module.exports = {
    createSizeChart,
    listSizeCharts,
};

