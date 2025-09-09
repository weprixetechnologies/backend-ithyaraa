const cartService = require('../services/userCouponsService');

async function applyCoupon(req, res) {
    try {
        const { couponID, cartID } = req.body;
        if (!couponID || !cartID) {
            return res.status(400).json({ success: false, message: 'Missing parameters' });
        }

        const result = await cartService.applyCouponToCart(couponID, cartID);

        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { applyCoupon };
