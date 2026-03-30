const express = require('express');
const router = express.Router();
const settlementController = require('../../controllers/settlementController');
const authBrandMiddleware = require('../../middleware/authBrandMiddleware');

router.get('/settlements', authBrandMiddleware.verifyAccessToken, settlementController.getMySettlements);
router.get('/settlements/:brandID/:month', authBrandMiddleware.verifyAccessToken, settlementController.getSettlementDetail);

module.exports = router;
