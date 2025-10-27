const express = require('express');
const router = express.Router();
const brandBankDetailsController = require('../../controllers/brandBankDetailsController');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');

// Get all bank details
router.get('/bank-details', authAdminMiddleware.verifyAccessToken, brandBankDetailsController.getAllBankDetails);

// Get pending bank details
router.get('/bank-details/pending', authAdminMiddleware.verifyAccessToken, brandBankDetailsController.getPendingBankDetails);

// Get bank details by brand ID
router.get('/bank-details/:brandID/brand', authAdminMiddleware.verifyAccessToken, brandBankDetailsController.getBankDetailsByBrandID);

// Get bank details by ID
router.get('/bank-details/:bankDetailID', authAdminMiddleware.verifyAccessToken, brandBankDetailsController.getBankDetailsByID);

// Add bank details (admin can add directly as active)
router.post('/bank-details', authAdminMiddleware.verifyAccessToken, brandBankDetailsController.addBankDetails);

// Approve bank details
router.put('/bank-details/:bankDetailID/approve', authAdminMiddleware.verifyAccessToken, brandBankDetailsController.approveBankDetails);

// Reject bank details
router.put('/bank-details/:bankDetailID/reject', authAdminMiddleware.verifyAccessToken, brandBankDetailsController.rejectBankDetails);

// Update bank details
router.put('/bank-details/:bankDetailID', authAdminMiddleware.verifyAccessToken, brandBankDetailsController.updateBankDetails);

// Delete bank details
router.delete('/bank-details/:bankDetailID', authAdminMiddleware.verifyAccessToken, brandBankDetailsController.deleteBankDetails);

module.exports = router;

