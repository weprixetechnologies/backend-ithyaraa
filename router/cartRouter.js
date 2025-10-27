const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const authUserMiddleware = require('./../middleware/authUserMiddleware')

router.post('/add-cart', authUserMiddleware.verifyAccessToken, cartController.addCartItem);
router.post('/get-cart', authUserMiddleware.verifyAccessToken, cartController.getCart);
router.post("/remove-cart", authUserMiddleware.verifyAccessToken, cartController.removeFromCart);
router.post('/add-cart-combo', authUserMiddleware.verifyAccessToken, cartController.addCartCombo);
module.exports = router;
