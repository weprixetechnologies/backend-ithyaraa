// BullMQ Producer Example

const { Queue } = require('bullmq');

// Redis connection config for Docker
const connection = {
    host: '127.0.0.1',
    port: 6379,
};

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