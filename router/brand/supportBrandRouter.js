const express = require('express');
const router = express.Router();
const supportController = require('../../controllers/supportController');
const authBrandMiddleware = require('../../middleware/authBrandMiddleware');

router.get('/topics', supportController.getTopics);

router.post('/tickets', authBrandMiddleware.verifyAccessToken, supportController.raiseTicket);
router.get('/tickets', authBrandMiddleware.verifyAccessToken, supportController.getMyTickets);
router.get('/tickets/:ticketNo', authBrandMiddleware.verifyAccessToken, supportController.getTicketDetail);
router.get('/unread-count', authBrandMiddleware.verifyAccessToken, supportController.getUnreadCount);
router.post('/tickets/:ticketNo/replies', authBrandMiddleware.verifyAccessToken, supportController.replyToTicket);

module.exports = router;
