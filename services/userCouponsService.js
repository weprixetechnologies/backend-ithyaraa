const cartModel = require('../model/userCouponsModel');
const cartModelMain = require('../model/cartModel');
const couponsModel = require('../model/couponsModel');

async function applyCouponToCart(couponCode, cartID, uid = null) {
    // 1. Get cart with items
    const allCartItems = await cartModel.getCartWithItems(cartID);
    if (!allCartItems || allCartItems.length === 0) throw new Error('Cart not found or empty');

    // 2. Restrict to selected items only (same as checkout)
    const cartItems = allCartItems.filter(item =>
        item.selected === true || item.selected === 1 || item.selected === null
    );
    if (!cartItems || cartItems.length === 0) {
        throw new Error('No items selected. Please select the items you want to checkout to apply a coupon.');
    }

    // 3. Calculate subtotal for eligible products among selected items (not combo, not make_combo, no offerID)
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

    // Check if there are any eligible products for coupon (among selected items)
    if (eligibleItemsCount === 0) {
        throw new Error('No eligible products found for coupon among selected items. Coupons cannot be applied to combo products, make_combo products, or products with existing offers.');
    }

    // 4. Get coupon details by code with usage limit check
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

    // Minimum order value (backend enforcement)
    const minOrder = coupon.minOrderValue != null ? Number(coupon.minOrderValue) : null;
    if (minOrder != null && minOrder > 0 && subtotal < minOrder) {
        throw new Error(`Minimum order value of ₹${minOrder} required for this coupon`);
    }

    // Per-user usage limit (skip if no uid, e.g. guest)
    if (uid && coupon.maxUsagePerUser != null && Number(coupon.maxUsagePerUser) >= 0) {
        const usedByUser = await couponsModel.getCouponUsageCountByUser(coupon.couponID, uid);
        if (usedByUser >= Number(coupon.maxUsagePerUser)) {
            throw new Error('You have already used this coupon the maximum number of times.');
        }
    }

    // 5. Calculate discount
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
        totalItemsCount: cartItems.length, // selected items only
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
