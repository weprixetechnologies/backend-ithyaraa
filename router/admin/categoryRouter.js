const express = require('express');
const router = express.Router();
const categoryController = require('./../../controllers/categoryController');

router.post('/upload-category', categoryController.postCategory);
router.get('/all-category', categoryController.getCategories); // GET with optional filters + pagination
router.get('/:categoryID', categoryController.getCategoryByID);



module.exports = router;
