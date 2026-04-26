const db = require('../utils/dbconnect');

/**
 * Add a featured block
 */
const create = async ({ image_url, routeTo, minPrice, maxPrice, category, offer, position }) => {
    try {
        const [result] = await db.query(
            `INSERT INTO featured_blocks (image_url, routeTo, minPrice, maxPrice, category, offer, position) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [image_url, routeTo || 'shop', minPrice || null, maxPrice || null, category || null, offer || null, position ?? 0]
        );
        return { success: true, id: result.insertId };
    } catch (error) {
        console.error('Error creating featured block:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all featured blocks for public/frontend, ordered by position
 */
const getActive = async () => {
    try {
        const [rows] = await db.query(
            `SELECT id, image_url, routeTo, minPrice, maxPrice, category, offer, position, createdAt
             FROM featured_blocks
             ORDER BY position ASC
             LIMIT 4`
        );
        return {
            success: true,
            data: rows
        };
    } catch (error) {
        console.error('Error getting featured blocks:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all featured blocks with full rows (for admin list)
 */
const getAll = async () => {
    try {
        const [rows] = await db.query(
            `SELECT id, image_url, routeTo, minPrice, maxPrice, category, offer, position, createdAt, updatedAt 
             FROM featured_blocks
             ORDER BY position ASC`
        );
        return { success: true, data: rows };
    } catch (error) {
        console.error('Error getting all featured blocks:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Delete a featured block by id
 */
const deleteById = async (id) => {
    try {
        const [result] = await db.query('DELETE FROM featured_blocks WHERE id = ?', [id]);
        return { success: true, deleted: result.affectedRows > 0 };
    } catch (error) {
        console.error('Error deleting featured block:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Update a featured block
 */
const updateById = async (id, { image_url, routeTo, minPrice, maxPrice, category, offer, position }) => {
    try {
        let sql = `UPDATE featured_blocks SET routeTo = ?, minPrice = ?, maxPrice = ?, category = ?, offer = ?, position = ?`;
        const params = [routeTo || 'shop', minPrice || null, maxPrice || null, category || null, offer || null, position ?? 0];
        
        if (image_url) {
            sql += `, image_url = ?`;
            params.push(image_url);
        }
        
        sql += ` WHERE id = ?`;
        params.push(id);

        const [result] = await db.query(sql, params);
        return { success: true, updated: result.affectedRows > 0 };
    } catch (error) {
        console.error('Error updating featured block:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Update positions (bulk reorder)
 */
const reorder = async (order) => {
    if (!Array.isArray(order) || order.length === 0) {
        return { success: false, error: 'Invalid order array.' };
    }
    try {
        for (let i = 0; i < order.length; i++) {
            await db.query('UPDATE featured_blocks SET position = ? WHERE id = ?', [i, order[i]]);
        }
        return { success: true };
    } catch (error) {
        console.error('Error reordering featured blocks:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    create,
    getActive,
    getAll,
    deleteById,
    updateById,
    reorder
};
