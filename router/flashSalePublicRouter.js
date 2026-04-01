const express = require('express');
const flashSalePublicRouter = express.Router();
const flashSalePublicController = require('../controllers/flashSalePublicController');

/**
 * Public route for fetching active flash sale products.
 * Optimized for high performance and live response.
 */
flashSalePublicRouter.get('/', flashSalePublicController.getFlashSaleProducts);

module.exports = flashSalePublicRouter;
