// BullMQ Worker Example

const { Worker } = require('bullmq');
const { REDIS_CONNECTION } = require('../../utils/config');

const connection = REDIS_CONNECTION;

const notificationWorker = new Worker('notificationQueue', async job => {
    if (job.name === 'sendEmail') {
        const { email, message } = job.data;
        // Simulate sending email (replace with actual email logic)
        console.log(`Sending email to ${email}: ${message}`);
        // You can integrate with nodemailer or any email service here
        return { status: 'sent', email };
    }
}, { connection });


notificationWorker.on('completed', (job) => {
    console.log(`Job ${job.id} completed!`);
});

notificationWorker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed:`, err);
});
