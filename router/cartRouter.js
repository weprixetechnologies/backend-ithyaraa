const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const authMiddleware = require('./../middleware/authAdminMiddleware')
router.post('/add-cart', authMiddleware.verifyAccessToken, cartController.addCartItem);
router.post('/get-cart', authMiddleware.verifyAccessToken, cartController.getCart);
router.post("/remove-cart", authMiddleware.verifyAccessToken, cartController.removeFromCart);
router.post('/add-cart-combo', authMiddleware.verifyAccessToken, cartController.addCartCombo);
module.exports = router;
