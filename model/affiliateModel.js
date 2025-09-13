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

// Fetch affiliated orders (items purchased via this user's referral)
async function getAffiliateOrdersByReferrer(uid, {
    startDate,
    endDate,
    minTotal,
    maxTotal,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'DESC'
} = {}) {
    const allowedSortBy = ['createdAt', 'total', 'orderID', 'buyerUID'];
    const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const where = ['oi.referBy = ?'];
    const params = [uid];

    if (startDate) { where.push('oi.createdAt >= ?'); params.push(startDate); }
    if (endDate) { where.push('oi.createdAt <= ?'); params.push(endDate); }
    if (minTotal != null) { where.push('oi.lineTotalAfter >= ?'); params.push(Number(minTotal)); }
    if (maxTotal != null) { where.push('oi.lineTotalAfter <= ?'); params.push(Number(maxTotal)); }
    // paymentStatus omitted to avoid unknown column issues

    const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const limitNum = Math.max(1, Number(limit));

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const listQuery = `
        SELECT 
            od.orderID,
            od.uid AS buyerUID,
            od.total,
            od.paymentMode,
            od.createdAt,
            od.orderStatus,
            oi.productID,
            oi.quantity,
            oi.name,
            oi.unitPriceAfter,
            oi.lineTotalAfter,
            oi.referBy
        FROM order_items oi
        INNER JOIN orderDetail od ON oi.orderID = od.orderID
        ${whereClause}
        ORDER BY ${safeSortBy === 'buyerUID' ? 'od.buyerUID' : safeSortBy === 'total' ? 'od.total' : safeSortBy === 'orderID' ? 'od.orderID' : 'oi.createdAt'} ${safeSortOrder}
        LIMIT ? OFFSET ?
    `;

    const countQuery = `
        SELECT COUNT(*) as total
        FROM order_items oi
        INNER JOIN orderDetail od ON oi.orderID = od.orderID
        ${whereClause}
    `;

    const [rows] = await db.execute(listQuery, [...params, limitNum, offset]);
    const [countRows] = await db.execute(countQuery, params);
    const total = countRows && countRows[0] ? countRows[0].total : 0;

    return { data: rows, page: Number(page) || 1, limit: limitNum, total };
}

module.exports.getAffiliateOrdersByReferrer = getAffiliateOrdersByReferrer;

/**
 * Get analytics for an affiliate user
 * @param {string} uid - User ID of the affiliate
 * @returns {Object} Analytics data including total clicks, orders, earnings and pending earnings
 */
async function getAffiliateAnalytics(uid) {
    // Get total clicks (cart_items + order_items where referBy = user.uid)
    const [clicksResult] = await db.execute(
        `SELECT 
            (SELECT COUNT(*) FROM cartDetail WHERE referBy = ?) +
            (SELECT COUNT(*) FROM order_items WHERE referBy = ?) AS totalClicks`,
        [uid, uid]
    );

    // Get total orders (count of order_items where referBy = user.uid)
    const [ordersResult] = await db.execute(
        `SELECT COUNT(*) AS totalOrders 
         FROM order_items 
         WHERE referBy = ?`,
        [uid]
    );

    // Get total earnings from affiliateTransactions table where type = 'incoming'
    const [earningsResult] = await db.execute(
        `SELECT SUM(amount) AS totalEarnings 
         FROM affiliateTransactions 
         WHERE uid = ? AND type = 'incoming'`,
        [uid]
    );

    // Get pending earnings from affiliateTransactions table where type = 'incoming' and status = 'pending'
    const [pendingEarningsResult] = await db.execute(
        `SELECT SUM(amount) AS totalPendingEarnings 
         FROM affiliateTransactions 
         WHERE uid = ? AND type = 'incoming' AND status = 'pending'`,
        [uid]
    );

    return {
        totalClicks: clicksResult[0].totalClicks || 0,
        totalOrders: ordersResult[0].totalOrders || 0,
        totalEarnings: earningsResult[0].totalEarnings || 0,
        totalPendingEarnings: pendingEarningsResult[0].totalPendingEarnings || 0
    };
}

module.exports.getAffiliateAnalytics = getAffiliateAnalytics;

const getPayoutHistory = async (uid) => {
    try {
        const query = `
            SELECT 
                txnID as id,
                amount,
                status,
                type,
                createdOn as date
            FROM affiliateTransactions
            WHERE uid = ? AND type = 'outgoing'
            ORDER BY createdOn DESC
        `;

        const [rows] = await db.execute(query, [uid]);
        return rows;
    } catch (error) {
        console.error('Error fetching payout history:', error);
        throw error;
    }
};

const getRequestedPayoutAmount = async (uid) => {
    try {
        const query = `
            SELECT SUM(amount) as totalRequested
            FROM affiliateTransactions
            WHERE uid = ? AND type = 'outgoing' AND status IN ('pending', 'completed')
        `;

        const [rows] = await db.execute(query, [uid]);
        return rows[0].totalRequested || 0;
    } catch (error) {
        console.error('Error fetching requested payout amount:', error);
        throw error;
    }
};

const getPendingPayoutAvailable = async (uid) => {
    try {
        // Get total earnings (all incoming transactions)
        const [totalEarningsResult] = await db.execute(
            `SELECT SUM(amount) as totalEarnings 
             FROM affiliateTransactions 
             WHERE uid = ? AND type = 'incoming'`,
            [uid]
        );

        // Get total paid (completed outgoing transactions)
        const [totalPaidResult] = await db.execute(
            `SELECT SUM(amount) as totalPaid 
             FROM affiliateTransactions 
             WHERE uid = ? AND type = 'outgoing' AND status = 'completed'`,
            [uid]
        );

        // Get requested payout (pending outgoing transactions)
        const [requestedPayoutResult] = await db.execute(
            `SELECT SUM(amount) as requestedPayout 
             FROM affiliateTransactions 
             WHERE uid = ? AND type = 'outgoing' AND status = 'pending'`,
            [uid]
        );

        // Get completed incoming transactions (available for payout)
        const [completedIncomingResult] = await db.execute(
            `SELECT SUM(amount) as totalCompletedIncoming 
             FROM affiliateTransactions 
             WHERE uid = ? AND type = 'incoming' AND status = 'completed'`,
            [uid]
        );

        const totalEarnings = totalEarningsResult[0].totalEarnings || 0;
        const totalPaid = totalPaidResult[0].totalPaid || 0;
        const requestedPayout = requestedPayoutResult[0].requestedPayout || 0;
        const totalCompletedIncoming = completedIncomingResult[0].totalCompletedIncoming || 0;

        // Available Payout = Completed Incoming Transactions (as per user requirement)
        const pendingPayoutAvailable = totalCompletedIncoming;

        return {
            totalEarnings,
            totalPaid,
            requestedPayout,
            totalCompletedIncoming,
            pendingPayoutAvailable: Math.max(0, pendingPayoutAvailable) // Ensure non-negative
        };
    } catch (error) {
        console.error('Error calculating pending payout available:', error);
        throw error;
    }
};

const getRequestablePayouts = async (uid) => {
    try {
        const payoutData = await getPendingPayoutAvailable(uid);
        return {
            requestableAmount: payoutData.pendingPayoutAvailable,
            breakdown: payoutData
        };
    } catch (error) {
        console.error('Error fetching requestable payouts:', error);
        throw error;
    }
};

const getPayoutRequests = async ({ page = 1, limit = 10, status }) => {
    try {
        const offset = (page - 1) * limit;
        const where = ['type = ?'];
        const params = ['outgoing'];

        if (status) {
            where.push('status = ?');
            params.push(status);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const listQuery = `
            SELECT 
                at.txnID,
                at.amount,
                at.status,
                at.type,
                at.createdOn,
                COALESCE(at.updatedOn, at.createdOn) as updatedOn,
                u.name as userName,
                u.emailID as userEmail
            FROM affiliateTransactions at
            LEFT JOIN users u ON at.uid = u.uid
            ${whereClause}
            ORDER BY at.createdOn DESC
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM affiliateTransactions
            ${whereClause}
        `;

        const [rows] = await db.execute(listQuery, [...params, limit, offset]);
        const [countRows] = await db.execute(countQuery, params);
        const total = countRows && countRows[0] ? countRows[0].total : 0;

        return {
            data: rows,
            page: page,
            limit: limit,
            total,
            totalPages: Math.ceil(total / limit)
        };
    } catch (error) {
        console.error('Error fetching payout requests:', error);
        throw error;
    }
};

const approvePayout = async (txnID) => {
    try {
        // Update transaction status to approved
        await db.execute(
            'UPDATE affiliateTransactions SET status = ?, updatedOn = NOW() WHERE txnID = ? AND status = ?',
            ['completed', txnID, 'pending']
        );

        return { success: true, data: { txnID, status: 'completed' } };
    } catch (error) {
        console.error('Error approving payout:', error);
        return { success: false, error: error.message };
    }
};

const rejectPayout = async (txnID) => {
    try {
        // Get the transaction details first
        const [txnRows] = await db.execute(
            'SELECT uid, amount FROM affiliateTransactions WHERE txnID = ? AND status = ?',
            [txnID, 'pending']
        );

        if (txnRows.length === 0) {
            return { success: false, error: 'Payout request not found or already processed' };
        }

        const { uid, amount } = txnRows[0];

        // Update transaction status to rejected
        await db.execute(
            'UPDATE affiliateTransactions SET status = ?, updatedOn = NOW() WHERE txnID = ?',
            ['rejected', txnID]
        );

        // Restore the amount to user's pending payment
        await db.execute(
            'UPDATE users SET pendingPayment = COALESCE(pendingPayment, 0) + ? WHERE uid = ?',
            [amount, uid]
        );

        return { success: true, data: { txnID, status: 'rejected' } };
    } catch (error) {
        console.error('Error rejecting payout:', error);
        return { success: false, error: error.message };
    }
};

module.exports.getPayoutHistory = getPayoutHistory;
module.exports.getRequestedPayoutAmount = getRequestedPayoutAmount;
module.exports.getPendingPayoutAvailable = getPendingPayoutAvailable;
module.exports.getRequestablePayouts = getRequestablePayouts;
module.exports.getPayoutRequests = getPayoutRequests;
module.exports.approvePayout = approvePayout;
module.exports.rejectPayout = rejectPayout;