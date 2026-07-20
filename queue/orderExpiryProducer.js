const { Queue } = require('bullmq');
const { REDIS_CONNECTION } = require('../utils/config');

const bullConnection = { ...REDIS_CONNECTION };
delete bullConnection.commandTimeout;

const orderExpiryQueue = new Queue('orderExpiry', { connection: bullConnection });

/**
 * Schedule a delayed follow-up action for a specific order.
 * @param {string} orderID - The order ID to check.
 * @param {number} delayMs - Delay in milliseconds (default 30 minutes).
 */
async function scheduleOrderExpiry(orderID, delayMs = 30 * 60 * 1000) {
    try {
        console.log(`[Order Expiry Queue] Scheduling delayed expiry for order: ${orderID} in ${delayMs}ms`);
        await orderExpiryQueue.add(
            'expireOrder',
            { orderID },
            { 
                delay: delayMs,
                jobId: `expire_${orderID}`, // Ensure uniqueness per order
                removeOnComplete: true,
                removeOnFail: true
            }
        );
    } catch (err) {
        console.error(`[Order Expiry Queue] Failed to schedule expiry for order ${orderID}:`, err);
    }
}

module.exports = { scheduleOrderExpiry, orderExpiryQueue };
