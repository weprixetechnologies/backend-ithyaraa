const cartModelMain = require('../model/cartModel');
const couponsModel = require('../model/couponsModel');
const cartService = require('./cartService');

async function applyCouponToCart(couponCode, cartID, uid = null) {
    console.log('=== CART COUPON APPLY START ===');
    console.log('UID:', uid);
    console.log('CartID:', cartID);
    console.log('Coupon code (raw):', couponCode);

    // 1. Get full cart via cartService so pricing (lineTotalBefore) matches checkout
    if (!uid) {
        throw new Error('User ID is required to apply a coupon');
    }

    const cartData = await cartService.getCart(uid);
    const allItems = cartData.items || [];
    console.log('Cart items (all):', allItems.length);

    // 2. Restrict to selected items only (same as checkout)
    const cartItems = allItems.filter(item =>
        item.selected === true || item.selected === 1 || item.selected === null
    );
    console.log('Cart items (selected):', cartItems.length);
    if (!cartItems || cartItems.length === 0) {
        throw new Error('No items selected. Please select the items you want to checkout to apply a coupon.');
    }

    // 3. Calculate subtotal for selected items using lineTotalBefore (same as cart summary)
    // - orderSubtotal: all selected items (for reference/logging)
    // - subtotal: only eligible items (for discount calculation + min-order check)
    let orderSubtotal = 0;
    let subtotal = 0;
    let eligibleItemsCount = 0;

    cartItems.forEach(item => {
        const lineBefore = item.lineTotalBefore != null
            ? Number(item.lineTotalBefore)
            : (Number(item.salePrice) || Number(item.regularPrice) || 0) * (item.quantity || 1);
        orderSubtotal += lineBefore;

        // Only count products that are:
        // - Variable products (`type === 'variable'`)
        // - NOT under any offer (offerID === null/undefined/"")
        const hasNoOffer =
            item.offerID === null ||
            item.offerID === undefined ||
            item.offerID === '';

        if (hasNoOffer && item.type === 'variable') {
            subtotal += lineBefore;
            eligibleItemsCount++;
        }
    });

    console.log('Cart orderSubtotal (selected, before coupon):', orderSubtotal);
    console.log('Eligible subtotal (selected, before coupon):', subtotal);

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
    console.log('Cart coupon row:', coupon);

    // Minimum order value (backend enforcement) - based on eligible subtotal only
    const minOrder = coupon.minOrderValue != null ? Number(coupon.minOrderValue) : null;
    console.log('Cart minOrderValue from DB:', minOrder);
    if (minOrder != null && minOrder > 0 && subtotal < minOrder) {
        console.log('Cart coupon rejected due to minOrderValue. eligible subtotal:', subtotal);
        throw new Error(`Minimum order value of ₹${minOrder} required for this coupon`);
    }

    // Per-user usage limit (skip if no uid, e.g. guest)
    if (uid && coupon.maxUsagePerUser != null && Number(coupon.maxUsagePerUser) >= 0) {
        const usedByUser = await couponsModel.getCouponUsageCountByUser(coupon.couponID, uid);
        console.log('Cart maxUsagePerUser:', coupon.maxUsagePerUser, 'usedByUser:', usedByUser);
        if (usedByUser >= Number(coupon.maxUsagePerUser)) {
            console.log('Cart coupon rejected due to per-user usage limit.');
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

    console.log('Cart coupon discount computed:', discount, 'finalTotal:', finalTotal);

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
