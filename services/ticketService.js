const supportModel = require('../model/supportModel');
const db = require('../utils/dbconnect');
const { notifyTicketUpdate } = require('./supportNotificationService');

const generateTicketNo = async () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const counter = await supportModel.getNextTicketCounter();
    const padded = String(counter).padStart(4, '0');
    return `TKT-${today}-${padded}`;
};

const raiseTicket = async (data) => {
    const ticketNo = await generateTicketNo();
    const leafId = data.leaf_topic_id;
    
    // Validate leaf topic
    const topic = await supportModel.getTopicById(leafId);
    if (!topic || topic.input_type !== 'leaf') {
        throw new Error('Invalid leaf topic');
    }

    const ticketId = await supportModel.createTicket({
        ...data,
        ticket_no: ticketNo
    });

    // Notify user
    const ticket = await supportModel.getTicketByNo(ticketNo);
    notifyTicketUpdate({ ticket, type: 'new_ticket' });

    return { ticket_no: ticketNo, id: ticketId };
};

const replyToTicket = async (ticketNo, senderData, message, isInternal = false) => {
    const ticket = await supportModel.getTicketByNo(ticketNo);
    if (!ticket) throw new Error('Ticket not found');

    if (ticket.status === 'closed') {
        throw new Error('Ticket is closed. Cannot reply.');
    }

    const replyId = await supportModel.createReply({
        ticket_id: ticket.id,
        sender_type: senderData.type,
        sender_id: senderData.id,
        message,
        is_internal: isInternal
    });

    // Business Logic: First admin response sets first_response_at
    if (senderData.type === 'admin' && !ticket.first_response_at && !isInternal) {
        await supportModel.updateTicket(ticketNo, { first_response_at: new Date() });
    }

    // Update unread count for user/brand if it's admin reply
    if (senderData.type === 'admin' && !isInternal) {
        // Only increment global count if ticket doesn't already have unread flag
        if (!ticket.has_unread_by_raiser) {
            await incrementUnreadCount(ticket.raised_by_id);
            await supportModel.updateTicket(ticketNo, { has_unread_by_raiser: 1 });
        }
        
        // Async notify
        const reply = { message, sender_type: senderData.type };
        notifyTicketUpdate({ ticket, reply, type: 'admin_reply' });
    }

    return replyId;
};

const incrementUnreadCount = async (username) => {
    await db.execute(
        'UPDATE users SET unread_ticket_replies = unread_ticket_replies + 1 WHERE username = ?',
        [username]
    );
};

const resetUnreadCount = async (username, ticketNo) => {
    // Check if this specific ticket has unread flag
    const ticket = await supportModel.getTicketByNo(ticketNo);
    if (ticket && ticket.has_unread_by_raiser) {
        // Decrement global count (don't go below 0)
        await db.execute(
            'UPDATE users SET unread_ticket_replies = IF(unread_ticket_replies > 0, unread_ticket_replies - 1, 0) WHERE username = ?',
            [username]
        );
        // Clear ticket flag
        await supportModel.updateTicket(ticketNo, { has_unread_by_raiser: 0 });
    }
};

module.exports = {
    raiseTicket,
    replyToTicket,
    resetUnreadCount
};
