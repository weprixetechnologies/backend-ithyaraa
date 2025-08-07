const express = require('express');
const couponsRouter = express.Router();
const controller = require('../controllers/couponsController');

couponsRouter.post('/create-coupon', controller.createCoupon);

module.exports = couponsRouter;
