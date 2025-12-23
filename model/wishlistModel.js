const db = require('../utils/dbconnect');
const { generateUID } = require('../utils/uidUtils');

// Create or get user's wishlist
const createOrGetWishlist = async (uid) => {
    try {
        // First check if user already has a wishlist
        const [existingWishlist] = await db.query(
            'SELECT wishlistID FROM wishlistDetail WHERE uid = ?',
            [uid]
        );

        if (existingWishlist.length > 0) {
            return {
                success: true,
                wishlistID: existingWishlist[0].wishlistID,
                isNew: false
            };
        }

        // Create new wishlist if doesn't exist
        const wishlistID = `WL${generateUID()}`;

        await db.query(
            'INSERT INTO wishlistDetail (wishlistID, uid) VALUES (?, ?)',
            [wishlistID, uid]
        );

        return {
            success: true,
            wishlistID,
            isNew: true
        };
    } catch (error) {
        console.error('Error creating/getting wishlist:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Add item to wishlist
const addItemToWishlist = async (wishlistID, uid, productID, productType) => {
    try {
        // Check if item already exists in wishlist
        const [existingItem] = await db.query(
            'SELECT wishlistItemID FROM wishlist_items WHERE wishlistID = ? AND productID = ?',
            [wishlistID, productID]
        );

        if (existingItem.length > 0) {
            return {
                success: false,
                message: 'Product already exists in wishlist',
                alreadyExists: true
            };
        }

        // Add new item to wishlist
        const wishlistItemID = `WLI${generateUID()}`;

        await db.query(
            'INSERT INTO wishlist_items (wishlistItemID, wishlistID, uid, productID, productType) VALUES (?, ?, ?, ?, ?)',
            [wishlistItemID, wishlistID, uid, productID, productType]
        );

        return {
            success: true,
            wishlistItemID,
            message: 'Product added to wishlist successfully'
        };
    } catch (error) {
        console.error('Error adding item to wishlist:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Get user's wishlist items
const getWishlistItems = async (uid) => {
    try {
        const [items] = await db.query(`
            SELECT 
                wi.wishlistItemID,
                wi.productID,
                wi.productType,
                wi.createdAt as addedAt,
                p.name as productName,
                p.featuredImage,
                p.regularPrice,
                p.salePrice,
                p.discountType,
                p.discountValue
            FROM wishlist_items wi
            LEFT JOIN products p ON wi.productID = p.productID
            WHERE wi.uid = ?
            ORDER BY wi.createdAt DESC
        `, [uid]);

        // Parse JSON fields and format the response
        const formattedItems = items.map(item => {
            const formattedItem = { ...item };

            // Parse featuredImage JSON string
            if (formattedItem.featuredImage) {
                try {
                    formattedItem.featuredImage = JSON.parse(formattedItem.featuredImage);
                } catch (parseError) {
                    console.error('Error parsing featuredImage:', parseError);
                    // If parsing fails, keep as string or set to null
                    formattedItem.featuredImage = null;
                }
            }

            // Convert price strings to numbers
            if (formattedItem.regularPrice) {
                formattedItem.regularPrice = parseFloat(formattedItem.regularPrice);
            }
            if (formattedItem.salePrice) {
                formattedItem.salePrice = parseFloat(formattedItem.salePrice);
            }
            if (formattedItem.discountValue) {
                formattedItem.discountValue = parseFloat(formattedItem.discountValue);
            }

            return formattedItem;
        });

        return {
            success: true,
            items: formattedItems
        };
    } catch (error) {
        console.error('Error getting wishlist items:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Remove item from wishlist
const removeItemFromWishlist = async (wishlistItemID, uid) => {
    try {
        const [result] = await db.query(
            'DELETE FROM wishlist_items WHERE wishlistItemID = ? AND uid = ?',
            [wishlistItemID, uid]
        );

        if (result.affectedRows === 0) {
            return {
                success: false,
                message: 'Item not found in wishlist'
            };
        }

        return {
            success: true,
            message: 'Item removed from wishlist successfully'
        };
    } catch (error) {
        console.error('Error removing item from wishlist:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Remove item from wishlist by productID
const removeItemByProductID = async (productID, uid) => {
    try {
        const [result] = await db.query(
            'DELETE FROM wishlist_items WHERE productID = ? AND uid = ?',
            [productID, uid]
        );

        if (result.affectedRows === 0) {
            return {
                success: false,
                message: 'Product not found in wishlist'
            };
        }

        return {
            success: true,
            message: 'Product removed from wishlist successfully',
            removedCount: result.affectedRows
        };
    } catch (error) {
        console.error('Error removing item by productID:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Check if product exists in user's wishlist
const isProductInWishlist = async (uid, productID) => {
    try {
        const [result] = await db.query(
            'SELECT wishlistItemID FROM wishlist_items WHERE uid = ? AND productID = ?',
            [uid, productID]
        );

        return {
            success: true,
            exists: result.length > 0,
            wishlistItemID: result.length > 0 ? result[0].wishlistItemID : null
        };
    } catch (error) {
        console.error('Error checking wishlist:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Get product type from database
const getProductType = async (productID) => {
    try {
        const [rows] = await db.query(
            'SELECT type FROM products WHERE productID = ? LIMIT 1',
            [productID]
        );

        if (rows.length === 0) {
            return { success: false, message: 'Product not found' };
        }

        return {
            success: true,
            type: rows[0].type
        };

    } catch (error) {
        console.error('Error getting product type:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    createOrGetWishlist,
    addItemToWishlist,
    getWishlistItems,
    removeItemFromWishlist,
    removeItemByProductID,
    isProductInWishlist,
    getProductType
};
