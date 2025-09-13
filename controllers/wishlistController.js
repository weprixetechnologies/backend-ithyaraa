const service = require('../services/wishlistService');

// Add product to wishlist
const addToWishlist = async (req, res) => {
    try {
        const { productID } = req.body;
        const uid = req.user.uid; // From auth middleware

        console.log('Add to wishlist request:', { uid, productID });

        // Validate required fields
        if (!productID) {
            return res.status(400).json({
                success: false,
                message: 'productID is required'
            });
        }

        // Call service to add to wishlist
        const result = await service.addToWishlistService(uid, productID);

        if (!result.success) {
            // Handle case where product already exists in wishlist
            if (result.alreadyExists) {
                return res.status(409).json({
                    success: false,
                    message: result.message,
                    alreadyExists: true
                });
            }

            return res.status(500).json({
                success: false,
                message: result.message,
                error: result.error
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                wishlistID: result.wishlistID,
                wishlistItemID: result.wishlistItemID,
                isNewWishlist: result.isNewWishlist
            }
        });

    } catch (error) {
        console.error('Error in addToWishlist controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get user's wishlist
const getWishlist = async (req, res) => {
    console.log('Get wishlist request');

    try {
        const uid = req.user.uid; // From auth middleware

        console.log('Get wishlist request for user:', uid);

        const result = await service.getWishlistService(uid);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.message,
                error: result.error
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Wishlist retrieved successfully',
            data: {
                items: result.items,
                count: result.count
            }
        });

    } catch (error) {
        console.error('Error in getWishlist controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Remove item from wishlist
const removeFromWishlist = async (req, res) => {
    try {
        const { wishlistItemID } = req.params;
        const uid = req.user.uid; // From auth middleware

        console.log('Remove from wishlist request:', { uid, wishlistItemID });

        if (!wishlistItemID) {
            return res.status(400).json({
                success: false,
                message: 'wishlistItemID is required'
            });
        }

        const result = await service.removeFromWishlistService(uid, wishlistItemID);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.message,
                error: result.error
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error('Error in removeFromWishlist controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Remove item from wishlist by productID
const removeByProductID = async (req, res) => {
    try {
        const { productID } = req.params;
        const uid = req.user.uid; // From auth middleware

        console.log('Remove by productID request:', { uid, productID });

        if (!productID) {
            return res.status(400).json({
                success: false,
                message: 'productID is required'
            });
        }

        const result = await service.removeByProductIDService(uid, productID);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.message,
                error: result.error
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                removedCount: result.removedCount
            }
        });

    } catch (error) {
        console.error('Error in removeByProductID controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Check if product is in wishlist
const checkWishlist = async (req, res) => {
    try {
        const { productID } = req.params;
        const uid = req.user.uid; // From auth middleware

        console.log('Check wishlist request:', { uid, productID });

        if (!productID) {
            return res.status(400).json({
                success: false,
                message: 'productID is required'
            });
        }

        const result = await service.checkWishlistService(uid, productID);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.message,
                error: result.error
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Wishlist status checked successfully',
            data: {
                exists: result.exists,
                wishlistItemID: result.wishlistItemID
            }
        });

    } catch (error) {
        console.error('Error in checkWishlist controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    addToWishlist,
    getWishlist,
    removeFromWishlist,
    removeByProductID,
    checkWishlist
};
