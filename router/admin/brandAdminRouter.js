const express = require('express');
const router = express.Router();
const brandController = require('../../controllers/brandController');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');

// Get all brands
router.get('/brands', authAdminMiddleware.verifyAccessToken, brandController.getAllBrands);

// Get brand review stats
router.get('/brands/:brandID/reviews/stats', brandController.getBrandReviewStats);

// Get brand by UID
router.get('/brands/:uid', authAdminMiddleware.verifyAccessToken, brandController.getBrandByUID);

// Create brand
router.post('/brands', authAdminMiddleware.verifyAccessToken, brandController.createBrand);

// Reset brand password (must come before /:uid route)
router.put('/brands/:uid/reset-password', authAdminMiddleware.verifyAccessToken, brandController.resetBrandPassword);

// Update brand
router.put('/brands/:uid', authAdminMiddleware.verifyAccessToken, brandController.updateBrand);

// Delete brand
router.delete('/brands/:uid', authAdminMiddleware.verifyAccessToken, brandController.deleteBrand);

module.exports = router;

