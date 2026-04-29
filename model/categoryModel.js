const db = require('../utils/dbconnect');

const insertCategory = async ({ categoryName, featuredImage, count, categoryBanner, slug, isFeatured }) => {
    const query = `
        INSERT INTO categories (categoryName, featuredImage, count, categoryBanner, slug, isFeatured)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [categoryName, featuredImage, count, categoryBanner, slug, isFeatured || 0]);
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
    categoryBanner,
    isFeatured
}) => {
    const [result] = await db.query(
        `
        UPDATE categories
        SET 
            categoryName = ?, 
            slug = ?, 
            featuredImage = ?, 
            categoryBanner = ?,
            isFeatured = ?
        WHERE categoryID = ?
        `,
        [categoryName, slug, featuredImage, categoryBanner, isFeatured || 0, categoryID]
    );

    return result.affectedRows > 0;
};

const deleteCategoryByID = async (categoryID) => {
    const [result] = await db.query(
        'DELETE FROM categories WHERE categoryID = ?',
        [categoryID]
    );
    return result.affectedRows > 0;
};

const removeCategoryFromProducts = async (categoryID) => {
    // Find all products that contain this category
    const [products] = await db.query(
        `SELECT productID, categories FROM products 
         WHERE JSON_CONTAINS(categories, JSON_OBJECT('categoryID', ?))`,
        [categoryID]
    );

    let updatedCount = 0;

    // Update each product to remove the category
    for (const product of products) {
        try {
            let categories = [];
            if (product.categories) {
                // Parse JSON if it's a string
                categories = typeof product.categories === 'string'
                    ? JSON.parse(product.categories)
                    : product.categories;
            }

            // Filter out the category with matching categoryID (normalize both to numbers for comparison)
            const categoryIDNum = Number(categoryID);
            const updatedCategories = categories.filter(
                cat => Number(cat.categoryID) !== categoryIDNum
            );

            // Update the product with the filtered categories
            await db.query(
                'UPDATE products SET categories = ? WHERE productID = ?',
                [JSON.stringify(updatedCategories), product.productID]
            );
            updatedCount++;
        } catch (error) {
            console.error(`Error updating product ${product.productID}:`, error);
        }
    }

    return updatedCount;
};

const getFeaturedCategories = async () => {
    const query = `
        SELECT * FROM categories 
        WHERE isFeatured = 1 
        ORDER BY featuredOrder ASC, createdOn DESC
    `;
    const [rows] = await db.query(query);
    return rows;
};

const bulkSetFeatured = async (categoryIDs, isFeatured) => {
    if (!categoryIDs || categoryIDs.length === 0) return 0;
    const query = `
        UPDATE categories 
        SET isFeatured = ? 
        WHERE categoryID IN (?)
    `;
    const [result] = await db.query(query, [isFeatured ? 1 : 0, categoryIDs]);
    return result.affectedRows;
};

const updateFeaturedOrder = async (reorderedItems) => {
    // reorderedItems is an array of { categoryID, featuredOrder }
    for (const item of reorderedItems) {
        await db.query(
            'UPDATE categories SET featuredOrder = ? WHERE categoryID = ?',
            [item.featuredOrder, item.categoryID]
        );
    }
    return true;
};

module.exports = {
    getCategoryByID,
    insertCategory,
    getFilteredCategories,
    updateCategoryByID,
    deleteCategoryByID,
    removeCategoryFromProducts,
    getFeaturedCategories,
    bulkSetFeatured,
    updateFeaturedOrder
};

// Fetch all categories: categoryID and categoryName only
async function getAllCategoryNamesIDs() {
    const [rows] = await db.query(
        `SELECT categoryID, categoryName FROM categories ORDER BY categoryName ASC`
    );
    return rows || [];
}

module.exports.getAllCategoryNamesIDs = getAllCategoryNamesIDs;
