const db = require('../utils/dbconnect');

// Support Topic Models
const getAllTopics = async (panel = null) => {
    let sql = 'SELECT * FROM support_topics';
    let params = [];
    if (panel) {
        sql += ' WHERE (panel = ? OR panel = "both") AND is_active = TRUE';
        params.push(panel);
    }
    sql += ' ORDER BY sort_order ASC, label ASC';
    const [rows] = await db.execute(sql, params);
    return rows;
};

const getTopicById = async (id) => {
    const [rows] = await db.execute('SELECT * FROM support_topics WHERE id = ?', [id]);
    return rows[0];
};

const createTopic = async (data) => {
    const { parent_id, panel, label, slug, description, input_type, prefilled_text, sort_order, is_active } = data;
    const [result] = await db.execute(
        `INSERT INTO support_topics 
        (parent_id, panel, label, slug, description, input_type, prefilled_text, sort_order, is_active) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [parent_id || null, panel || 'both', label, slug, description || null, input_type || 'branch', prefilled_text || null, sort_order || 0, is_active !== undefined ? is_active : true]
    );
    return result.insertId;
};

const updateTopic = async (id, data) => {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
        fields.push(`${key} = ?`);
        values.push(value);
    }
    values.push(id);
    await db.execute(`UPDATE support_topics SET ${fields.join(', ')} WHERE id = ?`, values);
};

// Support Ticket Models
const createTicket = async (data) => {
    const { ticket_no, raised_by_type, raised_by_id, topic_path, leaf_topic_id, comment, status, priority } = data;
    const [result] = await db.execute(
        `INSERT INTO support_tickets 
        (ticket_no, raised_by_type, raised_by_id, topic_path, leaf_topic_id, comment, status, priority) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ticket_no, raised_by_type, raised_by_id, JSON.stringify(topic_path), leaf_topic_id, comment, status || 'open', priority || 'medium']
    );
    return result.insertId;
};

const getTicketByNo = async (ticketNo) => {
    const [rows] = await db.execute('SELECT * FROM support_tickets WHERE ticket_no = ?', [ticketNo]);
    return rows[0];
};

const getTickets = async (filters = {}, limit = 20, offset = 0) => {
    let sql = 'SELECT * FROM support_tickets';
    const params = [];
    const where = [];

    if (filters.status) {
        where.push('status = ?');
        params.push(filters.status);
    }
    if (filters.raised_by_type) {
        where.push('raised_by_type = ?');
        params.push(filters.raised_by_type);
    }
    if (filters.raised_by_id) {
        where.push('raised_by_id = ?');
        params.push(filters.raised_by_id);
    }
    if (filters.priority) {
        where.push('priority = ?');
        params.push(filters.priority);
    }
    if (filters.assigned_to) {
        where.push('assigned_to = ?');
        params.push(filters.assigned_to);
    }
    if (filters.search) {
        where.push('(ticket_no LIKE ? OR comment LIKE ?)');
        params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (where.length > 0) {
        sql += ' WHERE ' + where.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.execute(sql, params);
    return rows;
};

const updateTicket = async (ticketNo, data) => {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
        fields.push(`${key} = ?`);
        values.push(value);
    }
    values.push(ticketNo);
    await db.execute(`UPDATE support_tickets SET ${fields.join(', ')} WHERE ticket_no = ?`, values);
};

// Support Reply Models
const createReply = async (data) => {
    const { ticket_id, sender_type, sender_id, message, is_internal } = data;
    const [result] = await db.execute(
        `INSERT INTO support_ticket_replies 
        (ticket_id, sender_type, sender_id, message, is_internal) 
        VALUES (?, ?, ?, ?, ?)`,
        [ticket_id, sender_type, sender_id, message, is_internal || false]
    );
    return result.insertId;
};

const getRepliesByTicketId = async (ticketId, includeInternal = false) => {
    let sql = 'SELECT * FROM support_ticket_replies WHERE ticket_id = ?';
    if (!includeInternal) {
        sql += ' AND is_internal = FALSE';
    }
    sql += ' ORDER BY created_at ASC';
    const [rows] = await db.execute(sql, [ticketId]);
    return rows;
};

// Counter for Ticket Numbers
const getNextTicketCounter = async () => {
    // Simple implementation using count. 
    // In production, use a dedicated counter table as suggested in notes.
    const [rows] = await db.execute('SELECT COUNT(*) as count FROM support_tickets WHERE DATE(created_at) = CURDATE()');
    return rows[0].count + 1;
};

module.exports = {
    getAllTopics,
    getTopicById,
    createTopic,
    updateTopic,
    createTicket,
    getTicketByNo,
    getTickets,
    updateTicket,
    createReply,
    getRepliesByTicketId,
    getNextTicketCounter
};
