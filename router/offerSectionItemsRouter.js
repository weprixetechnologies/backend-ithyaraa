const express = require('express');
const router = express.Router();
const controller = require('../controllers/offerSectionItemsController');
const authAdminMiddleware = require('../middleware/authAdminMiddleware');

// List items
router.get('/', authAdminMiddleware.verifyAccessToken, controller.getItems);

// Create item
router.post('/', authAdminMiddleware.verifyAccessToken, controller.createItem);

// Reorder items
router.patch('/reorder', authAdminMiddleware.verifyAccessToken, controller.reorderItems);

// Clear cache
router.delete('/cache', authAdminMiddleware.verifyAccessToken, controller.clearCache);

// Get single item
router.get('/:id', authAdminMiddleware.verifyAccessToken, controller.getItem);

// Update item
router.put('/:id', authAdminMiddleware.verifyAccessToken, controller.updateItem);

// Delete item
router.delete('/:id', authAdminMiddleware.verifyAccessToken, controller.deleteItem);

module.exports = router;
