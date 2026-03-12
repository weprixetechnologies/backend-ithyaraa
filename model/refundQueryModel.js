const db = require('../utils/dbconnect');
const { randomUUID } = require('crypto');

async function createRefundQuery({ orderID, orderItemID, productID, userID, brandID, reason }) {
    const refundQueryID = `RQ-${randomUUID().slice(0, 8).toUpperCase()}`;
    await db.query(
        `INSERT INTO refund_queries (refundQueryID, orderID, orderItemID, productID, userID, brandID, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [refundQueryID, orderID, orderItemID, productID, userID, brandID || null, reason || null]
    );
    return { refundQueryID, orderID, orderItemID, productID, userID, brandID, reason, status: 'pending' };
}

async function getRefundQueriesList({ page = 1, limit = 20, status = null } = {}) {
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    let where = '1=1';
    if (status) {
        where += ' AND rq.status = ?';
        params.push(status);
    }
    const [rows] = await db.query(
        `SELECT rq.refundQueryID, rq.orderID, rq.orderItemID, rq.productID, rq.userID, rq.brandID, rq.reason, rq.status, rq.createdAt, rq.updatedAt
         FROM refund_queries rq
         WHERE ${where}
         ORDER BY rq.createdAt DESC
         LIMIT ? OFFSET ?`,
        [...params, Number(limit), offset]
    );
    const [[{ total } = { total: 0 }]] = await db.query(
        `SELECT COUNT(*) as total FROM refund_queries rq WHERE ${where}`,
        params
    );
    return { data: rows, total, page: Number(page), limit: Number(limit) };
}

async function getRefundQueryByID(refundQueryID) {
    const [rows] = await db.query('SELECT * FROM refund_queries WHERE refundQueryID = ?', [refundQueryID]);
    return rows[0] || null;
}

async function updateRefundQueryStatus(refundQueryID, status) {
    const [result] = await db.query(
        'UPDATE refund_queries SET status = ?, updatedAt = NOW() WHERE refundQueryID = ?',
        [status, refundQueryID]
    );
    return result.affectedRows > 0;
}

module.exports = {
    createRefundQuery,
    getRefundQueriesList,
    getRefundQueryByID,
    updateRefundQueryStatus
};
