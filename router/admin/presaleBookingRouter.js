const express = require('express');
const router = express.Router();
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');
const presaleBookingController = require('../../controllers/presaleBookingController');

// Admin routes for presale bookings (requires admin authentication)
router.get('/all', authAdminMiddleware.verifyAccessToken, presaleBookingController.getAllPresaleBookingsController);
router.post('/bulk-recheck-payment-status', authAdminMiddleware.verifyAccessToken, presaleBookingController.bulkRecheckPresalePaymentStatusController);
router.get('/:preBookingID', authAdminMiddleware.verifyAccessToken, presaleBookingController.getAdminPresaleBookingDetailsController);
router.put('/update-status/:preBookingID', authAdminMiddleware.verifyAccessToken, presaleBookingController.updatePresaleBookingStatusController);
router.put('/update-payment-status/:preBookingID', authAdminMiddleware.verifyAccessToken, presaleBookingController.updatePresaleBookingPaymentStatusController);
router.put('/update-tracking/:preBookingID', authAdminMiddleware.verifyAccessToken, presaleBookingController.updatePresaleBookingTrackingController);

module.exports = router;

