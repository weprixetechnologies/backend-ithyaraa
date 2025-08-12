const express = require('express');
const router = express.Router();
const authAdminMiddleware = require('./../../middleware/authAdminMiddleware')
const categoryController = require('./../../controllers/categoryController');

router.post('/upload-category', authAdminMiddleware.verifyAccessToken, categoryController.postCategory);
router.get('/all-category', authAdminMiddleware.verifyAccessToken, categoryController.getCategories); // GET with optional filters + pagination
router.get('/:categoryID', authAdminMiddleware.verifyAccessToken, categoryController.getCategoryByID);



module.exports = router;
