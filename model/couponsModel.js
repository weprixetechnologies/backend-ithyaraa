const db = require('./../utils/dbconnect'); // adjust based on your db connection setup

const checkCouponExists = async (couponCode) => {
    const [rows] = await db.query(
        'SELECT * FROM coupons WHERE couponCode = ? LIMIT 1',
        [couponCode]
    );
    return rows.length > 0;
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
    } = couponData;

    try {
        const hasAssignedUser = assignedUser !== undefined && assignedUser !== null && assignedUser !== '';

        const fields = ['couponID', 'couponCode', 'discountType', 'discountValue', 'couponUsage', 'usageLimit'];
        const placeholders = ['?', '?', '?', '?', '?', '?'];
        const values = [couponID, couponCode, discountType, discountValue, couponUsage, usageLimit];

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


module.exports = {
    checkCouponExists,
    insertCoupon,
    getPaginatedCoupons, getCouponCount, getCouponByID, updateCoupon
};
