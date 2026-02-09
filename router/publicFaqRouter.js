const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');

// GET /api/public/faqs - active FAQs only, cached, minimal JSON
router.get('/faqs', faqController.listPublic);

module.exports = router;
