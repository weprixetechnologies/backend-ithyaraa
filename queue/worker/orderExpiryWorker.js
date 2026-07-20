const { Worker } = require('bullmq');
const { REDIS_CONNECTION } = require('../../utils/config');
const orderService = require('../../services/orderService');

const bullConnection = { ...REDIS_CONNECTION };
delete bullConnection.commandTimeout;

// This worker listens to the "orderExpiry" queue and processes jobs.
const orderExpiryWorker = new Worker('orderExpiry', async (job) => {
    if (job.name === 'expireOrder') {
        const { orderID } = job.data;
        console.log(`[Worker: orderExpiry] Processing delayed expiry check for order: ${orderID}`);
        
        // Defer to the refactored expiry logic inside orderService
        await orderService.handleOrderExpiry(orderID);
    }
}, { connection: bullConnection });

orderExpiryWorker.on('completed', (job) => {
    console.log(`[Order Expiry Worker] Expiry job ${job.id} completed successfully`);
});

orderExpiryWorker.on('failed', (job, err) => {
    console.error(`[Order Expiry Worker] Expiry job ${job.id} failed:`, err);
});

module.exports = orderExpiryWorker;
