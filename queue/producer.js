// BullMQ Producer Example

const { Queue } = require('bullmq');
const { REDIS_CONNECTION } = require('../utils/config');

// Redis connection config (local or cloud)
const connection = REDIS_CONNECTION;

const notificationQueue = new Queue('notificationQueue', { connection });

async function sendNotification(email, message) {
    try {
        // Add a job to the queue
        await notificationQueue.add('sendEmail', {
            email,
            message
        });
        console.log(`Notification job added for ${email}`);
    } catch (error) {
        console.error('Error adding job to queue:', error);
    }
}

module.exports = {
    sendNotification
};