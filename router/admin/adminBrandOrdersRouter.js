const express = require('express');
const router = express.Router();
const adminBrandOrdersController = require('../../controllers/adminBrandOrdersController');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');

// Note: /brands/search route is in brandAdminRouter.js (must be before /brands/:uid)

// GET /api/admin/orders/by-brand - Get brand orders
router.get('/orders/by-brand', authAdminMiddleware.verifyAccessToken, adminBrandOrdersController.getBrandOrders);

module.exports = router;

