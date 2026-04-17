const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Token bridge for app-to-browser payment flow
router.get('/pay/:token', paymentController.handleTokenPayment);

module.exports = router;
