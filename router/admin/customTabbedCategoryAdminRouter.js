const express = require('express');
const customTabbedCategoryController = require('../../controllers/customTabbedCategoryController');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');

const router = express.Router();

// Protected admin routes
router.get('/', authAdminMiddleware.verifyAccessToken, customTabbedCategoryController.adminListCustomTabbedCategories);
router.post('/', authAdminMiddleware.verifyAccessToken, customTabbedCategoryController.upsertCustomTabbedCategory);
router.delete('/:id', authAdminMiddleware.verifyAccessToken, customTabbedCategoryController.deleteCustomTabbedCategory);

module.exports = router;
