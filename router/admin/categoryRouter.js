const express = require('express');
const router = express.Router();
const authAdminMiddleware = require('./../../middleware/authAdminMiddleware')
const categoryController = require('./../../controllers/categoryController');

router.post('/upload-category', authAdminMiddleware.verifyAccessToken, categoryController.postCategory);
router.get('/all-category', authAdminMiddleware.verifyAccessToken, categoryController.getCategories); // GET with optional filters + pagination
router.get('/detail/:categoryID', authAdminMiddleware.verifyAccessToken, categoryController.getCategoryByID);
// Edit category by ID
router.put('/edit/:categoryID', authAdminMiddleware.verifyAccessToken, categoryController.editCategory);



module.exports = router;
