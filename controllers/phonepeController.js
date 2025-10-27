const phonepeService = require('../services/phonepeService');
const orderModel = require('../model/orderModel');
const usersModel = require('../model/usersModel');
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

        // Update order status based on webhook
        if (webhookData.merchantTransactionId) {
            try {
                await orderModel.updateOrderPaymentStatus(
                    webhookData.merchantTransactionId,
                    processedStatus.orderStatus
                );

                // Send confirmation email if payment successful
                if (processedStatus.isSuccess) {
                    await sendPaymentConfirmationEmail(webhookData.merchantTransactionId);
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

        if (!order.merchantTransactionId) {
            return res.status(400).json({
                success: false,
                message: 'No payment transaction found for this order'
            });
        }

        // Check current payment status
        const result = await phonepeService.checkPaymentStatus(order.merchantTransactionId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to check payment status',
                error: result.error
            });
        }

        const processedStatus = phonepeService.processPaymentStatus(result.data);

        // Update order status if it has changed
        if (processedStatus.orderStatus !== order.paymentStatus) {
            try {
                await orderModel.updateOrderPaymentStatus(order.merchantTransactionId, processedStatus.orderStatus);

                // Send confirmation email if payment successful
                if (processedStatus.isSuccess) {
                    await sendPaymentConfirmationEmail(order.merchantTransactionId);
                }
            } catch (updateError) {
                console.error('Error updating order status:', updateError);
            }
        }

        res.json({
            success: true,
            orderId,
            merchantTransactionId: order.merchantTransactionId,
            currentStatus: order.paymentStatus,
            latestStatus: processedStatus,
            rawData: result.data
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
 * Send payment confirmation email
 * @param {string} merchantTransactionId - Merchant transaction ID
 */
async function sendPaymentConfirmationEmail(merchantTransactionId) {
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

        // Send payment confirmation email
        await addSendEmailJob({
            to: user.emailID,
            templateName: 'payment-confirmation',
            variables: {
                customerName: user.name || user.username,
                orderID: order.orderID,
                merchantTransactionId: merchantTransactionId,
                amount: order.total,
                paymentDate: new Date().toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                websiteUrl: process.env.FRONTEND_URL || 'http://192.168.1.12:3000'
            },
            subject: `Payment Confirmation - Order #${order.orderID}`
        });

        console.log(`Payment confirmation email sent for order ${order.orderID}`);

    } catch (error) {
        console.error('Error sending payment confirmation email:', error);
    }
}

module.exports = {
    handleWebhookController,
    checkPaymentStatusController,
    getOrderPaymentStatusController
};