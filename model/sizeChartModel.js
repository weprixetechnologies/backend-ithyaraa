const db = require('../utils/dbconnect');

async function createSizeChart({ chartName, imgUrl }) {
    const [result] = await db.query(
        `INSERT INTO size_charts (chartName, imgUrl) VALUES (?, ?)`,
        [chartName, imgUrl]
    );
    return { id: result.insertId, chartName, imgUrl };
}

async function listSizeCharts() {
    const [rows] = await db.query(
        `SELECT id, chartName, imgUrl, createdAt, updatedAt FROM size_charts ORDER BY createdAt DESC`
    );
    return rows;
}

module.exports = {
    createSizeChart,
    listSizeCharts,
};

