const express = require('express');
const router = express.Router();
const sliderBannersController = require('../controllers/sliderBannersController');
const authAdminMiddleware = require('../middleware/authAdminMiddleware');

// Public route – for frontend (ISR-friendly)
router.get('/active', sliderBannersController.getActive);

// Admin routes
router.get('/', authAdminMiddleware.verifyAccessToken, sliderBannersController.getAll);
router.post('/', authAdminMiddleware.verifyAccessToken, sliderBannersController.create);
router.delete('/:id', authAdminMiddleware.verifyAccessToken, sliderBannersController.remove);
router.put('/:id', authAdminMiddleware.verifyAccessToken, sliderBannersController.update);
router.post('/reorder', authAdminMiddleware.verifyAccessToken, sliderBannersController.reorder);

module.exports = router;
