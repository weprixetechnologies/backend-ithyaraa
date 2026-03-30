const express = require('express');
const router = express.Router();
const settlementController = require('../../controllers/settlementController');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');

router.get('/settlements', authAdminMiddleware.verifyAccessToken, settlementController.getAllSettlements);
router.get('/settlements/:brandID/:month', authAdminMiddleware.verifyAccessToken, settlementController.getSettlementDetail);
router.post('/settlements/:id/pay', authAdminMiddleware.verifyAccessToken, settlementController.recordPayment);
router.post('/settlements/ledger/:id/clear-window', authAdminMiddleware.verifyAccessToken, settlementController.manualClearWindow);
router.post('/settlements/manual-check', authAdminMiddleware.verifyAccessToken, settlementController.runCheckManually);

module.exports = router;
