const express = require('express');
const router = express.Router();
const phonepeController = require('../controllers/phonepeController');

// Middleware to parse raw body for webhook signature verification
const rawBodyParser = express.raw({ type: 'application/json' });

/**
 * @route POST /api/phonepe/webhook
 * @desc Handle PhonePe webhook notifications
 * @access Public (but signature verified)
 */
router.post('/webhook', rawBodyParser, phonepeController.handleWebhookController);

/**
 * @route GET /api/phonepe/status/:merchantTransactionId
 * @desc Manual payment status check by merchant transaction ID
 * @access Public
 */
router.get('/status/:merchantTransactionId', phonepeController.checkPaymentStatusController);

/**
 * @route GET /api/phonepe/order/:orderId/status
 * @desc Get payment status by order ID
 * @access Public
 */
router.get('/order/:orderId/status', phonepeController.getOrderPaymentStatusController);

module.exports = router;