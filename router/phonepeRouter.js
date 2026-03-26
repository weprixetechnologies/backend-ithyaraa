const express = require('express');
const router = express.Router();
const phonepeController = require('../controllers/phonepeController');

// Middleware to parse raw body for webhook signature verification
// Required for PhonePe signature verification
const rawBodyParser = express.raw({ type: 'application/json' });

/**
 * ============================================================================
 * PHONEPE WEBHOOK ENDPOINT - REGULAR ORDERS
 * ============================================================================
 * 
 * This endpoint receives payment notifications from PhonePe for REGULAR ORDERS ONLY.
 * 
 * Source: /api/order/place-order (when paymentMode is PREPAID)
 * Table: orderDetail
 * Actions: 
 *   - Updates paymentStatus in orderDetail table
 *   - Sends order confirmation email to customer
 *   - Sends seller notification emails
 * 
 * @route POST /api/phonepe/webhook/order
 * @desc Handle PhonePe webhook notifications for regular orders
 * @access Public (but signature verified via X-VERIFY header)
 * 
 * @body {Object} - PhonePe webhook payload with merchantID
 * @headers {string} X-VERIFY - PhonePe webhook signature for verification
 * 
 * @returns {Object} { success: true, message: 'Webhook processed successfully' }
 */
router.post('/webhook/order', rawBodyParser, phonepeController.handleOrderWebhookController);

/**
 * ============================================================================
 * PHONEPE WEBHOOK ENDPOINT - PRESALE BOOKINGS
 * ============================================================================
 * 
 * This endpoint receives payment notifications from PhonePe for PRESALE BOOKINGS ONLY.
 * 
 * Source: /api/presale/place-prebooking-order (when paymentMode is PREPAID/PHONEPE)
 * Table: presale_booking_details
 * Actions:
 *   - Updates paymentStatus in presale_booking_details table
 *   - Sets status to 'confirmed' if payment is successful
 *   - Stores txnID and merchantID if not already set
 *   - Does NOT send emails (handled separately)
 * 
 * @route POST /api/phonepe/webhook/presale
 * @desc Handle PhonePe webhook notifications for presale bookings
 * @access Public (but signature verified via X-VERIFY header)
 * 
 * @body {Object} - PhonePe webhook payload with merchantID
 * @headers {string} X-VERIFY - PhonePe webhook signature for verification
 * 
 * @returns {Object} { success: true, message: 'Webhook processed successfully' }
 */
router.post('/webhook/presale', rawBodyParser, phonepeController.handlePresaleWebhookController);

/**
 * @route GET /api/phonepe/status/:merchantID
 * @desc Manual payment status check by merchant transaction ID
 * @access Public
 */
router.get('/status/:merchantID', phonepeController.checkPaymentStatusController);

/**
 * @route GET /api/phonepe/order/:orderId/status
 * @desc Get payment status by order ID
 * @access Public
 */
router.get('/order/:orderId/status', phonepeController.getOrderPaymentStatusController);

/**
 * @route GET /api/phonepe/presale/:preBookingID/status
 * @desc Get payment status by presale booking ID
 * @access Public
 */
router.get('/presale/:preBookingID/status', phonepeController.getPresalePaymentStatusController);

/**
 * @route GET /api/phonepe/webhook/test
 * @desc Test endpoint to verify webhook URL is accessible
 * @access Public
 */
router.get('/webhook/test', (req, res) => {
    const backendUrl = process.env.BACKEND_URL || 'https://backend.ithyaraa.com';
    res.json({
        success: true,
        message: 'Webhook endpoint is accessible',
        timestamp: new Date().toISOString(),
        backendUrl: backendUrl,
        endpoints: {
            order: `${backendUrl}/api/phonepe/webhook/order`,
            presale: `${backendUrl}/api/phonepe/webhook/presale`
        },
        note: 'These URLs should be configured in PhonePe dashboard as callback URLs'
    });
});

/**
 * @route POST /api/phonepe/webhook/test
 * @desc Test endpoint to verify webhook can receive POST requests
 * @access Public
 */
router.post('/webhook/test', express.json(), (req, res) => {
    console.log('[WEBHOOK-TEST] Received test webhook:', JSON.stringify(req.body, null, 2));
    console.log('[WEBHOOK-TEST] Headers:', JSON.stringify(req.headers, null, 2));
    res.json({
        success: true,
        message: 'Test webhook received successfully',
        timestamp: new Date().toISOString(),
        receivedData: req.body,
        headers: req.headers
    });
});

module.exports = router;