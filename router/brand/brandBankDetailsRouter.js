const express = require('express');
const router = express.Router();
const brandBankDetailsController = require('../../controllers/brandBankDetailsController');
const authBrandMiddleware = require('../../middleware/authBrandMiddleware');

// Get bank details for current brand
router.get('/bank-details', authBrandMiddleware.verifyAccessToken, (req, res) => {
    req.params.brandID = req.user.uid;
    return brandBankDetailsController.getBankDetailsByBrandID(req, res);
});

// Get active bank details for current brand
router.get('/bank-details/active', authBrandMiddleware.verifyAccessToken, (req, res) => {
    req.params.brandID = req.user.uid;
    return brandBankDetailsController.getActiveBankDetails(req, res);
});

// Add bank details (will be pending)
router.post('/bank-details', authBrandMiddleware.verifyAccessToken, brandBankDetailsController.addBankDetails);

// Get bank details by ID (for current brand only)
router.get('/bank-details/:bankDetailID', authBrandMiddleware.verifyAccessToken, brandBankDetailsController.getBankDetailsByID);

// Update bank details
router.put('/bank-details/:bankDetailID', authBrandMiddleware.verifyAccessToken, brandBankDetailsController.updateBankDetails);

module.exports = router;

