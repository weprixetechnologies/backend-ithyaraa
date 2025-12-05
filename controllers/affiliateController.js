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

        // Check if user has an approved bank account
        const defaultBankAccount = await affiliateService.getDefaultBankAccountService(uid);
        if (!defaultBankAccount) {
            return res.status(400).json({ 
                error: 'Please add and get approval for a bank account before requesting payout' 
            });
        }

        // Create payout request using createAffiliate function
        const txnID = require('crypto').randomUUID();
        await affiliateService.createAffiliate({
            txnID,
            uid,
            status: 'pending',
            amount: amount,
            type: 'outgoing',
            bankAccountID: defaultBankAccount.bankAccountID
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

// ==================== Bank Account Controllers ====================

// User: Add bank account
const addBankAccount = async (req, res) => {
    try {
        const { uid } = req.user;
        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        const {
            accountHolderName,
            accountNumber,
            ifscCode,
            bankName,
            branchName,
            accountType = 'savings',
            panNumber,
            gstin,
            address,
            isDefault = false
        } = req.body;

        // Validation
        if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
            return res.status(400).json({ error: 'Account holder name, account number, IFSC code, and bank name are required' });
        }

        // Validate IFSC format (11 characters)
        if (ifscCode.length !== 11) {
            return res.status(400).json({ error: 'IFSC code must be 11 characters' });
        }

        const result = await affiliateService.createBankAccountService({
            uid,
            accountHolderName,
            accountNumber,
            ifscCode: ifscCode.toUpperCase(),
            bankName,
            branchName,
            accountType,
            panNumber,
            gstin,
            address,
            isDefault
        });

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Bank account added successfully. It will be reviewed by admin.',
                data: result.data
            });
        } else {
            return res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// User: Get bank accounts
const getBankAccounts = async (req, res) => {
    try {
        const { uid } = req.user;
        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        const includeRejected = req.query.includeRejected === 'true';
        const accounts = await affiliateService.getBankAccountsService(uid, includeRejected);

        return res.status(200).json({
            success: true,
            data: accounts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// User: Get single bank account
const getBankAccount = async (req, res) => {
    try {
        const { uid } = req.user;
        const { bankAccountID } = req.params;

        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        const account = await affiliateService.getBankAccountByIdService(bankAccountID, uid);

        if (!account) {
            return res.status(404).json({ success: false, error: 'Bank account not found' });
        }

        return res.status(200).json({
            success: true,
            data: account
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// User: Set default bank account
const setDefaultBankAccount = async (req, res) => {
    try {
        const { uid } = req.user;
        const { bankAccountID } = req.body;

        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        if (!bankAccountID) {
            return res.status(400).json({ error: 'Bank account ID is required' });
        }

        const result = await affiliateService.setDefaultBankAccountService(bankAccountID, uid);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Default bank account updated successfully'
            });
        } else {
            return res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// User: Delete bank account
const deleteBankAccount = async (req, res) => {
    try {
        const { uid } = req.user;
        const { bankAccountID } = req.params;

        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        const result = await affiliateService.deleteBankAccountService(bankAccountID, uid);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Bank account deleted successfully'
            });
        } else {
            return res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// Admin: Get all bank account requests
const getAllBankAccountRequests = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, uid } = req.query;

        const result = await affiliateService.getAllBankAccountRequestsService({
            page: parseInt(page),
            limit: parseInt(limit),
            status,
            uid
        });

        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// Admin: Approve bank account
const approveBankAccount = async (req, res) => {
    try {
        const { bankAccountID } = req.params;
        const { uid: adminUID } = req.user;

        if (!bankAccountID) {
            return res.status(400).json({ error: 'Bank account ID is required' });
        }

        const result = await affiliateService.approveBankAccountService(bankAccountID, adminUID);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Bank account approved successfully',
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

// Admin: Reject bank account
const rejectBankAccount = async (req, res) => {
    try {
        const { bankAccountID } = req.params;
        const { uid: adminUID } = req.user;
        const { rejectionReason } = req.body;

        if (!bankAccountID) {
            return res.status(400).json({ error: 'Bank account ID is required' });
        }

        const result = await affiliateService.rejectBankAccountService(bankAccountID, adminUID, rejectionReason);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Bank account rejected successfully',
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

module.exports.addBankAccount = addBankAccount;
module.exports.getBankAccounts = getBankAccounts;
module.exports.getBankAccount = getBankAccount;
module.exports.setDefaultBankAccount = setDefaultBankAccount;
module.exports.deleteBankAccount = deleteBankAccount;
module.exports.getAllBankAccountRequests = getAllBankAccountRequests;
module.exports.approveBankAccount = approveBankAccount;
module.exports.rejectBankAccount = rejectBankAccount;
