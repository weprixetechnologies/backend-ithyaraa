const express = require('express');
const router = express.Router();
const presaleDetailsController = require('../../controllers/presaleDetailsController');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');

// Presale Group Routes
router.post('/add', authAdminMiddleware.verifyAccessToken, presaleDetailsController.createPresaleGroupController);
router.get('/all', authAdminMiddleware.verifyAccessToken, presaleDetailsController.getAllPresaleGroupsController);
router.get('/:presaleGroupID', authAdminMiddleware.verifyAccessToken, presaleDetailsController.getPresaleGroupByIDController);
router.put('/:presaleGroupID', authAdminMiddleware.verifyAccessToken, presaleDetailsController.updatePresaleGroupController);
router.delete('/:presaleGroupID', authAdminMiddleware.verifyAccessToken, presaleDetailsController.deletePresaleGroupController);

module.exports = router;

