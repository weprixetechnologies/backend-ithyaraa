const express = require('express');
const buyNowController = require('../controllers/buyNowController');

const buyNowRouter = express.Router();

// Public endpoint – supports both logged-in users (uid in body)
// and guest checkout (guestDetails + address).
buyNowRouter.post('/buy-now', buyNowController.buyNowController);

// Lightweight coupon validation specific to Buy Now (single-product subtotal)
buyNowRouter.get('/buy-now/validate-coupon', buyNowController.validateCoupon);

// Lightweight offer preview for Buy Now (no DB mutations)
buyNowRouter.get('/buy-now/check-offer', buyNowController.checkOffer);

// Lightweight shipping fee calculation for Buy Now UI
buyNowRouter.get('/buy-now/shipping-fee', buyNowController.getShippingFee);

module.exports = buyNowRouter;


