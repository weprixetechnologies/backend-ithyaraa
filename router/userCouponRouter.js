const express = require('express');
const router = express.Router();
const cartController = require('../controllers/userCouponsController');
const authUserMiddleware = require('../middleware/authUserMiddleware');
router.post('/apply-coupon', authUserMiddleware.verifyAccessToken, cartController.applyCoupon);

module.exports = router;
