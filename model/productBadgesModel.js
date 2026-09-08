const db = require('../utils/dbconnect');

const getAllBadges = async () => {
    const [rows] = await db.query(`
        SELECT 
            b.*,
            COUNT(pm.productID) as productCount
        FROM product_badges b
        LEFT JOIN product_badge_mappings pm ON pm.badgeID = b.id
        GROUP BY b.id
        ORDER BY b.displayOrder ASC, b.createdAt DESC
    `);
    return rows;
};

const getBadgeById = async (id) => {
    const [rows] = await db.query(`SELECT * FROM product_badges WHERE id = ?`, [id]);
    return rows[0] || null;
};

const createBadge = async ({ name, bgColor, textColor, icon, isActive, displayOrder }) => {
    const [result] = await db.query(
        `INSERT INTO product_badges (name, bgColor, textColor, icon, isActive, displayOrder) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, bgColor || '#ef4444', textColor || '#ffffff', icon || '🔥', isActive ?? 1, displayOrder || 0]
    );
    return result.insertId;
};

const updateBadge = async (id, { name, bgColor, textColor, icon, isActive, displayOrder }) => {
    const [result] = await db.query(
        `UPDATE product_badges 
         SET name = ?, bgColor = ?, textColor = ?, icon = ?, isActive = ?, displayOrder = ?
         WHERE id = ?`,
        [name, bgColor, textColor, icon, isActive, displayOrder, id]
    );
    return result.affectedRows > 0;
};

const deleteBadge = async (id) => {
    const [result] = await db.query(`DELETE FROM product_badges WHERE id = ?`, [id]);
    return result.affectedRows > 0;
};

const getBadgeProducts = async (badgeID) => {
    const [assignedRows] = await db.query(`
        SELECT 
            p.productID, 
            p.name, 
            p.featuredImage, 
            p.salePrice, 
            p.regularPrice, 
            p.type,
            p.brand
        FROM product_badge_mappings pm
        JOIN products p ON p.productID = pm.productID
        WHERE pm.badgeID = ? AND p.isDeleted = 0
        ORDER BY pm.createdAt DESC
    `, [badgeID]);

    return assignedRows;
};

const syncBadgeProducts = async (badgeID, productIDs) => {
    // Begin connection transaction for safety
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Remove existing mappings for this badge
        await connection.query(`DELETE FROM product_badge_mappings WHERE badgeID = ?`, [badgeID]);

        // Insert new mappings if any provided
        if (Array.isArray(productIDs) && productIDs.length > 0) {
            const values = productIDs.map(pid => [badgeID, pid]);
            await connection.query(
                `INSERT INTO product_badge_mappings (badgeID, productID) VALUES ?`,
                [values]
            );
        }

        await connection.commit();
        return true;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

const getActiveProductBadges = async () => {
    const [rows] = await db.query(`
        SELECT 
            b.id AS badgeID,
            b.name,
            b.bgColor,
            b.textColor,
            b.icon,
            b.displayOrder,
            pm.productID
        FROM product_badges b
        JOIN product_badge_mappings pm ON pm.badgeID = b.id
        JOIN products p ON p.productID = pm.productID
        WHERE b.isActive = 1 AND p.isDeleted = 0
        ORDER BY b.displayOrder ASC, b.id ASC
    `);

    // Group badges by productID
    const badgesByProduct = {};
    for (const row of rows) {
        if (!badgesByProduct[row.productID]) {
            badgesByProduct[row.productID] = [];
        }
        badgesByProduct[row.productID].push({
            id: row.badgeID,
            name: row.name,
            bgColor: row.bgColor,
            textColor: row.textColor,
            icon: row.icon
        });
    }

    return badgesByProduct;
};

module.exports = {
    getAllBadges,
    getBadgeById,
    createBadge,
    updateBadge,
    deleteBadge,
    getBadgeProducts,
    syncBadgeProducts,
    getActiveProductBadges
};
