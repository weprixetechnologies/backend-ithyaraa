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


module.exports = affiliateRouter