const express = require('express');
const router = express.Router();
const adminSupportController = require('../../controllers/adminSupportController');
const adminTopicController = require('../../controllers/adminTopicController');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');

// Ticket Management
router.get('/support/tickets', authAdminMiddleware.verifyAccessToken, adminSupportController.getAdminTickets);
router.get('/support/tickets/:ticketNo', authAdminMiddleware.verifyAccessToken, adminSupportController.getAdminTicketDetail);
router.patch('/support/tickets/:ticketNo', authAdminMiddleware.verifyAccessToken, adminSupportController.patchTicket);
router.post('/support/tickets/:ticketNo/replies', authAdminMiddleware.verifyAccessToken, adminSupportController.adminReply);

// Topic Management
router.get('/support/topics', authAdminMiddleware.verifyAccessToken, adminTopicController.getAdminTopics);
router.post('/support/topics', authAdminMiddleware.verifyAccessToken, adminTopicController.createTopic);
router.patch('/support/topics/:id', authAdminMiddleware.verifyAccessToken, adminTopicController.patchTopic);
router.delete('/support/topics/:id', authAdminMiddleware.verifyAccessToken, adminTopicController.deleteTopic);

module.exports = router;
