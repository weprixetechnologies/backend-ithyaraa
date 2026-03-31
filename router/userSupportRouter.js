const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const authMiddleware = require('../middleware/authUserMiddleware');

router.get('/topics', supportController.getTopics);

router.post('/tickets', authMiddleware.verifyAccessToken, supportController.raiseTicket);
router.get('/tickets', authMiddleware.verifyAccessToken, supportController.getMyTickets);
router.get('/tickets/:ticketNo', authMiddleware.verifyAccessToken, supportController.getTicketDetail);
router.get('/unread-count', authMiddleware.verifyAccessToken, supportController.getUnreadCount);
router.post('/tickets/:ticketNo/replies', authMiddleware.verifyAccessToken, supportController.replyToTicket);

module.exports = router;
