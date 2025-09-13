const cartService = require('../services/userCouponsService');

async function applyCoupon(req, res) {
    try {
        const { couponCode, cartID } = req.body;
        const uid = req.user.uid; // Get UID from auth middleware

        if (!couponCode) {
            return res.status(400).json({ success: false, message: 'Coupon code is required' });
        }

        // If cartID not provided, find it using UID
        let finalCartID = cartID;
        if (!finalCartID) {
            const cart = await cartService.getOrCreateCart(uid);
            finalCartID = cart.cartID;
        }

        const result = await cartService.applyCouponToCart(couponCode, finalCartID);

        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { applyCoupon };
