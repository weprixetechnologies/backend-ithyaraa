const express = require('express');
const router = express.Router();
const featuredBlocksController = require('../controllers/featuredBlocksController');
const authAdminMiddleware = require('../middleware/authAdminMiddleware');

// Public route – for frontend
router.get('/active', featuredBlocksController.getActive);

// Admin routes
router.get('/', authAdminMiddleware.verifyAccessToken, featuredBlocksController.getAll);
router.post('/', authAdminMiddleware.verifyAccessToken, featuredBlocksController.create);
router.delete('/:id', authAdminMiddleware.verifyAccessToken, featuredBlocksController.remove);
router.put('/:id', authAdminMiddleware.verifyAccessToken, featuredBlocksController.update);
router.post('/reorder', authAdminMiddleware.verifyAccessToken, featuredBlocksController.reorder);

module.exports = router;
