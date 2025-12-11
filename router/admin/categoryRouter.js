const express = require('express');
const router = express.Router();
const authAdminMiddleware = require('./../../middleware/authAdminMiddleware')
const categoryController = require('./../../controllers/categoryController');

// Public routes (no auth required)
router.get('/public', categoryController.getCategories);
router.get('/public/:categoryID', categoryController.getCategoryByID);

// Admin routes (auth required)
router.post('/upload-category', authAdminMiddleware.verifyAccessToken, categoryController.postCategory);
router.get('/all-category', categoryController.getCategories); // GET with optional filters + pagination
router.get('/detail/:categoryID', authAdminMiddleware.verifyAccessToken, categoryController.getCategoryByID);
// Edit category by ID
router.put('/edit/:categoryID', authAdminMiddleware.verifyAccessToken, categoryController.editCategory);
// Delete category by ID
router.delete('/delete/:categoryID', authAdminMiddleware.verifyAccessToken, categoryController.deleteCategory);



module.exports = router;
