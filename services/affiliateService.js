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
    getDefaultBankAccountService
};