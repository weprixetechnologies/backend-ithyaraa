const db = require('../utils/dbconnect');

let tableEnsuredPromise = null;
const ensureTable = async () => {
    if (!tableEnsuredPromise) {
        tableEnsuredPromise = (async () => {
            try {
                await db.query(`
                    CREATE TABLE IF NOT EXISTS homepage_tag_sections (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        title VARCHAR(255) NOT NULL,
                        tag VARCHAR(100) NOT NULL UNIQUE,
                        description TEXT DEFAULT NULL,
                        position INT DEFAULT 0,
                        isActive TINYINT(1) DEFAULT 1,
                        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                `);
            } catch (err) {
                console.error('Error ensuring homepage_tag_sections table:', err);
                tableEnsuredPromise = null; // reset so it retries on next call if failed
            }
        })();
    }
    return tableEnsuredPromise;
};

/**
 * Create a new tag section
 */
const createTagSection = async ({ title, tag, description = null, position = 0, isActive = 1 }) => {
    await ensureTable();
    try {
        const cleanTag = String(tag).trim().toLowerCase().replace(/\s+/g, '_');
        const [result] = await db.query(
            `INSERT INTO homepage_tag_sections (title, tag, description, position, isActive)
             VALUES (?, ?, ?, ?, ?)`,
            [title, cleanTag, description, position, isActive ? 1 : 0]
        );
        return { success: true, id: result.insertId, tag: cleanTag };
    } catch (error) {
        console.error('Error creating homepage tag section:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all tag sections with product count
 */
const getAllTagSections = async () => {
    await ensureTable();
    try {
        const [sections] = await db.query(
            `SELECT id, title, tag, description, position, isActive, createdAt, updatedAt
             FROM homepage_tag_sections
             ORDER BY position ASC, createdAt DESC`
        );

        // Fetch count of tagged products for each section
        const enriched = await Promise.all(
            sections.map(async (sec) => {
                const tagPattern = `%${sec.tag}%`;
                const [countRows] = await db.query(
                    `SELECT COUNT(*) AS productCount 
                     FROM products 
                     WHERE (sectionid = ? OR sectionid LIKE ? OR FIND_IN_SET(?, sectionid)) 
                       AND isDeleted = 0`,
                    [sec.tag, tagPattern, sec.tag]
                );
                return {
                    ...sec,
                    isActive: Boolean(sec.isActive),
                    productCount: countRows[0]?.productCount || 0
                };
            })
        );

        return { success: true, data: enriched };
    } catch (error) {
        console.error('Error getting homepage tag sections:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get section by tag or ID
 */
const getTagSectionByTag = async (tag) => {
    try {
        const cleanTag = String(tag).trim().toLowerCase();
        const [rows] = await db.query(
            `SELECT * FROM homepage_tag_sections WHERE tag = ? OR id = ? LIMIT 1`,
            [cleanTag, cleanTag]
        );
        if (rows.length === 0) return null;
        return { ...rows[0], isActive: Boolean(rows[0].isActive) };
    } catch (error) {
        console.error('Error getting tag section by tag:', error);
        return null;
    }
};

/**
 * Update tag section
 */
const updateTagSection = async (id, { title, tag, description, position, isActive }) => {
    try {
        const updates = [];
        const values = [];

        if (title !== undefined) { updates.push('title = ?'); values.push(title); }
        if (tag !== undefined) {
            const cleanTag = String(tag).trim().toLowerCase().replace(/\s+/g, '_');
            updates.push('tag = ?');
            values.push(cleanTag);
        }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (position !== undefined) { updates.push('position = ?'); values.push(position); }
        if (isActive !== undefined) { updates.push('isActive = ?'); values.push(isActive ? 1 : 0); }

        if (updates.length === 0) return { success: false, message: 'No fields to update' };

        values.push(id);
        const [result] = await db.query(
            `UPDATE homepage_tag_sections SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        return { success: result.affectedRows > 0 };
    } catch (error) {
        console.error('Error updating tag section:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Delete tag section
 */
const deleteTagSection = async (id) => {
    try {
        const [result] = await db.query('DELETE FROM homepage_tag_sections WHERE id = ?', [id]);
        return { success: result.affectedRows > 0 };
    } catch (error) {
        console.error('Error deleting tag section:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get products assigned to a section tag
 */
const getProductsByTag = async (tag, { page = 1, limit = 50 } = {}) => {
    try {
        const cleanTag = String(tag).trim().toLowerCase();
        const tagPattern = `%${cleanTag}%`;
        const offset = (page - 1) * limit;

        const [rows] = await db.query(
            `SELECT productID, name, sectionid, regularPrice, salePrice, discountType, discountValue,
                    offerID, featuredImage, brand, categories, type, status, createdAt
             FROM products
             WHERE (sectionid = ? OR sectionid LIKE ? OR FIND_IN_SET(?, sectionid))
               AND isDeleted = 0
             ORDER BY createdAt DESC
             LIMIT ? OFFSET ?`,
            [cleanTag, tagPattern, cleanTag, Number(limit), Number(offset)]
        );

        const [countRows] = await db.query(
            `SELECT COUNT(*) as total
             FROM products
             WHERE (sectionid = ? OR sectionid LIKE ? OR FIND_IN_SET(?, sectionid))
               AND isDeleted = 0`,
            [cleanTag, tagPattern, cleanTag]
        );

        const parsedProducts = rows.map(p => {
            let featuredImage = p.featuredImage;
            let categories = p.categories;
            try { if (typeof featuredImage === 'string') featuredImage = JSON.parse(featuredImage); } catch (_) {}
            try { if (typeof categories === 'string') categories = JSON.parse(categories); } catch (_) {}
            return { ...p, featuredImage, categories };
        });

        return {
            success: true,
            data: parsedProducts,
            total: countRows[0]?.total || 0,
            page,
            limit
        };
    } catch (error) {
        console.error('Error fetching products by tag:', error);
        return { success: false, error: error.message, data: [], total: 0 };
    }
};

/**
 * Bulk add tag to selected products
 */
const bulkAddTagToProducts = async (tag, productIDs) => {
    if (!Array.isArray(productIDs) || productIDs.length === 0) {
        return { success: false, message: 'No productIDs provided' };
    }

    const cleanTag = String(tag).trim().toLowerCase().replace(/\s+/g, '_');
    try {
        const placeholders = productIDs.map(() => '?').join(',');
        const [products] = await db.query(
            `SELECT productID, sectionid FROM products WHERE productID IN (${placeholders})`,
            productIDs
        );

        for (const prod of products) {
            let currentSec = (prod.sectionid || '').trim();
            const tagsList = currentSec ? currentSec.split(',').map(t => t.trim()) : [];
            if (!tagsList.includes(cleanTag)) {
                tagsList.push(cleanTag);
                const updatedSec = tagsList.filter(Boolean).join(',');
                await db.query(
                    `UPDATE products SET sectionid = ? WHERE productID = ?`,
                    [updatedSec, prod.productID]
                );
            }
        }

        return { success: true, updatedCount: products.length, tag: cleanTag };
    } catch (error) {
        console.error('Error bulk tagging products:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Bulk remove tag from selected products
 */
const bulkRemoveTagFromProducts = async (tag, productIDs) => {
    if (!Array.isArray(productIDs) || productIDs.length === 0) {
        return { success: false, message: 'No productIDs provided' };
    }

    const cleanTag = String(tag).trim().toLowerCase().replace(/\s+/g, '_');
    try {
        const placeholders = productIDs.map(() => '?').join(',');
        const [products] = await db.query(
            `SELECT productID, sectionid FROM products WHERE productID IN (${placeholders})`,
            productIDs
        );

        for (const prod of products) {
            let currentSec = (prod.sectionid || '').trim();
            if (!currentSec) continue;
            const tagsList = currentSec.split(',').map(t => t.trim()).filter(t => t && t !== cleanTag);
            const updatedSec = tagsList.join(',');
            await db.query(
                `UPDATE products SET sectionid = ? WHERE productID = ?`,
                [updatedSec, prod.productID]
            );
        }

        return { success: true, updatedCount: products.length, tag: cleanTag };
    } catch (error) {
        console.error('Error bulk untagging products:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    createTagSection,
    getAllTagSections,
    getTagSectionByTag,
    updateTagSection,
    deleteTagSection,
    getProductsByTag,
    bulkAddTagToProducts,
    bulkRemoveTagFromProducts
};
