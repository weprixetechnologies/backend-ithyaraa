const cartModel = require('../model/userCouponsModel');
const couponModel = require('../model/userCouponsModel');
const cartModelMain = require('../model/cartModel');

async function applyCouponToCart(couponCode, cartID) {
    // 1. Get cart with items
    const cartItems = await cartModel.getCartWithItems(cartID);
    if (!cartItems || cartItems.length === 0) throw new Error('Cart not found or empty');

    // 2. Calculate subtotal for eligible products (not combo, not make_combo, no offerID)
    let subtotal = 0;
    let eligibleItemsCount = 0;

    cartItems.forEach(item => {
        // Only count products that are:
        // - NOT combo products (type != 'combo')
        // - NOT make_combo products (type != 'make_combo')
        // - NOT have offerID (offerID is null/empty/undefined)
        if (!item.offerID && item.type !== 'combo' && item.type !== 'make_combo') {
            const price = Number(item.salePrice) || Number(item.regularPrice) || 0;
            subtotal += price * item.quantity;
            eligibleItemsCount++;
        }
    });

    // Check if there are any eligible products for coupon
    if (eligibleItemsCount === 0) {
        throw new Error('No eligible products found for coupon. Coupons cannot be applied to combo products, make_combo products, or products with existing offers.');
    }

    // 3. Get coupon details by code with usage limit check
    console.log('=== CART COUPON VALIDATION ===');
    console.log('Coupon code:', couponCode);
    console.log('Coupon code type:', typeof couponCode);
    console.log('Coupon code length:', couponCode ? couponCode.length : 'null');

    const db = require('../utils/dbconnect');
    const [couponRows] = await db.query(
        'SELECT * FROM coupons WHERE couponCode = ? AND (usageLimit IS NULL OR couponUsage < usageLimit)',
        [couponCode]
    );

    console.log('Cart coupon query result:', couponRows);
    console.log('Cart number of rows found:', couponRows ? couponRows.length : 'null');

    if (!couponRows || couponRows.length === 0) {
        console.log('Cart coupon validation failed - no rows found');
        throw new Error('Invalid or expired coupon code');
    }

    const coupon = couponRows[0];

    // 4. Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
        discount = subtotal * (coupon.discountValue / 100);
    } else if (coupon.discountType === 'flat') {
        discount = coupon.discountValue;
    }

    // Ensure discount does not exceed subtotal
    if (discount > subtotal) discount = subtotal;

    const finalTotal = subtotal - discount;

    return {
        cartID,
        couponCode,
        couponID: coupon.couponID,
        subtotal,
        discount,
        finalTotal,
        eligibleItemsCount,
        totalItemsCount: cartItems.length,
        cartItems
    };
}

async function getOrCreateCart(uid) {
    return await cartModelMain.getOrCreateCart(uid);
}

module.exports = {
    applyCouponToCart,
    getOrCreateCart
};
