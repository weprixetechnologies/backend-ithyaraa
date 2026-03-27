const orderService = require('../services/orderService');
const orderModel = require('../model/orderModel');
const { randomUUID } = require('crypto');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { addSendEmailJob } = require('../queue/emailProducer');
const usersModel = require('../model/usersModel');
const db = require('../utils/dbconnect');
const RETURN_WINDOW_DAYS = parseInt(process.env.RETURN_WINDOW_DAYS || '7', 10) || 7;

// Load from environment only
const merchantId = process.env.MERCHANT_ID || 'PGTESTPAYUAT86';
const key = process.env.KEY || '96434309-7796-489d-8924-ab56988a6076';
const keyIndex = process.env.KEY_INDEX || '1';

if (process.env.NODE_ENV === "production") {
    if (!merchantId || !key || !keyIndex) {
        throw new Error("Missing PhonePe production credentials");
    }
}

const phonePeUrl = process.env.NODE_ENV === "production"
    ? "https://api.phonepe.com/apis/hermes/pg/v1/pay"
    : "https://api-preprod.phonepe.com/apis/hermes/pg/v1/pay";

function generateChecksum(base64Payload) {
    const path = "/pg/v1/pay";
    const raw = base64Payload + path + key;
    const sha256 = crypto.createHash("sha256").update(raw).digest("hex");
    return `${sha256}###${keyIndex}`;
}

// Helper function to send order confirmation email
async function sendOrderConfirmationEmail(user, order, paymentMode, merchantOrderId = null) {
    try {
        const orderDate = new Date().toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const emailVariables = {
            customerName: user.name || user.username,
            orderID: order.orderID,
            orderDate: orderDate,
            paymentMode: paymentMode,
            merchantOrderId: merchantOrderId,
            items: order.orderData.items.map(item => ({
                name: item.name,
                variationName: item.variationName,
                quantity: item.quantity,
                lineTotalAfter: item.lineTotalAfter,
                offerApplied: item.offerApplied
            })),
            subtotal: order.orderData.summary.subtotal,
            totalDiscount: order.orderData.summary.totalDiscount,
            total: order.orderData.summary.total,
            isCOD: paymentMode === 'COD',
            trackOrderUrl: `${process.env.FRONTEND_URL || 'https://backend.ithyaraa.com'}/track-order/${order.orderID}`,
            websiteUrl: process.env.FRONTEND_URL || 'https://backend.ithyaraa.com'
        };

        // Generate invoice PDF for attachment
        let attachments = [];
        try {
            const orderService = require('../services/orderService');
            console.log(`Attempting to generate invoice for order ${order.orderID}...`);
            const invoiceResult = await orderService.generateInvoice(order.orderID);

            if (invoiceResult && invoiceResult.success) {
                // Convert Buffer to base64 for queue serialization
                const pdfBuffer = invoiceResult.invoice.pdfBuffer;
                const base64Content = pdfBuffer.toString('base64');

                attachments = [{
                    filename: `invoice_${order.orderID}.pdf`,
                    content: base64Content, // Store as base64 string for queue
                    contentType: 'application/pdf',
                    encoding: 'base64' // Flag to indicate this needs decoding
                }];

                console.log(`✅ Invoice PDF generated for order confirmation: ${pdfBuffer.length} bytes (base64: ${base64Content.length} chars)`);
            } else {
                console.warn(`⚠️ Invoice generation returned no result or success=false for order ${order.orderID}`);
            }
        } catch (invoiceError) {
            console.error(`❌ Error generating invoice for order confirmation (order ${order.orderID}):`, {
                message: invoiceError.message,
                stack: invoiceError.stack,
                name: invoiceError.name
            });
            // Continue without invoice attachment - don't break order confirmation
        }

        // Log before sending to queue
        console.log(`Adding email job to queue - attachments count: ${attachments.length}`);
        if (attachments.length > 0) {
            console.log(`Attachment details:`, {
                filename: attachments[0].filename,
                contentType: attachments[0].contentType,
                encoding: attachments[0].encoding,
                contentLength: attachments[0].content?.length || 0,
                contentTypeOf: typeof attachments[0].content
            });
        }

        await addSendEmailJob({
            to: user.emailID,
            templateName: 'order-confirmation',
            variables: emailVariables,
            subject: `Order Confirmation #${order.orderID} - Ithyaraa`,
            attachments: attachments
        });

        console.log(`Order confirmation email queued for ${user.emailID} for order ${order.orderID}${attachments.length > 0 ? ' with invoice attachment' : ''}`);
    } catch (error) {
        console.error('Error sending order confirmation email:', error);
        // Don't throw error - email failure shouldn't break order placement
    }
}

// Helper function to send seller notification emails
async function sendSellerNotificationEmails(orderID, paymentMode) {
    try {
        // Get order items grouped by brandID
        const [orderItems] = await db.query(
            `SELECT oi.name, oi.variationName, oi.quantity, oi.brandID, od.paymentMode, od.createdAt
             FROM order_items oi
             INNER JOIN orderDetail od ON oi.orderID = od.orderID
             WHERE oi.orderID = ?
             ORDER BY oi.brandID, oi.createdAt`,
            [orderID]
        );

        if (!orderItems || orderItems.length === 0) {
            console.log(`No order items found for order ${orderID}`);
            return;
        }

        // Group items by brandID
        const itemsByBrand = {};
        orderItems.forEach(item => {
            const brandID = item.brandID || 'inhouse'; // Use 'inhouse' as key for null brandID
            if (!itemsByBrand[brandID]) {
                itemsByBrand[brandID] = [];
            }
            itemsByBrand[brandID].push(item);
        });

        // Get order date
        const orderDate = orderItems[0].createdAt
            ? new Date(orderItems[0].createdAt).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : new Date().toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

        // Send email for each brand
        for (const [brandID, items] of Object.entries(itemsByBrand)) {
            try {
                let sellerEmail = null;
                let sellerName = 'Seller';

                if (brandID === 'inhouse') {
                    // Inhouse products - send to ithyaraa.official@gmail.com
                    sellerEmail = 'ithyaraa.official@gmail.com';
                    sellerName = 'Ithyaraa Team';
                } else {
                    // Get seller email from users table
                    const [brandUsers] = await db.query(
                        `SELECT emailID, name, username FROM users WHERE uid = ? AND role = 'brand' LIMIT 1`,
                        [brandID]
                    );

                    if (brandUsers && brandUsers.length > 0) {
                        sellerEmail = brandUsers[0].emailID;
                        sellerName = brandUsers[0].name || brandUsers[0].username || 'Seller';
                    } else {
                        console.warn(`Brand user not found for brandID: ${brandID}`);
                        continue; // Skip if brand not found
                    }
                }

                if (!sellerEmail) {
                    console.warn(`No email found for brandID: ${brandID}`);
                    continue;
                }

                // Format items as HTML
                let itemsHtml = '';
                items.forEach(item => {
                    const variationText = item.variationName
                        ? `<p style="margin: 0 0 5px 0; color: #666666; font-size: 13px;">Variant: <span style="color: #1a1a1a;">${item.variationName}</span></p>`
                        : '';

                    itemsHtml += `
                        <tr>
                            <td style="padding: 20px; border-bottom: 1px solid #f0f0f0;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="padding: 0;">
                                            <p style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.4;">
                                                ${item.name || 'Product'}</p>
                                            ${variationText}
                                            <p style="margin: 0; color: #666666; font-size: 13px;">Quantity:
                                                <span style="color: #1a1a1a; font-weight: 600;">${item.quantity || 1}</span>
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    `;
                });

                // Prepare email variables
                const emailVariables = {
                    orderID: orderID,
                    orderDate: orderDate,
                    paymentMode: paymentMode || 'COD',
                    productCount: items.length,
                    itemsList: itemsHtml
                };

                // Queue email
                await addSendEmailJob({
                    to: sellerEmail,
                    templateName: 'order_notify',
                    variables: emailVariables,
                    subject: `New Order #${orderID} - ${items.length} Product(s) - Ithyaraa`
                });

                console.log(`Seller notification email queued for ${sellerEmail} (${brandID === 'inhouse' ? 'Inhouse' : sellerName}) - Order ${orderID} - ${items.length} product(s)`);
            } catch (brandError) {
                console.error(`Error sending notification for brandID ${brandID}:`, brandError);
                // Continue with other brands even if one fails
            }
        }
    } catch (error) {
        console.error('Error sending seller notification emails:', error);
        // Don't throw error - email failure shouldn't break order placement
    }
}

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
        // Normalize FRONTEND_URL - remove trailing slashes
        const frontendUrlBase = (process.env.FRONTEND_URL || 'https://backend.ithyaraa.com').replace(/\/+$/, '');
        // Construct redirect URL and normalize to prevent double slashes (preserve protocol)
        const redirectUrl = `${frontendUrlBase}/order-status/order-summary/${order.orderID}`.replace(/([^:]\/)\/+/g, '$1');
        // Use order-specific webhook endpoint - ensure no trailing slashes
        const backendUrl = (process.env.BACKEND_URL || 'https://backend.ithyaraa.com').replace(/\/+$/, '');
        const callbackUrl = `${backendUrl}/api/phonepe/webhook/order`;

        console.log('[ORDER] PhonePe callback URL:', callbackUrl);
        console.log('[ORDER] PhonePe redirect URL:', redirectUrl);

        const payload = {
            merchantId,
            merchantTransactionId: merchantOrderId,
            amount: amountPaise, // integer paise
            redirectUrl,
            callbackUrl, // PhonePe will call this URL for webhook notifications
            redirectMode: "REDIRECT",
            paymentInstrument: { type: "PAY_PAGE" }
        };

        console.log('[ORDER] PhonePe Payment Request Payload:', JSON.stringify(payload, null, 2));
        console.log('[ORDER] PhonePe API URL:', phonePeUrl);
        console.log('[ORDER] Callback URL being sent to PhonePe:', callbackUrl);
        console.log('[ORDER] Redirect URL being sent to PhonePe:', redirectUrl);
        console.log('[ORDER] IMPORTANT: Ensure this callback URL is accessible and whitelisted in PhonePe dashboard');

        const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
        const checksum = generateChecksum(base64Payload);

        const response = await fetch(phonePeUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-VERIFY": checksum,
                "X-MERCHANT-ID": merchantId
            },
            body: JSON.stringify({ request: base64Payload })
        });

        const data = await response.json();
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
                checkoutPageUrl: checkoutUrl || data
            });
        } else {
            return res.status(500).json({
                success: false,
                message: "PhonePe did not return redirect URL",
                details: data
            });
        }

    } catch (error) {
        console.error("Order placement error:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};

const getOrderItemsByUidController = async (req, res) => {
    try {
        const uid = req.user.uid;
        const items = await orderService.getOrderItemsByUid(uid);
        return res.status(200).json({ success: true, items });
    } catch (error) {
        console.error('Get order items error:', error);
        return res.status(400).json({ success: false, message: error.message });
    }
};

const getOrderSummariesController = async (req, res) => {
    try {
        const uid = req.user.uid;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const searchOrderID = req.query.orderID || null;
        const status = req.query.status || null;
        const sortField = req.query.sortField || null;
        const sortOrder = req.query.sortOrder || null;

        const result = await orderService.getOrderSummaries(uid, page, limit, searchOrderID, status, sortField, sortOrder);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error('Get order summaries error:', error);
        return res.status(400).json({ success: false, message: error.message });
    }
};

const getOrderDetailsByOrderIDController = async (req, res) => {
    try {
        const uid = req.user.uid;
        const { orderID } = req.params;
        const { items, orderDetail } = await orderService.getOrderDetailsByOrderID(orderID, uid);
        return res.status(200).json({ success: true, items, orderDetail });
    } catch (error) {
        console.error('Get order details error:', error);
        return res.status(400).json({ success: false, message: error.message });
    }
};

const safeParseFeaturedImage = (value) => {
    try {
        let parsed = value;
        while (typeof parsed === 'string') parsed = JSON.parse(parsed);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const getMyReturnsController = async (req, res) => {
    try {
        const uid = req.user?.uid;
        if (!uid) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const orderModel = require('../model/orderModel');
        const rows = await orderModel.getMyReturns(uid);
        const grouped = {};
        for (const row of rows) {
            const id = row.orderID;
            if (!grouped[id]) {
                grouped[id] = {
                    orderID: id,
                    orderCreatedAt: row.orderCreatedAt,
                    deliveredAt: row.deliveredAt,
                    orderStatus: row.orderStatus,
                    items: []
                };
            }
            grouped[id].items.push({
                orderItemID: row.orderItemID,
                productID: row.productID,
                name: row.name,
                featuredImage: safeParseFeaturedImage(row.featuredImage),
                quantity: row.quantity,
                variationName: row.variationName,
                lineTotalAfter: row.lineTotalAfter,
                returnStatus: row.returnStatus,
                returnRequestedAt: row.returnRequestedAt,
                returnTrackingCode: row.returnTrackingCode,
                returnDeliveryCompany: row.returnDeliveryCompany,
                returnTrackingUrl: row.returnTrackingUrl,
                replacementOrderID: row.replacementOrderID,
                refundQueryID: row.refundQueryID
            });
        }
        const returns = Object.values(grouped).sort((a, b) => new Date(b.orderCreatedAt) - new Date(a.orderCreatedAt));
        return res.status(200).json({ success: true, returns });
    } catch (error) {
        console.error('Get my returns error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    placeOrderController,
    getOrderItemsByUidController,
    getOrderSummariesController,
    getOrderDetailsByOrderIDController,
    getMyReturnsController
};

const updateOrderController = async (req, res) => {
    try {
        const { orderID } = req.params;
        if (!orderID) {
            return res.status(400).json({ success: false, message: 'orderID is required' });
        }

        const updated = await orderService.updateOrder(orderID, req.body || {});
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Order not found or no valid fields to update' });
        }

        return res.status(200).json({ success: true, order: updated });
    } catch (error) {
        console.error('Update order error:', error);
        return res.status(400).json({ success: false, message: error.message });
    }
};

// Get order details by order ID
const getOrderDetailsController = async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' });
        }

        const orderDetails = await orderService.getOrderDetails(orderId, req.user.uid);
        if (!orderDetails) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        return res.status(200).json({ success: true, data: orderDetails });
    } catch (error) {
        console.error('Get order details error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get order details by order ID for admin
const getAdminOrderDetailsController = async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' });
        }

        const orderDetails = await orderService.getAdminOrderDetails(orderId);
        if (!orderDetails) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        return res.status(200).json({ success: true, data: orderDetails });
    } catch (error) {
        console.error('Get admin order details error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get all orders for admin
const getAllOrdersController = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, paymentStatus, search } = req.query;
        const offset = (page - 1) * limit;

        const orders = await orderService.getAllOrders({
            page: parseInt(page),
            limit: parseInt(limit),
            offset,
            status,
            paymentStatus,
            search
        });

        return res.status(200).json({
            success: true,
            data: orders.orders,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(orders.total / limit),
                totalOrders: orders.total,
                hasNext: page < Math.ceil(orders.total / limit),
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Get all orders error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: list refund queries (GET ?page=&limit=&status=)
const getRefundQueriesController = async (req, res) => {
    try {
        const refundQueryModel = require('../model/refundQueryModel');
        const { page = 1, limit = 20, status } = req.query;
        const result = await refundQueryModel.getRefundQueriesList({ page, limit, status: status || null });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error('Get refund queries error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: update refund query status (PUT body { status })
const updateRefundQueryStatusController = async (req, res) => {
    try {
        const refundQueryModel = require('../model/refundQueryModel');
        const { refundQueryID } = req.params;
        const { status } = req.body || {};
        if (!refundQueryID || !status) return res.status(400).json({ success: false, message: 'refundQueryID and status required' });
        const valid = ['pending', 'contacting_customer', 'resolved'];
        if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
        const updated = await refundQueryModel.updateRefundQueryStatus(refundQueryID, status);
        if (!updated) return res.status(404).json({ success: false, message: 'Refund query not found' });
        return res.status(200).json({ success: true, message: 'Status updated' });
    } catch (error) {
        console.error('Update refund query status error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Partial return: POST body { orderID, orderItemID? (optional), reason? }
const returnOrderController = async (req, res) => {
    try {
        const uid = req.user?.uid;
        if (!uid) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { orderID, orderItemID, reason } = req.body || {};
        if (!orderID) return res.status(400).json({ success: false, message: 'orderID is required' });
        const result = await orderService.returnOrder(uid, { orderID, orderItemID: orderItemID || null, reason: reason || null });
        return res.status(200).json(result);
    } catch (error) {
        console.error('Return order error:', error);
        return res.status(400).json({ success: false, message: error.message || 'Return request failed' });
    }
};

// Update order status
const updateOrderStatusController = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { orderStatus } = req.body;

        if (!orderId || !orderStatus) {
            return res.status(400).json({ success: false, message: 'orderId and orderStatus are required' });
        }

        const validStatuses = ['Preparing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
        if (!validStatuses.includes(orderStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid order status' });
        }

        const updated = await orderService.updateOrderStatus(orderId, orderStatus);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        return res.status(200).json({ success: true, message: 'Order status updated successfully', order: updated });
    } catch (error) {
        console.error('Update order status error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Update payment status
const updatePaymentStatusController = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { paymentStatus } = req.body;

        if (!orderId || !paymentStatus) {
            return res.status(400).json({ success: false, message: 'orderId and paymentStatus are required' });
        }

        const validStatuses = ['pending', 'successful', 'failed', 'refunded'];
        if (!validStatuses.includes(paymentStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid payment status' });
        }

        const updated = await orderService.updatePaymentStatus(orderId, paymentStatus);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        return res.status(200).json({ success: true, message: 'Payment status updated successfully', order: updated });
    } catch (error) {
        console.error('Update payment status error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Generate invoice
const generateInvoiceController = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { action = 'download' } = req.query; // 'download' or 'data'

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' });
        }

        const result = await orderService.generateInvoice(orderId);
        if (!result || !result.success) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (action === 'download') {
            // Set headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${result.invoice.fileName}"`);
            res.setHeader('Content-Length', result.invoice.pdfBuffer.length);

            // Send PDF buffer
            return res.send(result.invoice.pdfBuffer);
        } else {
            // Return invoice data for frontend
            return res.status(200).json({
                success: true,
                data: result.data,
                invoice: {
                    orderId: result.invoice.orderId,
                    invoiceNumber: result.invoice.invoiceNumber,
                    fileName: result.invoice.fileName,
                    generatedAt: result.invoice.generatedAt
                }
            });
        }
    } catch (error) {
        console.error('Generate invoice error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Generate invoice for user (with ownership check)
const generateInvoiceForUserController = async (req, res) => {
    try {
        const { orderId } = req.params;
        const uid = req.user.uid; // Get user ID from JWT
        const { action = 'download' } = req.query; // 'download' or 'data'

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' });
        }

        // Get order details and verify ownership
        const order = await orderModel.getOrderByID(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Verify that the order belongs to the user
        if (order.uid !== uid) {
            return res.status(403).json({ success: false, message: 'You do not have permission to access this order' });
        }

        const result = await orderService.generateInvoice(orderId);
        if (!result || !result.success) {
            return res.status(404).json({ success: false, message: 'Failed to generate invoice' });
        }

        if (action === 'download') {
            // Set headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${result.invoice.fileName}"`);
            res.setHeader('Content-Length', result.invoice.pdfBuffer.length);

            // Send PDF buffer
            return res.send(result.invoice.pdfBuffer);
        } else {
            // Return invoice data for frontend
            return res.status(200).json({
                success: true,
                data: result.data,
                invoice: {
                    orderId: result.invoice.orderId,
                    invoiceNumber: result.invoice.invoiceNumber,
                    fileName: result.invoice.fileName,
                    generatedAt: result.invoice.generatedAt
                }
            });
        }
    } catch (error) {
        console.error('Generate invoice error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Email invoice to customer
const emailInvoiceController = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' });
        }

        const result = await orderService.emailInvoice(orderId);
        if (!result || !result.success) {
            return res.status(404).json({ success: false, message: result.message || 'Failed to send invoice' });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            email: result.email
        });
    } catch (error) {
        console.error('Email invoice error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Update order items tracking (for admin): shipment AWB and/or return AWB; match by orderItemID or name+variationName
const updateOrderItemsTrackingController = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { items } = req.body; // [{ orderItemID?, name?, variationName?, trackingCode?, deliveryCompany?, returnTrackingCode?, returnDeliveryCompany?, itemStatus? }]
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Items array is required' });
        }

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' });
        }

        const [verify] = await db.query(
            `SELECT 1 FROM orderDetail WHERE orderID = ? LIMIT 1`,
            [orderId]
        );
        if (verify.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        let updated = 0;
        let anyDelivered = false;
        for (const it of items) {
            if (!it) continue;
            const updates = [];
            const params = [];
            if (it.trackingCode !== undefined || it.deliveryCompany !== undefined) {
                updates.push('trackingCode = ?, deliveryCompany = ?');
                params.push(it.trackingCode ?? null, it.deliveryCompany ?? null);
            }
            if (it.returnTrackingCode !== undefined || it.returnDeliveryCompany !== undefined) {
                updates.push('returnTrackingCode = ?, returnDeliveryCompany = ?');
                params.push(it.returnTrackingCode ?? null, it.returnDeliveryCompany ?? null);
            }
            if (it.returnTrackingUrl !== undefined) {
                updates.push('returnTrackingUrl = ?');
                params.push(it.returnTrackingUrl ?? null);
            }
            if (it.itemStatus !== undefined) {
                updates.push('itemStatus = ?');
                const statusLower = String(it.itemStatus).toLowerCase();
                if (statusLower === 'delivered') {
                    anyDelivered = true;
                }
                params.push(statusLower);
            } else if (it.trackingCode && updates.length > 0) {
                updates.push('itemStatus = ?');
                params.push('shipped');
            }
            if (it.returnStatus !== undefined) {
                updates.push('returnStatus = ?');
                params.push(it.returnStatus || 'none');
            }
            if (updates.length === 0) continue;

            const setClause = updates.join(', ');
            params.push(orderId);
            let whereClause;
            const whereParams = [];
            if (it.orderItemID != null) {
                whereClause = 'orderItemID = ?';
                whereParams.push(it.orderItemID);
            } else {
                whereClause = 'name = ?';
                whereParams.push(it.name);
                if (it.variationName) {
                    whereClause += ' AND variationName = ?';
                    whereParams.push(it.variationName);
                } else {
                    whereClause += ' AND (variationName IS NULL OR variationName = "")';
                }
            }

            const [result] = await db.query(
                `UPDATE order_items SET ${setClause} WHERE orderID = ? AND ${whereClause} LIMIT 1`,
                [...params, ...whereParams]
            );
            updated += result.affectedRows || 0;
        }

        // If any item was marked as delivered via tracking, ensure deliveredAt and coinLockUntil are populated
        if (anyDelivered) {
            const now = new Date();
            await db.query(
                `UPDATE orderDetail SET deliveredAt = ? WHERE orderID = ? AND deliveredAt IS NULL`,
                [now, orderId]
            );
            const lockUntil = new Date(now.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
            await db.query(
                `UPDATE order_items SET coinLockUntil = ? WHERE orderID = ? AND coinLockUntil IS NULL AND itemStatus = 'delivered'`,
                [lockUntil, orderId]
            );
        }

        return res.json({ success: true, message: 'Tracking info updated', updatedCount: updated });
    } catch (error) {
        console.error('Error updating item tracking info:', error);
        return res.status(500).json({ success: false, message: 'Failed to update tracking info', error: error.message });
    }
};

// Email invoice to customer (user-facing)
const emailInvoiceToCustomerController = async (req, res) => {
    try {
        const { orderId } = req.params;
        const uid = req.user.uid; // Get user ID from JWT

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' });
        }

        const result = await orderService.emailInvoiceToCustomer(orderId, uid);
        if (!result || !result.success) {
            return res.status(404).json({ success: false, message: result.message || 'Failed to send invoice' });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            email: result.email,
            requestedTimestamp: result.requestedTimestamp
        });
    } catch (error) {
        console.error('Email invoice to customer error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports.updateOrderController = updateOrderController;
module.exports.getOrderDetailsController = getOrderDetailsController;
module.exports.getAdminOrderDetailsController = getAdminOrderDetailsController;
module.exports.getAllOrdersController = getAllOrdersController;
module.exports.returnOrderController = returnOrderController;
module.exports.getRefundQueriesController = getRefundQueriesController;
module.exports.updateRefundQueryStatusController = updateRefundQueryStatusController;
module.exports.updateOrderStatusController = updateOrderStatusController;
module.exports.updatePaymentStatusController = updatePaymentStatusController;
module.exports.generateInvoiceController = generateInvoiceController;
module.exports.generateInvoiceForUserController = generateInvoiceForUserController;
module.exports.emailInvoiceController = emailInvoiceController;
module.exports.emailInvoiceToCustomerController = emailInvoiceToCustomerController;
module.exports.updateOrderItemsTrackingController = updateOrderItemsTrackingController;
module.exports.sendOrderConfirmationEmail = sendOrderConfirmationEmail;
module.exports.sendSellerNotificationEmails = sendSellerNotificationEmails;
