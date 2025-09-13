const affiliateService = require('./../services/affiliateService')
const db = require('./../utils/dbconnect')

const applyAffiliate = async (req, res) => {
    try {
        const { emailID, uid } = req.user;
        if (!emailID || !uid) {
            return res.status(400).json({ error: 'emailID, uid, and otp are required' });
        }

        const response = await affiliateService.applyAffiliateService(emailID, uid);
        res.status(200).json(response);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};



const approveAffiliate = async (req, res) => {
    try {
        const { uid, emailID, phonenumber } = req.user; // comes from authentication middleware
        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        const response = await affiliateService.approveAffiliateService(uid, emailID, phonenumber);
        res.status(200).json(response);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};

const getAllTransactions = async (req, res) => {
    try {
        const { uid } = req.user;
        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        const {
            status,
            type,
            startDate,
            endDate,
            minAmount,
            maxAmount,
            page,
            limit,
            sortBy,
            sortOrder
        } = req.query;

        const filters = {
            status,
            type,
            startDate,
            endDate,
            minAmount: minAmount != null ? Number(minAmount) : undefined,
            maxAmount: maxAmount != null ? Number(maxAmount) : undefined,
            page: page != null ? Number(page) : undefined,
            limit: limit != null ? Number(limit) : undefined,
            sortBy,
            sortOrder
        };

        const result = await affiliateService.getAllAffiliateTransactions(uid, filters);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

module.exports = { applyAffiliate, approveAffiliate, getAllTransactions }

const getAffiliatedOrders = async (req, res) => {
    try {
        const { uid } = req.user;
        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        const {
            startDate,
            endDate,
            minTotal,
            maxTotal,
            page,
            limit,
            sortBy,
            sortOrder
        } = req.query;

        const filters = {
            startDate,
            endDate,
            minTotal: minTotal != null ? Number(minTotal) : undefined,
            maxTotal: maxTotal != null ? Number(maxTotal) : undefined,
            page: page != null ? Number(page) : undefined,
            limit: limit != null ? Number(limit) : undefined,
            sortBy,
            sortOrder
        };

        const result = await affiliateService.getAffiliatedOrdersService(uid, filters);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

const getAffiliateAnalytics = async (req, res) => {
    try {
        const { uid } = req.user;
        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        const result = await affiliateService.getAffiliateAnalyticsService(uid);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

const requestPayout = async (req, res) => {
    try {
        const { uid } = req.user;
        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        const { amount, otp } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        // Verify OTP if provided
        if (otp) {
            const { verifyPayoutOtp } = require('../services/otpService');
            const otpResult = await verifyPayoutOtp(uid, otp, 'payout_verification');
            if (!otpResult.success) {
                return res.status(400).json({ error: otpResult.message || 'Invalid or expired OTP' });
            }
        } else {
            return res.status(400).json({ error: 'OTP is required for payout verification' });
        }

        // Check if user has enough pending balance
        const [userResult] = await db.execute(
            'SELECT pendingPayment FROM users WHERE uid = ?',
            [uid]
        );

        if (userResult.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentPending = userResult[0].pendingPayment || 0;
        if (amount > currentPending) {
            return res.status(400).json({ error: 'Insufficient pending balance' });
        }

        // Check minimum payout amount
        if (amount < 50) {
            return res.status(400).json({ error: 'Minimum payout amount is ₹50' });
        }

        // Create payout request using createAffiliate function
        const txnID = require('crypto').randomUUID();
        await affiliateService.createAffiliate({
            txnID,
            uid,
            status: 'pending',
            amount: amount,
            type: 'outgoing'
        });

        // Deduct from pending payment
        await db.execute(
            'UPDATE users SET pendingPayment = pendingPayment - ? WHERE uid = ?',
            [amount, uid]
        );

        return res.status(200).json({
            success: true,
            message: 'Payout request submitted successfully',
            data: { txnID, amount, status: 'pending' }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

module.exports.getAffiliatedOrders = getAffiliatedOrders;
module.exports.getAffiliateAnalytics = getAffiliateAnalytics;
const getPayoutHistory = async (req, res) => {
    try {
        const { uid } = req.user;
        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        const [payoutHistory, requestedAmount] = await Promise.all([
            affiliateService.getPayoutHistoryService(uid),
            affiliateService.getRequestedPayoutAmountService(uid)
        ]);

        return res.status(200).json({
            success: true,
            data: {
                payoutHistory,
                requestedAmount
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

const getPendingPayoutAvailable = async (req, res) => {
    try {
        const { uid } = req.user;
        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        const payoutData = await affiliateService.getPendingPayoutAvailableService(uid);

        return res.status(200).json({
            success: true,
            data: payoutData
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

const getRequestablePayouts = async (req, res) => {
    try {
        const { uid } = req.user;
        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        const payoutData = await affiliateService.getRequestablePayoutsService(uid);

        return res.status(200).json({
            success: true,
            data: payoutData
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

module.exports.requestPayout = requestPayout;
module.exports.getPayoutHistory = getPayoutHistory;
module.exports.getPendingPayoutAvailable = getPendingPayoutAvailable;
module.exports.getRequestablePayouts = getRequestablePayouts;

// Cancel a pending payout request
const cancelPayout = async (req, res) => {
    try {
        const { uid } = req.user;
        const { txnID } = req.body;

        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }
        if (!txnID) {
            return res.status(400).json({ error: 'txnID is required' });
        }

        // Fetch the payout transaction and ensure it belongs to user and is pending
        const [rows] = await db.execute(
            `SELECT amount, status FROM affiliateTransactions WHERE uid = ? AND txnID = ? LIMIT 1`,
            [uid, txnID]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Payout request not found' });
        }

        const txn = rows[0];
        if (txn.status !== 'pending') {
            return res.status(400).json({ success: false, error: 'Only pending payouts can be cancelled' });
        }

        const amount = Number(txn.amount) || 0;

        // Begin cancellation: delete the transaction row and revert user's pendingPayment
        await db.execute(
            `DELETE FROM affiliateTransactions WHERE uid = ? AND txnID = ? AND status = 'pending'`,
            [uid, txnID]
        );

        await db.execute(
            `UPDATE users SET pendingPayment = COALESCE(pendingPayment, 0) + ? WHERE uid = ?`,
            [amount, uid]
        );

        return res.status(200).json({ success: true, data: { txnID, deleted: true, amount } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// Admin: Get all payout requests
const getPayoutRequests = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;

        const result = await affiliateService.getPayoutRequestsService({
            page: parseInt(page),
            limit: parseInt(limit),
            status
        });

        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// Admin: Approve payout request
const approvePayout = async (req, res) => {
    try {
        const { txnID } = req.params;

        if (!txnID) {
            return res.status(400).json({ error: 'Transaction ID is required' });
        }

        const result = await affiliateService.approvePayoutService(txnID);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Payout approved successfully',
                data: result.data
            });
        } else {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// Admin: Reject payout request
const rejectPayout = async (req, res) => {
    try {
        const { txnID } = req.params;

        if (!txnID) {
            return res.status(400).json({ error: 'Transaction ID is required' });
        }

        const result = await affiliateService.rejectPayoutService(txnID);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Payout rejected successfully',
                data: result.data
            });
        } else {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

module.exports.cancelPayout = cancelPayout;
module.exports.getPayoutRequests = getPayoutRequests;
module.exports.approvePayout = approvePayout;
module.exports.rejectPayout = rejectPayout;
