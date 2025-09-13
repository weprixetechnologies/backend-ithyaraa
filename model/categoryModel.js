const db = require('../utils/dbconnect');

const insertCategory = async ({ categoryName, featuredImage, count, categoryBanner, slug }) => {
    const query = `
        INSERT INTO categories (categoryName, featuredImage, count, categoryBanner, slug)
        VALUES (?, ?, ?, ?,?)
    `;
    const [result] = await db.query(query, [categoryName, featuredImage, count, categoryBanner, slug]);
    return result.insertId;
};

const getFilteredCategories = async ({ filters, page, limit }) => {
    const values = [];
    let whereClause = '';

    // Optional filters
    if (filters.categoryName) {
        whereClause += 'WHERE categoryName LIKE ? ';
        values.push(`%${filters.categoryName}%`);
    }

    const offset = (page - 1) * limit;

    // Query for paginated data only
    const dataQuery = `
        SELECT * FROM categories 
        ${whereClause}
        ORDER BY createdOn DESC
        LIMIT ? OFFSET ?
    `;
    const [data] = await db.query(dataQuery, [...values, limit, offset]);

    return {
        data
        // no total count
    };
};

const getCategoryByID = async (categoryID) => {
    const [rows] = await db.query(
        'SELECT * FROM categories WHERE categoryID = ?',
        [categoryID]
    );
    return rows[0] || null;
};

const updateCategoryByID = async ({
    categoryID,
    categoryName,
    slug,
    featuredImage,
    categoryBanner
}) => {
    const [result] = await db.query(
        `
        UPDATE categories
        SET 
            categoryName = ?, 
            slug = ?, 
            featuredImage = ?, 
            categoryBanner = ?
        WHERE categoryID = ?
        `,
        [categoryName, slug, featuredImage, categoryBanner, categoryID]
    );

    return result.affectedRows > 0;
};


module.exports = {
    getCategoryByID,
    insertCategory,
    getFilteredCategories,
    updateCategoryByID
};

// Fetch all categories: categoryID and categoryName only
async function getAllCategoryNamesIDs() {
    const [rows] = await db.query(
        `SELECT categoryID, categoryName FROM categories ORDER BY categoryName ASC`
    );
    return rows || [];
}

module.exports.getAllCategoryNamesIDs = getAllCategoryNamesIDs;
