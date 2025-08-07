const db = require('./../utils/dbconnect'); // adjust based on your db connection setup

const checkCouponExists = async (couponCode) => {
    const [rows] = await db.query(
        'SELECT * FROM coupons WHERE couponCode = ? LIMIT 1',
        [couponCode]
    );
    return rows.length > 0;
};

const insertCoupon = async (couponData) => {
    const { couponID, couponCode, discountType, discountValue, usage, assignedUser, couponUsed } = couponData;

    await db.query(
        `INSERT INTO coupons (couponID, couponCode, discountType, discountValue, usage, assignedUser, couponUsed)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [couponID, couponCode, discountType, discountValue, usage, assignedUser, couponUsed]
    );
};

module.exports = {
    checkCouponExists,
    insertCoupon,
};
