const db = require('../utils/dbconnect');

let isProductOrderChecked = false;
const ensureProductOrderColumn = async () => {
    if (isProductOrderChecked) return;
    try {
        const [columns] = await db.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'homepage_tag_sections' 
               AND COLUMN_NAME = 'productOrder'`
        );
        if (columns.length === 0) {
            console.log('[Migration] Auto-adding productOrder column to homepage_tag_sections...');
            await db.query(`ALTER TABLE homepage_tag_sections ADD COLUMN productOrder JSON DEFAULT NULL`);
            console.log('[Migration] productOrder column auto-added to homepage_tag_sections.');
        }
        isProductOrderChecked = true;
    } catch (e) {
        console.error('ensureProductOrderColumn notice:', e.message);
    }
};

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
                        productOrder JSON DEFAULT NULL,
                        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                `);
                await ensureProductOrderColumn();

                // Check if table is empty and seed default sections if needed
                const [existing] = await db.query(`SELECT COUNT(*) as cnt FROM homepage_tag_sections`);
                if (existing[0]?.cnt === 0) {
                    console.log('[homepage_tag_sections] Seeding default section tags...');
                    await db.query(`
                        INSERT INTO homepage_tag_sections (title, tag, description, position, isActive)
                        VALUES 
                        ('Curated With Brands', 'brand_picks', 'Timeless Collections You\\'ll Love', 1, 1),
                        ('The New Edit', 'new_arrivals', 'Collections You Will Definitely Love', 2, 1),
                        ('Trending Picks', 'dress_month', 'Our Curated Dress of the Month', 3, 1)
                    `);
                }
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
            `SELECT id, title, tag, description, position, isActive, productOrder, createdAt, updatedAt
             FROM homepage_tag_sections
             ORDER BY position ASC, createdAt DESC`
        );

        // Fetch count of tagged products for each section
        const enriched = await Promise.all(
            sections.map(async (sec) => {
                const cleanTag = String(sec.tag).trim().toLowerCase();
                const [countRows] = await db.query(
                    `SELECT COUNT(*) AS productCount 
                     FROM products 
                     WHERE (sectionid = ? OR FIND_IN_SET(?, REPLACE(sectionid, ' ', ''))) 
                       AND isDeleted = 0`,
                    [cleanTag, cleanTag]
                );

                let parsedOrder = [];
                if (sec.productOrder) {
                    try {
                        parsedOrder = typeof sec.productOrder === 'string'
                            ? JSON.parse(sec.productOrder)
                            : sec.productOrder;
                        if (!Array.isArray(parsedOrder)) parsedOrder = [];
                    } catch (_) {
                        parsedOrder = [];
                    }
                }

                return {
                    ...sec,
                    isActive: Boolean(sec.isActive),
                    productOrder: parsedOrder,
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
 * Reorder products assigned to a section tag
 */
const reorderSectionProducts = async (tag, productIDs) => {
    await ensureTable();
    await ensureProductOrderColumn();
    try {
        const cleanTag = String(tag).trim().toLowerCase();
        const cleanIDs = Array.isArray(productIDs) ? productIDs.map(String) : [];
        const jsonStr = JSON.stringify(cleanIDs);

        const [result] = await db.query(
            `UPDATE homepage_tag_sections SET productOrder = ? WHERE tag = ? OR id = ?`,
            [jsonStr, cleanTag, cleanTag]
        );

        return {
            success: result.affectedRows > 0,
            tag: cleanTag,
            productOrder: cleanIDs
        };
    } catch (error) {
        console.error('Error in reorderSectionProducts model:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get products assigned to a section tag (respecting custom productOrder)
 */
const getProductsByTag = async (tag, { page = 1, limit = 50 } = {}) => {
    await ensureTable();
    await ensureProductOrderColumn();
    try {
        const cleanTag = String(tag).trim().toLowerCase();
        const offset = (page - 1) * limit;

        // Fetch section's custom product order if available
        const [secRows] = await db.query(
            `SELECT productOrder FROM homepage_tag_sections WHERE tag = ? OR id = ? LIMIT 1`,
            [cleanTag, cleanTag]
        );
        let customOrder = [];
        if (secRows.length > 0 && secRows[0].productOrder) {
            try {
                customOrder = typeof secRows[0].productOrder === 'string'
                    ? JSON.parse(secRows[0].productOrder)
                    : secRows[0].productOrder;
                if (!Array.isArray(customOrder)) customOrder = [];
            } catch (_) {
                customOrder = [];
            }
        }

        const [rows] = await db.query(
            `SELECT productID, name, sectionid, regularPrice, salePrice, discountType, discountValue,
                    offerID, featuredImage, brand, categories, type, status, createdAt
             FROM products
             WHERE (sectionid = ? OR FIND_IN_SET(?, REPLACE(sectionid, ' ', '')))
               AND isDeleted = 0`,
            [cleanTag, cleanTag]
        );

        const [countRows] = await db.query(
            `SELECT COUNT(*) as total
             FROM products
             WHERE (sectionid = ? OR FIND_IN_SET(?, REPLACE(sectionid, ' ', '')))
               AND isDeleted = 0`,
            [cleanTag, cleanTag]
        );

        // Sort products using customOrder if defined, falling back to createdAt DESC
        let sortedRows = rows;
        if (customOrder.length > 0) {
            const orderMap = new Map();
            customOrder.forEach((id, idx) => orderMap.set(String(id), idx));

            sortedRows = [...rows].sort((a, b) => {
                const idxA = orderMap.has(String(a.productID)) ? orderMap.get(String(a.productID)) : 999999;
                const idxB = orderMap.has(String(b.productID)) ? orderMap.get(String(b.productID)) : 999999;
                if (idxA !== idxB) return idxA - idxB;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
        } else {
            sortedRows = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        const paginatedRows = sortedRows.slice(offset, offset + Number(limit));

        const parsedProducts = paginatedRows.map(p => {
            let featuredImage = p.featuredImage;
            let categories = p.categories;
            try { if (typeof featuredImage === 'string') featuredImage = JSON.parse(featuredImage); } catch (_) {}
            try { if (typeof categories === 'string') categories = JSON.parse(categories); } catch (_) {}
            return { ...p, featuredImage, categories };
        });

        return {
            success: true,
            data: parsedProducts,
            total: countRows[0]?.total || sortedRows.length,
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

/**
 * Get all active tag sections along with their tagged products (respecting custom productOrder)
 */
const getActiveTagSectionsWithProducts = async (productLimit = 20) => {
    await ensureTable();
    await ensureProductOrderColumn();
    try {
        const [sections] = await db.query(
            `SELECT id, title, tag, description, position, isActive, productOrder, createdAt, updatedAt
             FROM homepage_tag_sections
             WHERE isActive = 1
             ORDER BY position ASC, createdAt DESC`
        );

        if (sections.length === 0) {
            return { success: true, data: [] };
        }

        const enriched = await Promise.all(
            sections.map(async (sec) => {
                const cleanTag = String(sec.tag).trim().toLowerCase();

                let customOrder = [];
                if (sec.productOrder) {
                    try {
                        customOrder = typeof sec.productOrder === 'string'
                            ? JSON.parse(sec.productOrder)
                            : sec.productOrder;
                        if (!Array.isArray(customOrder)) customOrder = [];
                    } catch (_) {
                        customOrder = [];
                    }
                }

                const [rows] = await db.query(
                    `SELECT productID, name, sectionid, regularPrice, salePrice, discountType, discountValue,
                            offerID, featuredImage, brand, categories, type, status, createdAt
                     FROM products
                     WHERE (sectionid = ? OR FIND_IN_SET(?, REPLACE(sectionid, ' ', '')))
                       AND isDeleted = 0`,
                    [cleanTag, cleanTag]
                );

                let sortedRows = rows;
                if (customOrder.length > 0) {
                    const orderMap = new Map();
                    customOrder.forEach((id, idx) => orderMap.set(String(id), idx));

                    sortedRows = [...rows].sort((a, b) => {
                        const idxA = orderMap.has(String(a.productID)) ? orderMap.get(String(a.productID)) : 999999;
                        const idxB = orderMap.has(String(b.productID)) ? orderMap.get(String(b.productID)) : 999999;
                        if (idxA !== idxB) return idxA - idxB;
                        return new Date(b.createdAt) - new Date(a.createdAt);
                    });
                } else {
                    sortedRows = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                }

                const limitedRows = sortedRows.slice(0, Number(productLimit));

                const parsedProducts = limitedRows.map(p => {
                    let featuredImage = p.featuredImage;
                    let categories = p.categories;
                    try { if (typeof featuredImage === 'string') featuredImage = JSON.parse(featuredImage); } catch (_) {}
                    try { if (typeof categories === 'string') categories = JSON.parse(categories); } catch (_) {}
                    return { ...p, featuredImage, categories };
                });

                return {
                    id: sec.id,
                    title: sec.title,
                    tag: sec.tag,
                    description: sec.description,
                    position: sec.position,
                    isActive: Boolean(sec.isActive),
                    products: parsedProducts
                };
            })
        );

        return { success: true, data: enriched };
    } catch (error) {
        console.error('Error in getActiveTagSectionsWithProducts:', error);
        return { success: false, error: error.message, data: [] };
    }
};

module.exports = {
    createTagSection,
    getAllTagSections,
    getTagSectionByTag,
    updateTagSection,
    deleteTagSection,
    getProductsByTag,
    reorderSectionProducts,
    bulkAddTagToProducts,
    bulkRemoveTagFromProducts,
    getActiveTagSectionsWithProducts
};
