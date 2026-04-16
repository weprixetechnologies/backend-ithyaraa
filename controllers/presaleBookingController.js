const presaleBookingModel = require('../model/presaleBookingModel');
const productModel = require('../model/productModel');
const usersModel = require('../model/usersModel');
const phonepeService = require('../services/phonepeService');
const { randomUUID } = require('crypto');
const fetch = require('node-fetch');

const placePrebookingOrderController = async (req, res) => {
    try {
        const uid = req.user.uid;
        const rawMode = (req.body && req.body.paymentMode) ? String(req.body.paymentMode) : 'COD';
        const paymentMode = rawMode.toUpperCase() === 'PREPAID' ? 'PREPAID' : 'COD';

        // Extract addressID, productID, variationID, and quantity from req.body
        const { addressID, productID, variationID, quantity = 1 } = req.body;

        // Validate required fields
        if (!addressID) {
            return res.status(400).json({ success: false, message: 'Address ID is required' });
        }

        // Fetch user data for email
        const user = await usersModel.findByuid(uid);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const booking = await require('../services/presaleBookingService').placePrebookingOrder(uid, addressID, paymentMode, productID, variationID, quantity);

        if (paymentMode === 'COD') {
            return res.status(200).json({
                success: true,
                paymentMode: 'COD',
                preBookingID: booking.preBookingID,
                orderStatus: booking.orderStatus,
                status: booking.status,
                paymentStatus: booking.paymentStatus
            });
        }

        // Default to PREPAID using PhonePe flow
        const amountRupees = Number(booking.total);
        const amountPaise = Math.round((isNaN(amountRupees) ? 0 : amountRupees) * 100);

        if (!amountPaise || amountPaise <= 0) {
            return res.status(400).send("Valid amount is required");
        }

        const merchantOrderId = randomUUID();
        const merchantId = process.env.MERCHANT_ID || 'ITHYARAAONLINE';

        // Normalize FRONTEND_URL - remove trailing slashes
        const frontendUrlBase = (process.env.FRONTEND_URL || 'https://backend.ithyaraa.com').replace(/\/+$/, '');
        // Construct redirect URL and normalize to prevent double slashes (preserve protocol)
        const redirectUrl = `${frontendUrlBase}/presale/order-status/${booking.preBookingID}`.replace(/([^:]\/)\/+/g, '$1');
        // Use presale-specific webhook endpoint - ensure no trailing slashes
        const backendUrl = (process.env.BACKEND_URL || 'https://backend.ithyaraa.com').replace(/\/+$/, '');
        const callbackUrl = `${backendUrl}/api/phonepe/webhook/presale`;

        console.log('[PRESALE] PhonePe redirect URL:', redirectUrl);

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

        console.log('[PRESALE] PhonePe Payment Request Payload:', JSON.stringify(payload, null, 2));
        console.log('[PRESALE] Callback URL being sent to PhonePe:', callbackUrl);
        console.log('[PRESALE] Redirect URL being sent to PhonePe:', redirectUrl);
        console.log('[PRESALE] IMPORTANT: Ensure this callback URL is accessible and whitelisted in PhonePe dashboard');

        const data = await phonepeService.initiatePayment(payload, clientIp, userAgent);
        console.log("[PRESALE] PhonePe API Response:", JSON.stringify(data, null, 2));

        // Check if PhonePe accepted the callback URL
        if (data.success && data.data) {
            console.log('[PRESALE] PhonePe accepted the payment request');
            console.log('[PRESALE] Check PhonePe dashboard for webhook delivery logs');
        } else {
            console.error('[PRESALE] PhonePe payment request may have failed or callback URL not accepted');
        }

        if (data.success) {
            // Store transaction IDs in the booking
            try {
                await presaleBookingModel.addmerchantID(booking.preBookingID, merchantOrderId, merchantId);
            } catch (updateError) {
                console.error('Error storing merchant transaction ID:', updateError);
                // Don't fail the response, just log the error
            }

            const checkoutUrl = data?.data?.instrumentResponse?.redirectInfo?.url || data?.data?.redirectUrl || null;
            return res.json({
                success: true,
                paymentMode: 'PREPAID',
                preBookingID: booking.preBookingID,
                merchantID: merchantOrderId,
                checkoutPageUrl: checkoutUrl || data,
                orderStatus: booking.orderStatus,
                status: booking.status,
                paymentStatus: booking.paymentStatus
            });
        } else {
            console.error('[PRESALE] PhonePe API error:', data);
            return res.status(500).json({
                success: false,
                message: 'PhonePe payment initiation failed',
                error: data
            });
        }

    } catch (error) {
        console.error('Presale prebooking error:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

const getPresaleBookingByUidController = async (req, res) => {
    try {
        const uid = req.user.uid;
        const bookings = await presaleBookingModel.getBookingsByUid(uid);
        res.status(200).json({ success: true, bookings });
    } catch (error) {
        console.error('Get presale bookings error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getPresaleBookingDetailsByBookingIDController = async (req, res) => {
    try {
        const preBookingID = req.params.preBookingID;
        const uid = req.user.uid;
        const booking = await presaleBookingModel.getBookingByBookingID(preBookingID, uid);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        const items = await presaleBookingModel.getBookingItemsByBookingID(preBookingID);
        res.status(200).json({ success: true, booking, items });
    } catch (error) {
        console.error('Get presale booking details error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    placePrebookingOrderController,
    getPresaleBookingByUidController,
    getPresaleBookingDetailsByBookingIDController
};

