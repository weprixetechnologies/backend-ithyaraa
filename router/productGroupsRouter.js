const express = require('express');
const router = express.Router();
const controller = require('../controllers/productGroupsController');
const authAdminMiddleware = require('../middleware/authAdminMiddleware');

// NOTE: Test-only endpoints (no auth) - remove or protect in production
router.post('/_test/create', controller.createGroup);
router.post('/_test/:groupId/products', controller.addProducts);

// Admin: list groups (supports ?page=&limit=&sectionID=&includeProducts=true)
router.get('/', authAdminMiddleware.verifyAccessToken, controller.listGroups);

// Admin: list groups by section (alias)
router.get('/section/:sectionID', authAdminMiddleware.verifyAccessToken, controller.listGroups);

// Admin: create group
router.post('/', authAdminMiddleware.verifyAccessToken, controller.createGroup);

// Admin: add products to group (append)
router.post('/:groupId/products', authAdminMiddleware.verifyAccessToken, controller.addProducts);

// Admin: replace group products (delete all old, add new)
router.put('/:groupId/products', authAdminMiddleware.verifyAccessToken, controller.replaceProducts);

// Admin: get products for a group
router.get('/:groupId/products', authAdminMiddleware.verifyAccessToken, controller.getGroupProducts);

// Admin: edit group metadata
router.put('/:groupId', authAdminMiddleware.verifyAccessToken, controller.updateGroup);

// Admin: delete group
router.delete('/:groupId', authAdminMiddleware.verifyAccessToken, controller.deleteGroup);

// Admin: get group by id (with products)
router.get('/:groupId', authAdminMiddleware.verifyAccessToken, controller.getGroupByID);

module.exports = router;

