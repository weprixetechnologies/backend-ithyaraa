const db = require('./../utils/dbconnect');

async function getCartWithItems(cartID) {
  const [rows] = await db.query(`
    SELECT c.cartID, ci.cartItemID, ci.productID, ci.quantity, 
           p.name, p.salePrice, p.regularPrice, p.offerID, p.type
    FROM cartDetail c
    JOIN cart_items ci ON c.cartID = ci.cartID
    JOIN products p ON ci.productID = p.productID
    WHERE c.cartID = ?
  `, [cartID]);

  return rows;
}

// Get coupon details by ID
async function getCouponByID(couponID) {
  const [rows] = await db.query(`
    SELECT couponID, discountType, discountValue 
    FROM coupons 
    WHERE couponID = ?
  `, [couponID]);

  return rows[0] || null;
}

// Get coupon details by code
async function getCouponByCode(couponCode) {
  const [rows] = await db.query(`
    SELECT couponID, couponCode, discountType, discountValue
    FROM coupons 
    WHERE couponCode = ?
  `, [couponCode]);

  return rows[0] || null;
}

module.exports = {
  getCartWithItems,
  getCouponByID,
  getCouponByCode
};