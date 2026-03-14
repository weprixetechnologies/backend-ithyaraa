const express = require('express');
const authAdminMiddleware = require('./../../middleware/authAdminMiddleware');
const homeCategoryController = require('./../../controllers/homeCategoryController');

const router = express.Router();

// GET /api/admin/home-categories – list all home category tiles (admin)
router.get('/', authAdminMiddleware.verifyAccessToken, homeCategoryController.getHomeCategories);

// POST /api/admin/home-categories – create/update a home category tile
router.post('/', authAdminMiddleware.verifyAccessToken, homeCategoryController.createHomeCategory);

module.exports = router;

