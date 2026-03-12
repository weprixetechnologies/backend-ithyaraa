/**
 * Queue emails for order item status and return status updates.
 * Used when: itemStatus (shipped, delivered) or returnStatus changes.
 */
const { addSendEmailJob } = require('../queue/emailProducer');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const STATUS_CONFIG = {
    shipped: {
        templateName: 'order-status-update',
        subject: 'Your order item has been shipped – Ithyaraa',
        statusTitle: 'Shipped',
        statusMessage: 'Your item has been shipped and is on its way.'
    },
    delivered: {
        templateName: 'order-status-update',
        subject: 'Your order item has been delivered – Ithyaraa',
        statusTitle: 'Delivered',
        statusMessage: 'Your item has been delivered. We hope you enjoy it!'
    },
    return_initiated: {
        templateName: 'order-status-update',
        subject: 'Return initiated for your order – Ithyaraa',
        statusTitle: 'Return Initiated',
        statusMessage: 'We have received your return request. Our team will arrange pickup and process your replacement or refund.'
    },
    return_picked: {
        templateName: 'order-status-update',
        subject: 'Return picked up – Ithyaraa',
        statusTitle: 'Return Picked',
        statusMessage: 'Your return has been picked up and is on its way back to us.'
    },
    replacement_processing: {
        templateName: 'order-status-update',
        subject: 'Replacement in progress – Ithyaraa',
        statusTitle: 'Replacement Processing',
        statusMessage: 'We are preparing your replacement order.'
    },
    replacement_shipped: {
        templateName: 'replacement-order-update',
        subject: 'Your replacement order has been shipped – Ithyaraa',
        statusTitle: 'Replacement Shipped',
        statusMessage: 'Your replacement has been shipped and is on its way.'
    },
    replacement_complete: {
        templateName: 'replacement-order-update',
        subject: 'Your replacement order is complete – Ithyaraa',
        statusTitle: 'Replacement Complete',
        statusMessage: 'Your replacement order has been delivered. Thank you for shopping with us!'
    },
    refund_pending: {
        templateName: 'order-status-update',
        subject: 'Refund request received – Ithyaraa',
        statusTitle: 'Refund Pending',
        statusMessage: 'We have received your refund request. Our executive will contact you shortly to complete the process.'
    },
    refund_completed: {
        templateName: 'order-status-update',
        subject: 'Refund completed – Ithyaraa',
        statusTitle: 'Refund Completed',
        statusMessage: 'Your refund has been processed successfully.'
    },
    returnRejected: {
        templateName: 'order-status-update',
        subject: 'Return request rejected – Ithyaraa',
        statusTitle: 'Return Rejected',
        statusMessage: 'Your return request has been rejected as it did not meet our return policy criteria.'
    },
    returned: {
        templateName: 'order-status-update',
        subject: 'Return received – Ithyaraa',
        statusTitle: 'Returned',
        statusMessage: 'We have received your return. Refund or replacement will be processed as per your request.'
    }
};

/**
 * Queue an email for order/return status update.
 * @param {Object} opts
 * @param {string} opts.to - Customer email
 * @param {string} opts.customerName - Customer name (or username)
 * @param {number} opts.orderID - Order ID (original order)
 * @param {string} opts.itemName - Product/item name
 * @param {string} [opts.variationName] - Variant name if any
 * @param {string} opts.statusType - One of: shipped, delivered, return_initiated, return_picked, replacement_processing, replacement_shipped, replacement_complete, refund_pending, refund_completed, returned, returnRejected
 * @param {number} [opts.replacementOrderID] - Required for replacement_shipped and replacement_complete; used to build view order link
 */
async function queueOrderStatusEmail(opts) {
    const { to, customerName, orderID, itemName, variationName = '', statusType } = opts;
    if (!to || !customerName || !orderID || !itemName || !statusType) {
        console.warn('[orderStatusEmail] Missing required fields, skipping email', { to: !!to, customerName: !!customerName, orderID, itemName, statusType });
        return;
    }
    const config = STATUS_CONFIG[statusType];
    if (!config) {
        console.warn('[orderStatusEmail] Unknown statusType:', statusType);
        return;
    }
    const variationLine = variationName ? ` (${variationName})` : '';
    const displayItemName = itemName + variationLine;

    if (config.templateName === 'replacement-order-update') {
        const replacementOrderID = opts.replacementOrderID;
        const viewReplacementOrderUrl = replacementOrderID ? `${FRONTEND_URL}/order-status/order-summary/${replacementOrderID}`.replace(/\/+/g, '/') : '';
        await addSendEmailJob({
            to,
            templateName: 'replacement-order-update',
            variables: {
                customerName,
                returnOrderID: String(orderID),
                replacementOrderID: replacementOrderID ? String(replacementOrderID) : '',
                viewReplacementOrderUrl,
                itemName: displayItemName,
                statusTitle: config.statusTitle,
                statusMessage: config.statusMessage
            },
            subject: config.subject
        });
        console.log(`[orderStatusEmail] Queued ${statusType} email to ${to} for order #${orderID}${replacementOrderID ? `, replacement #${replacementOrderID}` : ''}`);
        return;
    }

    const viewOrderUrl = `${FRONTEND_URL}/order-status/order-summary/${orderID}`.replace(/\/+/g, '/');
    await addSendEmailJob({
        to,
        templateName: 'order-status-update',
        variables: {
            customerName,
            orderID: String(orderID),
            itemName: displayItemName,
            statusTitle: config.statusTitle,
            statusMessage: config.statusMessage,
            viewOrderUrl
        },
        subject: config.subject
    });
    console.log(`[orderStatusEmail] Queued ${statusType} email to ${to} for order #${orderID}`);
}

module.exports = { queueOrderStatusEmail, FRONTEND_URL };
