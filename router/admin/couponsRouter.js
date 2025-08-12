const express = require('express');
const couponsRouter = express.Router();
const controller = require('../../controllers/couponsController');
const commonController = require('./../../controllers/index')
const authAdminMiddleware = require('./../../middleware/authAdminMiddleware')

couponsRouter.post('/create-coupon', authAdminMiddleware.verifyAccessToken, controller.createCoupon);
couponsRouter.get('/all-coupons', authAdminMiddleware.verifyAccessToken, controller.getAllCoupons)
couponsRouter.get('/count', authAdminMiddleware.verifyAccessToken, commonController.getCountController)
couponsRouter.get('/detail/:couponID', authAdminMiddleware.verifyAccessToken, controller.getCouponDetail);
couponsRouter.patch('/edit-coupon/:couponID', authAdminMiddleware.verifyAccessToken, controller.updateCoupon);

module.exports = couponsRouter;
