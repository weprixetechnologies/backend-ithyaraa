const express = require('express');
const affiliateRouter = express.Router();
const affiliateController = require('./../controllers/affiliateController')
const authAdminMiddleware = require('./../middleware/authAdminMiddleware')

affiliateRouter.post('/apply-affiliate', authAdminMiddleware.verifyAccessToken, affiliateController.applyAffiliate);
affiliateRouter.post('/approve-affiliate', authAdminMiddleware.verifyAccessToken, affiliateController.approveAffiliate);
affiliateRouter.get('/transactions', authAdminMiddleware.verifyAccessToken, affiliateController.getAllTransactions);

module.exports = affiliateRouter 