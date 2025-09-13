const express = require('express');
const router = express.Router();
const cartController = require('../controllers/userCouponsController');
const authAdminMiddleware = require('../middleware/authAdminMiddleware');
router.post('/apply-coupon', authAdminMiddleware.verifyAccessToken, cartController.applyCoupon);

module.exports = router;
