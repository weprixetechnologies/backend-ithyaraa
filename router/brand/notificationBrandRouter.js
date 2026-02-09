const express = require('express');
const router = express.Router();
const authBrandMiddleware = require('../../middleware/authBrandMiddleware');
const notificationBrandController = require('../../controllers/notificationBrandController');

// Brand notifications inbox
router.get(
  '/notifications',
  authBrandMiddleware.verifyAccessToken,
  notificationBrandController.listNotificationsForBrand
);

router.get(
  '/notifications/unread-count',
  authBrandMiddleware.verifyAccessToken,
  notificationBrandController.getUnreadCountForBrand
);

router.get(
  '/notifications/:id',
  authBrandMiddleware.verifyAccessToken,
  notificationBrandController.getNotificationDetailForBrand
);

module.exports = router;

