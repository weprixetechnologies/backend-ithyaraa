const express = require('express');
const affiliateRouter = express.Router();
const affiliateController = require('./../controllers/affiliateController')
const authAdminMiddleware = require('./../middleware/authAdminMiddleware')

affiliateRouter.post('/apply-affiliate', authAdminMiddleware.verifyAccessToken, affiliateController.applyAffiliate);
affiliateRouter.post('/approve-affiliate', authAdminMiddleware.verifyAccessToken, affiliateController.approveAffiliate);
affiliateRouter.get('/transactions', authAdminMiddleware.verifyAccessToken, affiliateController.getAllTransactions);
affiliateRouter.get('/orders', authAdminMiddleware.verifyAccessToken, affiliateController.getAffiliatedOrders);
affiliateRouter.get('/analytics', authAdminMiddleware.verifyAccessToken, affiliateController.getAffiliateAnalytics);
affiliateRouter.get('/payout-history', authAdminMiddleware.verifyAccessToken, affiliateController.getPayoutHistory);
affiliateRouter.get('/pending-payout-available', authAdminMiddleware.verifyAccessToken, affiliateController.getPendingPayoutAvailable);
affiliateRouter.get('/requestable-payouts', authAdminMiddleware.verifyAccessToken, affiliateController.getRequestablePayouts);
affiliateRouter.post('/request-payout', authAdminMiddleware.verifyAccessToken, affiliateController.requestPayout);
affiliateRouter.post('/cancel-payout', authAdminMiddleware.verifyAccessToken, affiliateController.cancelPayout);

// Admin routes for payout management
affiliateRouter.get('/payout-requests', authAdminMiddleware.verifyAccessToken, affiliateController.getPayoutRequests);
affiliateRouter.put('/approve-payout/:txnID', authAdminMiddleware.verifyAccessToken, affiliateController.approvePayout);
affiliateRouter.put('/reject-payout/:txnID', authAdminMiddleware.verifyAccessToken, affiliateController.rejectPayout);

// User routes for bank account management
affiliateRouter.post('/bank-account', authAdminMiddleware.verifyAccessToken, affiliateController.addBankAccount);
affiliateRouter.get('/bank-accounts', authAdminMiddleware.verifyAccessToken, affiliateController.getBankAccounts);
affiliateRouter.get('/bank-account/:bankAccountID', authAdminMiddleware.verifyAccessToken, affiliateController.getBankAccount);
affiliateRouter.put('/bank-account/set-default', authAdminMiddleware.verifyAccessToken, affiliateController.setDefaultBankAccount);
affiliateRouter.delete('/bank-account/:bankAccountID', authAdminMiddleware.verifyAccessToken, affiliateController.deleteBankAccount);

// Admin routes for bank account management
affiliateRouter.get('/admin/bank-accounts', authAdminMiddleware.verifyAccessToken, affiliateController.getAllBankAccountRequests);
affiliateRouter.put('/admin/bank-account/:bankAccountID/approve', authAdminMiddleware.verifyAccessToken, affiliateController.approveBankAccount);
affiliateRouter.put('/admin/bank-account/:bankAccountID/reject', authAdminMiddleware.verifyAccessToken, affiliateController.rejectBankAccount);

module.exports = affiliateRouter