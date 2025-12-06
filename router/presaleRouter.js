const express = require('express');
const router = express.Router();
const presaleDetailsController = require('../controllers/presaleDetailsController');
const presaleProductController = require('../controllers/presaleProductController');
const presaleBookingController = require('../controllers/presaleBookingController');
const userAuth = require('../middleware/authUserMiddleware.js');

// Public routes for presale groups (for homepage)
router.get('/groups', presaleDetailsController.getAllPresaleGroupsController);
router.get('/groups/:presaleGroupID', presaleDetailsController.getPresaleGroupByIDController);

// Public routes for presale products
router.get('/products', presaleProductController.getAllPresaleProductsController);
router.get('/products/paginated', presaleProductController.getAllPresaleProductsPaginatedController);
router.get('/products/:presaleProductID', presaleProductController.getPresaleProductByIDController);

// User routes for presale bookings (requires authentication)
router.post('/place-prebooking-order', userAuth.verifyAccessToken, presaleBookingController.placePrebookingOrderController);
router.get('/booking-details/:preBookingID', userAuth.verifyAccessToken, presaleBookingController.getPresaleBookingDetailsController);

module.exports = router;

