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
        // STEP 1: VERIFY WEBHOOK SIGNATURE
        // ====================================================================
        const signature = req.headers['x-verify'];
        const payload = JSON.stringify(req.body);

        if (!signature) {
            console.error('[WEBHOOK] Missing X-VERIFY header');
            return res.status(400).json({
                success: false,
                message: 'Missing X-VERIFY header'
            });
        }

        // Verify webhook signature to ensure it's from PhonePe
        const isValidSignature = phonepeService.verifyWebhookSignature(signature, payload);

        if (!isValidSignature) {
            console.error('[WEBHOOK] Invalid signature - potential security issue');
            return res.status(401).json({
                success: false,
                message: 'Invalid signature'
            });
        }

        // ====================================================================
        // STEP 2: EXTRACT WEBHOOK DATA
        // ====================================================================
        const webhookData = req.body;
        console.log('[WEBHOOK] PhonePe webhook received:', JSON.stringify(webhookData, null, 2));

        // Extract merchantTransactionId from webhook data (could be nested)
        // PhonePe webhook structure: { data: { merchantTransactionId: "...", ... } } or direct
        const merchantTransactionId = webhookData?.merchantTransactionId
            || webhookData?.data?.merchantTransactionId
            || webhookData?.response?.merchantTransactionId
            || webhookData?.transaction?.merchantTransactionId;

        // Extract status data (could be nested)
        const statusData = webhookData?.data || webhookData?.response || webhookData;

        // Process the webhook data to get standardized status
        const processedStatus = phonepeService.processPaymentStatus(statusData);

        // Map payment status: 'paid' -> 'successful' to match database schema
        let paymentStatus = processedStatus.orderStatus;
        if (paymentStatus === 'paid') {
            paymentStatus = 'successful';
        }

        // ====================================================================
        // STEP 3: ROUTE TO APPROPRIATE HANDLER
        // ====================================================================
        if (!merchantTransactionId) {
            console.warn('[WEBHOOK] No merchantTransactionId found in webhook data');
            return res.json({
                success: true,
                message: 'Webhook received but no merchantTransactionId found'
            });
        }

        try {
            // ================================================================
            // LOOKUP REGULAR ORDER
            // ================================================================
            const order = await orderModel.getOrderByMerchantTransactionId(merchantTransactionId);

            if (order) {
                // ============================================================
                // HANDLE REGULAR ORDER WEBHOOK
                // ============================================================
                console.log(`[WEBHOOK-ORDER] Processing REGULAR ORDER: ${order.orderID}`);

                await handleRegularOrderWebhook(
                    order,
                    merchantTransactionId,
                    paymentStatus,
                    processedStatus
                );

            } else {
                // ============================================================
                // ORDER NOT FOUND
                // ============================================================
                console.warn(`[WEBHOOK-ORDER] Order not found for merchantTransactionId: ${merchantTransactionId}`);
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
        // STEP 1: VERIFY WEBHOOK SIGNATURE
        // ====================================================================
        const signature = req.headers['x-verify'];
        const payload = JSON.stringify(req.body);

        if (!signature) {
            console.error('[WEBHOOK-PRESALE] Missing X-VERIFY header');
            return res.status(400).json({
                success: false,
                message: 'Missing X-VERIFY header'
            });
        }

        // Verify webhook signature to ensure it's from PhonePe
        const isValidSignature = phonepeService.verifyWebhookSignature(signature, payload);

        if (!isValidSignature) {
            console.error('[WEBHOOK-PRESALE] Invalid signature - potential security issue');
            return res.status(401).json({
                success: false,
                message: 'Invalid signature'
            });
        }

        // ====================================================================
        // STEP 2: EXTRACT WEBHOOK DATA
        // ====================================================================
        const webhookData = req.body;
        console.log('[WEBHOOK-PRESALE] PhonePe webhook received:', JSON.stringify(webhookData, null, 2));

        // Extract merchantTransactionId from webhook data (could be nested)
        const merchantTransactionId = webhookData?.merchantTransactionId
            || webhookData?.data?.merchantTransactionId
            || webhookData?.response?.merchantTransactionId
            || webhookData?.transaction?.merchantTransactionId;

        // Extract status data (could be nested)
        const statusData = webhookData?.data || webhookData?.response || webhookData;

        // Process the webhook data to get standardized status
        const processedStatus = phonepeService.processPaymentStatus(statusData);

        // Map payment status: 'paid' -> 'successful' to match database schema
        let paymentStatus = processedStatus.orderStatus;
        if (paymentStatus === 'paid') {
            paymentStatus = 'successful';
        }

        // ====================================================================
        // STEP 3: ROUTE TO PRESALE BOOKING HANDLER
        // ====================================================================
        if (!merchantTransactionId) {
            console.warn('[WEBHOOK-PRESALE] No merchantTransactionId found in webhook data');
            return res.json({
                success: true,
                message: 'Webhook received but no merchantTransactionId found'
            });
        }

        try {
            // ================================================================
            // LOOKUP PRESALE BOOKING
            // ================================================================
            const presaleBooking = await presaleBookingModel.getPresaleBookingByMerchantTransactionId(
                merchantTransactionId
            );

            if (presaleBooking) {
                // ============================================================
                // HANDLE PRESALE BOOKING WEBHOOK
                // ============================================================
                console.log(`[WEBHOOK-PRESALE] Processing PRESALE BOOKING: ${presaleBooking.preBookingID}`);

                await handlePresaleBookingWebhook(
                    presaleBooking,
                    merchantTransactionId,
                    paymentStatus,
                    processedStatus,
                    webhookData
                );

            } else {
                // ============================================================
                // PRESALE BOOKING NOT FOUND
                // ============================================================
                console.warn(`[WEBHOOK-PRESALE] Presale booking not found for merchantTransactionId: ${merchantTransactionId}`);
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
 * @param {string} merchantTransactionId - PhonePe merchant transaction ID
 * @param {string} paymentStatus - Payment status (successful, failed, pending)
 * @param {Object} processedStatus - Processed status from PhonePe
 * @param {Object} webhookData - Raw webhook data from PhonePe
 */
async function handlePresaleBookingWebhook(
    presaleBooking,
    merchantTransactionId,
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
            merchantTransactionId,
            merchantId
        );

        console.log(`[WEBHOOK-PRESALE] Status updated: ${presaleBooking.preBookingID}`);
        console.log(`[WEBHOOK-PRESALE] Payment Status: ${paymentStatus}`);
        console.log(`[WEBHOOK-PRESALE] Is Success: ${processedStatus.isSuccess}`);

        // Note: Email notifications for presale bookings are handled separately
        // Presale bookings have different email templates and timing
        // If needed, add email sending logic here

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
 * @param {string} merchantTransactionId - PhonePe merchant transaction ID
 * @param {string} paymentStatus - Payment status (successful, failed, pending)
 * @param {Object} processedStatus - Processed status from PhonePe
 */
async function handleRegularOrderWebhook(
    order,
    merchantTransactionId,
    paymentStatus,
    processedStatus
) {
    try {
        // Update regular order payment status
        const updated = await orderModel.updateOrderPaymentStatus(
            merchantTransactionId,
            paymentStatus
        );

        if (!updated) {
            console.warn(`[WEBHOOK-ORDER] Order not found or update failed: ${merchantTransactionId}`);
            return;
        }

        console.log(`[WEBHOOK-ORDER] Status updated: ${order.orderID}`);
        console.log(`[WEBHOOK-ORDER] Payment Status: ${paymentStatus}`);
        console.log(`[WEBHOOK-ORDER] Is Success: ${processedStatus.isSuccess}`);

        // Send order confirmation and seller notifications if payment successful
        if (processedStatus.isSuccess) {
            await sendOrderConfirmationAndNotifications(merchantTransactionId);
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
 * GET /api/phonepe/status/:merchantTransactionId
 */
const checkPaymentStatusController = async (req, res) => {
    try {
        const { merchantTransactionId } = req.params;

        if (!merchantTransactionId) {
            return res.status(400).json({
                success: false,
                message: 'Merchant transaction ID is required'
            });
        }

        console.log(`Manual status check for transaction: ${merchantTransactionId}`);

        const result = await phonepeService.checkPaymentStatus(merchantTransactionId);

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
            merchantTransactionId,
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
 */
const getOrderPaymentStatusController = async (req, res) => {
    try {
        const { orderId } = req.params;

        console.log('Checking');

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

        // Check locally from database only (no PhonePe API call)
        const isSuccess = order.paymentStatus === 'successful' || order.paymentStatus === 'paid';

        res.json({
            success: true,
            orderId,
            merchantTransactionId: order.merchantTransactionId,
            currentStatus: order.paymentStatus,
            latestStatus: {
                orderStatus: order.paymentStatus,
                isSuccess: isSuccess,
                statusMessage: isSuccess ? 'Payment successful' : order.paymentStatus === 'pending' ? 'Payment pending' : 'Payment status unknown'
            }
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
 * Send order confirmation email and seller notifications after successful payment
 * @param {string} merchantTransactionId - Merchant transaction ID
 */
async function sendOrderConfirmationAndNotifications(merchantTransactionId) {
    try {
        // Get order details
        const order = await orderModel.getOrderByMerchantTransactionId(merchantTransactionId);

        if (!order) {
            console.error('Order not found for merchant transaction ID:', merchantTransactionId);
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
        await orderController.sendOrderConfirmationEmail(user, orderObject, order.paymentMode || 'PREPAID', merchantTransactionId);

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
    getOrderPaymentStatusController
};