const { Queue } = require('bullmq');
const jwt = require('jsonwebtoken');

const connection = {
  host: '127.0.0.1',
  port: 6379,
};

const sendEmailsQueue = new Queue('sendEmails', { connection });

/**
 * Add a job to the sendEmails queue
 */
function addEmailJob({ to, templateName, variables, subject }) {
  return sendEmailsQueue.add('sendEmail', {
    to,
    templateName,
    variables,
    subject,
  });
}



async function addSendEmailJob(data) {
    await sendEmailsQueue.add('sendEmail', data);
}

const sendVerifyEmail = async (user) => {
    // Generate token
    const payload = { uid: user.uid, email: user.emailID };
    const token = jwt.sign(payload, process.env.EMAIL_VERIFY_SECRET || 'email_verify_secret', { expiresIn: '1d' });
    // Construct verify link
    const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${token}`;
    // Send email via queue
    await addSendEmailJob({
        to: user.emailID,
        templateName: 'verifyemail',
        variables: {
            name: user.name || user.username,
            verifyLink
        },
        subject: 'Verify Your Email'
    });
    return { success: true, message: 'Verification email sent', token };
};

module.exports = {
  sendEmailsQueue,
  sendVerifyEmail,
  addEmailJob,
  addSendEmailJob
};
