const db = require('../utils/dbconnect');

async function getActiveFlashForProduct(productID) {
    const [rows] = await db.query(
        `SELECT i.discountType AS discountType, i.discountValue AS discountValue
         FROM flash_sale_items i
         JOIN flash_sale_details d ON d.saleID = i.saleID
         WHERE i.productID = ? AND d.status = 'active' AND NOW() BETWEEN d.startTime AND d.endTime
         LIMIT 1`,
        [productID]
    );
    return (rows && rows.length > 0) ? rows[0] : null;
}

module.exports = { getActiveFlashForProduct };


