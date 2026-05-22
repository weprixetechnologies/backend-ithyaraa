const db = require('../utils/dbconnect');

async function createSizeChart({ chartName, imgUrl, brandID = null }) {
    const [result] = await db.query(
        `INSERT INTO size_charts (chartName, imgUrl, brandID) VALUES (?, ?, ?)`,
        [chartName, imgUrl, brandID]
    );
    return { id: result.insertId, chartName, imgUrl, brandID };
}

async function listSizeCharts() {
    const [rows] = await db.query(
        `SELECT id, chartName, imgUrl, brandID FROM size_charts`
    );
    return rows;
}

async function getSizeChartByID(id) {
    const [rows] = await db.query(
        `SELECT id, chartName, imgUrl, brandID FROM size_charts WHERE id = ?`,
        [id]
    );
    return rows[0] || null;
}

async function getProductsUsingSizeChart(imgUrl) {
    const [products] = await db.query(
        `SELECT productID, name, 'standard' as productType FROM products WHERE sizeChartUrl = ?`,
        [imgUrl]
    );
    const [presaleProducts] = await db.query(
        `SELECT presaleProductID as productID, name, 'presale' as productType FROM presale_products WHERE sizeChartUrl = ?`,
        [imgUrl]
    );
    return [...products, ...presaleProducts];
}

async function nullifyProductsSizeChart(imgUrl) {
    await db.query(
        `UPDATE products SET sizeChartUrl = NULL WHERE sizeChartUrl = ?`,
        [imgUrl]
    );
    await db.query(
        `UPDATE presale_products SET sizeChartUrl = NULL WHERE sizeChartUrl = ?`,
        [imgUrl]
    );
}

async function deleteSizeChart(id) {
    const [result] = await db.query(
        `DELETE FROM size_charts WHERE id = ?`,
        [id]
    );
    return result.affectedRows > 0;
}

module.exports = {
    createSizeChart,
    listSizeCharts,
    getSizeChartByID,
    getProductsUsingSizeChart,
    nullifyProductsSizeChart,
    deleteSizeChart,
};

