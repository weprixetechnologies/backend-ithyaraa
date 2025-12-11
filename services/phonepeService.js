const crypto = require('crypto');
const fetch = require('node-fetch');

// Load from environment
const merchantId = process.env.MERCHANT_ID || 'PGTESTPAYUAT86';
const key = process.env.KEY || '96434309-7796-489d-8924-ab56988a6076';
const keyIndex = process.env.KEY_INDEX || '1';

// PhonePe Hermes API URLs
const phonePeBaseUrl = process.env.NODE_ENV === "production"
    ? "https://api.phonepe.com/apis/hermes"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox";

const phonePeStatusUrl = process.env.NODE_ENV === "production"
    ? "https://api.phonepe.com/apis/hermes/pg/v1/status"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status";

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
 * @param {string} merchantID - Merchant transaction ID
 * @returns {Object} - Payment status response
 */
async function checkPaymentStatus(merchantID) {
    try {
        if (!merchantID) {
            return {
                success: false,
                error: 'Merchant transaction ID is required'
            };
        }

        // PhonePe Hermes Status API endpoint: /pg/v1/status/{merchantId}/{merchantID}
        const apiPath = `/pg/v1/status/${merchantId}/${merchantID}`;

        // For GET status requests, checksum = SHA256(path + saltKey) + "###" + saltIndex
        // No payload for GET requests, so checksum is: path + key
        const xVerifyString = apiPath + key;
        const xVerify =
            crypto.createHash("sha256").update(xVerifyString).digest("hex") +
            "###" +
            keyIndex;

        console.log(`[PhonePe Status Check] Checking status for transaction: ${merchantID}`);
        console.log(`[PhonePe Status Check] Path: ${apiPath}`);
        console.log(`[PhonePe Status Check] Checksum String: ${apiPath} + key`);
        console.log(`[PhonePe Status Check] URL: ${phonePeBaseUrl}${apiPath}`);

        const response = await fetch(`${phonePeBaseUrl}${apiPath}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': xVerify,
                'X-MERCHANT-ID': merchantId,
                'Accept': 'application/json'
            }
        });

        const responseText = await response.text();
        console.log(`[PhonePe Status Check] Raw response text (length: ${responseText.length}):`, responseText.substring(0, 500));

        if (!response.ok) {
            console.error(`[PhonePe Status Check] HTTP Error - Status: ${response.status}`);
            console.error(`[PhonePe Status Check] Error response:`, responseText);

            // Try to parse error response as JSON
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                if (responseText) {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                }
            } catch (e) {
                // If not JSON, use the raw text
                errorMessage = responseText || errorMessage;
            }

            throw new Error(errorMessage);
        }

        // Check if response is empty
        if (!responseText || responseText.trim().length === 0) {
            throw new Error('Empty response from PhonePe API');
        }

        // Try to parse JSON response
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error(`[PhonePe Status Check] JSON Parse Error:`, parseError.message);
            console.error(`[PhonePe Status Check] Response text that failed to parse:`, responseText);
            throw new Error(`Invalid JSON response from PhonePe: ${parseError.message}`);
        }

        console.log(`[PhonePe Status Check] Success response:`, JSON.stringify(data, null, 2));

        return {
            success: true,
            data
        };

    } catch (error) {
        console.error('[PhonePe Status Check] Error:', error.message);
        console.error('[PhonePe Status Check] Stack:', error.stack);
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
    // Handle different response formats from PhonePe
    // Status API might return: { code, message, data: { state, ... } }
    // Webhook might return: { code, message, state, ... }
    const code = statusData?.code || statusData?.data?.code;
    const message = statusData?.message || statusData?.data?.message;
    const state = statusData?.state || statusData?.data?.state;
    const responseCode = statusData?.responseCode || statusData?.data?.responseCode;
    const responseCodeDescription = statusData?.responseCodeDescription || statusData?.data?.responseCodeDescription;

    // Map PhonePe status codes to our internal status
    let orderStatus = 'pending';
    let isSuccess = false;
    let statusMessage = message || 'Payment status unknown';
    let isFailed = false;

    // Check state first (COMPLETED, PENDING, FAILED, etc.)
    if (state) {
        const stateUpper = state.toUpperCase();
        if (stateUpper === 'COMPLETED' || stateUpper === 'SUCCESS') {
            orderStatus = 'successful';
            isSuccess = true;
            statusMessage = 'Payment successful';
        } else if (stateUpper === 'FAILED' || stateUpper === 'FAILURE') {
            orderStatus = 'failed';
            isSuccess = false;
            isFailed = true;
            statusMessage = 'Payment failed';
        } else if (stateUpper === 'PENDING') {
            orderStatus = 'pending';
            isSuccess = false;
            statusMessage = 'Payment pending';
        }
    }

    // Override with code if available
    if (code) {
        const codeUpper = code.toUpperCase();
        switch (codeUpper) {
            case 'PAYMENT_SUCCESS':
            case 'SUCCESS':
                orderStatus = 'successful';
                isSuccess = true;
                statusMessage = 'Payment successful';
                break;
            case 'PAYMENT_ERROR':
            case 'ERROR':
            case 'FAILURE':
                orderStatus = 'failed';
                isSuccess = false;
                isFailed = true;
                statusMessage = 'Payment failed';
                break;
            case 'PAYMENT_PENDING':
            case 'PENDING':
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
        }
    }

    return {
        orderStatus,
        isSuccess,
        isFailed,
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
