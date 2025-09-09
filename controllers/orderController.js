const orderService = require('../services/orderService');
const orderModel = require('../model/orderModel');
const { randomUUID } = require('crypto');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { addSendEmailJob } = require('../queue/emailProducer');
const usersModel = require('../model/usersModel');

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
            trackOrderUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/track-order/${order.orderID}`,
            websiteUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
        };

        await addSendEmailJob({
            to: user.emailID,
            templateName: 'order-confirmation',
            variables: emailVariables,
            subject: `Order Confirmation #${order.orderID} - Ithyaraa`
        });

        console.log(`Order confirmation email sent to ${user.emailID} for order ${order.orderID}`);
    } catch (error) {
        console.error('Error sending order confirmation email:', error);
        // Don't throw error - email failure shouldn't break order placement
    }
}

const placeOrderController = async (req, res) => {
    try {
        const uid = req.user.uid; // assuming middleware sets req.user
        const rawMode = (req.body && req.body.paymentMode) ? String(req.body.paymentMode) : 'COD';
        const paymentMode = rawMode.toUpperCase() === 'PREPAID' ? 'PREPAID' : 'COD';

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
            const order = await orderService.placeOrder(uid, addressID, paymentMode, couponCode);

            // Send confirmation email for COD
            await sendOrderConfirmationEmail(user, order, 'COD');

            return res.status(200).json({
                success: true,
                paymentMode: 'COD',
                orderID: order.orderID,
                order
            });
        }

        // Default to PREPAID using PhonePe flow
        const order = await orderService.placeOrder(uid, addressID, paymentMode, couponCode);
        // Ensure amount is an integer in paise for PhonePe
        const amountRupees = Number(order.orderData.summary.total);
        const amountPaise = Math.round((isNaN(amountRupees) ? 0 : amountRupees) * 100);

        if (!amountPaise || amountPaise <= 0) {
            return res.status(400).send("Valid amount is required");
        }

        const merchantOrderId = randomUUID();
        const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-status?merchantTransactionId=${merchantOrderId}`;
        const callbackUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/phonepe/webhook`;

        const payload = {
            merchantId,
            merchantTransactionId: merchantOrderId,
            amount: amountPaise, // integer paise
            redirectUrl,
            callbackUrl, // PhonePe will call this URL for webhook notifications
            redirectMode: "REDIRECT",
            paymentInstrument: { type: "PAY_PAGE" }
        };

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
        console.log("PhonePe response:", data);

        if (data.success) {
            // Store merchant transaction ID in the order
            try {
                await orderModel.addMerchantTransactionId(order.orderID, merchantOrderId);
            } catch (updateError) {
                console.error('Error storing merchant transaction ID:', updateError);
                // Don't fail the response, just log the error
            }

            // Send confirmation email for PREPAID (order is already placed)
            await sendOrderConfirmationEmail(user, order, 'PREPAID', merchantOrderId);

            // Try to extract the redirect URL if present
            const checkoutUrl = data?.data?.instrumentResponse?.redirectInfo?.url || data?.data?.redirectUrl || null;
            return res.json({
                success: true,
                paymentMode: 'PREPAID',
                orderID: order.orderID,
                merchantOrderId,
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

module.exports = { placeOrderController, getOrderItemsByUidController };

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

module.exports.updateOrderController = updateOrderController;
