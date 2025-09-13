const model = require('../model/wishlistModel');

// Add product to wishlist service
const addToWishlistService = async (uid, productID) => {
    try {
        // Validate input parameters
        if (!uid || !productID) {
            return {
                success: false,
                message: 'Missing required parameters: uid and productID are required'
            };
        }

        // First, verify that the product exists and get its type
        const productResult = await model.getProductType(productID);
        if (!productResult.success) {
            return {
                success: false,
                message: productResult.message || 'Product not found',
                error: productResult.error
            };
        }

        const productType = productResult.type;

        // Create or get user's wishlist
        const wishlistResult = await model.createOrGetWishlist(uid);
        if (!wishlistResult.success) {
            return {
                success: false,
                message: 'Failed to create or get wishlist',
                error: wishlistResult.error
            };
        }

        // Add item to wishlist
        const addItemResult = await model.addItemToWishlist(
            wishlistResult.wishlistID,
            uid,
            productID,
            productType
        );

        if (!addItemResult.success) {
            return {
                success: false,
                message: addItemResult.message || 'Failed to add item to wishlist',
                alreadyExists: addItemResult.alreadyExists || false,
                error: addItemResult.error
            };
        }

        return {
            success: true,
            message: addItemResult.message,
            wishlistID: wishlistResult.wishlistID,
            wishlistItemID: addItemResult.wishlistItemID,
            isNewWishlist: wishlistResult.isNew
        };

    } catch (error) {
        console.error('Error in addToWishlistService:', error);
        return {
            success: false,
            message: 'Internal server error',
            error: error.message
        };
    }
};

// Get user's wishlist service
const getWishlistService = async (uid) => {
    try {
        if (!uid) {
            return {
                success: false,
                message: 'User ID is required'
            };
        }

        const result = await model.getWishlistItems(uid);

        if (!result.success) {
            return {
                success: false,
                message: 'Failed to get wishlist items',
                error: result.error
            };
        }

        return {
            success: true,
            items: result.items,
            count: result.items.length
        };

    } catch (error) {
        console.error('Error in getWishlistService:', error);
        return {
            success: false,
            message: 'Internal server error',
            error: error.message
        };
    }
};

// Remove item from wishlist service
const removeFromWishlistService = async (uid, wishlistItemID) => {
    try {
        if (!uid || !wishlistItemID) {
            return {
                success: false,
                message: 'User ID and wishlist item ID are required'
            };
        }

        const result = await model.removeItemFromWishlist(wishlistItemID, uid);

        if (!result.success) {
            return {
                success: false,
                message: result.message || 'Failed to remove item from wishlist',
                error: result.error
            };
        }

        return {
            success: true,
            message: result.message
        };

    } catch (error) {
        console.error('Error in removeFromWishlistService:', error);
        return {
            success: false,
            message: 'Internal server error',
            error: error.message
        };
    }
};

// Remove item from wishlist by productID service
const removeByProductIDService = async (uid, productID) => {
    try {
        if (!uid || !productID) {
            return {
                success: false,
                message: 'User ID and product ID are required'
            };
        }

        const result = await model.removeItemByProductID(productID, uid);

        if (!result.success) {
            return {
                success: false,
                message: result.message || 'Failed to remove product from wishlist',
                error: result.error
            };
        }

        return {
            success: true,
            message: result.message,
            removedCount: result.removedCount
        };

    } catch (error) {
        console.error('Error in removeByProductIDService:', error);
        return {
            success: false,
            message: 'Internal server error',
            error: error.message
        };
    }
};

// Check if product is in wishlist service
const checkWishlistService = async (uid, productID) => {
    try {
        if (!uid || !productID) {
            return {
                success: false,
                message: 'User ID and product ID are required'
            };
        }

        const result = await model.isProductInWishlist(uid, productID);

        if (!result.success) {
            return {
                success: false,
                message: 'Failed to check wishlist status',
                error: result.error
            };
        }

        return {
            success: true,
            exists: result.exists,
            wishlistItemID: result.wishlistItemID
        };

    } catch (error) {
        console.error('Error in checkWishlistService:', error);
        return {
            success: false,
            message: 'Internal server error',
            error: error.message
        };
    }
};

module.exports = {
    addToWishlistService,
    getWishlistService,
    removeFromWishlistService,
    removeByProductIDService,
    checkWishlistService
};
