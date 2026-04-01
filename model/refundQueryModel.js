const db = require('../utils/dbconnect');
const { randomUUID } = require('crypto');

async function createRefundQuery({ refundQueryID: manualID, orderID, orderItemID, productID, userID, brandID, reason, status = 'pending', returnType = 'refund', comments = null, photos = null }) {
    const refundQueryID = manualID || `RQ-${randomUUID().slice(0, 8).toUpperCase()}`;
    await db.query(
        `INSERT INTO refund_queries (refundQueryID, orderID, orderItemID, productID, userID, brandID, reason, status, returnType, comments, photos)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [refundQueryID, orderID, orderItemID, productID, userID, brandID || null, reason || null, status, returnType, comments, photos]
    );
    return { refundQueryID, orderID, orderItemID, productID, userID, brandID, reason, status, returnType, comments, photos };
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
        `SELECT rq.refundQueryID, rq.orderID, rq.orderItemID, rq.productID, rq.userID, rq.brandID, rq.reason, rq.status, rq.createdAt, rq.updatedAt, rq.returnType, rq.comments, rq.photos
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
    await db.query(`UPDATE refund_queries SET status = ? WHERE refundQueryID = ?`, [status, refundQueryID]);
    return { success: true };
}

async function resolveRefundQuery(refundQueryID, finalStatus) {
    try {
        // Copy to resolved table
        await db.query(
            `INSERT INTO refund_queries_resolved 
             (refundQueryID, orderID, orderItemID, productID, userID, brandID, reason, status, returnType, comments, photos, createdAt)
             SELECT refundQueryID, orderID, orderItemID, productID, userID, brandID, reason, ?, returnType, comments, photos, createdAt 
             FROM refund_queries WHERE refundQueryID = ?`,
            [finalStatus, refundQueryID]
        );
        // Delete from active table
        await db.query(`DELETE FROM refund_queries WHERE refundQueryID = ?`, [refundQueryID]);
        return { success: true };
    } catch (e) {
        console.error('Error resolving refund query:', e);
        throw e;
    }
}

async function getResolvedQueriesList({ page = 1, limit = 20 } = {}) {
    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await db.query(
        `SELECT rq.*, p.name AS productName, p.featuredImage AS productImg, u.username, u.emailID 
         FROM refund_queries_resolved rq
         LEFT JOIN products p ON rq.productID = p.productID
         LEFT JOIN users u ON rq.userID = u.uid
         ORDER BY rq.resolvedAt DESC
         LIMIT ? OFFSET ?`,
        [Number(limit), offset]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM refund_queries_resolved`);
    return { success: true, data: rows, total };
}

module.exports.createRefundQuery = createRefundQuery;
module.exports.getRefundQueriesList = getRefundQueriesList;
module.exports.getRefundQueryByID = getRefundQueryByID;
module.exports.updateRefundQueryStatus = updateRefundQueryStatus;
module.exports.resolveRefundQuery = resolveRefundQuery;
module.exports.getResolvedQueriesList = getResolvedQueriesList;
