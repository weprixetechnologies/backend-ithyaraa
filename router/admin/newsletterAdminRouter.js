const express = require('express');
const router = express.Router();
const controller = require('../../controllers/adminNewsletterController');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');

// All admin newsletter routes require admin access token
router.get('/newsletter/subscribers', authAdminMiddleware.verifyAccessToken, controller.listSubscribers);
router.get('/newsletters', authAdminMiddleware.verifyAccessToken, controller.listNewsletters);
router.post('/newsletters', authAdminMiddleware.verifyAccessToken, controller.createNewsletter);
router.post('/newsletters/:id/send', authAdminMiddleware.verifyAccessToken, controller.sendNewsletter);
router.get('/newsletters/:id/stats', authAdminMiddleware.verifyAccessToken, controller.getNewsletterStats);

module.exports = router;

