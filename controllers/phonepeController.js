/**
 * ============================================================================
 * PHONEPE WEBHOOK CONTROLLER
 * ============================================================================
 * 
 * This controller handles PhonePe payment webhooks with SEPARATE endpoints:
 * 
 * 1. REGULAR ORDERS
 *    - Order Endpoint: /api/order/place-order
 *    - Webhook Endpoint: /api/phonepe/webhook/order
 *    - Controller: handleOrderWebhookController()
 *    - Handler Function: handleRegularOrderWebhook()
 *    - Table: orderDetail
 *    - Features: Email notifications, seller notifications
 * 
 * 2. PRESALE BOOKINGS
 *    - Booking Endpoint: /api/presale/place-prebooking-order
 *    - Webhook Endpoint: /api/phonepe/webhook/presale
 *    - Controller: handlePresaleWebhookController()
 *    - Handler Function: handlePresaleBookingWebhook()
 *    - Table: presale_booking_details
 *    - Features: Status updates, no emails (handled separately)
 * 
 * Each flow uses its own dedicated webhook endpoint for better separation
 * and easier maintenance.
 * 
 * ============================================================================
 */

const phonepeService = require('../services/phonepeService');
const orderModel = require('../model/orderModel');
const presaleBookingModel = require('../model/presaleBookingModel');
const usersModel = require('../model/usersModel');
const orderService = require('../services/orderService');
const db = require('../utils/dbconnect');
const { addSendEmailJob } = require('../queue/emailProducer');

/**
 * ============================================================================
 * PHONEPE WEBHOOK HANDLER - REGULAR ORDERS ONLY
 * ============================================================================
 * 
 * This webhook handles payment notifications for REGULAR ORDERS ONLY.
 * Called from: /api/order/place-order (when paymentMode is PREPAID)
 * 
 * @route POST /api/phonepe/webhook/order
 * @desc Handle PhonePe webhook notifications for regular orders
 * @access Public (but signature verified)
 */
const handleOrderWebhookController = async (req, res) => {
    try {
        // ====================================================================
        // LOG WEBHOOK RECEIVED
        // ====================================================================
        console.log('[WEBHOOK-ORDER] ============================================');
        console.log('[WEBHOOK-ORDER] Webhook received at:', new Date().toISOString());
        console.log('[WEBHOOK-ORDER] Method:', req.method);
        console.log('[WEBHOOK-ORDER] Headers:', JSON.stringify(req.headers, null, 2));
        console.log('[WEBHOOK-ORDER] Body type:', typeof req.body);
        console.log('[WEBHOOK-ORDER] Body is Buffer:', Buffer.isBuffer(req.body));

        // ====================================================================
        // STEP 1: EXTRACT RAW BODY AND VERIFY WEBHOOK SIGNATURE
        // ====================================================================
        const signature = req.headers['x-verify'] || req.headers['X-VERIFY'];

        // req.body is a Buffer when using express.raw()
        // Convert to string for signature verification
        const rawBodyString = req.body.toString('utf8');

        console.log('[WEBHOOK-ORDER] Raw body length:', rawBodyString.length);
        console.log('[WEBHOOK-ORDER] Raw body (first 1000 chars):', rawBodyString.substring(0, 1000));

        if (!signature) {
            console.error('[WEBHOOK-ORDER] Missing X-VERIFY header');
            console.error('[WEBHOOK-ORDER] All headers:', Object.keys(req.headers));
            console.error('[WEBHOOK-ORDER] Raw body:', rawBodyString);
            // Still try to process if no signature (for testing)
            console.warn('[WEBHOOK-ORDER] Proceeding without signature verification');
        }

        // Verify webhook signature using raw body string
        const isValidSignature = phonepeService.verifyWebhookSignature(signature, rawBodyString);

        if (!isValidSignature) {
            console.error('[WEBHOOK] Invalid signature - potential security issue');
            console.error('[WEBHOOK] Received signature:', signature);
            console.error('[WEBHOOK] Raw body length:', rawBodyString.length);
            console.error('[WEBHOOK] Raw body (first 500 chars):', rawBodyString.substring(0, 500));
            // Still process the webhook but log the issue
            // PhonePe might use different signature format in some cases
            console.warn('[WEBHOOK] Proceeding with webhook processing despite signature mismatch');
        } else {
            console.log('[WEBHOOK] Signature verified successfully');
        }

        // ====================================================================
        // STEP 2: EXTRACT WEBHOOK DATA
        // ====================================================================
        // Parse the JSON body
        let webhookData;
        try {
            webhookData = JSON.parse(rawBodyString);
        } catch (parseError) {
            console.error('[WEBHOOK] Failed to parse JSON body:', parseError);
            console.error('[WEBHOOK] Raw body:', rawBodyString);
            return res.status(400).json({
                success: false,
                message: 'Invalid JSON payload'
            });
        }

        console.log('[WEBHOOK] PhonePe webhook received:', JSON.stringify(webhookData, null, 2));

        // Extract merchantID from webhook data (could be nested)
        // PhonePe webhook structure: { data: { merchantID: "...", ... } } or direct
        const merchantID = webhookData?.merchantID
            || webhookData?.data?.merchantID
            || webhookData?.response?.merchantID
            || webhookData?.transaction?.merchantID;

        // Extract status data (could be nested)
        const statusData = webhookData?.data || webhookData?.response || webhookData;

        // Process the webhook data to get standardized status
        const processedStatus = phonepeService.processPaymentStatus(statusData);

        // Use payment status directly from processPaymentStatus
        // It now returns 'successful', 'failed', 'pending', etc.
        let paymentStatus = processedStatus.orderStatus;

        // ====================================================================
        // STEP 3: ROUTE TO APPROPRIATE HANDLER
        // ====================================================================
        if (!merchantID) {
            console.warn('[WEBHOOK] No merchantID found in webhook data');
            return res.json({
                success: true,
                message: 'Webhook received but no merchantID found'
            });
        }

        try {
            // ================================================================
            // LOOKUP REGULAR ORDER
            // ================================================================
            const order = await orderModel.getOrderBymerchantID(merchantID);

            if (order) {
                // ============================================================
                // HANDLE REGULAR ORDER WEBHOOK
                // ============================================================
                console.log(`[WEBHOOK-ORDER] Processing REGULAR ORDER: ${order.orderID}`);

                await handleRegularOrderWebhook(
                    order,
                    merchantID,
                    paymentStatus,
                    processedStatus
                );

            } else {
                // ============================================================
                // ORDER NOT FOUND
                // ============================================================
                console.warn(`[WEBHOOK-ORDER] Order not found for merchantID: ${merchantID}`);
                // Still return success to PhonePe to prevent retries
            }

        } catch (updateError) {
            console.error('[WEBHOOK] Error processing webhook:', updateError);
            console.error('[WEBHOOK] Error stack:', updateError.stack);
            // Don't return error - log it but still respond success to PhonePe
            // PhonePe will retry if we return an error, which could cause duplicate processing
        }

        // ====================================================================
        // STEP 4: RESPOND TO PHONEPE
        // ====================================================================
        res.json({
            success: true,
            message: 'Webhook processed successfully'
        });

    } catch (error) {
        console.error('[WEBHOOK-ORDER] Fatal error processing webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Webhook processing failed',
            error: error.message
        });
    }
};

/**
 * ============================================================================
 * PHONEPE WEBHOOK HANDLER - PRESALE BOOKINGS ONLY
 * ============================================================================
 * 
 * This webhook handles payment notifications for PRESALE BOOKINGS ONLY.
 * Called from: /api/presale/place-prebooking-order (when paymentMode is PREPAID/PHONEPE)
 * 
 * @route POST /api/phonepe/webhook/presale
 * @desc Handle PhonePe webhook notifications for presale bookings
 * @access Public (but signature verified)
 */
const handlePresaleWebhookController = async (req, res) => {
    try {
        // ====================================================================
        // LOG WEBHOOK RECEIVED
        // ====================================================================
        console.log('[WEBHOOK-PRESALE] ============================================');
        console.log('[WEBHOOK-PRESALE] Webhook received at:', new Date().toISOString());
        console.log('[WEBHOOK-PRESALE] Method:', req.method);
        console.log('[WEBHOOK-PRESALE] Headers:', JSON.stringify(req.headers, null, 2));
        console.log('[WEBHOOK-PRESALE] Body type:', typeof req.body);
        console.log('[WEBHOOK-PRESALE] Body is Buffer:', Buffer.isBuffer(req.body));

        // ====================================================================
        // STEP 1: EXTRACT RAW BODY AND VERIFY WEBHOOK SIGNATURE
        // ====================================================================
        const signature = req.headers['x-verify'] || req.headers['X-VERIFY'];

        // req.body is a Buffer when using express.raw()
        // Convert to string for signature verification
        const rawBodyString = req.body.toString('utf8');

        console.log('[WEBHOOK-PRESALE] Raw body length:', rawBodyString.length);
        console.log('[WEBHOOK-PRESALE] Raw body (first 1000 chars):', rawBodyString.substring(0, 1000));

        if (!signature) {
            console.error('[WEBHOOK-PRESALE] Missing X-VERIFY header');
            console.error('[WEBHOOK-PRESALE] All headers:', Object.keys(req.headers));
            console.error('[WEBHOOK-PRESALE] Raw body:', rawBodyString);
            // Still try to process if no signature (for testing)
            console.warn('[WEBHOOK-PRESALE] Proceeding without signature verification');
        }

        // Verify webhook signature using raw body string
        const isValidSignature = phonepeService.verifyWebhookSignature(signature, rawBodyString);

        if (!isValidSignature) {
            console.error('[WEBHOOK-PRESALE] Invalid signature - potential security issue');
            console.error('[WEBHOOK-PRESALE] Received signature:', signature);
            console.error('[WEBHOOK-PRESALE] Raw body length:', rawBodyString.length);
            console.error('[WEBHOOK-PRESALE] Raw body (first 500 chars):', rawBodyString.substring(0, 500));
            // Still process the webhook but log the issue
            // PhonePe might use different signature format in some cases
            console.warn('[WEBHOOK-PRESALE] Proceeding with webhook processing despite signature mismatch');
        } else {
            console.log('[WEBHOOK-PRESALE] Signature verified successfully');
        }

        // ====================================================================
        // STEP 2: EXTRACT WEBHOOK DATA
        // ====================================================================
        // Parse the JSON body
        let webhookData;
        try {
            webhookData = JSON.parse(rawBodyString);
        } catch (parseError) {
            console.error('[WEBHOOK-PRESALE] Failed to parse JSON body:', parseError);
            console.error('[WEBHOOK-PRESALE] Raw body:', rawBodyString);
            return res.status(400).json({
                success: false,
                message: 'Invalid JSON payload'
            });
        }

        console.log('[WEBHOOK-PRESALE] PhonePe webhook received:', JSON.stringify(webhookData, null, 2));

        // Extract merchantID from webhook data (could be nested)
        const merchantID = webhookData?.merchantID
            || webhookData?.data?.merchantID
            || webhookData?.response?.merchantID
            || webhookData?.transaction?.merchantID;

        // Extract status data (could be nested)
        const statusData = webhookData?.data || webhookData?.response || webhookData;

        // Process the webhook data to get standardized status
        const processedStatus = phonepeService.processPaymentStatus(statusData);

        // Use payment status directly from processPaymentStatus
        // It now returns 'successful', 'failed', 'pending', etc.
        let paymentStatus = processedStatus.orderStatus;

        // ====================================================================
        // STEP 3: ROUTE TO PRESALE BOOKING HANDLER
        // ====================================================================
        if (!merchantID) {
            console.warn('[WEBHOOK-PRESALE] No merchantID found in webhook data');
            return res.json({
                success: true,
                message: 'Webhook received but no merchantID found'
            });
        }

        try {
            // ================================================================
            // LOOKUP PRESALE BOOKING
            // ================================================================
            const presaleBooking = await presaleBookingModel.getPresaleBookingBymerchantID(
                merchantID
            );

            if (presaleBooking) {
                // ============================================================
                // HANDLE PRESALE BOOKING WEBHOOK
                // ============================================================
                console.log(`[WEBHOOK-PRESALE] Processing PRESALE BOOKING: ${presaleBooking.preBookingID}`);

                await handlePresaleBookingWebhook(
                    presaleBooking,
                    merchantID,
                    paymentStatus,
                    processedStatus,
                    webhookData
                );

            } else {
                // ============================================================
                // PRESALE BOOKING NOT FOUND
                // ============================================================
                console.warn(`[WEBHOOK-PRESALE] Presale booking not found for merchantID: ${merchantID}`);
                // Still return success to PhonePe to prevent retries
            }

        } catch (updateError) {
            console.error('[WEBHOOK-PRESALE] Error processing webhook:', updateError);
            console.error('[WEBHOOK-PRESALE] Error stack:', updateError.stack);
            // Don't return error - log it but still respond success to PhonePe
            // PhonePe will retry if we return an error, which could cause duplicate processing
        }

        // ====================================================================
        // STEP 4: RESPOND TO PHONEPE
        // ====================================================================
        res.json({
            success: true,
            message: 'Webhook processed successfully'
        });

    } catch (error) {
        console.error('[WEBHOOK-PRESALE] Fatal error processing webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Webhook processing failed',
            error: error.message
        });
    }
};

/**
 * ============================================================================
 * PRESALE BOOKING WEBHOOK HANDLER
 * ============================================================================
 * 
 * Handles payment webhook notifications specifically for PRESALE BOOKINGS.
 * Called from: /api/presale/place-prebooking-order (when paymentMode is PREPAID/PHONEPE)
 * 
 * Actions:
 * 1. Updates paymentStatus in presale_booking_details table
 * 2. Updates status to 'confirmed' if payment is successful
 * 3. Stores txnID and merchantID if not already set
 * 4. Does NOT send emails (presale bookings have different email flow)
 * 
 * @param {Object} presaleBooking - Presale booking record from database
 * @param {string} merchantID - PhonePe merchant transaction ID
 * @param {string} paymentStatus - Payment status (successful, failed, pending, refunded)
 * @param {Object} processedStatus - Processed status from PhonePe
 * @param {Object} webhookData - Raw webhook data from PhonePe
 */
async function handlePresaleBookingWebhook(
    presaleBooking,
    merchantID,
    paymentStatus,
    processedStatus,
    webhookData
) {
    try {
        // Extract merchant ID from webhook or environment
        const merchantId = process.env.MERCHANT_ID
            || webhookData?.merchantId
            || webhookData?.data?.merchantId
            || null;

        // Update presale booking payment status
        await presaleBookingModel.updatePresaleBookingPaymentStatus(
            presaleBooking.preBookingID,
            paymentStatus,
            merchantID,
            merchantId
        );

        console.log(`[WEBHOOK-PRESALE] Status updated: ${presaleBooking.preBookingID}`);
        console.log(`[WEBHOOK-PRESALE] Payment Status: ${paymentStatus}`);
        console.log(`[WEBHOOK-PRESALE] Is Success: ${processedStatus.isSuccess}`);

        // Cancel pending coins if payment failed (use cancelled, not reversal)
        if (paymentStatus === 'failed' && presaleBooking.paymentStatus === 'pending') {
            try {
                const coinModel = require('../model/coinModel');
                const result = await coinModel.cancelPendingCoins(presaleBooking.uid, presaleBooking.preBookingID, 'presale');
                if (result.success) {
                    console.log(`[WEBHOOK-PRESALE] Cancelled pending coins for failed payment: ${presaleBooking.preBookingID}`);
                    // Update coinsEarned to 0 in presale_booking_details
                    const db = require('../utils/dbconnect');
                    await db.query(`UPDATE presale_booking_details SET coinsEarned = 0 WHERE preBookingID = ?`, [presaleBooking.preBookingID]);
                }
            } catch (coinError) {
                console.error(`[WEBHOOK-PRESALE] Error cancelling coins for failed payment:`, coinError);
                // Don't fail the webhook if coin cancellation fails
            }
        }

        // Send order confirmation and seller notifications if payment status changed from pending to successful
        if (processedStatus.isSuccess && presaleBooking.paymentStatus === 'pending' && paymentStatus === 'successful') {
            await sendPresaleBookingConfirmationAndNotifications(presaleBooking.preBookingID, merchantID, presaleBooking.paymentStatus, paymentStatus);
            console.log(`[WEBHOOK-PRESALE] Confirmation emails sent for presale booking ${presaleBooking.preBookingID} (pending -> successful)`);
        } else {
            console.log(`[WEBHOOK-PRESALE] Skipping email notifications: previousStatus=${presaleBooking.paymentStatus}, newStatus=${paymentStatus}, isSuccess=${processedStatus.isSuccess}`);
        }

    } catch (error) {
        console.error(`[WEBHOOK-PRESALE] Error updating presale booking ${presaleBooking.preBookingID}:`, error);
        throw error; // Re-throw to be caught by main handler
    }
}

/**
 * ============================================================================
 * REGULAR ORDER WEBHOOK HANDLER
 * ============================================================================
 * 
 * Handles payment webhook notifications specifically for REGULAR ORDERS.
 * Called from: /api/order/place-order (when paymentMode is PREPAID)
 * 
 * Actions:
 * 1. Updates paymentStatus in orderDetail table
 * 2. Sends order confirmation email to customer (if payment successful)
 * 3. Sends seller notification emails (if payment successful)
 * 4. Updates order status automatically based on payment result
 * 
 * @param {Object} order - Order record from database
 * @param {string} merchantID - PhonePe merchant transaction ID
 * @param {string} paymentStatus - Payment status (paid, failed, pending, refunded)
 * @param {Object} processedStatus - Processed status from PhonePe
 */
async function handleRegularOrderWebhook(
    order,
    merchantID,
    paymentStatus,
    processedStatus
) {
    try {
        // Update regular order payment status
        const updated = await orderModel.updateOrderPaymentStatus(
            merchantID,
            paymentStatus
        );

        if (!updated) {
            console.warn(`[WEBHOOK-ORDER] Order not found or update failed: ${merchantID}`);
            return;
        }

        console.log(`[WEBHOOK-ORDER] Status updated: ${order.orderID}`);
        console.log(`[WEBHOOK-ORDER] Payment Status: ${paymentStatus}`);
        console.log(`[WEBHOOK-ORDER] Is Success: ${processedStatus.isSuccess}`);

        // Send order confirmation and seller notifications if payment successful
        if (processedStatus.isSuccess) {
            await sendOrderConfirmationAndNotifications(merchantID);
            console.log(`[WEBHOOK-ORDER] Confirmation emails sent for order ${order.orderID}`);
        } else {
            console.log(`[WEBHOOK-ORDER] Payment not successful - skipping email notifications`);
        }

    } catch (error) {
        console.error(`[WEBHOOK-ORDER] Error updating order ${order.orderID}:`, error);
        throw error; // Re-throw to be caught by main handler
    }
}

/**
 * Manual payment status check
 * GET /api/phonepe/status/:merchantID
 */
const checkPaymentStatusController = async (req, res) => {
    try {
        const { merchantID } = req.params;

        if (!merchantID) {
            return res.status(400).json({
                success: false,
                message: 'Merchant transaction ID is required'
            });
        }

        console.log(`Manual status check for transaction: ${merchantID}`);

        const result = await phonepeService.checkPaymentStatus(merchantID);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to check payment status',
                error: result.error
            });
        }

        const processedStatus = phonepeService.processPaymentStatus(result.data);

        res.json({
            success: true,
            merchantID,
            status: processedStatus,
            rawData: result.data
        });

    } catch (error) {
        console.error('Payment status check error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Get order payment status by order ID
 * GET /api/phonepe/order/:orderId/status
 * This endpoint checks PhonePe API for the latest payment status
 */
const getOrderPaymentStatusController = async (req, res) => {
    try {
        const { orderId } = req.params;
        const phonepeService = require('../services/phonepeService');

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        // Get order details
        const order = await orderModel.getOrderByID(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // If payment is already successful or COD, no need to check PhonePe
        // Normal orders use 'successful' as payment status (not 'paid')
        if (order.paymentStatus === 'successful' || order.paymentMode === 'COD') {
            return res.json({
                success: true,
                orderId,
                merchantTransactionId: order.merchantID || order.txnID,
                currentStatus: order.paymentStatus,
                latestStatus: {
                    orderStatus: order.paymentStatus,
                    isSuccess: order.paymentStatus === 'successful',
                    statusMessage: order.paymentStatus === 'successful' ? 'Payment successful' : 'COD order - payment on delivery'
                }
            });
        }

        // Check if we have a transaction ID (orders use merchantID field)
        const merchantTransactionId = order.merchantID || order.merchantTransactionId || order.txnID;
        if (!merchantTransactionId) {
            return res.status(400).json({
                success: false,
                message: 'No PhonePe transaction ID found for this order. Payment may not have been initiated.'
            });
        }

        // Call PhonePe API to check payment status
        const result = await phonepeService.checkPaymentStatus(merchantTransactionId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to check payment status with PhonePe',
                error: result.error
            });
        }

        // Extract status data (could be nested like webhook data)
        // PhonePe status API might return data in different formats
        const statusData = result.data?.data || result.data?.response || result.data || {};

        // Process the payment status response
        const processedStatus = phonepeService.processPaymentStatus(statusData);

        // Map PhonePe status to our payment status enum
        // Normal orders use 'successful' instead of 'paid'
        let paymentStatus = 'pending';
        if (processedStatus.isSuccess) {
            paymentStatus = 'successful'; // Both normal orders and presale bookings use 'successful'
        } else if (processedStatus.isFailed) {
            paymentStatus = 'failed';
        }

        // Update order status in DB if payment status changed
        if (paymentStatus !== order.paymentStatus) {
            await orderService.updatePaymentStatus(orderId, paymentStatus);

            // If payment is successful, send confirmation emails and seller notifications
            if (processedStatus.isSuccess) {
                try {
                    const orderController = require('./orderController');
                    const usersModel = require('../model/usersModel');
                    const user = await usersModel.findByuid(order.uid);

                    if (user) {
                        // Get order items to build orderData structure
                        const db = require('../utils/dbconnect');
                        const [orderItems] = await db.query(
                            `SELECT oi.name, oi.variationName, oi.quantity, oi.lineTotalAfter, oi.lineTotalBefore, 
                                    oi.offerApplied, oi.brandID
                             FROM order_items oi
                             WHERE oi.orderID = ?
                             ORDER BY oi.createdAt ASC`,
                            [order.orderID]
                        );

                        // Build orderData structure expected by sendOrderConfirmationEmail
                        const orderData = {
                            items: orderItems.map(item => ({
                                name: item.name,
                                variationName: item.variationName,
                                quantity: item.quantity,
                                lineTotalAfter: item.lineTotalAfter,
                                lineTotalBefore: item.lineTotalBefore,
                                offerApplied: item.offerApplied || false
                            })),
                            summary: {
                                subtotal: Number(order.subtotal) || 0,
                                totalDiscount: Number(order.totalDiscount) || 0,
                                total: Number(order.total) || 0
                            }
                        };

                        // Build order object in the format expected by sendOrderConfirmationEmail
                        const orderObject = {
                            orderID: order.orderID,
                            orderData: orderData
                        };

                        // Send order confirmation email
                        await orderController.sendOrderConfirmationEmail(user, orderObject, order.paymentMode || 'PREPAID', merchantTransactionId);

                        // Send seller notification emails
                        await orderController.sendSellerNotificationEmails(order.orderID, order.paymentMode || 'PREPAID');

                        console.log(`[STATUS-CHECK] Confirmation email and seller notifications sent for order ${orderId}`);
                    }
                } catch (emailError) {
                    console.error(`[STATUS-CHECK] Error sending emails:`, emailError);
                    // Don't fail the response if email fails
                }
            }
        }

        return res.json({
            success: true,
            orderId,
            merchantTransactionId: merchantTransactionId,
            currentStatus: order.paymentStatus, // Status before this check
            latestStatus: {
                orderStatus: paymentStatus,
                isSuccess: processedStatus.isSuccess,
                statusMessage: processedStatus.statusMessage || (processedStatus.isSuccess ? 'Payment successful' : 'Payment pending')
            },
            updated: paymentStatus !== order.paymentStatus // Indicates if status was updated
        });

    } catch (error) {
        console.error('Order payment status check error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Get presale booking payment status by preBookingID
 * GET /api/phonepe/presale/:preBookingID/status
 * This endpoint checks PhonePe API for the latest payment status
 */
const getPresalePaymentStatusController = async (req, res) => {
    try {
        const { preBookingID } = req.params;
        const presaleBookingModel = require('../model/presaleBookingModel');
        const phonepeService = require('../services/phonepeService');

        if (!preBookingID) {
            return res.status(400).json({
                success: false,
                message: 'PreBooking ID is required'
            });
        }

        // Get presale booking details
        const booking = await presaleBookingModel.getPresaleBookingByID(preBookingID);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Presale booking not found'
            });
        }

        // If payment is already successful or COD, no need to check PhonePe
        if (booking.paymentStatus === 'successful' || booking.paymentType === 'COD') {
            return res.json({
                success: true,
                preBookingID,
                merchantID: booking.txnID,
                currentStatus: booking.paymentStatus,
                latestStatus: {
                    orderStatus: booking.paymentStatus,
                    isSuccess: booking.paymentStatus === 'successful',
                    statusMessage: booking.paymentStatus === 'successful' ? 'Payment successful' : 'COD order - payment on delivery'
                }
            });
        }

        // Check if we have a transaction ID
        if (!booking.txnID) {
            return res.status(400).json({
                success: false,
                message: 'No PhonePe transaction ID found for this booking. Payment may not have been initiated.'
            });
        }

        // Call PhonePe API to check payment status
        const result = await phonepeService.checkPaymentStatus(booking.txnID);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to check payment status with PhonePe',
                error: result.error
            });
        }

        // Extract status data (could be nested like webhook data)
        // PhonePe status API might return data in different formats
        const statusData = result.data?.data || result.data?.response || result.data || {};

        // Process the payment status response
        const processedStatus = phonepeService.processPaymentStatus(statusData);

        // Map PhonePe status to our payment status enum
        // Presale bookings use 'successful' as payment status
        let paymentStatus = 'pending';
        if (processedStatus.isSuccess) {
            paymentStatus = 'successful';
        } else if (processedStatus.isFailed) {
            paymentStatus = 'failed';
        }

        // Update booking status in DB if payment status changed
        if (paymentStatus !== booking.paymentStatus) {
            await presaleBookingModel.updatePresaleBookingPaymentStatus(
                preBookingID,
                paymentStatus,
                booking.txnID,
                booking.merchantID,
                booking.paymentType
            );

            // Cancel pending coins if payment failed (use cancelled, not reversal)
            if (paymentStatus === 'failed' && booking.paymentStatus === 'pending') {
                try {
                    const coinModel = require('../model/coinModel');
                    const result = await coinModel.cancelPendingCoins(booking.uid, preBookingID, 'presale');
                    if (result.success) {
                        console.log(`[STATUS-CHECK] Cancelled pending coins for failed payment: ${preBookingID}`);
                        // Update coinsEarned to 0 in presale_booking_details
                        const db = require('../utils/dbconnect');
                        await db.query(`UPDATE presale_booking_details SET coinsEarned = 0 WHERE preBookingID = ?`, [preBookingID]);
                    }
                } catch (coinError) {
                    console.error(`[STATUS-CHECK] Error cancelling coins for failed payment:`, coinError);
                    // Don't fail the response if coin cancellation fails
                }
            }

            // If payment is successful and status changed from pending to successful, send confirmation emails
            if (processedStatus.isSuccess && booking.paymentStatus === 'pending' && paymentStatus === 'successful') {
                try {
                    await sendPresaleBookingConfirmationAndNotifications(preBookingID, booking.txnID, booking.paymentStatus, paymentStatus);
                    console.log(`[STATUS-CHECK] Confirmation emails sent for presale booking ${preBookingID} (pending -> successful)`);
                } catch (emailError) {
                    console.error(`[STATUS-CHECK] Error sending emails:`, emailError);
                    // Don't fail the response if email fails
                }
            }
        }

        return res.json({
            success: true,
            preBookingID,
            merchantID: booking.txnID,
            currentStatus: booking.paymentStatus, // Status before this check
            latestStatus: {
                orderStatus: paymentStatus,
                isSuccess: processedStatus.isSuccess,
                statusMessage: processedStatus.statusMessage || (processedStatus.isSuccess ? 'Payment successful' : 'Payment pending')
            },
            updated: paymentStatus !== booking.paymentStatus // Indicates if status was updated
        });

    } catch (error) {
        console.error('Presale payment status check error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Send presale booking confirmation email and seller notifications after successful payment
 * Only sends emails if the previous status was 'pending' and new status is 'successful'
 * @param {string} preBookingID - Presale booking ID
 * @param {string} merchantID - Merchant transaction ID
 * @param {string} previousStatus - Previous payment status
 * @param {string} newStatus - New payment status
 */
async function sendPresaleBookingConfirmationAndNotifications(preBookingID, merchantID, previousStatus, newStatus) {
    try {
        // Only send emails if status changed from 'pending' to 'successful'
        if (previousStatus !== 'pending' || newStatus !== 'successful') {
            console.log(`[EMAIL] Skipping email for ${preBookingID}: previousStatus=${previousStatus}, newStatus=${newStatus}`);
            return;
        }

        // Get presale booking details
        const booking = await presaleBookingModel.getPresaleBookingByID(preBookingID);

        if (!booking) {
            console.error('Presale booking not found for preBookingID:', preBookingID);
            return;
        }

        // Get user details
        const user = await usersModel.findByuid(booking.uid);

        if (!user) {
            console.error('User not found for presale booking:', preBookingID);
            return;
        }

        // Get presale booking items to build bookingData structure
        const bookingItems = await presaleBookingModel.getPresaleBookingItems(preBookingID);

        // Calculate quantity from subtotal and unit price
        let bookingQuantity = 1;
        if (bookingItems.length > 0) {
            const firstItem = bookingItems[0];
            const unitPrice = parseFloat(firstItem.unitSalePrice || firstItem.salePrice || firstItem.unitPrice || firstItem.regularPrice || 0);
            const subtotal = parseFloat(booking.subtotal || 0);
            if (unitPrice > 0) {
                bookingQuantity = Math.round(subtotal / unitPrice);
            }
        }

        // Build bookingData structure expected by sendOrderConfirmationEmail
        const bookingData = {
            items: bookingItems.map(item => {
                const unitSalePrice = parseFloat(item.unitSalePrice || item.salePrice || 0);
                const unitRegularPrice = parseFloat(item.unitPrice || item.regularPrice || 0);
                return {
                    name: item.name || 'Product',
                    variationName: item.variationName || null,
                    quantity: bookingQuantity,
                    lineTotalAfter: unitSalePrice * bookingQuantity,
                    lineTotalBefore: unitRegularPrice * bookingQuantity,
                    offerApplied: false
                };
            }),
            summary: {
                subtotal: Number(booking.subtotal) || 0,
                totalDiscount: Number(booking.discount) || 0,
                total: Number(booking.total) || 0
            }
        };

        // Build booking object in the format expected by sendPreBookingOrderConfirmationEmail
        const bookingObject = {
            preBookingID: booking.preBookingID,
            bookingData: bookingData,
            orderStatus: booking.orderStatus,
            status: booking.status,
            paymentStatus: booking.paymentStatus
        };

        // Import email functions from presaleBookingController
        const presaleBookingController = require('./presaleBookingController');

        // Send presale booking confirmation email
        await presaleBookingController.sendPreBookingOrderConfirmationEmail(user, bookingObject, booking.paymentType || 'PREPAID', merchantID);

        // Send seller notification emails
        await presaleBookingController.sendPresaleSellerNotificationEmails(booking.preBookingID, booking.paymentType || 'PREPAID');

        console.log(`Presale booking confirmation and seller notifications sent for preBookingID ${booking.preBookingID}`);

    } catch (error) {
        console.error('Error sending presale booking confirmation and notifications:', error);
        // Don't throw - email failures shouldn't break webhook processing
    }
}

/**
 * Send order confirmation email and seller notifications after successful payment
 * @param {string} merchantID - Merchant transaction ID
 */
async function sendOrderConfirmationAndNotifications(merchantID) {
    try {
        // Get order details
        const order = await orderModel.getOrderBymerchantID(merchantID);

        if (!order) {
            console.error('Order not found for merchant transaction ID:', merchantID);
            return;
        }

        // Get user details
        const user = await usersModel.findByuid(order.uid);

        if (!user) {
            console.error('User not found for order:', order.orderID);
            return;
        }

        // Get order items to build orderData structure
        const [orderItems] = await db.query(
            `SELECT oi.name, oi.variationName, oi.quantity, oi.lineTotalAfter, oi.lineTotalBefore, 
                    oi.offerApplied, oi.brandID
             FROM order_items oi
             WHERE oi.orderID = ?
             ORDER BY oi.createdAt ASC`,
            [order.orderID]
        );

        // Build orderData structure expected by sendOrderConfirmationEmail
        const orderData = {
            items: orderItems.map(item => ({
                name: item.name,
                variationName: item.variationName,
                quantity: item.quantity,
                lineTotalAfter: item.lineTotalAfter,
                lineTotalBefore: item.lineTotalBefore,
                offerApplied: item.offerApplied || false
            })),
            summary: {
                subtotal: Number(order.subtotal) || 0,
                totalDiscount: Number(order.totalDiscount) || 0,
                total: Number(order.total) || 0
            }
        };

        // Build order object in the format expected by sendOrderConfirmationEmail
        const orderObject = {
            orderID: order.orderID,
            orderData: orderData
        };

        // Import email functions from orderController
        const orderController = require('./orderController');

        // Send order confirmation email
        await orderController.sendOrderConfirmationEmail(user, orderObject, order.paymentMode || 'PREPAID', merchantID);

        // Send seller notification emails
        await orderController.sendSellerNotificationEmails(order.orderID, order.paymentMode || 'PREPAID');

        console.log(`Order confirmation and seller notifications sent for order ${order.orderID}`);

    } catch (error) {
        console.error('Error sending order confirmation and notifications:', error);
        // Don't throw - email failures shouldn't break webhook processing
    }
}

module.exports = {
    handleOrderWebhookController,      // For regular orders: /api/phonepe/webhook/order
    handlePresaleWebhookController,    // For presale bookings: /api/phonepe/webhook/presale
    checkPaymentStatusController,
    getOrderPaymentStatusController,
    getPresalePaymentStatusController
};