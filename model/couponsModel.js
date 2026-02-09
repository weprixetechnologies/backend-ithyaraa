const db = require('./../utils/dbconnect'); // adjust based on your db connection setup

const checkCouponExists = async (couponCode) => {
    const [rows] = await db.query(
        'SELECT * FROM coupons WHERE couponCode = ? LIMIT 1',
        [couponCode]
    );
    return rows.length > 0;
};

const getCouponByCode = async (couponCode) => {
    const [rows] = await db.query('SELECT * FROM coupons WHERE couponCode = ? LIMIT 1', [couponCode]);
    return rows[0] || null;
};

const getCouponUsageCountByUser = async (couponID, uid) => {
    const [rows] = await db.query(
        'SELECT COUNT(*) AS cnt FROM coupon_user_usage WHERE couponID = ? AND uid = ?',
        [couponID, uid]
    );
    return Number(rows[0]?.cnt ?? 0);
};

/**
 * Record coupon usage for a successful order (idempotent per order).
 * Inserts into coupon_user_usage and increments global couponUsage only if this order was not already recorded.
 * Call only after order is successfully placed (COD) or payment is successful (PREPAID).
 */
const recordCouponUsageForOrder = async (couponCode, uid, orderID) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [couponRows] = await connection.query(
            'SELECT couponID FROM coupons WHERE couponCode = ? LIMIT 1',
            [couponCode]
        );
        if (!couponRows || couponRows.length === 0) {
            await connection.rollback();
            return { recorded: false, reason: 'coupon_not_found' };
        }
        const couponID = couponRows[0].couponID;

        const [insertResult] = await connection.query(
            'INSERT IGNORE INTO coupon_user_usage (couponID, uid, orderID) VALUES (?, ?, ?)',
            [couponID, uid, orderID]
        );
        if (insertResult.affectedRows === 0) {
            await connection.rollback();
            return { recorded: false, reason: 'already_recorded' };
        }

        await connection.query(
            'UPDATE coupons SET couponUsage = couponUsage + 1 WHERE couponCode = ?',
            [couponCode]
        );
        await connection.commit();
        return { recorded: true };
    } catch (err) {
        await connection.rollback().catch(() => {});
        console.error('Error in recordCouponUsageForOrder:', err);
        throw err;
    } finally {
        connection.release();
    }
};

const insertCoupon = async (couponData) => {
    const {
        couponID,
        couponCode,
        discountType,
        discountValue,
        couponUsage,
        usageLimit,
        assignedUser,
        maxUsagePerUser,
        minOrderValue,
    } = couponData;

    try {
        const hasAssignedUser = assignedUser !== undefined && assignedUser !== null && assignedUser !== '';
        const hasMaxUsagePerUser = maxUsagePerUser !== undefined && maxUsagePerUser !== null;
        const hasMinOrderValue = minOrderValue !== undefined && minOrderValue !== null;

        const fields = ['couponID', 'couponCode', 'discountType', 'discountValue', 'couponUsage', 'usageLimit'];
        const placeholders = ['?', '?', '?', '?', '?', '?'];
        const values = [couponID, couponCode, discountType, discountValue, couponUsage, usageLimit];

        if (hasMaxUsagePerUser) {
            fields.push('maxUsagePerUser');
            placeholders.push('?');
            values.push(maxUsagePerUser);
        }
        if (hasMinOrderValue) {
            fields.push('minOrderValue');
            placeholders.push('?');
            values.push(minOrderValue);
        }
        if (hasAssignedUser) {
            fields.push('assignedUser');
            placeholders.push('?');
            values.push(assignedUser);
        }

        const query = `INSERT INTO coupons (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;

        const [result] = await db.query(query, values);

        return {
            data: couponData,
            success: result.affectedRows === 1,
            message: 'Insert successful'
        };

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            return {
                success: false,
                error: 'duplicate',
                message: 'Duplicate couponCode or couponID'
            };
        }

        return {
            success: false,
            error: 'server_error',
            message: 'Something went wrong while inserting the coupon'
        };
    }
};


// GET ALL PRODUCTS

const getPaginatedCoupons = async ({ page, limit, filters }) => {
    const offset = (page - 1) * limit;

    let query = `SELECT * FROM coupons WHERE 1`;
    const values = [];

    Object.keys(filters).forEach((key) => {
        query += ` AND ${key} LIKE ?`;
        values.push(`%${filters[key]}%`);
    });

    query += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
    values.push(limit, offset);

    const [rows] = await db.query(query, values);
    return rows;
};

const getCouponCount = async (filters) => {
    let query = `SELECT COUNT(*) AS total FROM coupons WHERE 1`;
    const values = [];

    Object.keys(filters).forEach((key) => {
        query += ` AND ${key} LIKE ?`;
        values.push(`%${filters[key]}%`);
    });

    const [rows] = await db.query(query, values);
    return rows[0].total;
};


const getCouponByID = async (couponID) => {
    try {
        const [rows] = await db.query(`SELECT * FROM coupons WHERE couponID = ?`, [couponID]);

        if (!rows.length) {
            console.warn(`Coupon with ID '${couponID}' not found.`);
            return null; // Let service/controller decide how to respond
        }

        return rows[0];
    } catch (error) {
        console.error(`Database error in getCouponByID for couponID='${couponID}':`, error.message);
        throw new Error('Internal server error while fetching coupon');
    }
};
const updateCoupon = async (couponID, updateData) => {
    console.log('update', updateData);

    try {
        const fields = Object.keys(updateData);
        const values = Object.values(updateData);

        if (fields.length === 0) {
            throw new Error('No update data provided');
        }

        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const query = `UPDATE coupons SET ${setClause} WHERE couponID = ?`;

        const [result] = await db.query(query, [...values, couponID]);

        return result.affectedRows > 0;
    } catch (error) {
        console.error(`Error updating coupon '${couponID}':`, error.message);
        throw new Error('Failed to update coupon');
    }
};


const incrementCouponUsage = async (couponCode) => {
    try {
        const [result] = await db.query(
            'UPDATE coupons SET couponUsage = couponUsage + 1 WHERE couponCode = ?',
            [couponCode]
        );
        return result.affectedRows > 0;
    } catch (error) {
        console.error(`Error incrementing coupon usage for '${couponCode}':`, error.message);
        throw new Error('Failed to update coupon usage');
    }
};

module.exports = {
    checkCouponExists,
    getCouponByCode,
    getCouponUsageCountByUser,
    recordCouponUsageForOrder,
    insertCoupon,
    getPaginatedCoupons,
    getCouponCount,
    getCouponByID,
    updateCoupon,
    incrementCouponUsage
};
