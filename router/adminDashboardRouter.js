const express = require('express');
const router = express.Router();
const adminDashboardController = require('../controllers/adminDashboardController');
const authAdminMiddleware = require('../middleware/authAdminMiddleware');

router.get('/dashboard/stats', authAdminMiddleware.verifyAccessToken, adminDashboardController.getDashboardStatsController);

module.exports = router;

