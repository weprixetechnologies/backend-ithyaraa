const db = require('../utils/dbconnect');

/**
 * Create a featured coupon
 */
const create = async ({ popupImage, iconImage, couponCode }) => {
    try {
        const [result] = await db.query(
            `INSERT INTO featured_coupons (popupImage, iconImage, couponCode) VALUES (?, ?, ?)`,
            [popupImage, iconImage, couponCode]
        );
        return { success: true, id: result.insertId };
    } catch (error) {
        console.error('Error creating featured coupon:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get active featured coupons (all active coupons for floating modal)
 */
const getActive = async () => {
    try {
        const [rows] = await db.query(
            `SELECT fc.id, fc.popupImage, fc.iconImage, fc.couponCode, fc.isActive, fc.createdAt, fc.updatedAt,
                    c.couponID, c.discountType, c.discountValue, c.minOrderValue, c.usageLimit, c.couponUsage
             FROM featured_coupons fc
             LEFT JOIN coupons c ON fc.couponCode = c.couponCode
             WHERE fc.isActive = 1
             ORDER BY fc.id DESC`
        );
        return {
            success: true,
            data: rows
        };
    } catch (error) {
        console.error('Error getting active featured coupons:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all featured coupons (admin)
 */
const getAll = async () => {
    try {
        const [rows] = await db.query(
            `SELECT fc.id, fc.popupImage, fc.iconImage, fc.couponCode, fc.isActive, fc.createdAt, fc.updatedAt,
                    c.couponID, c.discountType, c.discountValue, c.minOrderValue, c.usageLimit, c.couponUsage
             FROM featured_coupons fc
             LEFT JOIN coupons c ON fc.couponCode = c.couponCode
             ORDER BY fc.id DESC`
        );
        return { success: true, data: rows };
    } catch (error) {
        console.error('Error getting all featured coupons:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get by ID
 */
const getById = async (id) => {
    try {
        const [rows] = await db.query(
            `SELECT id, popupImage, iconImage, couponCode, isActive, createdAt, updatedAt
             FROM featured_coupons WHERE id = ?`,
            [id]
        );
        if (rows.length === 0) return { success: false, message: 'Not found' };
        return { success: true, data: rows[0] };
    } catch (error) {
        console.error('Error getting featured coupon by id:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Update a featured coupon
 */
const updateById = async (id, { popupImage, iconImage, couponCode, isActive }) => {
    try {
        const updates = [];
        const params = [];

        if (popupImage !== undefined) {
            updates.push('popupImage = ?');
            params.push(popupImage);
        }
        if (iconImage !== undefined) {
            updates.push('iconImage = ?');
            params.push(iconImage);
        }
        if (couponCode !== undefined) {
            updates.push('couponCode = ?');
            params.push(couponCode);
        }
        if (isActive !== undefined) {
            updates.push('isActive = ?');
            params.push(isActive ? 1 : 0);
        }

        if (updates.length === 0) {
            return { success: false, message: 'No fields to update' };
        }

        params.push(id);
        const [result] = await db.query(
            `UPDATE featured_coupons SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
        return { success: true, updated: result.affectedRows > 0 };
    } catch (error) {
        console.error('Error updating featured coupon:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Delete a featured coupon by id
 */
const deleteById = async (id) => {
    try {
        const [result] = await db.query('DELETE FROM featured_coupons WHERE id = ?', [id]);
        return { success: true, deleted: result.affectedRows > 0 };
    } catch (error) {
        console.error('Error deleting featured coupon:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    create,
    getActive,
    getAll,
    getById,
    updateById,
    deleteById
};
