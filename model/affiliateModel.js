const db = require('./../utils/dbconnect')
const { randomUUID } = require('crypto');

// Affiliate transaction status enums (manual variants: mPending, mCompleted, etc.; frontend strips "m" for display)
const AFFILIATE_TXN_STATUS = ['pending', 'confirmed', 'completed', 'failed', 'rejected', 'returned', 'mPending', 'mConfirmed', 'mCompleted', 'mFailed', 'mRejected', 'mReturned'];
const AFFILIATE_TXN_STATUS_SQL_IN_COMPLETED = "(status IN ('completed','mCompleted'))";
const AFFILIATE_TXN_STATUS_SQL_IN_PENDING = "(status IN ('pending','mPending'))";
const AFFILIATE_TXN_STATUS_SQL_IN_CONFIRMED = "(status IN ('confirmed','mConfirmed'))";
const AFFILIATE_TXN_STATUS_SQL_NOT_RETURNED = "(status NOT IN ('returned','mReturned'))";
const AFFILIATE_TXN_STATUS_SQL_IN_PENDING_OR_COMPLETED = "(status IN ('pending','mPending','completed','mCompleted'))";

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

const rejectAffiliateByUID = async (uid) => {
    const query = `
        UPDATE users 
        SET affiliate = NULL
        WHERE uid = ?
    `;
    const [result] = await db.execute(query, [uid]);
    return result;
};

// Create a new record in affiliateTransactions table
const createAffiliateTransaction = async ({ txnID, uid, status = 'pending', amount, type, bankAccountID = null, orderID = null }) => {
    // Ensure txnID is present
    txnID = txnID || randomUUID();

    let query, params;
    try {
        const [colBank] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'bankAccountID'`);
        const [colOrder] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'orderID'`);
        const hasBank = colBank.length > 0;
        const hasOrder = colOrder.length > 0;

        if (hasOrder && hasBank) {
            query = `INSERT INTO affiliateTransactions (txnID, uid, status, amount, type, bankAccountID, orderID) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            params = [txnID, uid, status, amount, type, bankAccountID, orderID];
        } else if (hasOrder) {
            query = `INSERT INTO affiliateTransactions (txnID, uid, status, amount, type, orderID) VALUES (?, ?, ?, ?, ?, ?)`;
            params = [txnID, uid, status, amount, type, orderID];
        } else if (hasBank) {
            query = `INSERT INTO affiliateTransactions (txnID, uid, status, amount, type, bankAccountID) VALUES (?, ?, ?, ?, ?, ?)`;
            params = [txnID, uid, status, amount, type, bankAccountID];
        } else {
            query = `INSERT INTO affiliateTransactions (txnID, uid, status, amount, type) VALUES (?, ?, ?, ?, ?)`;
            params = [txnID, uid, status, amount, type];
        }
    } catch (error) {
        query = `INSERT INTO affiliateTransactions (txnID, uid, status, amount, type) VALUES (?, ?, ?, ?, ?)`;
        params = [txnID, uid, status, amount, type];
    }

    const [result] = await db.execute(query, params);
    return result;
};

// Admin: Update affiliate transaction status (allowed values: all AFFILIATE_TXN_STATUS including m.*)
const updateAffiliateTransactionStatus = async (txnID, newStatus) => {
    if (!AFFILIATE_TXN_STATUS.includes(newStatus)) {
        throw new Error(`Invalid status. Allowed: ${AFFILIATE_TXN_STATUS.join(', ')}`);
    }
    const [result] = await db.execute(
        'UPDATE affiliateTransactions SET status = ?, updatedOn = NOW() WHERE txnID = ?',
        [newStatus, txnID]
    );
    return result;
};

// Admin: Create manual affiliate transaction (deduction or increase) and adjust user pendingPayment
const createManualAffiliateTransaction = async ({ uid, amount, type, comment }) => {
    if (!uid || amount == null || Number(amount) <= 0) {
        throw new Error('uid and positive amount are required');
    }
    if (!['incoming', 'outgoing'].includes(type)) {
        throw new Error('type must be incoming or outgoing');
    }
    const txnID = randomUUID();
    const amt = Number(amount);
    const status = 'mCompleted';

    if (type === 'outgoing') {
        const [rows] = await db.execute(
            'SELECT COALESCE(pendingPayment, 0) as pendingPayment FROM users WHERE uid = ?',
            [uid]
        );
        if (!rows.length) throw new Error('User not found');
        if (rows[0].pendingPayment < amt) {
            throw new Error('Insufficient pending balance for deduction');
        }
    }

    const [colComment] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'comment'`);
    const hasComment = colComment.length > 0;
    const commentVal = comment || (type === 'incoming' ? 'Manual credit by admin' : 'Manual deduction by admin');

    if (hasComment) {
        await db.execute(
            `INSERT INTO affiliateTransactions (txnID, uid, status, amount, type, comment, updatedOn) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [txnID, uid, status, amt, type, commentVal]
        );
    } else {
        await db.execute(
            `INSERT INTO affiliateTransactions (txnID, uid, status, amount, type, updatedOn) VALUES (?, ?, ?, ?, ?, NOW())`,
            [txnID, uid, status, amt, type]
        );
    }

    if (type === 'incoming') {
        await db.execute(
            'UPDATE users SET pendingPayment = COALESCE(pendingPayment, 0) + ? WHERE uid = ?',
            [amt, uid]
        );
    } else {
        await db.execute(
            'UPDATE users SET pendingPayment = GREATEST(0, COALESCE(pendingPayment, 0) - ?) WHERE uid = ?',
            [amt, uid]
        );
    }

    return { txnID, amount: amt, type, status };
};

// Admin: List users who are affiliates (pending or approved)
async function getAffiliateList({ search, status, page = 1, limit = 10 } = {}) {
    const where = ["(affiliate = 'pending' OR affiliate = 'approved')"];
    const params = [];

    if (status && status !== 'all') {
        where.push('affiliate = ?');
        params.push(status === 'pending' ? 'pending' : 'approved');
    }
    if (search) {
        where.push('(username LIKE ? OR emailID LIKE ? OR phonenumber LIKE ? OR uid LIKE ?)');
        const term = `%${search}%`;
        params.push(term, term, term, term);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const limitNum = Math.max(1, Number(limit));

    const listQuery = `
        SELECT uid, username as name, emailID, phonenumber, affiliate as affiliateStatus, createdOn, lastLogin, balance
        FROM users
        ${whereClause}
        ORDER BY createdOn DESC
        LIMIT ? OFFSET ?
    `;
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;

    const [rows] = await db.execute(listQuery, [...params, limitNum, offset]);
    const [countRows] = await db.execute(countQuery, params);
    const total = countRows && countRows[0] ? countRows[0].total : 0;

    return { data: rows, page: Number(page) || 1, limit: limitNum, total };
}

module.exports = {
    updateAffiliateStatus, approveAffiliateByUID, rejectAffiliateByUID, createAffiliateTransaction, getAffiliateList,
    updateAffiliateTransactionStatus, createManualAffiliateTransaction,
    AFFILIATE_TXN_STATUS
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

// ==================== Bank Account Functions ====================

// Create a new bank account
const createBankAccount = async (bankAccountData) => {
    try {
        const {
            uid,
            accountHolderName,
            accountNumber,
            ifscCode,
            bankName,
            branchName = null,
            accountType = 'savings',
            panNumber = null,
            gstin = null,
            address = null
        } = bankAccountData;

        // Check if account already exists
        const [existing] = await db.execute(
            'SELECT bankAccountID FROM affiliate_bank_accounts WHERE uid = ? AND accountNumber = ? AND ifscCode = ?',
            [uid, accountNumber, ifscCode]
        );

        if (existing.length > 0) {
            return { success: false, error: 'Bank account already exists' };
        }

        // If this is the first account or isDefault is true, set others to not default
        if (bankAccountData.isDefault) {
            await db.execute(
                'UPDATE affiliate_bank_accounts SET isDefault = 0 WHERE uid = ?',
                [uid]
            );
        } else {
            // Check if user has any approved accounts
            const [approvedAccounts] = await db.execute(
                'SELECT COUNT(*) as count FROM affiliate_bank_accounts WHERE uid = ? AND status = "approved"',
                [uid]
            );
            // If no approved accounts exist, set this as default
            if (approvedAccounts[0].count === 0) {
                bankAccountData.isDefault = 1;
            }
        }

        const query = `
            INSERT INTO affiliate_bank_accounts 
            (uid, accountHolderName, accountNumber, ifscCode, bankName, branchName, accountType, panNumber, gstin, address, status, isDefault, submittedBy)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `;

        const [result] = await db.execute(query, [
            uid,
            accountHolderName,
            accountNumber,
            ifscCode,
            bankName,
            branchName,
            accountType,
            panNumber,
            gstin,
            address,
            bankAccountData.isDefault || 0,
            uid
        ]);

        return { success: true, data: { bankAccountID: result.insertId } };
    } catch (error) {
        console.error('Error creating bank account:', error);
        throw error;
    }
};

// Get bank accounts for a user
const getBankAccounts = async (uid, includeRejected = false) => {
    try {
        const where = ['uid = ?'];
        const params = [uid];

        if (!includeRejected) {
            where.push('status != ?');
            params.push('rejected');
        }

        const query = `
            SELECT 
                bankAccountID,
                accountHolderName,
                accountNumber,
                ifscCode,
                bankName,
                branchName,
                accountType,
                panNumber,
                gstin,
                address,
                status,
                isDefault,
                createdAt,
                updatedAt,
                approvedAt,
                rejectedAt,
                rejectionReason
            FROM affiliate_bank_accounts
            WHERE ${where.join(' AND ')}
            ORDER BY isDefault DESC, createdAt DESC
        `;

        const [rows] = await db.execute(query, params);
        return rows;
    } catch (error) {
        console.error('Error fetching bank accounts:', error);
        throw error;
    }
};

// Get a single bank account by ID
const getBankAccountById = async (bankAccountID, uid) => {
    try {
        const query = `
            SELECT 
                bankAccountID,
                uid,
                accountHolderName,
                accountNumber,
                ifscCode,
                bankName,
                branchName,
                accountType,
                panNumber,
                gstin,
                address,
                status,
                isDefault,
                createdAt,
                updatedAt,
                approvedAt,
                rejectedAt,
                rejectionReason,
                approvedBy,
                rejectedBy
            FROM affiliate_bank_accounts
            WHERE bankAccountID = ? AND uid = ?
        `;

        const [rows] = await db.execute(query, [bankAccountID, uid]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('Error fetching bank account:', error);
        throw error;
    }
};

// Set default bank account
const setDefaultBankAccount = async (bankAccountID, uid) => {
    try {
        // Verify account belongs to user and is approved
        const [account] = await db.execute(
            'SELECT status FROM affiliate_bank_accounts WHERE bankAccountID = ? AND uid = ?',
            [bankAccountID, uid]
        );

        if (account.length === 0) {
            return { success: false, error: 'Bank account not found' };
        }

        if (account[0].status !== 'approved') {
            return { success: false, error: 'Only approved bank accounts can be set as default' };
        }

        // Set all accounts to not default
        await db.execute(
            'UPDATE affiliate_bank_accounts SET isDefault = 0 WHERE uid = ?',
            [uid]
        );

        // Set selected account as default
        await db.execute(
            'UPDATE affiliate_bank_accounts SET isDefault = 1 WHERE bankAccountID = ? AND uid = ?',
            [bankAccountID, uid]
        );

        return { success: true };
    } catch (error) {
        console.error('Error setting default bank account:', error);
        throw error;
    }
};

// Delete bank account (only if not approved or user's own)
const deleteBankAccount = async (bankAccountID, uid) => {
    try {
        const [account] = await db.execute(
            'SELECT status, isDefault FROM affiliate_bank_accounts WHERE bankAccountID = ? AND uid = ?',
            [bankAccountID, uid]
        );

        if (account.length === 0) {
            return { success: false, error: 'Bank account not found' };
        }

        // Can only delete pending or rejected accounts
        if (account[0].status === 'approved') {
            return { success: false, error: 'Cannot delete approved bank account' };
        }

        await db.execute(
            'DELETE FROM affiliate_bank_accounts WHERE bankAccountID = ? AND uid = ?',
            [bankAccountID, uid]
        );

        return { success: true };
    } catch (error) {
        console.error('Error deleting bank account:', error);
        throw error;
    }
};

// Admin: Get all bank account requests
const getAllBankAccountRequests = async ({ page = 1, limit = 10, status, uid = null }) => {
    try {
        const offset = (page - 1) * limit;
        const where = [];
        const params = [];

        if (status) {
            where.push('aba.status = ?');
            params.push(status);
        }

        if (uid) {
            where.push('aba.uid = ?');
            params.push(uid);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const listQuery = `
            SELECT 
                aba.bankAccountID,
                aba.uid,
                aba.accountHolderName,
                aba.accountNumber,
                aba.ifscCode,
                aba.bankName,
                aba.branchName,
                aba.accountType,
                aba.panNumber,
                aba.gstin,
                aba.address,
                aba.status,
                aba.isDefault,
                aba.createdAt,
                aba.updatedAt,
                aba.approvedAt,
                aba.rejectedAt,
                aba.rejectionReason,
                aba.approvedBy,
                aba.rejectedBy,
                u.name as userName,
                u.emailID as userEmail
            FROM affiliate_bank_accounts aba
            LEFT JOIN users u ON aba.uid = u.uid
            ${whereClause}
            ORDER BY aba.createdAt DESC
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM affiliate_bank_accounts aba
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
        console.error('Error fetching bank account requests:', error);
        throw error;
    }
};

// Admin: Approve bank account
const approveBankAccount = async (bankAccountID, adminUID) => {
    try {
        // Check if account exists and is pending
        const [account] = await db.execute(
            'SELECT uid, status FROM affiliate_bank_accounts WHERE bankAccountID = ?',
            [bankAccountID]
        );

        if (account.length === 0) {
            return { success: false, error: 'Bank account not found' };
        }

        if (account[0].status !== 'pending') {
            return { success: false, error: 'Bank account is not pending approval' };
        }

        // If this is the first approved account for the user, set as default
        const [approvedAccounts] = await db.execute(
            'SELECT COUNT(*) as count FROM affiliate_bank_accounts WHERE uid = ? AND status = "approved"',
            [account[0].uid]
        );

        const isDefault = approvedAccounts[0].count === 0 ? 1 : 0;

        // Update account status
        await db.execute(
            `UPDATE affiliate_bank_accounts 
             SET status = 'approved', 
                 isDefault = ?,
                 approvedBy = ?,
                 approvedAt = NOW(),
                 updatedAt = NOW()
             WHERE bankAccountID = ?`,
            [isDefault, adminUID, bankAccountID]
        );

        return { success: true, data: { bankAccountID, status: 'approved' } };
    } catch (error) {
        console.error('Error approving bank account:', error);
        return { success: false, error: error.message };
    }
};

// Admin: Reject bank account
const rejectBankAccount = async (bankAccountID, adminUID, rejectionReason = null) => {
    try {
        // Check if account exists and is pending
        const [account] = await db.execute(
            'SELECT uid, status FROM affiliate_bank_accounts WHERE bankAccountID = ?',
            [bankAccountID]
        );

        if (account.length === 0) {
            return { success: false, error: 'Bank account not found' };
        }

        if (account[0].status !== 'pending') {
            return { success: false, error: 'Bank account is not pending approval' };
        }

        // Update account status
        await db.execute(
            `UPDATE affiliate_bank_accounts 
             SET status = 'rejected', 
                 rejectedBy = ?,
                 rejectionReason = ?,
                 rejectedAt = NOW(),
                 updatedAt = NOW()
             WHERE bankAccountID = ?`,
            [adminUID, rejectionReason, bankAccountID]
        );

        return { success: true, data: { bankAccountID, status: 'rejected' } };
    } catch (error) {
        console.error('Error rejecting bank account:', error);
        return { success: false, error: error.message };
    }
};

// Get approved default bank account for user
const getDefaultBankAccount = async (uid) => {
    try {
        const query = `
            SELECT 
                bankAccountID,
                accountHolderName,
                accountNumber,
                ifscCode,
                bankName,
                branchName,
                accountType
            FROM affiliate_bank_accounts
            WHERE uid = ? AND status = 'approved' AND isDefault = 1
            LIMIT 1
        `;

        const [rows] = await db.execute(query, [uid]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('Error fetching default bank account:', error);
        throw error;
    }
};

module.exports.createBankAccount = createBankAccount;
module.exports.getBankAccounts = getBankAccounts;
module.exports.getBankAccountById = getBankAccountById;
module.exports.setDefaultBankAccount = setDefaultBankAccount;
module.exports.deleteBankAccount = deleteBankAccount;
module.exports.getAllBankAccountRequests = getAllBankAccountRequests;
module.exports.approveBankAccount = approveBankAccount;
module.exports.rejectBankAccount = rejectBankAccount;
module.exports.getDefaultBankAccount = getDefaultBankAccount;

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

    // Total earnings: incoming, exclude returned (include m.* for manual-override rows)
    const [earningsResult] = await db.execute(
        `SELECT SUM(amount) AS totalEarnings 
         FROM affiliateTransactions 
         WHERE uid = ? AND type = 'incoming' AND ${AFFILIATE_TXN_STATUS_SQL_NOT_RETURNED}`,
        [uid]
    );

    // Pending earnings: incoming, status = pending (order placed, not yet delivered)
    const [pendingEarningsResult] = await db.execute(
        `SELECT SUM(amount) AS totalPendingEarnings 
         FROM affiliateTransactions 
         WHERE uid = ? AND type = 'incoming' AND ${AFFILIATE_TXN_STATUS_SQL_IN_PENDING}`,
        [uid]
    );

    // Locked amount: confirmed and still within return period (lockedUntil > now)
    let lockedEarnings = 0;
    try {
        const [colLocked] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'lockedUntil'`);
        if (colLocked.length > 0) {
            const now = new Date();
            const [lockedResult] = await db.execute(
                `SELECT COALESCE(SUM(amount), 0) AS lockedEarnings 
                 FROM affiliateTransactions 
                 WHERE uid = ? AND type = 'incoming' AND ${AFFILIATE_TXN_STATUS_SQL_IN_CONFIRMED} AND lockedUntil > ?`,
                [uid, now]
            );
            lockedEarnings = lockedResult[0].lockedEarnings || 0;
        }
    } catch (e) { /* column may not exist */ }

    return {
        totalClicks: clicksResult[0].totalClicks || 0,
        totalOrders: ordersResult[0].totalOrders || 0,
        totalEarnings: earningsResult[0].totalEarnings || 0,
        totalPendingEarnings: pendingEarningsResult[0].totalPendingEarnings || 0,
        lockedEarnings
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
            WHERE uid = ? AND type = 'outgoing' AND ${AFFILIATE_TXN_STATUS_SQL_IN_PENDING_OR_COMPLETED}
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
        // Total earnings: incoming only, exclude returned (include m.*)
        const [totalEarningsResult] = await db.execute(
            `SELECT SUM(amount) as totalEarnings 
             FROM affiliateTransactions 
             WHERE uid = ? AND type = 'incoming' AND ${AFFILIATE_TXN_STATUS_SQL_NOT_RETURNED}`,
            [uid]
        );

        // Total paid (completed outgoing)
        const [totalPaidResult] = await db.execute(
            `SELECT SUM(amount) as totalPaid 
             FROM affiliateTransactions 
             WHERE uid = ? AND type = 'outgoing' AND ${AFFILIATE_TXN_STATUS_SQL_IN_COMPLETED}`,
            [uid]
        );

        // Requested payout (pending outgoing)
        const [requestedPayoutResult] = await db.execute(
            `SELECT SUM(amount) as requestedPayout 
             FROM affiliateTransactions 
             WHERE uid = ? AND type = 'outgoing' AND ${AFFILIATE_TXN_STATUS_SQL_IN_PENDING}`,
            [uid]
        );

        // Available for payout: completed OR (confirmed and lockedUntil passed)
        let availableIncomingResult;
        let lockedAmountResult;
        try {
            const [colLocked] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'lockedUntil'`);
            if (colLocked.length > 0) {
                const now = new Date();
                [availableIncomingResult] = await db.execute(
                    `SELECT SUM(amount) as totalAvailable 
                     FROM affiliateTransactions 
                     WHERE uid = ? AND type = 'incoming' AND ${AFFILIATE_TXN_STATUS_SQL_NOT_RETURNED}
                     AND (${AFFILIATE_TXN_STATUS_SQL_IN_COMPLETED} OR (${AFFILIATE_TXN_STATUS_SQL_IN_CONFIRMED} AND (lockedUntil IS NULL OR lockedUntil <= ?)))`,
                    [uid, now]
                );
                [lockedAmountResult] = await db.execute(
                    `SELECT COALESCE(SUM(amount), 0) as lockedAmount 
                     FROM affiliateTransactions 
                     WHERE uid = ? AND type = 'incoming' AND ${AFFILIATE_TXN_STATUS_SQL_IN_CONFIRMED} AND lockedUntil > ?`,
                    [uid, now]
                );
            } else {
                [availableIncomingResult] = await db.execute(
                    `SELECT SUM(amount) as totalAvailable FROM affiliateTransactions 
                     WHERE uid = ? AND type = 'incoming' AND ${AFFILIATE_TXN_STATUS_SQL_IN_COMPLETED}`,
                    [uid]
                );
                lockedAmountResult = [{ lockedAmount: 0 }];
            }
        } catch (e) {
            [availableIncomingResult] = await db.execute(
                `SELECT SUM(amount) as totalAvailable FROM affiliateTransactions 
                 WHERE uid = ? AND type = 'incoming' AND ${AFFILIATE_TXN_STATUS_SQL_IN_COMPLETED}`,
                [uid]
            );
            lockedAmountResult = [{ lockedAmount: 0 }];
        }

        const totalEarnings = totalEarningsResult[0].totalEarnings || 0;
        const totalPaid = totalPaidResult[0].totalPaid || 0;
        const requestedPayout = requestedPayoutResult[0].requestedPayout || 0;
        const totalAvailableIncoming = availableIncomingResult[0].totalAvailable || 0;
        const lockedAmount = (lockedAmountResult && lockedAmountResult[0]) ? (lockedAmountResult[0].lockedAmount || 0) : 0;

        return {
            totalEarnings,
            totalPaid,
            requestedPayout,
            totalCompletedIncoming: totalAvailableIncoming, // kept for backward compat
            pendingPayoutAvailable: Math.max(0, totalAvailableIncoming),
            lockedAmount: Math.max(0, lockedAmount)
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

// Get locked affiliate amounts with unlock dates (for "Know more" on payout page)
const getLockedAffiliateBreakdown = async (uid) => {
    try {
        const [colLocked] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'lockedUntil'`);
        if (colLocked.length === 0) return { lockedAmount: 0, items: [] };
        const now = new Date();
        let rows = [];
        try {
            const [r] = await db.execute(
                `SELECT amount, lockedUntil, orderID 
                 FROM affiliateTransactions 
                 WHERE uid = ? AND type = 'incoming' AND ${AFFILIATE_TXN_STATUS_SQL_IN_CONFIRMED} AND lockedUntil > ?
                 ORDER BY lockedUntil ASC`,
                [uid, now]
            );
            rows = r;
        } catch (e) {
            if (e.message && e.message.includes('orderID')) {
                const [r] = await db.execute(
                    `SELECT amount, lockedUntil FROM affiliateTransactions 
                     WHERE uid = ? AND type = 'incoming' AND ${AFFILIATE_TXN_STATUS_SQL_IN_CONFIRMED} AND lockedUntil > ?
                     ORDER BY lockedUntil ASC`,
                    [uid, now]
                );
                rows = r.map((x) => ({ ...x, orderID: null }));
            } else throw e;
        }
        const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        return {
            lockedAmount: total,
            items: rows.map((r) => ({
                amount: Number(r.amount || 0),
                unlockedAt: r.lockedUntil,
                orderID: r.orderID || null
            }))
        };
    } catch (error) {
        console.error('Error fetching locked affiliate breakdown:', error);
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

        // Check if bankAccountID column exists - use dynamic query
        let listQuery;
        try {
            const [columns] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'bankAccountID'`);
            if (columns.length > 0) {
                listQuery = `
                    SELECT at.txnID, at.amount, at.status, at.type, at.bankAccountID, at.createdOn,
                    COALESCE(at.updatedOn, at.createdOn) as updatedOn, u.name as userName, u.emailID as userEmail,
                    aba.accountHolderName, aba.accountNumber, aba.ifscCode, aba.bankName
                    FROM affiliateTransactions at
                    LEFT JOIN users u ON at.uid = u.uid
                    LEFT JOIN affiliate_bank_accounts aba ON at.bankAccountID = aba.bankAccountID
                    ${whereClause}
                    ORDER BY at.createdOn DESC LIMIT ? OFFSET ?
                `;
            } else {
                listQuery = `
                    SELECT at.txnID, at.amount, at.status, at.type, at.createdOn,
                    COALESCE(at.updatedOn, at.createdOn) as updatedOn, u.name as userName, u.emailID as userEmail
                    FROM affiliateTransactions at
                    LEFT JOIN users u ON at.uid = u.uid
                    ${whereClause}
                    ORDER BY at.createdOn DESC LIMIT ? OFFSET ?
                `;
            }
        } catch (error) {
            listQuery = `
                SELECT at.txnID, at.amount, at.status, at.type, at.createdOn,
                COALESCE(at.updatedOn, at.createdOn) as updatedOn, u.name as userName, u.emailID as userEmail
                FROM affiliateTransactions at
                LEFT JOIN users u ON at.uid = u.uid
                ${whereClause}
                ORDER BY at.createdOn DESC LIMIT ? OFFSET ?
            `;
        }

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

// Confirm refer settlement on delivery: set status=confirmed, comment, lockedUntil (7-day return period)
const confirmReferSettlementOnDelivery = async (orderID, deliveredAt = new Date()) => {
    try {
        const [colOrder] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'orderID'`);
        if (colOrder.length === 0) return { updated: 0 };
        const lockedUntil = new Date(deliveredAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        const comment = 'Locked until return period';
        const [result] = await db.execute(
            `UPDATE affiliateTransactions SET status = 'confirmed', comment = ?, lockedUntil = ?, updatedOn = NOW()
             WHERE orderID = ? AND type = 'incoming' AND status = 'pending'`,
            [comment, lockedUntil, orderID]
        );
        return { updated: result.affectedRows || 0 };
    } catch (error) {
        console.error('Error confirming refer settlement on delivery:', error);
        throw error;
    }
};

// Revert refer settlement on return: set status=returned and deduct from user's pendingPayment
const revertReferSettlementOnReturn = async (orderID) => {
    try {
        const [colOrder] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'orderID'`);
        if (colOrder.length === 0) return { reverted: 0 };
        const [rows] = await db.execute(
            `SELECT txnID, uid, amount FROM affiliateTransactions
             WHERE orderID = ? AND type = 'incoming' AND status IN ('pending', 'confirmed')`,
            [orderID]
        );
        if (!rows || rows.length === 0) return { reverted: 0 };
        for (const row of rows) {
            await db.execute(
                `UPDATE affiliateTransactions SET status = 'returned', updatedOn = NOW() WHERE txnID = ?`,
                [row.txnID]
            );
            await db.execute(
                'UPDATE users SET pendingPayment = GREATEST(0, COALESCE(pendingPayment, 0) - ?) WHERE uid = ?',
                [row.amount, row.uid]
            );
        }
        return { reverted: rows.length };
    } catch (error) {
        console.error('Error reverting refer settlement on return:', error);
        throw error;
    }
};

// Deduct affiliate earnings proportionally for a returned order item.
// Reduces the locked amount (original incoming transaction amount) and pendingPayment; also logs affiliate_return_deduction for history.
const deductAffiliateEarningsForReturnedItem = async (orderID, orderItemID, itemLineTotal, orderTotal, referrerUid) => {
    try {
        const [colOrderItem] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'orderItemID'`);
        if (colOrderItem.length === 0) return { success: false, message: 'orderItemID column not found' };
        const [rows] = await db.execute(
            `SELECT txnID, uid, amount FROM affiliateTransactions WHERE orderID = ? AND type = 'incoming' AND status IN ('pending','confirmed')`,
            [orderID]
        );
        if (!rows || rows.length === 0) return { success: true, deducted: 0 };
        const totalCommission = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        if (orderTotal <= 0 || totalCommission <= 0) return { success: true, deducted: 0 };
        const deduction = Math.round((itemLineTotal / orderTotal) * totalCommission * 100) / 100;
        if (deduction <= 0) return { success: true, deducted: 0 };
        const uid = rows[0].uid;
        if (uid !== referrerUid) return { success: false, message: 'Referrer mismatch' };
        // Reduce locked amount: update the original incoming transaction(s) so locked commission is reduced
        await db.execute(
            `UPDATE affiliateTransactions SET amount = GREATEST(0, amount - ?), updatedOn = NOW() WHERE orderID = ? AND type = 'incoming' AND status IN ('pending','confirmed')`,
            [deduction, orderID]
        );
        // Reduce pendingPayment to match (locked amount was part of balance)
        await db.execute(
            'UPDATE users SET pendingPayment = GREATEST(0, COALESCE(pendingPayment, 0) - ?) WHERE uid = ?',
            [deduction, uid]
        );
        // Log for transaction history
        const txnID = randomUUID();
        await db.execute(
            `INSERT INTO affiliateTransactions (txnID, uid, status, amount, type, orderID, orderItemID) VALUES (?, ?, 'completed', ?, 'affiliate_return_deduction', ?, ?)`,
            [txnID, uid, -deduction, orderID, orderItemID]
        );
        return { success: true, deducted: deduction };
    } catch (error) {
        console.error('Error deducting affiliate earnings for returned item:', error);
        throw error;
    }
};

// Revert pending refer settlement when order cancelled before delivery (no delivery happened)
const revertPendingReferSettlementOnCancel = async (orderID) => {
    try {
        const [colOrder] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'orderID'`);
        if (colOrder.length === 0) return { reverted: 0 };
        const [rows] = await db.execute(
            `SELECT txnID, uid, amount FROM affiliateTransactions
             WHERE orderID = ? AND type = 'incoming' AND status = 'pending'`,
            [orderID]
        );
        if (!rows || rows.length === 0) return { reverted: 0 };
        for (const row of rows) {
            await db.execute(
                `UPDATE affiliateTransactions SET status = 'returned', updatedOn = NOW() WHERE txnID = ?`,
                [row.txnID]
            );
            await db.execute(
                'UPDATE users SET pendingPayment = GREATEST(0, COALESCE(pendingPayment, 0) - ?) WHERE uid = ?',
                [row.amount, row.uid]
            );
        }
        return { reverted: rows.length };
    } catch (error) {
        console.error('Error reverting pending refer settlement on cancel:', error);
        throw error;
    }
};

// Re-apply refer settlement when order status is changed back from Returned/Cancelled to Delivered
const reapplyReferSettlementOnDelivery = async (orderID, deliveredAt = new Date()) => {
    try {
        const [colOrder] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'orderID'`);
        if (colOrder.length === 0) return { updated: 0 };
        const [rows] = await db.execute(
            `SELECT txnID, uid, amount FROM affiliateTransactions
             WHERE orderID = ? AND type = 'incoming' AND status = 'returned'`,
            [orderID]
        );
        if (!rows || rows.length === 0) return { updated: 0 };
        const lockedUntil = new Date(deliveredAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        const comment = 'Locked until return period';
        const [colComment] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'comment'`);
        const hasComment = colComment.length > 0;
        for (const row of rows) {
            if (hasComment) {
                await db.execute(
                    `UPDATE affiliateTransactions SET status = 'confirmed', comment = ?, lockedUntil = ?, updatedOn = NOW() WHERE txnID = ?`,
                    [comment, lockedUntil, row.txnID]
                );
            } else {
                await db.execute(
                    `UPDATE affiliateTransactions SET status = 'confirmed', lockedUntil = ?, updatedOn = NOW() WHERE txnID = ?`,
                    [lockedUntil, row.txnID]
                );
            }
            await db.execute(
                'UPDATE users SET pendingPayment = COALESCE(pendingPayment, 0) + ? WHERE uid = ?',
                [row.amount, row.uid]
            );
        }
        return { updated: rows.length };
    } catch (error) {
        console.error('Error re-applying refer settlement on delivery:', error);
        throw error;
    }
};

// Re-apply refer settlement to pending when order status is changed back from Returned/Cancelled to non-Delivered (e.g. Preparing, Shipped)
const reapplyReferSettlementToPending = async (orderID) => {
    try {
        const [colOrder] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'orderID'`);
        if (colOrder.length === 0) return { updated: 0 };
        const [rows] = await db.execute(
            `SELECT txnID, uid, amount FROM affiliateTransactions
             WHERE orderID = ? AND type = 'incoming' AND status = 'returned'`,
            [orderID]
        );
        if (!rows || rows.length === 0) return { updated: 0 };
        const [colComment] = await db.execute(`SHOW COLUMNS FROM affiliateTransactions LIKE 'comment'`);
        const hasComment = colComment.length > 0;
        for (const row of rows) {
            if (hasComment) {
                await db.execute(
                    `UPDATE affiliateTransactions SET status = 'pending', comment = NULL, lockedUntil = NULL, updatedOn = NOW() WHERE txnID = ?`,
                    [row.txnID]
                );
            } else {
                await db.execute(
                    `UPDATE affiliateTransactions SET status = 'pending', lockedUntil = NULL, updatedOn = NOW() WHERE txnID = ?`,
                    [row.txnID]
                );
            }
            await db.execute(
                'UPDATE users SET pendingPayment = COALESCE(pendingPayment, 0) + ? WHERE uid = ?',
                [row.amount, row.uid]
            );
        }
        return { updated: rows.length };
    } catch (error) {
        console.error('Error re-applying refer settlement to pending:', error);
        throw error;
    }
};

module.exports.getPayoutHistory = getPayoutHistory;
module.exports.getRequestedPayoutAmount = getRequestedPayoutAmount;
module.exports.getPendingPayoutAvailable = getPendingPayoutAvailable;
module.exports.getRequestablePayouts = getRequestablePayouts;
module.exports.getLockedAffiliateBreakdown = getLockedAffiliateBreakdown;
module.exports.getPayoutRequests = getPayoutRequests;
module.exports.approvePayout = approvePayout;
module.exports.rejectPayout = rejectPayout;
module.exports.confirmReferSettlementOnDelivery = confirmReferSettlementOnDelivery;
module.exports.revertReferSettlementOnReturn = revertReferSettlementOnReturn;
module.exports.revertPendingReferSettlementOnCancel = revertPendingReferSettlementOnCancel;
module.exports.deductAffiliateEarningsForReturnedItem = deductAffiliateEarningsForReturnedItem;
module.exports.reapplyReferSettlementOnDelivery = reapplyReferSettlementOnDelivery;
module.exports.reapplyReferSettlementToPending = reapplyReferSettlementToPending;