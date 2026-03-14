const db = require('../utils/dbconnect');

const VALID_TYPES = ['mobile', 'desktop'];

/**
 * Add a slider banner (mobile or desktop)
 */
const create = async ({ type, image_url, position }) => {
    if (!VALID_TYPES.includes(type)) {
        return { success: false, error: 'Invalid type. Use mobile or desktop.' };
    }
    try {
        const [result] = await db.query(
            `INSERT INTO home_slider_banners (type, image_url, position) VALUES (?, ?, ?)`,
            [type, image_url, position ?? 0]
        );
        return { success: true, id: result.insertId };
    } catch (error) {
        console.error('Error creating slider banner:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all banners for public/frontend, grouped by type, ordered by position
 */
const getActiveByType = async () => {
    try {
        const [rows] = await db.query(
            `SELECT id, type, image_url, position, createdAt
             FROM home_slider_banners
             ORDER BY type, position ASC`
        );
        const mobile = rows.filter(r => r.type === 'mobile').map(r => r.image_url);
        const desktop = rows.filter(r => r.type === 'desktop').map(r => r.image_url);
        return {
            success: true,
            data: { mobile, desktop }
        };
    } catch (error) {
        console.error('Error getting slider banners:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all banners with full rows (for admin list)
 */
const getAll = async ({ type } = {}) => {
    try {
        let sql = `SELECT id, type, image_url, position, createdAt, updatedAt FROM home_slider_banners`;
        const params = [];
        if (type && VALID_TYPES.includes(type)) {
            sql += ` WHERE type = ?`;
            params.push(type);
        }
        sql += ` ORDER BY type, position ASC`;
        const [rows] = await db.query(sql, params);
        return { success: true, data: rows };
    } catch (error) {
        console.error('Error getting all slider banners:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Delete a banner by id
 */
const deleteById = async (id) => {
    try {
        const [result] = await db.query('DELETE FROM home_slider_banners WHERE id = ?', [id]);
        return { success: true, deleted: result.affectedRows > 0 };
    } catch (error) {
        console.error('Error deleting slider banner:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Update positions for a type (bulk reorder)
 * payload: { type: 'mobile'|'desktop', order: [id1, id2, ...] }
 */
const reorder = async ({ type, order }) => {
    if (!VALID_TYPES.includes(type) || !Array.isArray(order) || order.length === 0) {
        return { success: false, error: 'Invalid type or order array.' };
    }
    try {
        for (let i = 0; i < order.length; i++) {
            await db.query('UPDATE home_slider_banners SET position = ? WHERE id = ? AND type = ?', [i, order[i], type]);
        }
        return { success: true };
    } catch (error) {
        console.error('Error reordering slider banners:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    create,
    getActiveByType,
    getAll,
    deleteById,
    reorder
};
