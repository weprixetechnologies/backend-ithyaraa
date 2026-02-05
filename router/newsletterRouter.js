const express = require('express');
const router = express.Router();
const controller = require('../controllers/newsletterController');

// Public newsletter APIs
router.post('/subscribe', controller.subscribe);
router.get('/status', controller.getStatus);
router.get('/', controller.listNewsletters);
router.post('/unsubscribe', controller.unsubscribe);

module.exports = router;

