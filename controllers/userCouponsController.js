const cartService = require('../services/userCouponsService');

async function applyCoupon(req, res) {
    try {
        const { couponCode, cartID } = req.body;
        const uid = req.user.uid; // JWT payload uses uid

        if (!couponCode) {
            return res.status(400).json({ success: false, message: 'Coupon code is required' });
        }

        // If cartID not provided, find it using UID
        let finalCartID = cartID;
        if (!finalCartID) {
            const cart = await cartService.getOrCreateCart(uid);
            finalCartID = cart.cartID;
        }

        const result = await cartService.applyCouponToCart(couponCode, finalCartID, uid);

        res.json({ success: true, ...result });
    } catch (err) {
        // Coupon validation failures (invalid/expired, ineligible cart) are client/business errors, not server errors
        const status = err.message && (
            err.message.includes('Invalid or expired') ||
            err.message.includes('No eligible products') ||
            err.message.includes('Cart not found or empty') ||
            err.message.includes('No items selected') ||
            err.message.includes('Minimum order value') ||
            err.message.includes('maximum number of times')
        ) ? 400 : 500;
        res.status(status).json({ success: false, message: err.message });
    }
}

module.exports = { applyCoupon };
