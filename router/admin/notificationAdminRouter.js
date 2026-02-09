const express = require('express');
const router = express.Router();
const notificationAdminController = require('../../controllers/notificationAdminController');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');

// Admin notification composer + listing
router.post(
  '/notifications',
  authAdminMiddleware.verifyAccessToken,
  notificationAdminController.createNotification
);

router.get(
  '/notifications',
  authAdminMiddleware.verifyAccessToken,
  notificationAdminController.listNotifications
);

router.get(
  '/notifications/:id/deliveries',
  authAdminMiddleware.verifyAccessToken,
  notificationAdminController.getNotificationDeliveries
);

router.post(
  '/notifications/:id/resend-email',
  authAdminMiddleware.verifyAccessToken,
  notificationAdminController.resendNotificationEmail
);

module.exports = router;

