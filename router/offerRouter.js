const express = require('express');
const router = express.Router();
const controller = require('../controllers/offerController');

router.get('/offerpage-app', controller.getOfferPageFeed);

module.exports = router;
