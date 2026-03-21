const express = require('express');
const router = express.Router();
const reelsController = require('../controllers/reelsController');

// All routes are prefixed with /api/reels (in index.js)
router.get('/active', reelsController.listReelsPublic);

module.exports = router;
