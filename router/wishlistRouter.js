const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authAdminMiddleware');
const wishlistController = require('../controllers/wishlistController');

router.post('/add', authMiddleware.verifyAccessToken, wishlistController.addWishlist);
router.delete('/remove', authMiddleware.verifyAccessToken, wishlistController.removeWishlist);
router.get('/get-wishlist', authMiddleware.verifyAccessToken, wishlistController.getWishlist);

module.exports = router;
