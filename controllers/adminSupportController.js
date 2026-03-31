const supportModel = require('../model/supportModel');
const ticketService = require('../services/ticketService');
const { notifyTicketUpdate } = require('../services/supportNotificationService');

// Admin - Manage Tickets
const getAdminTickets = async (req, res) => {
    try {
        const { status, panel, priority, page = 1, limit = 20, search } = req.query;
        const offset = (page - 1) * limit;

        const tickets = await supportModel.getTickets({
            status,
            raised_by_type: panel,
            priority,
            search
        }, parseInt(limit), offset);

        res.status(200).json({ success: true, tickets });
    } catch (err) {
        console.error('Admin get tickets error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getAdminTicketDetail = async (req, res) => {
    try {
        const { ticketNo } = req.params;
        const ticket = await supportModel.getTicketByNo(ticketNo);
        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        const replies = await supportModel.getRepliesByTicketId(ticket.id, true);

        res.status(200).json({ success: true, ticket, replies });
    } catch (err) {
        console.error('Admin get ticket detail error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const patchTicket = async (req, res) => {
    try {
        const { ticketNo } = req.params;
        const { status, priority, assigned_to } = req.body;

        const data = {};
        if (status) {
            data.status = status;
            if (status === 'closed') {
                data.closed_at = new Date();
            }
        }
        if (priority) data.priority = priority;
        if (assigned_to) data.assigned_to = assigned_to;

        await supportModel.updateTicket(ticketNo, data);
        
        if (data.status) {
            const ticket = await supportModel.getTicketByNo(ticketNo);
            notifyTicketUpdate({ ticket, type: 'status_change' });
        }

        res.status(200).json({ success: true, message: 'Ticket updated' });
    } catch (err) {
        console.error('Patch ticket error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const adminReply = async (req, res) => {
    try {
        const { ticketNo } = req.params;
        const { message, is_internal } = req.body;
        const admin = req.admin || req.user; // Depends on auth middleware

        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const replyId = await ticketService.replyToTicket(ticketNo, {
            type: 'admin',
            id: admin.username
        }, message, is_internal);

        res.status(201).json({ success: true, replyId });
    } catch (err) {
        console.error('Admin reply error:', err);
        res.status(400).json({ success: false, message: err.message || 'Server error' });
    }
};

module.exports = {
    getAdminTickets,
    getAdminTicketDetail,
    patchTicket,
    adminReply
};
