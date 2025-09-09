const db = require('./../utils/dbconnect')
const { randomUUID } = require('crypto');

const updateAffiliateStatus = async (emailID, uid) => {
    const query = `
        UPDATE users 
        SET affiliate = 'pending'
        WHERE emailID = ? AND uid = ?
    `;
    const [result] = await db.execute(query, [emailID, uid]);
    return result;
};
const approveAffiliateByUID = async (uid) => {
    const query = `
        UPDATE users 
        SET affiliate = 'approved'
        WHERE uid = ?
    `;
    const [result] = await db.execute(query, [uid]);
    return result;
};

// Create a new record in affiliateTransactions table
const createAffiliateTransaction = async ({ txnID, uid, status = 'pending', amount, type }) => {
    // Ensure txnID is present
    txnID = txnID || randomUUID();
    const query = `
        INSERT INTO affiliateTransactions (txnID, uid, status, amount, type)
        VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [txnID, uid, status, amount, type]);
    return result;
};

module.exports = {
    updateAffiliateStatus, approveAffiliateByUID, createAffiliateTransaction
};

// Fetch affiliate transactions for a user with optional filters and pagination
async function getAffiliateTransactions(uid, {
    status,
    type,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    page = 1,
    limit = 10,
    sortBy = 'createdOn',
    sortOrder = 'DESC'
} = {}) {
    const allowedSortBy = ['createdOn', 'amount', 'status', 'type'];
    const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'createdOn';
    const safeSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const where = ['uid = ?'];
    const params = [uid];

    if (status) { where.push('status = ?'); params.push(status); }
    if (type) { where.push('type = ?'); params.push(type); }
    if (startDate) { where.push('createdOn >= ?'); params.push(startDate); }
    if (endDate) { where.push('createdOn <= ?'); params.push(endDate); }
    if (minAmount != null) { where.push('amount >= ?'); params.push(minAmount); }
    if (maxAmount != null) { where.push('amount <= ?'); params.push(maxAmount); }

    const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const limitNum = Math.max(1, Number(limit));

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const listQuery = `
        SELECT txnID, uid, status, amount, type, createdOn
        FROM affiliateTransactions
        ${whereClause}
        ORDER BY ${safeSortBy} ${safeSortOrder}
        LIMIT ? OFFSET ?
    `;

    const countQuery = `
        SELECT COUNT(*) as total
        FROM affiliateTransactions
        ${whereClause}
    `;

    const [rows] = await db.execute(listQuery, [...params, limitNum, offset]);
    const [countRows] = await db.execute(countQuery, params);
    const total = countRows && countRows[0] ? countRows[0].total : 0;

    return { data: rows, page: Number(page) || 1, limit: limitNum, total };
}

module.exports.getAffiliateTransactions = getAffiliateTransactions;