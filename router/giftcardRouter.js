// src/routes/giftcard.routes.js
const express = require('express');
const giftcardRouter = express.Router();
const giftcardController = require('../controllers/giftcardController');
const authMiddleware = require('./../middleware/authAdminMiddleware')

// Optional: add auth & rate-limit middlewares here
giftcardRouter.post('/create-giftcard', giftcardController.createGiftCard);
giftcardRouter.post('/redeem', authMiddleware.verifyAccessToken, giftcardController.verifyGiftCard);

module.exports = giftcardRouter;
