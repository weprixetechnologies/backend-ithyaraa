const express = require('express');
const router = express.Router();
const adminDashboardController = require('../controllers/adminDashboardController');
const authAdminMiddleware = require('../middleware/authAdminMiddleware');

router.get('/dashboard/stats', authAdminMiddleware.verifyAccessToken, adminDashboardController.getDashboardStatsController);
router.get('/settings', authAdminMiddleware.verifyAccessToken, adminDashboardController.getGlobalSettingsController);
router.post('/settings/update', authAdminMiddleware.verifyAccessToken, adminDashboardController.updateGlobalSettingsController);

module.exports = router;

