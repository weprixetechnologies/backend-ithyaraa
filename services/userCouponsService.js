const cartModel = require('../model/userCouponsModel');
const couponModel = require('../model/userCouponsModel');

async function applyCouponToCart(couponID, cartID) {
    // 1. Get cart with items
    const cartItems = await cartModel.getCartWithItems(cartID);
    if (!cartItems || cartItems.length === 0) throw new Error('Cart not found or empty');

    // 2. Calculate subtotal for non-offer, non-combo products
    let subtotal = 0;
    cartItems.forEach(item => {
        if (!item.offerID && !item.type == 'combo') {
            const price = item.salePrice || item.regularPrice || 0;
            subtotal += price * item.quantity;
        }
    });

    // 3. Get coupon details
    const coupon = await couponModel.getCouponByID(couponID);
    if (!coupon) throw new Error('Coupon not found');

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
        couponID,
        subtotal,
        discount,
        finalTotal,
        cartItems
    };
}

module.exports = {
    applyCouponToCart
};
