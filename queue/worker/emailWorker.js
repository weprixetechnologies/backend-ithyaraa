


const { Worker } = require('bullmq');
const { sendEmail } = require('../service/emailService');
const connection = {
    host: '127.0.0.1',
    port: 6379,
};


// Create BullMQ worker for sendEmails queue
const sendEmailsWorker = new Worker('sendEmails', async job => {
  // job.data should contain: { to, templateName, variables, subject }
  try {
    await sendEmail(job.data);
    console.log(`Email sent to ${job.data.to} using template ${job.data.templateName}`);
  } catch (err) {
    console.error('Error sending email:', err);
    throw err;
  }
}, { connection });

sendEmailsWorker.on('completed', job => {
  console.log(`Job ${job.id} completed`);
});

sendEmailsWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});
