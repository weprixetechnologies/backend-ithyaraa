const express = require('express');
const affiliateRouter = express.Router();
const affiliateController = require('./../controllers/affiliateController')
const authAdminMiddleware = require('./../middleware/authAdminMiddleware')

affiliateRouter.post('/apply-affiliate', authAdminMiddleware.verifyAccessToken, affiliateController.applyAffiliate);
affiliateRouter.post('/approve-affiliate', authAdminMiddleware.verifyAccessToken, affiliateController.approveAffiliate);

module.exports = affiliateRouter 