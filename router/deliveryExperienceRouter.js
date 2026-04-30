const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/deliveryExperienceController');
const { verifyAccessToken: userAuth } = require('../middleware/authUserMiddleware');
const { verifyAccessToken: adminAuth } = require('../middleware/authAdminMiddleware');

// Public route for users to submit feedback
router.post('/submit', userAuth, feedbackController.submitFeedback);

// Admin route to list all feedback
router.get('/admin/list', adminAuth, feedbackController.listFeedback);

module.exports = router;
