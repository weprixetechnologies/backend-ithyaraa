const presaleBookingService = require('../services/presaleBookingService');
const presaleBookingModel = require('../model/presaleBookingModel');
const usersModel = require('../model/usersModel');
const invoiceService = require('../services/invoiceService');
const { addSendEmailJob } = require('../queue/emailProducer');
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
            // Send confirmation email for COD
            try {
                const user = await usersModel.findByuid(uid);
                if (user) {
                    await sendPreBookingOrderConfirmationEmail(user, booking, 'COD');

                    // Send seller notification emails
                    await sendPresaleSellerNotificationEmails(booking.preBookingID, 'COD');
                }
            } catch (emailError) {
                console.error('Error sending presale booking confirmation emails:', emailError);
                // Don't fail the response - email failure shouldn't break order placement
            }

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
        // Normalize FRONTEND_URL - remove trailing slashes
        const frontendUrlBase = (process.env.FRONTEND_URL || 'https://build.ithyaraa.com').replace(/\/+$/, '');
        // Construct redirect URL and normalize to prevent double slashes (preserve protocol)
        const redirectUrl = `${frontendUrlBase}/presale/order-status/${booking.preBookingID}`.replace(/([^:]\/)\/+/g, '$1');
        // Use presale-specific webhook endpoint - ensure no trailing slashes
        const backendUrl = (process.env.BACKEND_URL || 'https://api.ithyaraa.com').replace(/\/+$/, '');
        const callbackUrl = `${backendUrl}/api/phonepe/webhook/presale`;

        console.log('[PRESALE] PhonePe callback URL:', callbackUrl);
        console.log('[PRESALE] PhonePe redirect URL:', redirectUrl);

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
                await presaleBookingModel.addmerchantID(booking.preBookingID, merchantOrderId, merchantId);
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
                merchantID: merchantOrderId,
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

/**
 * Get all presale bookings for the authenticated user
 * GET /api/presale/my-bookings
 */
const getUserPresaleBookingsController = async (req, res) => {
    try {
        const uid = req.user.uid;
        const { page = 1, limit = 10, status, paymentStatus } = req.query;

        const result = await presaleBookingService.getUserPresaleBookings(uid, {
            page: parseInt(page),
            limit: parseInt(limit),
            status,
            paymentStatus
        });

        return res.status(200).json({
            success: true,
            bookings: result.bookings,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(result.total / limit),
                totalBookings: result.total,
                hasNext: page < Math.ceil(result.total / limit),
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Get user presale bookings error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get presale bookings'
        });
    }
};

/**
 * Get all presale bookings for admin
 * GET /api/admin/presale-bookings/all
 */
const getAllPresaleBookingsController = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, paymentStatus, search } = req.query;
        const offset = (page - 1) * limit;

        const bookings = await presaleBookingService.getAllPresaleBookings({
            page: parseInt(page),
            limit: parseInt(limit),
            offset,
            status,
            paymentStatus,
            search
        });

        return res.status(200).json({
            success: true,
            data: bookings.bookings,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(bookings.total / limit),
                totalBookings: bookings.total,
                hasNext: page < Math.ceil(bookings.total / limit),
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Get all presale bookings error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get presale booking details for admin
 * GET /api/admin/presale-bookings/:preBookingID
 */
const getAdminPresaleBookingDetailsController = async (req, res) => {
    try {
        const { preBookingID } = req.params;

        if (!preBookingID) {
            return res.status(400).json({ success: false, message: 'PreBooking ID is required' });
        }

        const bookingDetails = await presaleBookingService.getAdminPresaleBookingDetails(preBookingID);

        if (!bookingDetails) {
            return res.status(404).json({ success: false, message: 'Presale booking not found' });
        }

        return res.status(200).json({
            success: true,
            data: bookingDetails
        });
    } catch (error) {
        console.error('Get admin presale booking details error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to get presale booking details'
        });
    }
};

/**
 * Update presale booking order status
 * PUT /api/admin/presale-bookings/update-status/:preBookingID
 */
const updatePresaleBookingStatusController = async (req, res) => {
    try {
        const { preBookingID } = req.params;
        const { orderStatus } = req.body;

        if (!preBookingID) {
            return res.status(400).json({ success: false, message: 'PreBooking ID is required' });
        }

        if (!orderStatus) {
            return res.status(400).json({ success: false, message: 'Order status is required' });
        }

        const result = await presaleBookingService.updatePresaleBookingStatus(preBookingID, orderStatus);

        if (result) {
            return res.status(200).json({
                success: true,
                message: 'Order status updated successfully'
            });
        } else {
            return res.status(404).json({
                success: false,
                message: 'Presale booking not found'
            });
        }
    } catch (error) {
        console.error('Update presale booking status error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update order status'
        });
    }
};

/**
 * Update presale booking payment status
 * PUT /api/admin/presale-bookings/update-payment-status/:preBookingID
 */
const updatePresaleBookingPaymentStatusController = async (req, res) => {
    try {
        const { preBookingID } = req.params;
        const { paymentStatus } = req.body;

        if (!preBookingID) {
            return res.status(400).json({ success: false, message: 'PreBooking ID is required' });
        }

        if (!paymentStatus) {
            return res.status(400).json({ success: false, message: 'Payment status is required' });
        }

        // Get booking details to check payment type
        const booking = await presaleBookingModel.getPresaleBookingByID(preBookingID);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Presale booking not found' });
        }

        // Pass paymentType to the model function so it can handle PREPAID + pending logic
        await presaleBookingModel.updatePresaleBookingPaymentStatus(
            preBookingID,
            paymentStatus,
            null,
            null,
            booking.paymentType
        );

        return res.status(200).json({
            success: true,
            message: 'Payment status updated successfully'
        });
    } catch (error) {
        console.error('Update presale booking payment status error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update payment status'
        });
    }
};

/**
 * Update presale booking tracking code
 * PUT /api/admin/presale-bookings/update-tracking/:preBookingID
 */
const updatePresaleBookingTrackingController = async (req, res) => {
    try {
        const { preBookingID } = req.params;
        const { trackingCode, deliveryCompany } = req.body;

        if (!preBookingID) {
            return res.status(400).json({ success: false, message: 'PreBooking ID is required' });
        }

        const result = await presaleBookingService.updatePresaleBookingTracking(preBookingID, trackingCode, deliveryCompany);

        if (result) {
            return res.status(200).json({
                success: true,
                message: 'Tracking information updated successfully'
            });
        } else {
            return res.status(404).json({
                success: false,
                message: 'Presale booking not found'
            });
        }
    } catch (error) {
        console.error('Update presale booking tracking error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update tracking information'
        });
    }
};

/**
 * Generate invoice for presale booking
 * @param {string} preBookingID - Presale booking ID
 * @returns {Object} - Invoice result with PDF buffer
 */
async function generatePreBookingInvoice(preBookingID) {
    try {
        // Get presale booking details
        const booking = await presaleBookingModel.getPresaleBookingByID(preBookingID);

        if (!booking) {
            return { success: false, message: 'Presale booking not found' };
        }

        // Get user details for email
        const user = await usersModel.findByuid(booking.uid);

        // Get presale booking items
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

        // Build orderData structure compatible with invoiceService
        const orderData = {
            orderID: booking.preBookingID,
            createdAt: booking.createdAt,
            items: bookingItems.map(item => {
                const unitSalePrice = parseFloat(item.unitSalePrice || item.salePrice || 0);
                const unitRegularPrice = parseFloat(item.unitPrice || item.regularPrice || 0);
                const lineTotal = unitSalePrice * bookingQuantity;
                return {
                    name: item.name || 'Product',
                    variationName: item.variationName || null,
                    quantity: bookingQuantity,
                    unitPrice: unitSalePrice,
                    regularPrice: unitRegularPrice,
                    lineTotal: lineTotal,
                    lineTotalAfter: lineTotal, // Required by invoice PDF generation
                    lineTotalBefore: unitRegularPrice * bookingQuantity
                };
            }),
            subtotal: Number(booking.subtotal) || 0,
            discount: Number(booking.discount) || 0,
            shipping: 0, // Presale bookings typically don't have shipping charges upfront
            total: Number(booking.total) || 0,
            deliveryAddress: {
                emailID: user?.emailID || '',
                line1: booking.addressLine1 || '',
                line2: booking.addressLine2 || '',
                city: booking.city || '',
                state: booking.state || '',
                pincode: booking.pincode || '',
                landmark: booking.landmark || '',
                phoneNumber: booking.phoneNumber || ''
            },
            paymentMode: booking.paymentType || 'COD',
            status: booking.status || 'confirmed'
        };

        // Generate invoice data
        const invoiceData = invoiceService.generateInvoiceData(orderData);

        // Generate PDF buffer
        const pdfBuffer = await invoiceService.generateInvoicePDF(invoiceData);

        return {
            success: true,
            invoice: {
                orderId: booking.preBookingID,
                invoiceNumber: invoiceData.invoiceNumber,
                pdfBuffer: pdfBuffer,
                fileName: `invoice_presale_${booking.preBookingID}.pdf`,
                mimeType: 'application/pdf',
                generatedAt: invoiceData.generatedAt || new Date()
            },
            data: invoiceData
        };
    } catch (error) {
        console.error('Error generating presale booking invoice:', error);
        throw error;
    }
}

/**
 * Helper function to send presale booking order confirmation email
 * Similar to sendOrderConfirmationEmail but for presale bookings
 */
async function sendPreBookingOrderConfirmationEmail(user, booking, paymentMode, merchantOrderId = null) {
    try {
        const orderDate = new Date().toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Build items array for email template
        const items = booking.bookingData.items.map(item => ({
            name: item.productName || item.name,
            variationName: item.variationName || null,
            quantity: item.quantity,
            lineTotalAfter: item.lineTotal || (item.price * item.quantity),
            lineTotalBefore: item.lineTotal || (item.price * item.quantity),
            offerApplied: false
        }));

        const emailVariables = {
            customerName: user.name || user.username,
            orderID: booking.preBookingID,
            orderDate: orderDate,
            paymentMode: paymentMode,
            merchantOrderId: merchantOrderId,
            items: items,
            subtotal: booking.bookingData.summary.subtotal,
            totalDiscount: booking.bookingData.summary.totalDiscount || 0,
            total: booking.bookingData.summary.total,
            isCOD: paymentMode === 'COD',
            trackOrderUrl: (() => {
                const baseUrl = (process.env.FRONTEND_URL || 'https://build.ithyaraa.com').replace(/\/+$/, '');
                return `${baseUrl}/presale/order-status/${booking.preBookingID}`.replace(/([^:]\/)\/+/g, '$1');
            })(),
            websiteUrl: process.env.FRONTEND_URL || 'https://build.ithyaraa.com'
        };

        // Generate invoice PDF for attachment
        let attachments = [];
        try {
            console.log(`Attempting to generate invoice for presale booking ${booking.preBookingID}...`);
            const invoiceResult = await generatePreBookingInvoice(booking.preBookingID);

            if (invoiceResult && invoiceResult.success) {
                // Convert Buffer to base64 for queue serialization
                const pdfBuffer = invoiceResult.invoice.pdfBuffer;
                const base64Content = pdfBuffer.toString('base64');

                attachments = [{
                    filename: `invoice_presale_${booking.preBookingID}.pdf`,
                    content: base64Content, // Store as base64 string for queue
                    contentType: 'application/pdf',
                    encoding: 'base64' // Flag to indicate this needs decoding
                }];

                console.log(`✅ Invoice PDF generated for presale booking confirmation: ${pdfBuffer.length} bytes (base64: ${base64Content.length} chars)`);
            } else {
                console.warn(`⚠️ Invoice generation returned no result or success=false for presale booking ${booking.preBookingID}`);
            }
        } catch (invoiceError) {
            console.error(`❌ Error generating invoice for presale booking confirmation (preBookingID ${booking.preBookingID}):`, {
                message: invoiceError.message,
                stack: invoiceError.stack,
                name: invoiceError.name
            });
            // Continue without invoice attachment - don't break order confirmation
        }

        // Log before sending to queue
        console.log(`Adding presale booking email job to queue - attachments count: ${attachments.length}`);
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
            subject: `Presale Booking Confirmation #${booking.preBookingID} - Ithyaraa`,
            attachments: attachments
        });

        console.log(`Presale booking confirmation email queued for ${user.emailID} for preBookingID ${booking.preBookingID}${attachments.length > 0 ? ' with invoice attachment' : ''}`);
    } catch (error) {
        console.error('Error sending presale booking order confirmation email:', error);
        // Don't throw error - email failure shouldn't break order placement
    }
}

/**
 * Helper function to send seller notification emails for presale bookings
 * Similar to sendSellerNotificationEmails but for presale bookings
 */
async function sendPresaleSellerNotificationEmails(preBookingID, paymentMode) {
    try {
        const db = require('../utils/dbconnect');
        const { addSendEmailJob } = require('../queue/emailProducer');

        // Get presale booking items grouped by brandID
        const [bookingItems] = await db.query(
            `SELECT pbi.name, pbi.variationName, pbi.brandID, pbd.paymentType, pbd.createdAt
             FROM presale_booking_items pbi
             INNER JOIN presale_booking_details pbd ON pbi.preBookingID = pbd.preBookingID
             WHERE pbi.preBookingID = ?
             ORDER BY pbi.brandID, pbi.createdAt`,
            [preBookingID]
        );

        if (!bookingItems || bookingItems.length === 0) {
            console.log(`No presale booking items found for preBookingID ${preBookingID}`);
            return;
        }

        // Group items by brandID
        const itemsByBrand = {};
        bookingItems.forEach(item => {
            const brandID = item.brandID || 'inhouse'; // Use 'inhouse' as key for null brandID
            if (!itemsByBrand[brandID]) {
                itemsByBrand[brandID] = [];
            }
            itemsByBrand[brandID].push(item);
        });

        // Get booking date
        const bookingDate = bookingItems[0].createdAt
            ? new Date(bookingItems[0].createdAt).toLocaleDateString('en-IN', {
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
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    `;
                });

                // Prepare email variables
                const emailVariables = {
                    orderID: preBookingID,
                    orderDate: bookingDate,
                    paymentMode: paymentMode || 'COD',
                    productCount: items.length,
                    itemsList: itemsHtml
                };

                // Queue email
                await addSendEmailJob({
                    to: sellerEmail,
                    templateName: 'order_notify',
                    variables: emailVariables,
                    subject: `New Presale Booking #${preBookingID} - ${items.length} Product(s) - Ithyaraa`
                });

                console.log(`Presale seller notification email queued for ${sellerEmail} (${brandID === 'inhouse' ? 'Inhouse' : sellerName}) - PreBooking ${preBookingID} - ${items.length} product(s)`);
            } catch (brandError) {
                console.error(`Error sending presale notification for brandID ${brandID}:`, brandError);
                // Continue with other brands even if one fails
            }
        }
    } catch (error) {
        console.error('Error sending presale seller notification emails:', error);
        // Don't throw error - email failure shouldn't break order placement
    }
}

/**
 * Bulk recheck payment status for multiple presale bookings
 * POST /admin/presale-bookings/bulk-recheck-payment-status
 */
const bulkRecheckPresalePaymentStatusController = async (req, res) => {
    try {
        const { preBookingIDs } = req.body;

        if (!preBookingIDs || !Array.isArray(preBookingIDs) || preBookingIDs.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'preBookingIDs array is required and must not be empty'
            });
        }

        const phonepeService = require('../services/phonepeService');
        const results = [];
        let successCount = 0;
        let updatedCount = 0;
        let failCount = 0;

        // Process each booking
        for (const preBookingID of preBookingIDs) {
            try {
                // Get presale booking details
                const booking = await presaleBookingModel.getPresaleBookingByID(preBookingID);

                if (!booking) {
                    results.push({
                        preBookingID,
                        success: false,
                        message: 'Presale booking not found'
                    });
                    failCount++;
                    continue;
                }

                // Skip COD orders
                if (booking.paymentType === 'COD') {
                    results.push({
                        preBookingID,
                        success: true,
                        message: 'COD order - no payment status check needed',
                        skipped: true
                    });
                    continue;
                }

                // Skip if already successful
                if (booking.paymentStatus === 'successful') {
                    results.push({
                        preBookingID,
                        success: true,
                        message: 'Payment already successful',
                        currentStatus: booking.paymentStatus,
                        updated: false
                    });
                    continue;
                }

                // Check if we have a transaction ID
                if (!booking.txnID) {
                    results.push({
                        preBookingID,
                        success: false,
                        message: 'No PhonePe transaction ID found'
                    });
                    failCount++;
                    continue;
                }

                // Call PhonePe API to check payment status
                const result = await phonepeService.checkPaymentStatus(booking.txnID);

                if (!result.success) {
                    results.push({
                        preBookingID,
                        success: false,
                        message: 'Failed to check payment status with PhonePe',
                        error: result.error
                    });
                    failCount++;
                    continue;
                }

                // Extract status data
                const statusData = result.data?.data || result.data?.response || result.data || {};

                // Process the payment status response
                const processedStatus = phonepeService.processPaymentStatus(statusData);

                // Map PhonePe status to our payment status enum
                let paymentStatus = 'pending';
                if (processedStatus.isSuccess) {
                    paymentStatus = 'successful';
                } else if (processedStatus.isFailed) {
                    paymentStatus = 'failed';
                }

                const wasUpdated = paymentStatus !== booking.paymentStatus;

                // Update booking status in DB if payment status changed
                if (wasUpdated) {
                    await presaleBookingModel.updatePresaleBookingPaymentStatus(
                        preBookingID,
                        paymentStatus,
                        booking.txnID,
                        booking.merchantID,
                        booking.paymentType
                    );

                    // If payment is successful and status changed from pending to successful, send confirmation emails
                    if (processedStatus.isSuccess && booking.paymentStatus === 'pending' && paymentStatus === 'successful') {
                        try {
                            await sendPresaleBookingConfirmationAndNotifications(preBookingID, booking.txnID, booking.paymentStatus, paymentStatus);
                            console.log(`[BULK-STATUS-CHECK] Confirmation emails sent for presale booking ${preBookingID} (pending -> successful)`);
                        } catch (emailError) {
                            console.error(`[BULK-STATUS-CHECK] Error sending emails:`, emailError);
                            // Don't fail the response if email fails
                        }
                    }

                    if (wasUpdated) {
                        updatedCount++;
                    }
                }

                results.push({
                    preBookingID,
                    success: true,
                    currentStatus: booking.paymentStatus,
                    latestStatus: {
                        orderStatus: paymentStatus,
                        isSuccess: processedStatus.isSuccess,
                        statusMessage: processedStatus.statusMessage || (processedStatus.isSuccess ? 'Payment successful' : 'Payment pending')
                    },
                    updated: wasUpdated
                });

                successCount++;

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 300));

            } catch (error) {
                console.error(`[BULK-STATUS-CHECK] Error processing ${preBookingID}:`, error);
                results.push({
                    preBookingID,
                    success: false,
                    message: error.message || 'Internal error',
                    error: error.message
                });
                failCount++;
            }
        }

        return res.json({
            success: true,
            summary: {
                total: preBookingIDs.length,
                successful: successCount,
                updated: updatedCount,
                failed: failCount
            },
            results
        });

    } catch (error) {
        console.error('Bulk presale payment status check error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Helper function to send presale booking confirmation and notifications
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

        const booking = await presaleBookingModel.getPresaleBookingByID(preBookingID);
        if (!booking) {
            console.error(`Booking not found: ${preBookingID}`);
            return;
        }

        const user = await usersModel.findByuid(booking.uid);
        if (user) {
            await sendPreBookingOrderConfirmationEmail(user, booking, booking.paymentType, merchantID);
        }

        await sendPresaleSellerNotificationEmails(preBookingID, booking.paymentType);
    } catch (error) {
        console.error(`Error sending confirmation emails for ${preBookingID}:`, error);
        throw error;
    }
}

module.exports = {
    placePrebookingOrderController,
    getPresaleBookingDetailsController,
    getUserPresaleBookingsController,
    getAllPresaleBookingsController,
    getAdminPresaleBookingDetailsController,
    updatePresaleBookingStatusController,
    updatePresaleBookingPaymentStatusController,
    updatePresaleBookingTrackingController,
    bulkRecheckPresalePaymentStatusController,
    sendPreBookingOrderConfirmationEmail,
    sendPresaleSellerNotificationEmails,
    generatePreBookingInvoice
};

