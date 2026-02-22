const express = require('express');
const router = express.Router();
const controller = require('../controllers/sectionItemsController');
const authAdminMiddleware = require('../middleware/authAdminMiddleware');

// Public GET
router.get('/', controller.getItems);

// Admin create
router.post('/', authAdminMiddleware.verifyAccessToken, controller.createItem);
// Admin reorder
router.patch('/reorder', authAdminMiddleware.verifyAccessToken, controller.reorderItems);
// Admin: clear home cache (must come before param routes)
router.delete('/cache', authAdminMiddleware.verifyAccessToken, controller.clearCache);
// Admin get single
router.get('/:id', authAdminMiddleware.verifyAccessToken, controller.getItem);
// Admin update
router.put('/:id', authAdminMiddleware.verifyAccessToken, controller.updateItem);
// Admin delete
router.delete('/:id', authAdminMiddleware.verifyAccessToken, controller.deleteItem);

module.exports = router;

