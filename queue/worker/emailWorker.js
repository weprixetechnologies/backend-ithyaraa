


const { Worker } = require('bullmq');
const { sendEmail } = require('../service/emailService');
const { REDIS_CONFIG } = require('../../utils/config');

const connection = REDIS_CONFIG;


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
