const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const authMiddleware = require('../middleware/authUserMiddleware');
const authAdminMiddleware = require('../middleware/authAdminMiddleware');

// Add a review (requires authentication)
router.post('/add', authMiddleware.verifyAccessToken, reviewController.addReviewController);

// Get reviews for a product
router.get('/product/:productID', reviewController.getProductReviewsController);

// Get review statistics for a product
router.get('/product/:productID/stats', reviewController.getReviewStatsController);

// Get user's reviews (requires authentication)
router.get('/user', authMiddleware.verifyAccessToken, reviewController.getUserReviewsController);

// Admin routes
router.get('/admin/all', authAdminMiddleware.verifyAccessToken, reviewController.getAllReviewsController);
router.get('/admin/stats', authAdminMiddleware.verifyAccessToken, reviewController.getReviewStatsAdminController);
router.put('/admin/:reviewID/status', authAdminMiddleware.verifyAccessToken, reviewController.updateReviewStatusController);
router.delete('/admin/:reviewID', authAdminMiddleware.verifyAccessToken, reviewController.deleteReviewAdminController);

// Mark review as helpful (requires authentication)
router.post('/helpful/:reviewID', authMiddleware.verifyAccessToken, reviewController.markHelpfulController);

// Delete review (requires authentication)
router.delete('/:reviewID', authMiddleware.verifyAccessToken, reviewController.deleteReviewController);

module.exports = router;

