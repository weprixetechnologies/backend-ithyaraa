const express = require('express');
const router = express.Router();
const controller = require('../controllers/sizeChartController');
const authAdminMiddleware = require('../middleware/authAdminMiddleware');

// Size chart APIs (admin-only) - mounted at /api/size-charts
router.post('/', authAdminMiddleware.verifyAccessToken, controller.createSizeChart);
router.get('/', authAdminMiddleware.verifyAccessToken, controller.listSizeCharts);

module.exports = router;

