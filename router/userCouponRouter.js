const express = require('express');
const router = express.Router();
const cartController = require('../controllers/userCouponsController');

router.post('/apply-coupon', cartController.applyCoupon);

module.exports = router;
