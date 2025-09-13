const mailer = require('./utils/mailer');

async function testSimpleEmail() {
    try {
        console.log('Testing simple email...');
        console.log('GMAIL_USER:', process.env.GMAIL_USER ? 'Set' : 'Not set');
        console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'Set' : 'Not set');
        
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: 'test@example.com', // Replace with your email
            subject: 'Test Email from Ithyaraa',
            text: 'This is a test email to verify email configuration.'
        };

        console.log('Sending test email...');
        const result = await mailer.sendMail(mailOptions);
        console.log('✅ Email sent successfully!', result.messageId);
        
    } catch (error) {
        console.error('❌ Email failed:', error.message);
        console.error('Full error:', error);
    }
}

testSimpleEmail();
