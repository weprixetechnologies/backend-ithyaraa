const presaleBookingService = require('../services/presaleBookingService');
const presaleBookingModel = require('../model/presaleBookingModel');
const { randomUUID } = require('crypto');
const crypto = require('crypto');
const fetch = require('node-fetch');

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

/**
 * Place a presale booking order
 * POST /api/presale/place-prebooking-order
 */
const placePrebookingOrderController = async (req, res) => {
    try {
        const uid = req.user.uid; // JWT payload uses uid
        const rawMode = (req.body && req.body.paymentMode) ? String(req.body.paymentMode) : 'COD';
        const paymentMode = rawMode.toUpperCase() === 'PREPAID' || rawMode.toUpperCase() === 'PHONEPE'
            ? 'PREPAID'
            : 'COD';

        // Extract addressID, productID, variationID, and quantity from req.body
        const { addressID, productID, variationID, quantity = 1 } = req.body;

        // Validate required fields
        if (!addressID) {
            return res.status(400).json({ success: false, message: 'Address ID is required' });
        }

        if (!productID) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        // Place the presale booking order
        const booking = await presaleBookingService.placePresaleBookingOrder(
            uid,
            addressID,
            productID,
            paymentMode,
            quantity,
            variationID
        );

        // Handle COD orders
        if (paymentMode === 'COD') {
            return res.status(200).json({
                success: true,
                paymentMode: 'COD',
                preBookingID: booking.preBookingID,
                orderStatus: booking.orderStatus,
                status: booking.status,
                paymentStatus: booking.paymentStatus,
                booking
            });
        }

        // Handle PREPAID/PhonePe orders
        // Ensure amount is an integer in paise for PhonePe
        const amountRupees = Number(booking.bookingData.summary.total);
        const amountPaise = Math.round((isNaN(amountRupees) ? 0 : amountRupees) * 100);

        if (!amountPaise || amountPaise <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid amount is required"
            });
        }

        const merchantOrderId = randomUUID();
        const frontendUrl = process.env.FRONTEND_URL || 'http://72.60.219.181:3002';
        // Redirect to order-status page after payment (using preBookingID as orderId)
        const redirectUrl = `${frontendUrl}/order-status/order-summary/${booking.preBookingID}`;
        // Use presale-specific webhook endpoint
        const callbackUrl = `${process.env.BACKEND_URL || 'http://72.60.219.181:3002'}/api/phonepe/webhook/presale`;

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
        console.log("PhonePe response for presale booking:", data);

        if (data.success) {
            // Store transaction IDs in the booking
            try {
                await presaleBookingModel.addMerchantTransactionId(booking.preBookingID, merchantOrderId, merchantId);
            } catch (updateError) {
                console.error('Error storing merchant transaction ID:', updateError);
                // Don't fail the response, just log the error
            }

            // Try to extract the redirect URL if present
            const checkoutUrl = data?.data?.instrumentResponse?.redirectInfo?.url || data?.data?.redirectUrl || null;
            return res.json({
                success: true,
                paymentMode: 'PREPAID',
                preBookingID: booking.preBookingID,
                merchantTransactionId: merchantOrderId,
                checkoutPageUrl: checkoutUrl || data,
                orderStatus: booking.orderStatus,
                status: booking.status,
                paymentStatus: booking.paymentStatus
            });
        } else {
            return res.status(500).json({
                success: false,
                message: "PhonePe did not return redirect URL",
                details: data
            });
        }

    } catch (error) {
        console.error("Presale booking order placement error:", error);
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to place presale booking order'
        });
    }
};

/**
 * Get presale booking details by preBookingID
 * GET /api/presale/booking-details/:preBookingID
 */
const getPresaleBookingDetailsController = async (req, res) => {
    try {
        const uid = req.user.uid;
        const { preBookingID } = req.params;

        if (!preBookingID) {
            return res.status(400).json({ success: false, message: 'PreBooking ID is required' });
        }

        const bookingDetails = await presaleBookingService.getPresaleBookingDetails(preBookingID, uid);

        if (!bookingDetails) {
            return res.status(404).json({ success: false, message: 'Presale booking not found' });
        }

        return res.status(200).json({
            success: true,
            items: bookingDetails.items,
            orderDetail: bookingDetails.orderDetail
        });
    } catch (error) {
        console.error('Get presale booking details error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get presale booking details'
        });
    }
};

module.exports = {
    placePrebookingOrderController,
    getPresaleBookingDetailsController
};

