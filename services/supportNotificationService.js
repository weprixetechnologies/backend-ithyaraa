const { addSendEmailJob } = require('../queue/emailProducer');
const db = require('../utils/dbconnect');

/**
 * Sends a notification/email when a ticket is created or replied to.
 */
async function notifyTicketUpdate({ ticket, reply, type }) {
    try {
        // Find user/brand email
        const [users] = await db.execute(
            'SELECT emailID, name, username FROM users WHERE username = ?',
            [ticket.raised_by_id]
        );
        const user = users[0];

        if (!user || !user.emailID) return;

        let subject = '';
        let message = '';

        if (type === 'new_ticket') {
            subject = `Support Ticket Created: ${ticket.ticket_no}`;
            message = `Your support ticket regarding "${JSON.parse(ticket.topic_path).pop()?.label}" has been created.\n\nSummary:\n${ticket.comment}\n\nOne of our agents will review it soon.`;
        } else if (type === 'admin_reply') {
            subject = `New Reply to Ticket: ${ticket.ticket_no}`;
            message = `You have a new response from our support team regarding your ticket ${ticket.ticket_no}.\n\nReply:\n${reply?.message || ''}`;
        } else if (type === 'status_change') {
            subject = `Ticket Status Updated: ${ticket.ticket_no}`;
            message = `The status of your ticket ${ticket.ticket_no} has been changed to ${ticket.status.replace('_', ' ')}.`;
        }

        if (subject && message) {
            const baseUrl = (process.env.FRONTEND_URL || 'https://ithyaraa.com').replace(/\/$/, '');
            await addSendEmailJob({
                to: user.emailID,
                templateName: 'support_notification',
                variables: {
                    name: user.name || user.username || 'User',
                    ticketNo: ticket.ticket_no,
                    message,
                    link: `${baseUrl}/support/details/${ticket.ticket_no}`
                },
                subject
            });
        }
    } catch (error) {
        console.error('Error in support notification service:', error);
    }
}

module.exports = {
    notifyTicketUpdate
};
