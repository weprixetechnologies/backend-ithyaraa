const express = require('express');
const homeCategoryController = require('../controllers/homeCategoryController');

const router = express.Router();

// Public endpoint used by storefront
// GET /api/home-categories
router.get('/', homeCategoryController.getHomeCategories);

module.exports = router;

