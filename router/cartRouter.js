const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const authUserMiddleware = require('./../middleware/authUserMiddleware');

router.post('/add-cart', authUserMiddleware.verifyCartSession, cartController.addCartItem);
router.post('/update-cart-selected', authUserMiddleware.verifyCartSession, cartController.updateCartItemsSelected);
router.post('/get-cart', authUserMiddleware.verifyCartSession, cartController.getCart);
router.post('/remove-cart', authUserMiddleware.verifyCartSession, cartController.removeFromCart);
router.post('/add-cart-combo', authUserMiddleware.verifyCartSession, cartController.addCartCombo);
router.post('/update-quantities', authUserMiddleware.verifyCartSession, cartController.updateCartItemQuantity);
router.post('/auto-update-selection', authUserMiddleware.verifyCartSession, cartController.autoUpdateCartSelection);

module.exports = router;
