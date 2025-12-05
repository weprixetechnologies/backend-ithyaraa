const express = require('express');
const router = express.Router();
const presaleDetailsController = require('../controllers/presaleDetailsController');
const presaleProductController = require('../controllers/presaleProductController');

// Public routes for presale groups (for homepage)
router.get('/groups', presaleDetailsController.getAllPresaleGroupsController);
router.get('/groups/:presaleGroupID', presaleDetailsController.getPresaleGroupByIDController);

// Public routes for presale products
router.get('/products', presaleProductController.getAllPresaleProductsController);
router.get('/products/paginated', presaleProductController.getAllPresaleProductsPaginatedController);
router.get('/products/:presaleProductID', presaleProductController.getPresaleProductByIDController);

module.exports = router;

