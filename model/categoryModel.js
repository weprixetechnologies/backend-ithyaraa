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

const getBrandsByCategoryID = async (categoryID) => {
    const catIDStr = String(categoryID);
    const queryExternal = `
        SELECT DISTINCT 
            u.uid, 
            u.username, 
            u.emailID,
            u.name, 
            u.profilePhoto, 
            u.verifiedEmail
        FROM users u
        JOIN products p ON (
            p.brandID = u.uid 
            OR p.brand = u.uid 
            OR (p.brand COLLATE utf8mb4_general_ci = u.name COLLATE utf8mb4_general_ci)
            OR (p.brand COLLATE utf8mb4_general_ci = u.username COLLATE utf8mb4_general_ci)
            OR (p.brandID COLLATE utf8mb4_general_ci = u.username COLLATE utf8mb4_general_ci)
        )
        WHERE (LOWER(CAST(u.role AS CHAR)) = 'brand' OR u.role IS NULL)
          AND (p.isDeleted = 0 OR p.isDeleted IS NULL)
          AND (p.status != 'inactive' OR p.status IS NULL)
          AND (
            JSON_CONTAINS(p.categories, JSON_OBJECT('categoryID', CAST(? AS UNSIGNED)))
            OR JSON_CONTAINS(p.categories, JSON_OBJECT('categoryID', CAST(? AS CHAR)))
            OR JSON_CONTAINS(p.categories, JSON_QUOTE(CAST(? AS CHAR)))
            OR JSON_CONTAINS(p.categories, JSON_ARRAY(CAST(? AS CHAR)))
            OR (CAST(p.categories AS CHAR) COLLATE utf8mb4_general_ci LIKE CONCAT('%"categoryid":', ?, '%'))
            OR (CAST(p.categories AS CHAR) COLLATE utf8mb4_general_ci LIKE CONCAT('%"categoryid":"', ?, '"%'))
          )
        ORDER BY u.name ASC
    `;

    const queryInHouse = `
        SELECT COUNT(*) as inhouseCount
        FROM products p
        LEFT JOIN users u ON (
            p.brandID = u.uid 
            OR p.brand = u.uid 
            OR (p.brand COLLATE utf8mb4_general_ci = u.name COLLATE utf8mb4_general_ci)
            OR (p.brand COLLATE utf8mb4_general_ci = u.username COLLATE utf8mb4_general_ci)
            OR (p.brandID COLLATE utf8mb4_general_ci = u.username COLLATE utf8mb4_general_ci)
        )
        WHERE (p.isDeleted = 0 OR p.isDeleted IS NULL)
          AND (p.status != 'inactive' OR p.status IS NULL)
          AND (
            p.brandID IS NULL 
            OR TRIM(p.brandID) = '' 
            OR p.brand IS NULL 
            OR TRIM(p.brand) = ''
            OR LOWER(CAST(p.brand AS CHAR)) IN ('ithyaraa', 'inhouse', 'in house')
            OR LOWER(CAST(p.brandID AS CHAR)) IN ('ithyaraa', 'inhouse', 'in house')
            OR u.uid IS NULL
          )
          AND (
            JSON_CONTAINS(p.categories, JSON_OBJECT('categoryID', CAST(? AS UNSIGNED)))
            OR JSON_CONTAINS(p.categories, JSON_OBJECT('categoryID', CAST(? AS CHAR)))
            OR JSON_CONTAINS(p.categories, JSON_QUOTE(CAST(? AS CHAR)))
            OR JSON_CONTAINS(p.categories, JSON_ARRAY(CAST(? AS CHAR)))
            OR (CAST(p.categories AS CHAR) COLLATE utf8mb4_general_ci LIKE CONCAT('%"categoryid":', ?, '%'))
            OR (CAST(p.categories AS CHAR) COLLATE utf8mb4_general_ci LIKE CONCAT('%"categoryid":"', ?, '"%'))
          )
    `;

    const [rowsExternal] = await db.query(queryExternal, [catIDStr, catIDStr, catIDStr, catIDStr, catIDStr, catIDStr]);
    const [[{ inhouseCount }]] = await db.query(queryInHouse, [catIDStr, catIDStr, catIDStr, catIDStr, catIDStr, catIDStr]);

    const brands = rowsExternal ? [...rowsExternal] : [];

    if (inhouseCount > 0) {
        const [ithyaraaUserRows] = await db.query(
            `SELECT uid, username, emailID, name, profilePhoto, verifiedEmail 
             FROM users 
             WHERE (LOWER(CAST(username AS CHAR)) = 'ithyaraa' OR LOWER(CAST(name AS CHAR)) = 'ithyaraa')
             LIMIT 1`
        );

        const ithyaraaBrandObj = (ithyaraaUserRows && ithyaraaUserRows.length > 0) ? {
            uid: ithyaraaUserRows[0].uid || "ithyaraa-inhouse",
            username: ithyaraaUserRows[0].username || "ithyaraa",
            emailID: ithyaraaUserRows[0].emailID || "support@ithyaraa.com",
            name: ithyaraaUserRows[0].name || "Ithyaraa",
            profilePhoto: ithyaraaUserRows[0].profilePhoto || "/ithyaraa-logo.png",
            verifiedEmail: ithyaraaUserRows[0].verifiedEmail ?? 1
        } : {
            uid: "ithyaraa-inhouse",
            username: "ithyaraa",
            emailID: "support@ithyaraa.com",
            name: "Ithyaraa",
            profilePhoto: "/ithyaraa-logo.png",
            verifiedEmail: 1
        };

        const exists = brands.some(b => 
            b.uid === ithyaraaBrandObj.uid || 
            b.username?.toLowerCase() === 'ithyaraa' || 
            b.name?.toLowerCase() === 'ithyaraa'
        );

        if (!exists) {
            brands.unshift(ithyaraaBrandObj);
        }
    }

    return brands;
};

const getAllCategoriesBrandsMap = async () => {
    return getMegamenuCategoriesBrands();
};

const getMegamenuCategoriesBrands = async () => {
    const queryExternal = `
        SELECT DISTINCT 
            c.categoryID,
            u.uid, 
            u.username, 
            u.emailID,
            u.name, 
            u.profilePhoto, 
            u.verifiedEmail
        FROM categories c
        JOIN products p ON (
            JSON_CONTAINS(p.categories, JSON_OBJECT('categoryID', c.categoryID))
            OR JSON_CONTAINS(p.categories, JSON_OBJECT('categoryID', CAST(c.categoryID AS CHAR)))
            OR JSON_CONTAINS(p.categories, JSON_QUOTE(CAST(c.categoryID AS CHAR)))
            OR JSON_CONTAINS(p.categories, JSON_ARRAY(c.categoryID))
            OR JSON_CONTAINS(p.categories, JSON_ARRAY(CAST(c.categoryID AS CHAR)))
            OR JSON_CONTAINS(p.categories, JSON_OBJECT('categoryName', c.categoryName))
            OR (CAST(p.categories AS CHAR) COLLATE utf8mb4_general_ci LIKE CONCAT('%"categoryid":', c.categoryID, '%'))
            OR (CAST(p.categories AS CHAR) COLLATE utf8mb4_general_ci LIKE CONCAT('%"categoryid":"', c.categoryID, '"%'))
            OR (LOWER(CAST(p.categories AS CHAR)) COLLATE utf8mb4_general_ci LIKE CONCAT('%"', LOWER(CAST(c.categoryName AS CHAR)) COLLATE utf8mb4_general_ci, '"%'))
        )
        JOIN users u ON (
            p.brandID = u.uid 
            OR p.brand = u.uid 
            OR (p.brand COLLATE utf8mb4_general_ci = u.name COLLATE utf8mb4_general_ci)
            OR (p.brand COLLATE utf8mb4_general_ci = u.username COLLATE utf8mb4_general_ci)
            OR (p.brandID COLLATE utf8mb4_general_ci = u.username COLLATE utf8mb4_general_ci)
        )
        WHERE (LOWER(CAST(u.role AS CHAR)) = 'brand' OR u.role IS NULL)
          AND (p.isDeleted = 0 OR p.isDeleted IS NULL)
          AND (p.status != 'inactive' OR p.status IS NULL)
        ORDER BY c.categoryID ASC, u.name ASC
    `;

    const queryInHouseCategories = `
        SELECT DISTINCT 
            c.categoryID
        FROM categories c
        JOIN products p ON (
            JSON_CONTAINS(p.categories, JSON_OBJECT('categoryID', c.categoryID))
            OR JSON_CONTAINS(p.categories, JSON_OBJECT('categoryID', CAST(c.categoryID AS CHAR)))
            OR JSON_CONTAINS(p.categories, JSON_QUOTE(CAST(c.categoryID AS CHAR)))
            OR JSON_CONTAINS(p.categories, JSON_ARRAY(c.categoryID))
            OR JSON_CONTAINS(p.categories, JSON_ARRAY(CAST(c.categoryID AS CHAR)))
            OR JSON_CONTAINS(p.categories, JSON_OBJECT('categoryName', c.categoryName))
            OR (CAST(p.categories AS CHAR) COLLATE utf8mb4_general_ci LIKE CONCAT('%"categoryid":', c.categoryID, '%'))
            OR (CAST(p.categories AS CHAR) COLLATE utf8mb4_general_ci LIKE CONCAT('%"categoryid":"', c.categoryID, '"%'))
            OR (LOWER(CAST(p.categories AS CHAR)) COLLATE utf8mb4_general_ci LIKE CONCAT('%"', LOWER(CAST(c.categoryName AS CHAR)) COLLATE utf8mb4_general_ci, '"%'))
        )
        LEFT JOIN users u ON (
            p.brandID = u.uid 
            OR p.brand = u.uid 
            OR (p.brand COLLATE utf8mb4_general_ci = u.name COLLATE utf8mb4_general_ci)
            OR (p.brand COLLATE utf8mb4_general_ci = u.username COLLATE utf8mb4_general_ci)
            OR (p.brandID COLLATE utf8mb4_general_ci = u.username COLLATE utf8mb4_general_ci)
        )
        WHERE (p.isDeleted = 0 OR p.isDeleted IS NULL)
          AND (p.status != 'inactive' OR p.status IS NULL)
          AND (
            p.brandID IS NULL 
            OR TRIM(p.brandID) = '' 
            OR p.brand IS NULL 
            OR TRIM(p.brand) = ''
            OR LOWER(CAST(p.brand AS CHAR)) IN ('ithyaraa', 'inhouse', 'in house')
            OR LOWER(CAST(p.brandID AS CHAR)) IN ('ithyaraa', 'inhouse', 'in house')
            OR u.uid IS NULL
          )
    `;

    const [ithyaraaUserRows] = await db.query(
        `SELECT uid, username, emailID, name, profilePhoto, verifiedEmail 
         FROM users 
         WHERE (LOWER(CAST(username AS CHAR)) = 'ithyaraa' OR LOWER(CAST(name AS CHAR)) = 'ithyaraa')
         LIMIT 1`
    );

    const ithyaraaBrandObj = (ithyaraaUserRows && ithyaraaUserRows.length > 0) ? {
        uid: ithyaraaUserRows[0].uid || "ithyaraa-inhouse",
        username: ithyaraaUserRows[0].username || "ithyaraa",
        emailID: ithyaraaUserRows[0].emailID || "support@ithyaraa.com",
        name: ithyaraaUserRows[0].name || "Ithyaraa",
        profilePhoto: ithyaraaUserRows[0].profilePhoto || "/ithyaraa-logo.png",
        verifiedEmail: ithyaraaUserRows[0].verifiedEmail ?? 1
    } : {
        uid: "ithyaraa-inhouse",
        username: "ithyaraa",
        emailID: "support@ithyaraa.com",
        name: "Ithyaraa",
        profilePhoto: "/ithyaraa-logo.png",
        verifiedEmail: 1
    };

    const [rowsExternal] = await db.query(queryExternal);
    const [rowsInHouseCats] = await db.query(queryInHouseCategories);

    const map = {};

    if (Array.isArray(rowsExternal)) {
        for (const row of rowsExternal) {
            const catID = String(row.categoryID);
            if (!map[catID]) map[catID] = [];
            
            const exists = map[catID].some(b => b.uid === row.uid || b.name?.toLowerCase() === row.name?.toLowerCase());
            if (!exists) {
                map[catID].push({
                    uid: row.uid,
                    username: row.username,
                    emailID: row.emailID,
                    name: row.name,
                    profilePhoto: row.profilePhoto,
                    verifiedEmail: row.verifiedEmail
                });
            }
        }
    }

    if (Array.isArray(rowsInHouseCats)) {
        for (const row of rowsInHouseCats) {
            const catID = String(row.categoryID);
            if (!map[catID]) map[catID] = [];

            const exists = map[catID].some(b => 
                b.uid === ithyaraaBrandObj.uid || 
                b.username?.toLowerCase() === 'ithyaraa' || 
                b.name?.toLowerCase() === 'ithyaraa'
            );

            if (!exists) {
                map[catID].unshift(ithyaraaBrandObj);
            }
        }
    }

    return map;
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
    updateFeaturedOrder,
    getBrandsByCategoryID,
    getAllCategoriesBrandsMap,
    getMegamenuCategoriesBrands
};

// Fetch all categories: categoryID and categoryName only
async function getAllCategoryNamesIDs() {
    const [rows] = await db.query(
        `SELECT categoryID, categoryName FROM categories ORDER BY categoryName ASC`
    );
    return rows || [];
}

module.exports.getAllCategoryNamesIDs = getAllCategoryNamesIDs;

