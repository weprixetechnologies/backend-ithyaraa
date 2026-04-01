const express = require('express');
const router = express.Router();
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');
const adminAffiliateController = require('../../controllers/adminAffiliateController');

router.get('/affiliates', authAdminMiddleware.verifyAccessToken, adminAffiliateController.listAffiliates);
router.get('/affiliates/transactions/statuses', authAdminMiddleware.verifyAccessToken, adminAffiliateController.getTransactionStatuses);
router.post('/affiliates/transactions/manual', authAdminMiddleware.verifyAccessToken, adminAffiliateController.createManualTransaction);
router.put('/affiliates/transactions/:txnID/status', authAdminMiddleware.verifyAccessToken, adminAffiliateController.updateTransactionStatus);
router.put('/affiliates/:uid/commission', authAdminMiddleware.verifyAccessToken, adminAffiliateController.updateCommissionPercentage);
router.get('/affiliates/:uid', authAdminMiddleware.verifyAccessToken, adminAffiliateController.getAffiliateByUid);
router.put('/affiliates/:uid/approve', authAdminMiddleware.verifyAccessToken, adminAffiliateController.approveAffiliate);
router.put('/affiliates/:uid/reject', authAdminMiddleware.verifyAccessToken, adminAffiliateController.rejectAffiliate);

module.exports = router;
