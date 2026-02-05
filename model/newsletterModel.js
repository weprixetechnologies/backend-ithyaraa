const db = require('../utils/dbconnect');

// Subscriber queries

async function findSubscriberByEmail(email) {
    const [rows] = await db.query(
        'SELECT * FROM newsletter_subscribers WHERE email = ? LIMIT 1',
        [email]
    );
    return rows[0] || null;
}

async function createSubscriber({ name, email }) {
    const [result] = await db.query(
        `INSERT INTO newsletter_subscribers (name, email, status)
         VALUES (?, ?, 'active')
         ON DUPLICATE KEY UPDATE 
            name = VALUES(name),
            status = 'active',
            unsubscribed_at = NULL`,
        [name, email]
    );
    return result.insertId;
}

async function updateSubscriberStatusById(id, status) {
    const fields = ['active', 'unsubscribed', 'bounced'];
    if (!fields.includes(status)) {
        throw new Error('Invalid subscriber status');
    }
    await db.query(
        `UPDATE newsletter_subscribers 
         SET status = ?, 
             unsubscribed_at = CASE WHEN ? = 'unsubscribed' THEN NOW() ELSE unsubscribed_at END
         WHERE id = ?`,
        [status, status, id]
    );
}

async function updateSubscriberLastEmailSentAt(id) {
    await db.query(
        `UPDATE newsletter_subscribers 
         SET last_email_sent_at = NOW()
         WHERE id = ?`,
        [id]
    );
}

async function listSubscribers({ status, search, limit = 50, offset = 0 }) {
    const filters = [];
    const values = [];

    if (status) {
        filters.push('status = ?');
        values.push(status);
    }
    if (search) {
        filters.push('email LIKE ?');
        values.push(`%${search}%`);
    }

    let where = '';
    if (filters.length > 0) {
        where = `WHERE ${filters.join(' AND ')}`;
    }

    const [rows] = await db.query(
        `SELECT * FROM newsletter_subscribers
         ${where}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...values, Number(limit), Number(offset)]
    );

    const [countRows] = await db.query(
        `SELECT COUNT(*) as total FROM newsletter_subscribers ${where}`,
        values
    );

    return {
        data: rows,
        total: countRows[0]?.total || 0
    };
}

// Newsletter queries

async function createNewsletter({ title, content_html, content_text, status, scheduled_at, created_by }) {
    const [result] = await db.query(
        `INSERT INTO newsletters 
            (title, content_html, content_text, status, scheduled_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [title, content_html, content_text || null, status || 'draft', scheduled_at || null, created_by || null]
    );
    return result.insertId;
}

async function getNewsletterById(id) {
    const [rows] = await db.query(
        'SELECT * FROM newsletters WHERE id = ? LIMIT 1',
        [id]
    );
    return rows[0] || null;
}

async function listPublicNewsletters({ limit = 10, offset = 0 }) {
    const [rows] = await db.query(
        `SELECT id, title, content_html, content_text, sent_at 
         FROM newsletters 
         WHERE status = 'sent'
         ORDER BY sent_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [Number(limit), Number(offset)]
    );

    const [countRows] = await db.query(
        `SELECT COUNT(*) as total 
         FROM newsletters 
         WHERE status = 'sent'`,
        []
    );

    return {
        data: rows,
        total: countRows[0]?.total || 0
    };
}

async function listAllNewsletters({ limit = 20, offset = 0 }) {
    const [rows] = await db.query(
        `SELECT * 
         FROM newsletters
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [Number(limit), Number(offset)]
    );

    const [countRows] = await db.query(
        `SELECT COUNT(*) as total 
         FROM newsletters`,
        []
    );

    return {
        data: rows,
        total: countRows[0]?.total || 0
    };
}

async function updateNewsletterStatusAndSentAt(id, status) {
    await db.query(
        `UPDATE newsletters 
         SET status = ?, 
             sent_at = CASE WHEN ? = 'sent' THEN NOW() ELSE sent_at END
         WHERE id = ?`,
        [status, status, id]
    );
}

// Deliveries

async function insertDeliveriesBatch(newsletterId, subscriberIds) {
    if (!subscriberIds || subscriberIds.length === 0) {
        return;
    }
    const values = subscriberIds.map(id => [newsletterId, id]);
    await db.query(
        `INSERT INTO newsletter_deliveries (newsletter_id, subscriber_id, status)
         VALUES ?`,
        [values]
    );
}

async function createDelivery(newsletterId, subscriberId) {
    const [result] = await db.query(
        `INSERT INTO newsletter_deliveries (newsletter_id, subscriber_id, status)
         VALUES (?, ?, 'pending')`,
        [newsletterId, subscriberId]
    );
    return result.insertId;
}

async function updateDeliveryStatus({ deliveryId, status, errorMessage }) {
    const [result] = await db.query(
        `UPDATE newsletter_deliveries
         SET status = ?, 
             error_message = ?,
             sent_at = CASE WHEN ? = 'sent' THEN NOW() ELSE sent_at END
         WHERE id = ?`,
        [status, errorMessage || null, status, deliveryId]
    );
    return result.affectedRows;
}

async function getNewsletterStats(newsletterId) {
    const [rows] = await db.query(
        `SELECT 
            COUNT(*) AS total,
            SUM(status = 'sent') AS sent,
            SUM(status = 'failed') AS failed,
            SUM(status = 'pending') AS pending
         FROM newsletter_deliveries
         WHERE newsletter_id = ?`,
        [newsletterId]
    );
    return rows[0] || { total: 0, sent: 0, failed: 0, pending: 0 };
}

async function getFailedDeliveries(newsletterId, limit = 1000) {
    const [rows] = await db.query(
        `SELECT nd.id, ns.email, ns.name
         FROM newsletter_deliveries nd
         JOIN newsletter_subscribers ns ON ns.id = nd.subscriber_id
         WHERE nd.newsletter_id = ? AND nd.status = 'failed'
         LIMIT ?`,
        [newsletterId, Number(limit)]
    );
    return rows;
}

async function getActiveSubscribersBatch({ limit = 1000, offset = 0 }) {
    const [rows] = await db.query(
        `SELECT id, name, email 
         FROM newsletter_subscribers 
         WHERE status = 'active'
         ORDER BY id ASC
         LIMIT ? OFFSET ?`,
        [Number(limit), Number(offset)]
    );
    return rows;
}

module.exports = {
    findSubscriberByEmail,
    createSubscriber,
    updateSubscriberStatusById,
    updateSubscriberLastEmailSentAt,
    listSubscribers,
    createNewsletter,
    getNewsletterById,
    listPublicNewsletters,
    listAllNewsletters,
    updateNewsletterStatusAndSentAt,
    insertDeliveriesBatch,
    createDelivery,
    updateDeliveryStatus,
    getNewsletterStats,
    getFailedDeliveries,
    getActiveSubscribersBatch
};

