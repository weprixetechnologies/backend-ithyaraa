/* eslint-disable no-unused-vars */
const orderModel = require('./../model/orderModel');
const orderService = require('./../services/orderService');
const usersModel = require('./../model/usersModel');
const phonepeService = require('./../services/phonepeService');
const { randomUUID } = require('crypto');
const nodeFetch = require('node-fetch');
const { sendOrderConfirmationEmail, sendSellerNotificationEmails } = require('./../services/emailService');

const placeOrderController = async (req, res) => {
    try {
        const uid = req.user.uid; // JWT payload uses uid
        const rawMode = (req.body && req.body.paymentMode) ? String(req.body.paymentMode) : 'COD';
        const paymentMode = rawMode.toUpperCase() === 'PREPAID' ? 'PREPAID' : 'COD';
        const walletApplied = Math.max(0, Number(req.body?.walletApplied || 0));

        // Extract addressID and couponCode from req.body
        const { addressID, couponCode } = req.body;

        // Validate required fields
        if (!addressID) {
            return res.status(400).json({ success: false, message: 'Address ID is required' });
        }

        // Fetch user data for email
        const user = await usersModel.findByuid(uid);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (paymentMode === 'COD') {
            const order = await orderService.placeOrder(uid, addressID, paymentMode, couponCode, walletApplied);

            // Send confirmation email for COD
            await sendOrderConfirmationEmail(user, order, 'COD');

            // Send seller notification emails
            await sendSellerNotificationEmails(order.orderID, 'COD');

            return res.status(200).json({
                success: true,
                paymentMode: 'COD',
                orderID: order.orderID,
                order
            });
        }

        // Default to PREPAID using PhonePe flow
        const order = await orderService.placeOrder(uid, addressID, paymentMode, couponCode, walletApplied);
        // Ensure amount is an integer in paise for PhonePe
        const amountRupees = Number(order.orderData.summary.total);
        const amountPaise = Math.round((isNaN(amountRupees) ? 0 : amountRupees) * 100);

        if (!amountPaise || amountPaise <= 0) {
            return res.status(400).send("Valid amount is required");
        }

        const merchantOrderId = randomUUID();
        const merchantId = process.env.MERCHANT_ID || 'ITHYARAAONLINE';

        // Normalize FRONTEND_URL - remove trailing slashes
        const frontendUrlBase = (process.env.FRONTEND_URL || 'https://backend.ithyaraa.com').replace(/\/+$/, '');
        // Construct redirect URL and normalize to prevent double slashes (preserve protocol)
        const redirectUrl = `${frontendUrlBase}/order-status/order-summary/${order.orderID}`.replace(/([^:]\/)\/+/g, '$1');
        // Use order-specific webhook endpoint - ensure no trailing slashes
        const backendUrl = (process.env.BACKEND_URL || 'https://backend.ithyaraa.com').replace(/\/+$/, '');
        const callbackUrl = `${backendUrl}/api/phonepe/webhook/order`;

        console.log('[ORDER] PhonePe redirect URL:', redirectUrl);

        // Capture client context for Request Context Forwarding
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const payload = {
            merchantId,
            merchantTransactionId: merchantOrderId,
            merchantUserId: uid,
            amount: amountPaise, // integer paise
            redirectUrl,
            callbackUrl, // PhonePe will call this URL for webhook notifications
            redirectMode: "REDIRECT",
            paymentInstrument: { type: "PAY_PAGE" }
        };

        console.log('[ORDER] PhonePe Payment Request Payload:', JSON.stringify(payload, null, 2));
        console.log('[ORDER] Callback URL being sent to PhonePe:', callbackUrl);
        console.log('[ORDER] Redirect URL being sent to PhonePe:', redirectUrl);
        console.log('[ORDER] IMPORTANT: Ensure this callback URL is accessible and whitelisted in PhonePe dashboard');

        const data = await phonepeService.initiatePayment(payload, clientIp, userAgent);
        console.log("[ORDER] PhonePe API Response:", JSON.stringify(data, null, 2));

        // Check if PhonePe accepted the callback URL
        if (data.success && data.data) {
            console.log('[ORDER] PhonePe accepted the payment request');
            console.log('[ORDER] Check PhonePe dashboard for webhook delivery logs');
        } else {
            console.error('[ORDER] PhonePe payment request may have failed or callback URL not accepted');
        }

        if (data.success) {
            // Store merchant transaction ID in the order
            try {
                await orderModel.addmerchantID(order.orderID, merchantOrderId);
            } catch (updateError) {
                console.error('Error storing merchant transaction ID:', updateError);
                // Don't fail the response, just log the error
            }

            // DO NOT send confirmation emails here - wait for webhook confirmation
            // Emails will be sent after successful payment via webhook

            // Try to extract the redirect URL if present
            const checkoutUrl = data?.data?.instrumentResponse?.redirectInfo?.url || data?.data?.redirectUrl || null;
            return res.json({
                success: true,
                paymentMode: 'PREPAID',
                orderID: order.orderID,
                merchantTransactionId: merchantOrderId,
                checkoutPageUrl: checkoutUrl || data,
                status: 'pending'
            });
        } else {
            console.error('[ORDER] PhonePe API error:', data);
            return res.status(500).json({
                success: false,
                message: 'PhonePe payment initiation failed',
                error: data
            });
        }

    } catch (error) {
        console.error('Order placement error:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

const getOrderItemsByUidController = async (req, res) => {
    try {
        const uid = req.user.uid;
        const items = await orderService.getOrderItemsByUid(uid);
        res.status(200).json({ success: true, items });
    } catch (error) {
        console.error('Get order items error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getOrderSummariesController = async (req, res) => {
    try {
        const uid = req.user.uid;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const searchOrderID = req.query.searchOrderID || null;
        const status = req.query.status || null;
        const sortField = req.query.sortField || 'createdAt';
        const sortOrder = req.query.sortOrder || 'DESC';

        const result = await orderService.getOrderSummaries(uid, page, limit, searchOrderID, status, sortField, sortOrder);

        res.status(200).json({
            success: true,
            orders: result.orders,
            total: result.total,
            page,
            limit
        });
    } catch (error) {
        console.error('Get order summaries error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getOrderDetailsByOrderIDController = async (req, res) => {
    try {
        const orderID = req.params.orderID;
        const uid = req.user.uid;
        const result = await orderService.getOrderDetailsByOrderID(orderID, uid);

        if (!result.orderDetail) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.status(200).json({
            success: true,
            orderDetail: result.orderDetail,
            items: result.items
        });
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getMyReturnsController = async (req, res) => {
    try {
        const uid = req.user.uid;
        const [returns] = await require('../utils/dbconnect').query(
            `SELECT oi.*, p.name as productName, p.featuredImage 
             FROM order_items oi
             LEFT JOIN products p ON oi.productID = p.productID
             WHERE oi.uid = ? AND oi.returnStatus != 'none'
             ORDER BY oi.updatedAt DESC`,
            [uid]
        );
        res.status(200).json({ success: true, returns });
    } catch (error) {
        console.error('Get returns error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const returnOrderController = async (req, res) => {
    try {
        const uid = req.user.uid;
        const { orderItemID, returnType, returnReason, returnComments, photos } = req.body;

        if (!orderItemID || !returnType || !returnReason) {
            return res.status(400).json({ success: false, message: 'Required fields missing' });
        }

        const [item] = await require('../utils/dbconnect').query(
            'SELECT * FROM order_items WHERE orderItemID = ? AND uid = ?',
            [orderItemID, uid]
        );

        if (!item || item.length === 0) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        const photosJson = JSON.stringify(photos || []);
        await require('../utils/dbconnect').query(
            `UPDATE order_items 
             SET returnStatus = 'pending', returnType = ?, returnReason = ?, 
                 returnComments = ?, returnPhotos = ?, updatedAt = NOW()
             WHERE orderItemID = ?`,
            [returnType, returnReason, returnComments, photosJson, orderItemID]
        );

        res.status(200).json({ success: true, message: 'Return request submitted' });
    } catch (error) {
        console.error('Return order error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const updateOrderController = async (req, res) => {
    try {
        const orderID = req.params.orderID;
        const updateData = req.body;
        await orderService.updateOrder(orderID, updateData);
        res.status(200).json({ success: true, message: 'Order updated successfully' });
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Admin Controllers
const getAllOrdersController = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            paymentStatus: req.query.paymentStatus,
            search: req.query.search,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10
        };
        const result = await orderService.getAllOrders(filters);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error('Admin get all orders error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getAdminOrderDetailsController = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await orderService.getOrderDetails(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        res.status(200).json({ success: true, order });
    } catch (error) {
        console.error('Admin get order details error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getRefundQueriesController = async (req, res) => {
    try {
        const [queries] = await require('../utils/dbconnect').query(
            "SELECT * FROM refund_queries WHERE status = 'pending' ORDER BY createdAt DESC"
        );
        res.status(200).json({ success: true, queries });
    } catch (error) {
        console.error('Get refund queries error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getResolvedRefundQueriesController = async (req, res) => {
    try {
        const [queries] = await require('../utils/dbconnect').query(
            "SELECT * FROM refund_queries WHERE status != 'pending' ORDER BY updated_at DESC"
        );
        res.status(200).json({ success: true, queries });
    } catch (error) {
        console.error('Get resolved refund queries error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const updateRefundQueryStatusController = async (req, res) => {
    try {
        const { refundQueryID } = req.params;
        const { status, remarks } = req.body;
        await require('../utils/dbconnect').query(
            "UPDATE refund_queries SET status = ?, remarks = ?, updated_at = NOW() WHERE refundQueryID = ?",
            [status, remarks, refundQueryID]
        );
        res.status(200).json({ success: true, message: 'Status updated' });
    } catch (error) {
        console.error('Update refund query status error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const approveReturnRequestController = async (req, res) => {
    try {
        const { orderItemID } = req.params;
        await require('../utils/dbconnect').query(
            "UPDATE order_items SET returnStatus = 'approved', updatedAt = NOW() WHERE orderItemID = ?",
            [orderItemID]
        );
        res.status(200).json({ success: true, message: 'Return request approved' });
    } catch (error) {
        console.error('Approve return request error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const rejectReturnRequestController = async (req, res) => {
    try {
        const { orderItemID } = req.params;
        const { reason } = req.body;
        await require('../utils/dbconnect').query(
            "UPDATE order_items SET returnStatus = 'rejected', returnRejectionReason = ?, updatedAt = NOW() WHERE orderItemID = ?",
            [reason, orderItemID]
        );
        res.status(200).json({ success: true, message: 'Return request rejected' });
    } catch (error) {
        console.error('Reject return request error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const updateOrderStatusController = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        await require('../utils/dbconnect').query(
            "UPDATE orderDetail SET orderStatus = ?, updatedAt = NOW() WHERE orderID = ?",
            [status, orderId]
        );
        res.status(200).json({ success: true, message: 'Order status updated' });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const updatePaymentStatusController = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { paymentStatus } = req.body;
        await require('../utils/dbconnect').query(
            "UPDATE orderDetail SET paymentStatus = ?, updatedAt = NOW() WHERE orderID = ?",
            [paymentStatus, orderId]
        );
        res.status(200).json({ success: true, message: 'Payment status updated' });
    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const updateOrderItemsTrackingController = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { items } = req.body; // Array of { orderItemID, trackingID, carrier }
        for (const item of items) {
            await require('../utils/dbconnect').query(
                "UPDATE order_items SET trackingID = ?, carrier = ?, updatedAt = NOW() WHERE orderItemID = ? AND orderID = ?",
                [item.trackingID, item.carrier, item.orderItemID, orderId]
            );
        }
        res.status(200).json({ success: true, message: 'Tracking information updated' });
    } catch (error) {
        console.error('Update order items tracking error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const generateInvoiceController = async (req, res) => {
    try {
        const { orderId } = req.params;
        const filePath = await invoiceService.generateInvoice(orderId);
        res.status(200).sendFile(filePath);
    } catch (error) {
        console.error('Generate invoice error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const emailInvoiceController = async (req, res) => {
    try {
        const { orderId } = req.params;
        await invoiceService.emailInvoice(orderId);
        res.status(200).json({ success: true, message: 'Invoice emailed' });
    } catch (error) {
        console.error('Email invoice error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const generateInvoiceForUserController = async (req, res) => {
    try {
        const { orderId } = req.params;
        const uid = req.user.uid;
        // Verify ownership
        const [order] = await require('../utils/dbconnect').query(
            "SELECT uid FROM orderDetail WHERE orderID = ?",
            [orderId]
        );
        if (!order || order.length === 0 || order[0].uid !== uid) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        const filePath = await invoiceService.generateInvoice(orderId);
        res.status(200).sendFile(filePath);
    } catch (error) {
        console.error('Generate invoice user error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const emailInvoiceToCustomerController = async (req, res) => {
    try {
        const { orderId } = req.params;
        const uid = req.user.uid;
        // Verify ownership
        const [order] = await require('../utils/dbconnect').query(
            "SELECT uid FROM orderDetail WHERE orderID = ?",
            [orderId]
        );
        if (!order || order.length === 0 || order[0].uid !== uid) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        await invoiceService.emailInvoice(orderId);
        res.status(200).json({ success: true, message: 'Invoice emailed' });
    } catch (error) {
        console.error('Email invoice user error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    placeOrderController,
    getOrderItemsByUidController,
    getOrderSummariesController,
    getOrderDetailsByOrderIDController,
    getMyReturnsController,
    returnOrderController,
    updateOrderController,
    getAllOrdersController,
    getAdminOrderDetailsController,
    getRefundQueriesController,
    getResolvedRefundQueriesController,
    updateRefundQueryStatusController,
    approveReturnRequestController,
    rejectReturnRequestController,
    updateOrderStatusController,
    updatePaymentStatusController,
    updateOrderItemsTrackingController,
    generateInvoiceController,
    emailInvoiceController,
    generateInvoiceForUserController,
    emailInvoiceToCustomerController
};
