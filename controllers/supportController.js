const supportModel = require('../model/supportModel');
const ticketService = require('../services/ticketService');
const topicService = require('../services/topicService');
const db = require('../utils/dbconnect');

// Public Topics
const getTopics = async (req, res) => {
    try {
        const panel = req.query.panel || 'both';
        const tree = await topicService.getTopicTree(panel);
        res.status(200).json({ success: true, topics: tree });
    } catch (err) {
        console.error('Get topics error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// User/Brand - Raise Ticket
const raiseTicket = async (req, res) => {
    try {
        const { leaf_topic_id, topic_path, comment } = req.body;
        const raiser = req.user; // From auth middleware

        if (!leaf_topic_id || !topic_path || !comment) {
            return res.status(400).json({ success: false, message: 'Missing fields' });
        }

        const result = await ticketService.raiseTicket({
            raised_by_type: raiser.role === 'brand' ? 'brand' : 'user',
            raised_by_id: raiser.username,
            leaf_topic_id,
            topic_path,
            comment
        });

        res.status(201).json({ success: true, ...result });
    } catch (err) {
        console.error('Raise ticket error:', err);
        res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
};

// User/Brand - My Tickets
const getMyTickets = async (req, res) => {
    try {
        const raiser = req.user;
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const tickets = await supportModel.getTickets({
            raised_by_id: raiser.username,
            status
        }, parseInt(limit), offset);

        res.status(200).json({ success: true, tickets });
    } catch (err) {
        console.error('Get my tickets error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// User/Brand - Ticket Detail + Replies
const getTicketDetail = async (req, res) => {
    try {
        const { ticketNo } = req.params;
        const raiser = req.user;

        const ticket = await supportModel.getTicketByNo(ticketNo);
        if (!ticket || ticket.raised_by_id !== raiser.username) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        const replies = await supportModel.getRepliesByTicketId(ticket.id, false);

        // Reset unread count if user views ticket
        await ticketService.resetUnreadCount(raiser.username, ticketNo);

        res.status(200).json({ success: true, ticket, replies });
    } catch (err) {
        console.error('Get ticket detail error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// User/Brand - Reply
const replyToTicket = async (req, res) => {
    try {
        const { ticketNo } = req.params;
        const { message } = req.body;
        const raiser = req.user;

        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const replyId = await ticketService.replyToTicket(ticketNo, {
            type: raiser.role === 'brand' ? 'brand' : 'user',
            id: raiser.username
        }, message);

        res.status(201).json({ success: true, replyId });
    } catch (err) {
        console.error('Reply error:', err);
        res.status(400).json({ success: false, message: err.message || 'Server error' });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT unread_ticket_replies FROM users WHERE username = ?', [req.user.username]);
        res.status(200).json({ success: true, count: rows[0]?.unread_ticket_replies || 0 });
    } catch (err) {
        console.error('Unread count error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    getTopics,
    raiseTicket,
    getMyTickets,
    getTicketDetail,
    replyToTicket,
    getUnreadCount
};
