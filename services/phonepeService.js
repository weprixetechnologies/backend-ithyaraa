const crypto = require('crypto');
const fetch = require('node-fetch');

// Load from environment
const merchantId = process.env.MERCHANT_ID || 'PGTESTPAYUAT86';
const key = process.env.KEY || '96434309-7796-489d-8924-ab56988a6076';
const keyIndex = process.env.KEY_INDEX || '1';

// PhonePe API URLs
const phonePeStatusUrl = process.env.NODE_ENV === "production"
    ? "https://mercury-t2.phonepe.com/v3/transaction"
    : "https://mercury-uat.phonepe.com/enterprise-sandbox/v3/transaction";

const phonePeWebhookUrl = process.env.NODE_ENV === "production"
    ? "https://mercury-t2.phonepe.com/v3/transaction"
    : "https://mercury-uat.phonepe.com/enterprise-sandbox/v3/transaction";

/**
 * Generate checksum for PhonePe API requests
 * @param {string} path - API path
 * @param {string} payload - Request payload (base64 encoded)
 * @returns {string} - Checksum with salt index
 */
function generateChecksum(path, payload = '') {
    const raw = payload + path + key;
    const sha256 = crypto.createHash("sha256").update(raw).digest("hex");
    return `${sha256}###${keyIndex}`;
}

/**
 * Check payment status using PhonePe Status API
 * @param {string} merchantTransactionId - Merchant transaction ID
 * @returns {Object} - Payment status response
 */
async function checkPaymentStatus(merchantTransactionId) {
    try {
        const path = `/${merchantId}/${merchantTransactionId}/status`;
        const checksum = generateChecksum(path);

        const response = await fetch(`${phonePeStatusUrl}${path}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-CLIENT-ID': merchantId
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            data: data
        };

    } catch (error) {
        console.error('PhonePe status check error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Verify webhook signature
 * @param {string} signature - X-VERIFY header from webhook
 * @param {string} payload - Raw request body
 * @returns {boolean} - Whether signature is valid
 */
function verifyWebhookSignature(signature, payload) {
    try {
        // For webhooks, PhonePe uses a different signature format
        // The signature should be: sha256(payload + salt) + "###" + saltIndex
        const raw = payload + key;
        const sha256 = crypto.createHash("sha256").update(raw).digest("hex");
        const expectedSignature = `${sha256}###${keyIndex}`;

        return signature === expectedSignature;
    } catch (error) {
        console.error('Webhook signature verification error:', error);
        return false;
    }
}

/**
 * Process payment status and update order accordingly
 * @param {Object} statusData - Payment status data from PhonePe
 * @returns {Object} - Processed status information
 */
function processPaymentStatus(statusData) {
    const { code, message, state, responseCode, responseCodeDescription } = statusData;

    // Map PhonePe status codes to our internal status
    let orderStatus = 'pending';
    let isSuccess = false;
    let statusMessage = message || 'Payment status unknown';

    switch (code) {
        case 'PAYMENT_SUCCESS':
            orderStatus = 'paid';
            isSuccess = true;
            statusMessage = 'Payment successful';
            break;
        case 'PAYMENT_ERROR':
            orderStatus = 'failed';
            isSuccess = false;
            statusMessage = 'Payment failed';
            break;
        case 'PAYMENT_PENDING':
            orderStatus = 'pending';
            isSuccess = false;
            statusMessage = 'Payment pending';
            break;
        case 'TRANSACTION_NOT_FOUND':
            orderStatus = 'not_found';
            isSuccess = false;
            statusMessage = 'Transaction not found';
            break;
        case 'TIMED_OUT':
            orderStatus = 'timeout';
            isSuccess = false;
            statusMessage = 'Payment timed out';
            break;
        default:
            orderStatus = 'unknown';
            isSuccess = false;
            statusMessage = `Unknown status: ${code}`;
    }

    return {
        orderStatus,
        isSuccess,
        statusMessage,
        phonepeCode: code,
        phonepeState: state,
        responseCode,
        responseCodeDescription
    };
}

module.exports = {
    checkPaymentStatus,
    verifyWebhookSignature,
    processPaymentStatus,
    generateChecksum
};
