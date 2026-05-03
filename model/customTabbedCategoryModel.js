const db = require('../utils/dbconnect');

// Insert or update a custom tabbed category tile
async function upsertCustomTabbedCategory({ categoryID, imageUrl, sortOrder = 0, isActive = 1 }) {
    await db.query(
        `INSERT INTO custom_tabbed_categories (categoryID, imageUrl, sortOrder, isActive)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE imageUrl = VALUES(imageUrl),
                                 sortOrder = VALUES(sortOrder),
                                 isActive = VALUES(isActive)`,
        [categoryID, imageUrl, sortOrder, isActive]
    );
    return true;
}

// Fetch all active custom tabbed categories joined with category name
async function getAllCustomTabbedCategories(onlyActive = true) {
    let query = `
        SELECT ctc.id, ctc.categoryID, ctc.imageUrl, ctc.sortOrder, ctc.isActive, c.categoryName
        FROM custom_tabbed_categories ctc
        INNER JOIN categories c ON c.categoryID = ctc.categoryID
    `;
    
    if (onlyActive) {
        query += ` WHERE ctc.isActive = 1`;
    }
    
    query += ` ORDER BY ctc.sortOrder ASC, ctc.id ASC`;
    
    const [rows] = await db.query(query);
    return rows || [];
}

// Delete a custom tabbed category
async function deleteCustomTabbedCategory(id) {
    await db.query(`DELETE FROM custom_tabbed_categories WHERE id = ?`, [id]);
    return true;
}

module.exports = {
    upsertCustomTabbedCategory,
    getAllCustomTabbedCategories,
    deleteCustomTabbedCategory,
};
