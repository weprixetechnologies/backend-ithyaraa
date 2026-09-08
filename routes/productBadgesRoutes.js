const express = require('express');
const router = express.Router();
const productBadgesController = require('../controllers/productBadgesController');

// Public route for storefront product badges
router.get('/products/active-badges', productBadgesController.getActiveProductBadges);

// Admin routes for badges management
router.get('/admin/product-badges', productBadgesController.getAllBadges);
router.post('/admin/product-badges', productBadgesController.createBadge);
router.get('/admin/product-badges/:id', productBadgesController.getBadgeById);
router.put('/admin/product-badges/:id', productBadgesController.updateBadge);
router.delete('/admin/product-badges/:id', productBadgesController.deleteBadge);
router.get('/admin/product-badges/:id/products', productBadgesController.getBadgeProducts);
router.post('/admin/product-badges/:id/products', productBadgesController.syncBadgeProducts);

module.exports = router;
