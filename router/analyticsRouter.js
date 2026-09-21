const express = require('express');
const router = express.Router();
const authAdminMiddleware = require('../middleware/authAdminMiddleware');
const analyticsController = require('../controllers/analyticsController');

// All analytics routes require admin or manager authorization
router.get('/unified', authAdminMiddleware.verifyAccessToken, analyticsController.getUnifiedAnalyticsController);
router.get('/retention', authAdminMiddleware.verifyAccessToken, analyticsController.getRetentionAnalyticsController);
router.get('/onboarding', authAdminMiddleware.verifyAccessToken, analyticsController.getOnboardingAnalyticsController);
router.get('/export', authAdminMiddleware.verifyAccessToken, analyticsController.exportAnalyticsReportController);

module.exports = router;
