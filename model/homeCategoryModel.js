const db = require('../utils/dbconnect');

// Insert or update a home category tile (one per categoryID)
async function upsertHomeCategory({ categoryID, imageUrl, sortOrder = null }) {
    // sortOrder is optional; when null, let DB default or use id ordering
    await db.query(
        `INSERT INTO home_categories (categoryID, imageUrl, sortOrder)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE imageUrl = VALUES(imageUrl),
                                 sortOrder = COALESCE(VALUES(sortOrder), sortOrder)`,
        [categoryID, imageUrl, sortOrder]
    );
    return true;
}

// Fetch all home category tiles joined with category name
async function getAllHomeCategories() {
    const [rows] = await db.query(
        `SELECT hc.categoryID, hc.imageUrl, c.categoryName
         FROM home_categories hc
         INNER JOIN categories c ON c.categoryID = hc.categoryID
         ORDER BY COALESCE(hc.sortOrder, hc.id) ASC`
    );
    return rows || [];
}

module.exports = {
    upsertHomeCategory,
    getAllHomeCategories,
};

