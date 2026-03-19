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
        `SELECT id, chartName, imgUrl, brandID, createdAt, updatedAt FROM size_charts ORDER BY createdAt DESC`
    );
    return rows;
}

module.exports = {
    createSizeChart,
    listSizeCharts,
};

