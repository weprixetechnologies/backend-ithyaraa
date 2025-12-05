const phonepeService = require('../services/phonepeService');
const orderModel = require('../model/orderModel');
const usersModel = require('../model/usersModel');
const orderService = require('../services/orderService');
const db = require('../utils/dbconnect');
const { addSendEmailJob } = require('../queue/emailProducer');

/**
 * Handle PhonePe webhook notifications
 * POST /api/phonepe/webhook
 */
const handleWebhookController = async (req, res) => {
    try {
        const signature = req.headers['x-verify'];
        const payload = JSON.stringify(req.body);

        if (!signature) {
            console.error('Missing X-VERIFY header in webhook');
            return res.status(400).json({
                success: false,
                message: 'Missing X-VERIFY header'
            });
        }

        // Verify webhook signature
        const isValidSignature = phonepeService.verifyWebhookSignature(signature, payload);

        if (!isValidSignature) {
            console.error('Invalid webhook signature');
            return res.status(401).json({
                success: false,
                message: 'Invalid signature'
            });
        }

        const webhookData = req.body;
        console.log('PhonePe webhook received:', webhookData);

        // Process the webhook data
        const processedStatus = phonepeService.processPaymentStatus(webhookData);

        // Map payment status: 'paid' -> 'successful' to match database schema
        let paymentStatus = processedStatus.orderStatus;
        if (paymentStatus === 'paid') {
            paymentStatus = 'successful';
        }

        // Update order status based on webhook
        if (webhookData.merchantTransactionId) {
            try {
                await orderModel.updateOrderPaymentStatus(
                    webhookData.merchantTransactionId,
                    paymentStatus
                );

                // Send order confirmation and seller notifications if payment successful
                if (processedStatus.isSuccess) {
                    await sendOrderConfirmationAndNotifications(webhookData.merchantTransactionId);
                }

                console.log(`Order status updated: ${webhookData.merchantTransactionId} -> ${processedStatus.orderStatus}`);

            } catch (updateError) {
                console.error('Error updating order from webhook:', updateError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to update order status'
                });
            }
        }

        res.json({
            success: true,
            message: 'Webhook processed successfully'
        });

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Webhook processing failed',
            error: error.message
        });
    }
};

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
    handleWebhookController,
    checkPaymentStatusController,
    getOrderPaymentStatusController
};