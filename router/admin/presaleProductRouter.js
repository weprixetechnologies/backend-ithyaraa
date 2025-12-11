const express = require('express');
const router = express.Router();
const presaleProductController = require('../../controllers/presaleProductController');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');

// Presale Product Routes
router.post('/add', authAdminMiddleware.verifyAccessToken, presaleProductController.createPresaleProductController);
router.get('/all', authAdminMiddleware.verifyAccessToken, presaleProductController.getAllPresaleProductsController);
router.get('/search', authAdminMiddleware.verifyAccessToken, presaleProductController.searchPresaleProductsController);
router.post('/bulk-delete', authAdminMiddleware.verifyAccessToken, presaleProductController.bulkDeletePresaleProductsController);
router.get('/:presaleProductID', authAdminMiddleware.verifyAccessToken, presaleProductController.getPresaleProductByIDController);
router.put('/:presaleProductID', authAdminMiddleware.verifyAccessToken, presaleProductController.updatePresaleProductController);
router.delete('/:presaleProductID', authAdminMiddleware.verifyAccessToken, presaleProductController.deletePresaleProductController);

module.exports = router;

