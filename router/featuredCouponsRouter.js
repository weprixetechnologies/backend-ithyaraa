const express = require('express');
const router = express.Router();
const controller = require('../controllers/featuredCouponsController');
const authAdminMiddleware = require('../middleware/authAdminMiddleware');

// Public route - get active coupon
router.get('/active', controller.getActiveCoupon);

// Admin routes
router.post('/', authAdminMiddleware.verifyAccessToken, controller.createCoupon);
router.get('/', authAdminMiddleware.verifyAccessToken, controller.getAllCoupons);
router.get('/:id', authAdminMiddleware.verifyAccessToken, controller.getCouponById);
router.put('/:id', authAdminMiddleware.verifyAccessToken, controller.updateCoupon);
router.delete('/:id', authAdminMiddleware.verifyAccessToken, controller.deleteCoupon);

module.exports = router;
