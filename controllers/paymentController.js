const paymentTokenModel = require('./../model/paymentTokenModel');
const orderModel = require('./../model/orderModel');
const presaleBookingModel = require('./../model/presaleBookingModel');
const phonepeService = require('./../services/phonepeService');
const fetch = require('node-fetch');

const handleTokenPayment = async (req, res) => {
    const { token } = req.params;

    try {
        console.log(`[PAY TOKEN] Processing token: ${token}`);

        // 1. Validate token
        const tokenData = await paymentTokenModel.getValidToken(token);
        if (!tokenData) {
            console.error(`[PAY TOKEN] Token invalid, used, or expired: ${token}`);
            return res.status(410).json({
                success: false,
                message: 'Payment session expired or already used. Please initiate a new payment from the app.'
            });
        }

        const { orderID, merchantTransactionId, type } = tokenData;
        console.log(`[PAY TOKEN] Token valid for ${type} ID: ${orderID}`);

        // 2. Fetch Order/Booking Details to get the amount and UID
        let order;
        let amount;
        let uid;

        if (type === 'order' || type === 'buy_now') {
            order = await orderModel.getOrderByID(orderID);
            if (!order) throw new Error('Order not found');
            amount = order.total;
            uid = order.uid;
        } else if (type === 'presale') {
            order = await presaleBookingModel.getPresaleBookingByID(orderID);
            if (!order) throw new Error('Presale booking not found');
            amount = order.total; // In presaleBookingModel, the field is 'total'
            uid = order.uid;
        }

        const amountPaise = Math.round(Number(amount) * 100);

        // 3. Reconstruct PhonePe Payload (REUSE logic from controllers)
        const merchantId = process.env.MERCHANT_ID || 'ITHYARAAONLINE';
        const phonePeUrl = process.env.NODE_ENV === "production"
            ? "https://api.phonepe.com/apis/hermes/pg/v1/pay"
            : "https://api-preprod.phonepe.com/apis/hermes/pg/v1/pay";

        const frontendUrlBase = (process.env.FRONTEND_URL || 'https://ithyaraa.com').replace(/\/+$/, '');
        const backendUrl = (process.env.BACKEND_URL || 'https://backend.ithyaraa.com').replace(/\/+$/, '');

        const redirectUrl = type === 'presale'
            ? `${frontendUrlBase}/order-status/presale-summary/${orderID}`.replace(/([^:]\/)\/+/g, '$1')
            : `${frontendUrlBase}/order-status/order-summary/${orderID}`.replace(/([^:]\/)\/+/g, '$1');

        const callbackUrl = type === 'presale'
            ? `${backendUrl}/api/phonepe/webhook/presale`
            : `${backendUrl}/api/phonepe/webhook/order`;

        const payload = {
            merchantId,
            merchantTransactionId,
            merchantUserId: uid,
            amount: amountPaise,
            redirectUrl,
            callbackUrl,
            redirectMode: "REDIRECT",
            paymentInstrument: { type: "PAY_PAGE" }
        };

        const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
        const checksum = phonepeService.generateChecksum("/pg/v1/pay", base64Payload);

        const headers = {
            "Content-Type": "application/json",
            "X-VERIFY": checksum,
            "X-MERCHANT-ID": merchantId,
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
        };

        // 4. Call PhonePe
        console.log(`[PAY TOKEN] Calling PhonePe for order ${orderID}...`);
        const response = await fetch(phonePeUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ request: base64Payload })
        });

        const data = await response.json();

        if (data.success) {
            const checkoutUrl = data?.data?.instrumentResponse?.redirectInfo?.url || data?.data?.redirectUrl;
            if (checkoutUrl) {
                // 5. Success - Mark token as used and redirect
                await paymentTokenModel.markTokenAsUsed(token);
                console.log(`[PAY TOKEN] Success. Redirecting to: ${checkoutUrl}`);
                return res.redirect(checkoutUrl);
            }
        }

        console.error(`[PAY TOKEN] PhonePe API failed:`, JSON.stringify(data));
        return res.status(502).json({
            success: false,
            message: 'Failed to initiate payment with PhonePe. Please try again.'
        });

    } catch (error) {
        console.error(`[PAY TOKEN] Error processing token:`, error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    handleTokenPayment
};
