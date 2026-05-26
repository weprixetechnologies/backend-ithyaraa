const express = require('express');
const router = express.Router();
const brandController = require('../../controllers/brandController');
const adminBrandOrdersController = require('../../controllers/adminBrandOrdersController');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');
const brandApplicationController = require('../../controllers/brandApplicationController');

// Get all brands
router.get('/brands', brandController.getAllBrands);

// Search brands by name
router.get('/brands/search/by-name', authAdminMiddleware.verifyAccessToken, adminBrandOrdersController.searchBrands);

// Get brand review stats
router.get('/brands/:brandID/reviews/stats', brandController.getBrandReviewStats);

// Get brand by UID
router.get('/brands/:uid', brandController.getBrandByUID);

// Create brand
router.post('/brands', authAdminMiddleware.verifyAccessToken, brandController.createBrand);

// Set commission percentage for a brand
router.patch('/brands/:uid/commission', authAdminMiddleware.verifyAccessToken, brandController.setBrandCommission);

// Reset brand password (must come before /:uid route)
router.put('/brands/:uid/reset-password', authAdminMiddleware.verifyAccessToken, brandController.resetBrandPassword);

// Update brand
router.put('/brands/:uid', authAdminMiddleware.verifyAccessToken, brandController.updateBrand);

// Delete brand
router.delete('/brands/:uid', authAdminMiddleware.verifyAccessToken, brandController.deleteBrand);

// ─── Brand Onboarding Applications ───────────────────────────────────────────

// List all applications (optionally filtered: ?status=pending|approved|rejected)
router.get('/brand-applications', authAdminMiddleware.verifyAccessToken, brandApplicationController.listApplications);

// Get a single application's full detail
router.get('/brand-applications/:id', authAdminMiddleware.verifyAccessToken, brandApplicationController.getApplicationDetail);

// Approve an application — creates brand user account automatically
router.post('/brand-applications/:id/approve', authAdminMiddleware.verifyAccessToken, brandApplicationController.approveApplication);

// Reject an application
router.post('/brand-applications/:id/reject', authAdminMiddleware.verifyAccessToken, brandApplicationController.rejectApplication);

module.exports = router;

