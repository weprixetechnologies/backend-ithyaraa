const express = require('express');
const router = express.Router();
const brandApplicationController = require('../controllers/brandApplicationController');

// Public route — no auth required
// POST /api/brand-applications/submit
router.post('/submit', brandApplicationController.submitApplication);

module.exports = router;
