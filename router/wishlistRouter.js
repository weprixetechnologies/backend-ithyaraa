const express = require('express');
const router = express.Router();
const { verifyAccessToken } = require('../middleware/authUserMiddleware');
const wishlistController = require('../controllers/wishlistController');

// All wishlist routes require authentication
router.use(verifyAccessToken);

// Add product to wishlist
router.post('/add-wishlist', wishlistController.addToWishlist);

// Get user's wishlist
router.get('/get-wishlist', wishlistController.getWishlist);

// Check if product is in wishlist
router.get('/check/:productID', wishlistController.checkWishlist);

// Remove item from wishlist
router.delete('/remove/:wishlistItemID', wishlistController.removeFromWishlist);

// Remove item from wishlist by productID
router.delete('/remove-product/:productID', wishlistController.removeByProductID);

module.exports = router;
