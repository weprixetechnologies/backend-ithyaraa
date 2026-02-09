const affiliateModel = require('./../model/affiliateModel')
const { addSendEmailJob } = require('./../queue/emailProducer')

const applyAffiliateService = async (emailID, uid, otp) => {
    // You can verify OTP here if you have an OTP table or verification logic.
    // For now, we're just updating status directly.

    const result = await affiliateModel.updateAffiliateStatus(emailID, uid);

    if (result.affectedRows === 0) {
        throw new Error('User not found or update failed');
    }

    return { message: 'Affiliate status updated to pending' };
};

const approveAffiliateService = async (uid, emailID, phonenumber) => {
    const result = await affiliateModel.approveAffiliateByUID(uid);

    if (result.affectedRows === 0) {
        throw new Error('User not found or update failed');
    }


    await addSendEmailJob({
        to: emailID,
        templateName: 'login',
        variables: {
            emailID: emailID,
            phonenumber: phonenumber,
            time: new Date().toLocaleString()
        },
        subject: 'Account Created Successfully'
    });


    return { message: 'Affiliate approved successfully' };
};

const getAllAffiliateTransactions = async (uid, filters = {}) => {
    return await affiliateModel.getAffiliateTransactions(uid, filters);
};

const getAffiliatedOrdersService = async (uid, filters = {}) => {
    return await affiliateModel.getAffiliateOrdersByReferrer(uid, filters);
};

const getAffiliateAnalyticsService = async (uid) => {
    return await affiliateModel.getAffiliateAnalytics(uid);
};

const getAffiliateDetailsService = async (uid) => {
    return await affiliateModel.getAffiliateDetails(uid);
};

const createAffiliate = async (affiliateData) => {
    return await affiliateModel.createAffiliateTransaction(affiliateData);
};

const getPayoutHistoryService = async (uid) => {
    return await affiliateModel.getPayoutHistory(uid);
};

const getRequestedPayoutAmountService = async (uid) => {
    return await affiliateModel.getRequestedPayoutAmount(uid);
};

const getPendingPayoutAvailableService = async (uid) => {
    return await affiliateModel.getPendingPayoutAvailable(uid);
};

const getRequestablePayoutsService = async (uid) => {
    return await affiliateModel.getRequestablePayouts(uid);
};

const getLockedBreakdownService = async (uid) => {
    return await affiliateModel.getLockedAffiliateBreakdown(uid);
};

const getPayoutRequestsService = async (filters) => {
    return await affiliateModel.getPayoutRequests(filters);
};

const approvePayoutService = async (txnID) => {
    return await affiliateModel.approvePayout(txnID);
};

const rejectPayoutService = async (txnID) => {
    return await affiliateModel.rejectPayout(txnID);
};

// Bank Account Services
const createBankAccountService = async (bankAccountData) => {
    return await affiliateModel.createBankAccount(bankAccountData);
};

const getBankAccountsService = async (uid, includeRejected = false) => {
    return await affiliateModel.getBankAccounts(uid, includeRejected);
};

const getBankAccountByIdService = async (bankAccountID, uid) => {
    return await affiliateModel.getBankAccountById(bankAccountID, uid);
};

const setDefaultBankAccountService = async (bankAccountID, uid) => {
    return await affiliateModel.setDefaultBankAccount(bankAccountID, uid);
};

const deleteBankAccountService = async (bankAccountID, uid) => {
    return await affiliateModel.deleteBankAccount(bankAccountID, uid);
};

const getAllBankAccountRequestsService = async (filters) => {
    return await affiliateModel.getAllBankAccountRequests(filters);
};

const approveBankAccountService = async (bankAccountID, adminUID) => {
    return await affiliateModel.approveBankAccount(bankAccountID, adminUID);
};

const rejectBankAccountService = async (bankAccountID, adminUID, rejectionReason) => {
    return await affiliateModel.rejectBankAccount(bankAccountID, adminUID, rejectionReason);
};

const getDefaultBankAccountService = async (uid) => {
    return await affiliateModel.getDefaultBankAccount(uid);
};

// Admin: List affiliates with filters and pagination
const getAffiliateListService = async (filters) => {
    return await affiliateModel.getAffiliateList(filters);
};

// Admin: Get full affiliate detail by uid (user + analytics + transactions + orders + payout history + bank accounts)
const getAffiliateDetailForAdminService = async (uid) => {
    const [user, analytics, transactions, orders, payoutHistory, bankAccounts] = await Promise.all([
        require('./usersService').getUserByuid(uid),
        affiliateModel.getAffiliateAnalytics(uid),
        affiliateModel.getAffiliateTransactions(uid, { page: 1, limit: 20 }),
        affiliateModel.getAffiliateOrdersByReferrer(uid, { page: 1, limit: 20 }),
        affiliateModel.getPayoutHistory(uid),
        affiliateModel.getBankAccounts(uid, true)
    ]);
    return {
        user,
        analytics,
        transactions: transactions?.data || [],
        transactionsPagination: { total: transactions?.total, page: transactions?.page, limit: transactions?.limit },
        orders: orders?.data || [],
        ordersPagination: { total: orders?.total, page: orders?.page, limit: orders?.limit },
        payoutHistory: payoutHistory || [],
        bankAccounts: bankAccounts || []
    };
};

// Admin: Approve affiliate by uid
const adminApproveAffiliateService = async (uid) => {
    const result = await affiliateModel.approveAffiliateByUID(uid);
    return result;
};

// Admin: Reject affiliate by uid
const adminRejectAffiliateService = async (uid) => {
    const result = await affiliateModel.rejectAffiliateByUID(uid);
    return result;
};

// Admin: Update affiliate transaction status
const updateAffiliateTransactionStatusService = async (txnID, newStatus) => {
    return await affiliateModel.updateAffiliateTransactionStatus(txnID, newStatus);
};

// Admin: Create manual affiliate transaction (deduction or increase)
const createManualAffiliateTransactionService = async (payload) => {
    return await affiliateModel.createManualAffiliateTransaction(payload);
};

// Get allowed transaction statuses for admin
const getAffiliateTransactionStatusesService = () => {
    return affiliateModel.AFFILIATE_TXN_STATUS || [];
};

module.exports = {
    applyAffiliateService,
    approveAffiliateService,
    getAllAffiliateTransactions,
    getAffiliatedOrdersService,
    getAffiliateAnalyticsService,
    createAffiliate,
    getPayoutHistoryService,
    getRequestedPayoutAmountService,
    getPendingPayoutAvailableService,
    getRequestablePayoutsService,
    getLockedBreakdownService,
    getPayoutRequestsService,
    approvePayoutService,
    rejectPayoutService,
    createBankAccountService,
    getBankAccountsService,
    getBankAccountByIdService,
    setDefaultBankAccountService,
    deleteBankAccountService,
    getAllBankAccountRequestsService,
    approveBankAccountService,
    rejectBankAccountService,
    getDefaultBankAccountService,
    getAffiliateListService,
    getAffiliateDetailForAdminService,
    adminApproveAffiliateService,
    adminRejectAffiliateService,
    updateAffiliateTransactionStatusService,
    createManualAffiliateTransactionService,
    getAffiliateTransactionStatusesService
};