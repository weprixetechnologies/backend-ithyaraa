const sizeChartModel = require('../model/sizeChartModel');

async function createSizeChart(payload) {
    const { chartName, imgUrl, brandID = null } = payload || {};

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
        brandID: brandID ? String(brandID).trim() : null
    });

    return chart;
}

async function listSizeCharts() {
    const charts = await sizeChartModel.listSizeCharts();
    return charts;
}

async function getSizeChartByID(id) {
    return sizeChartModel.getSizeChartByID(id);
}

async function getProductsUsingSizeChart(imgUrl) {
    return sizeChartModel.getProductsUsingSizeChart(imgUrl);
}

async function nullifyProductsSizeChart(imgUrl) {
    return sizeChartModel.nullifyProductsSizeChart(imgUrl);
}

async function deleteSizeChart(id) {
    return sizeChartModel.deleteSizeChart(id);
}

module.exports = {
    createSizeChart,
    listSizeCharts,
    getSizeChartByID,
    getProductsUsingSizeChart,
    nullifyProductsSizeChart,
    deleteSizeChart,
};

