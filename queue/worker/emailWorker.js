


const { Worker } = require('bullmq');
const { sendEmail } = require('../service/emailService');
const newsletterModel = require('../../model/newsletterModel');
const connection = {
  host: '127.0.0.1',
  port: 6379,
};

async function markDeliverySuccess(job) {
  const { deliveryId, subscriberId } = job.data || {};
  if (!deliveryId) return;
  try {
    await newsletterModel.updateDeliveryStatus({
      deliveryId,
      status: 'sent',
      errorMessage: null
    });
    if (subscriberId) {
      await newsletterModel.updateSubscriberLastEmailSentAt(subscriberId);
    }
  } catch (err) {
    console.error('Failed to update newsletter delivery status (success path):', err);
  }
}

async function markDeliveryFailed(job, err) {
  const { deliveryId } = job.data || {};
  if (!deliveryId) return;
  try {
    await newsletterModel.updateDeliveryStatus({
      deliveryId,
      status: 'failed',
      errorMessage: err?.message || 'Unknown error'
    });
  } catch (e) {
    console.error('Failed to update newsletter delivery status (failure path):', e);
  }
}

// Create BullMQ worker for sendEmails queue
const sendEmailsWorker = new Worker('sendEmails', async job => {
  // job.data should contain: { to, templateName, variables, subject, attachments? }
  try {
    const { to, templateName, attachments } = job.data || {};
    console.log('Email worker received job with:', {
      to,
      templateName,
      hasAttachments: !!attachments,
      attachmentsIsArray: Array.isArray(attachments),
      attachmentsCount: attachments?.length || 0,
    });

    if (Array.isArray(attachments) && attachments.length > 0) {
      const att = attachments[0];
      console.log('First attachment meta:', {
        filename: att?.filename,
        contentType: att?.contentType,
        encoding: att?.encoding,
        hasContent: !!att?.content,
        contentTypeOf: typeof att?.content,
        contentLength: att?.content ? (typeof att.content === 'string' ? att.content.length : att.content.length) : 0,
      });
    }

    await sendEmail(job.data);
    console.log(`Email sent to ${job.data.to} using template ${job.data.templateName}`);
    await markDeliverySuccess(job);
  } catch (err) {
    console.error('Error sending email:', err);
    await markDeliveryFailed(job, err);
    throw err;
  }
}, { connection });

sendEmailsWorker.on('completed', job => {
  console.log(`Job ${job.id} completed`);
});

sendEmailsWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});